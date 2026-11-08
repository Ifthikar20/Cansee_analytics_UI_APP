// Loading one response's attribution (attribution_contract.md 1): GET the
// stored result; when it was never computed, POST to start it; poll GET
// every `interval` ms while it is pending, up to `timeout` ms. No Vue: the
// caller passes the requests and gets each state through `onUpdate`.
//
// States: {phase, data, error}, phase one of
//   loading  - the first request is in flight
//   pending  - the analysis is running (data is the pending payload)
//   ready    - data.findings and data.summary are final
//   failed   - the analysis failed (data.error says why); retry with refresh()
//   timeout  - still pending after `timeout`; retry with start()
//   error    - a request failed; retry with start()

export const POLL_INTERVAL_MS = 2000
export const POLL_TIMEOUT_MS = 90000

/**
 * `get()` and `post(body)` resolve with the attribution payload (the
 * unwrapped envelope `data`). Returns {start, refresh, stop}; stop() also
 * makes any answer still in flight be ignored.
 */
export function createAttributionLoader({
    get,
    post,
    onUpdate,
    interval = POLL_INTERVAL_MS,
    timeout = POLL_TIMEOUT_MS,
    now = () => Date.now(),
    timers = globalThis,
}) {
    let run = 0
    let timer = null
    let startedAt = 0

    const emit = (id, phase, data = null, error = null) => {
        if (id === run) onUpdate({ phase, data, error })
    }

    function clearTimer() {
        if (timer !== null) {
            timers.clearTimeout(timer)
            timer = null
        }
    }

    function stop() {
        run++
        clearTimer()
    }

    function schedule(id, data) {
        if (now() - startedAt >= timeout) {
            emit(id, 'timeout', data)
            return
        }
        emit(id, 'pending', data)
        timer = timers.setTimeout(() => {
            timer = null
            request(id, get, true)
        }, interval)
    }

    async function request(id, call, polling) {
        let data
        try {
            data = await call()
            if (id !== run) return
            // Never computed: start it (once per run; a poll that sees
            // `none` means the work was lost, which reads as an error).
            if (data?.status === 'none' && !polling) {
                data = await post({})
                if (id !== run) return
            }
        } catch (error) {
            if (id !== run) return
            // 409: the analysis is already running; keep polling.
            if (error?.response?.status === 409) schedule(id, null)
            else emit(id, 'error', null, error)
            return
        }
        const status = data?.status
        if (status === 'pending') schedule(id, data)
        else if (status === 'ready') emit(id, 'ready', data)
        else if (status === 'failed') emit(id, 'failed', data)
        else emit(id, 'error', data)
    }

    function begin(call) {
        stop()
        const id = run
        startedAt = now()
        emit(id, 'loading')
        return request(id, call, false)
    }

    return {
        start: () => begin(get),
        refresh: () => begin(() => post({ refresh: true })),
        stop,
    }
}
