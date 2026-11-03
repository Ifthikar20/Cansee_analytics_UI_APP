// Keeps one transport per active run. SSE first; it reconnects with
// jittered backoff (base from the server's `retry:`, else 500 ms; cap 15 s),
// aborts a connection that sends no bytes for 45 s, and falls back to
// long-polling after 6 SSE failures or an UnsupportedTransport. Events are
// de-duplicated by seq and handed to the store in one batch per animation
// frame. A `resync` event pauses the transport while the store reloads the
// message snapshot, then resumes from its parts_seq. The session ends on a
// terminal event, a fatal error, or detach (which never cancels the run).
import { BACKOFF_BASE_MS, backoffDelay, sleep } from './backoff'
import { POLL_WAIT_SECONDS, pollRunEvents } from './poller'
import { OfflineError, TransportError, UnsupportedTransport, isAbortError, openRunStream } from './streamClient'
import { EVENT, TERMINAL_EVENT_TYPES, TRANSPORT_STATE } from './types'

export const WATCHDOG_MS = 45000
export const SSE_FAILURES_BEFORE_POLL = 6
export const MAX_CONSECUTIVE_RESYNCS = 3
// A poll that comes back empty faster than this waits before the next one,
// so a server that ignores `wait` cannot drive a hot loop.
export const MIN_EMPTY_POLL_MS = 1000

/** Run `fn` on the next animation frame, or after 100 ms when frames are paused (hidden tab). */
export function frameScheduler(fn) {
    let settled = false
    let raf = null
    const timer = setTimeout(run, 100)
    if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(run)
    function run() {
        if (settled) return
        settled = true
        cancel()
        fn()
    }
    function cancel() {
        clearTimeout(timer)
        if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
    }
    return () => {
        settled = true
        cancel()
    }
}

class RunSession {
    constructor(runId, lastSeq, deps, onDone) {
        this.runId = runId
        this.lastSeq = lastSeq
        this.deps = deps
        this.onDone = onDone
        this.queue = []
        this.cancelFlush = null
        this.stopped = false
        this.closed = false
        this.terminal = false
        this.error = null
        this.mode = 'sse'
        this.attempt = 0
        this.sseFailures = 0
        this.resyncs = 0
        this.retryBase = null
        this.pendingResync = null
        this.stopCtrl = new AbortController()
        this.connCtrl = null
        this.watchdogTimer = null
        this.watchdogFired = false
        this.done = null
    }

    start() {
        this.done = this.loop()
        return this.done
    }

    stop() {
        if (this.stopped) return
        this.stopped = true
        this.stopCtrl.abort()
        this.connCtrl?.abort()
        this.clearWatchdog()
        this.flush()
    }

    report(state) {
        this.deps.onTransport?.(this.runId, { state, mode: this.mode, attempt: this.attempt })
    }

    /** Queue new events; returns false when reading should stop (terminal or resync). */
    receive(events) {
        for (const event of events || []) {
            if (!event || typeof event !== 'object') continue
            if (event.type === EVENT.RESYNC) {
                this.pendingResync = event.reason || 'resync'
                break
            }
            const seq = Number(event.seq)
            if (Number.isFinite(seq) && seq > 0) {
                if (seq <= this.lastSeq) continue
                this.lastSeq = seq
            }
            this.queue.push(event)
            this.resyncs = 0
            if (TERMINAL_EVENT_TYPES.has(event.type)) {
                this.terminal = true
                break
            }
        }
        this.scheduleFlush()
        return !this.terminal && !this.pendingResync
    }

    scheduleFlush() {
        if (this.cancelFlush || !this.queue.length) return
        this.cancelFlush = this.deps.schedule(() => {
            this.cancelFlush = null
            this.flush()
        })
    }

    flush() {
        if (this.cancelFlush) {
            this.cancelFlush()
            this.cancelFlush = null
        }
        if (!this.queue.length) return
        const batch = this.queue
        this.queue = []
        try {
            this.deps.applyEvents?.(this.runId, batch)
        } catch (err) {
            console.error('[agent] applying run events failed', err)
        }
    }

    armWatchdog(ms = this.deps.watchdogMs) {
        this.clearWatchdog()
        this.watchdogTimer = setTimeout(() => {
            this.watchdogFired = true
            this.connCtrl?.abort()
        }, ms)
    }

    clearWatchdog() {
        if (this.watchdogTimer) clearTimeout(this.watchdogTimer)
        this.watchdogTimer = null
    }

    async loop() {
        try {
            while (!this.stopped && !this.terminal) {
                let failure = null
                try {
                    if (this.mode === 'sse') await this.readSse()
                    else await this.readPoll()
                } catch (err) {
                    if (this.stopped) break
                    const watchdog = this.watchdogFired
                    this.watchdogFired = false
                    if (err instanceof UnsupportedTransport) {
                        this.switchToPolling()
                        continue
                    }
                    if (isAbortError(err) && !watchdog) break
                    if (err && err.fatal) {
                        this.error = err
                        break
                    }
                    failure = err || new TransportError('transport failed')
                    if (err instanceof OfflineError) this.report(TRANSPORT_STATE.OFFLINE)
                    if (this.mode === 'sse') {
                        this.sseFailures += 1
                        if (this.sseFailures >= SSE_FAILURES_BEFORE_POLL) this.switchToPolling()
                    }
                }
                if (this.stopped || this.terminal) break
                if (this.pendingResync) {
                    if (!(await this.resync())) break
                    continue
                }
                if (!failure) continue
                const delay = this.deps.backoff(this.attempt, { base: this.retryBase ?? BACKOFF_BASE_MS })
                this.attempt += 1
                if (!(failure instanceof OfflineError)) this.report(TRANSPORT_STATE.RECONNECTING)
                await this.deps.sleep(Math.max(delay, Number(failure.retryAfterMs) || 0), this.stopCtrl.signal)
            }
        } finally {
            this.finish()
        }
    }

    switchToPolling() {
        this.mode = 'poll'
        this.attempt = 0
    }

    async readSse() {
        const ctrl = new AbortController()
        this.connCtrl = ctrl
        this.report(this.attempt > 0 ? TRANSPORT_STATE.RECONNECTING : TRANSPORT_STATE.CONNECTING)
        let received = 0
        this.armWatchdog()
        try {
            const result = await this.deps.openStream({
                runId: this.runId,
                lastSeq: this.lastSeq,
                signal: ctrl.signal,
                onOpen: () => this.report(TRANSPORT_STATE.OPEN),
                onBytes: () => this.armWatchdog(),
                onRetry: (ms) => {
                    if (Number.isFinite(ms) && ms > 0) this.retryBase = ms
                },
                onEvent: (event) => {
                    received += 1
                    return this.receive([event])
                },
            })
            const reason = result?.reason || 'eof'
            if (reason === 'terminal' || reason === 'stopped') return
            if (reason === 'reconnect' || received > 0) {
                this.attempt = 0
                this.sseFailures = 0
                return
            }
            throw new TransportError('stream closed without events')
        } finally {
            this.clearWatchdog()
            if (this.connCtrl === ctrl) this.connCtrl = null
        }
    }

    async readPoll() {
        const ctrl = new AbortController()
        this.connCtrl = ctrl
        const wait = this.deps.pollWait
        const startedAt = Date.now()
        this.armWatchdog((wait + 20) * 1000)
        try {
            const result = await this.deps.poll({ runId: this.runId, after: this.lastSeq, wait, signal: ctrl.signal })
            this.clearWatchdog()
            this.attempt = 0
            this.report(TRANSPORT_STATE.OPEN)
            const events = result?.events || []
            this.receive(events)
            if (result?.terminal && !this.terminal && !this.pendingResync) {
                // The run ended but its terminal event was not in the batch
                // (trimmed buffer): reload the persisted message instead.
                this.pendingResync = 'terminal_without_event'
            }
            if (!events.length && !this.terminal && !this.pendingResync && Date.now() - startedAt < MIN_EMPTY_POLL_MS) {
                await this.deps.sleep(MIN_EMPTY_POLL_MS, this.stopCtrl.signal)
            }
        } finally {
            this.clearWatchdog()
            if (this.connCtrl === ctrl) this.connCtrl = null
        }
    }

    async resync() {
        const reason = this.pendingResync
        this.pendingResync = null
        this.flush()
        this.resyncs += 1
        if (this.resyncs > MAX_CONSECUTIVE_RESYNCS) {
            this.error = new TransportError('resync did not converge', { code: 'resync_failed', fatal: true, retryable: false })
            return false
        }
        if (this.resyncs > 1) {
            await this.deps.sleep(this.deps.backoff(this.resyncs - 2, { base: this.retryBase ?? BACKOFF_BASE_MS }), this.stopCtrl.signal)
            if (this.stopped) return false
        }
        let result
        try {
            result = await this.deps.onResync?.(this.runId, reason)
        } catch {
            result = null
        }
        if (this.stopped) return false
        if (!result) return true
        if (!result.active) {
            this.terminal = true
            return false
        }
        this.lastSeq = Math.max(0, Number(result.lastSeq) || 0)
        return true
    }

    finish() {
        this.clearWatchdog()
        this.flush()
        this.closed = true
        this.report(this.error ? TRANSPORT_STATE.ERROR : TRANSPORT_STATE.CLOSED)
        this.onDone(this)
        if (!this.stopped) {
            this.deps.onClose?.(this.runId, { terminal: this.terminal, error: this.error })
        }
    }
}

/**
 * hooks: {
 *   applyEvents(runId, events),            batch of new events, in seq order
 *   onTransport(runId, {state, mode, attempt}),
 *   onResync(runId, reason) -> Promise<{active, lastSeq} | null>,
 *   onClose(runId, {terminal, error}),     the session ended by itself
 * }
 * plus optional overrides for tests: openStream, poll, schedule, backoff, sleep, watchdogMs, pollWait.
 */
export function createRunManager(hooks = {}) {
    const deps = {
        openStream: openRunStream,
        poll: pollRunEvents,
        schedule: frameScheduler,
        backoff: backoffDelay,
        sleep,
        watchdogMs: WATCHDOG_MS,
        pollWait: POLL_WAIT_SECONDS,
        ...hooks,
    }
    const sessions = new Map()

    function attach(run) {
        if (!run || run.id === undefined || run.id === null) return null
        const id = String(run.id)
        const existing = sessions.get(id)
        if (existing && !existing.closed) return existing
        const session = new RunSession(id, Math.max(0, Number(run.lastSeq) || 0), deps, (s) => {
            if (sessions.get(id) === s) sessions.delete(id)
        })
        sessions.set(id, session)
        session.start()
        return session
    }

    function detach(runId) {
        const id = String(runId)
        const session = sessions.get(id)
        if (!session) return
        sessions.delete(id)
        session.stop()
    }

    function detachAll() {
        for (const id of [...sessions.keys()]) detach(id)
    }

    function isAttached(runId) {
        return sessions.has(String(runId))
    }

    return { attach, detach, detachAll, isAttached, sessions }
}
