// fetch-based transport for a run's event stream. EventSource cannot send
// the Bearer header, so the stream is read from `res.body` and parsed with
// sseParser. The axios interceptors do not apply here, so auth (proactive
// refresh, one retry after a 401) is handled in fetchWithAuth.
import { authHeaders, refreshAccessToken } from '@/api/client'
import { createSseParser } from './sseParser'
import { ERROR_CODE, EVENT, TERMINAL_EVENT_TYPES } from './types'

export const AGENT_LIVE_BASE = '/api/v1/agent/live'

// Refresh the access token first when it expires within this window.
export const TOKEN_REFRESH_WINDOW_MS = 60000

export class TransportError extends Error {
    constructor(message, { status = 0, code = '', serverMessage = '', details = null, retryable = true, fatal = false, retryAfterMs = null } = {}) {
        super(message || code || `HTTP ${status}`)
        this.name = 'TransportError'
        this.isTransportError = true
        this.status = status
        this.code = code
        this.serverMessage = serverMessage
        this.details = details
        this.retryable = retryable
        this.fatal = fatal
        this.retryAfterMs = retryAfterMs
    }
}

/** The endpoint cannot stream (404/405/406 or not text/event-stream): use long-polling. */
export class UnsupportedTransport extends TransportError {
    constructor(message, opts = {}) {
        super(message, { retryable: false, ...opts })
        this.name = 'UnsupportedTransport'
    }
}

/** 401 after a refresh, or the refresh itself was refused (the session is over). */
export class AuthError extends TransportError {
    constructor(message = 'unauthorized', opts = {}) {
        super(message, { status: 401, code: ERROR_CODE.UNAUTHORIZED, retryable: false, fatal: true, ...opts })
        this.name = 'AuthError'
    }
}

/** The agent process is down (503 agent_unavailable) or the network is gone. */
export class OfflineError extends TransportError {
    constructor(message = 'offline', opts = {}) {
        super(message, { code: ERROR_CODE.AGENT_UNAVAILABLE, retryable: true, ...opts })
        this.name = 'OfflineError'
    }
}

/** 503 maintenance: the site is down for maintenance. Retry after `retryAfterMs` (Retry-After). */
export class MaintenanceError extends TransportError {
    constructor(message = 'maintenance', opts = {}) {
        super(message, { status: 503, ...opts, code: ERROR_CODE.MAINTENANCE, retryable: true, fatal: false })
        this.name = 'MaintenanceError'
    }
}

export function isAbortError(err) {
    return Boolean(err) && (err.name === 'AbortError' || err.code === 20)
}

function tokenFromHeaders(headers) {
    const value = headers?.Authorization || headers?.authorization || ''
    return value.startsWith('Bearer ') ? value.slice(7) : ''
}

/** Milliseconds until a JWT's `exp`, or null when it has none or is not a JWT. */
export function jwtExpiresInMs(token, now = Date.now()) {
    if (typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    try {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
        const payload = JSON.parse(atob(padded))
        const exp = Number(payload?.exp)
        if (!Number.isFinite(exp)) return null
        return exp * 1000 - now
    } catch {
        return null
    }
}

async function refreshIfExpiring() {
    const left = jwtExpiresInMs(tokenFromHeaders(authHeaders()))
    if (left === null || left > TOKEN_REFRESH_WINDOW_MS) return
    try {
        await refreshAccessToken()
    } catch {
        // The request goes out with the old token; a 401 takes the retry path.
    }
}

function parseRetryAfter(value) {
    if (!value) return null
    const seconds = Number(value)
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
    const at = Date.parse(value)
    return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null
}

/** Build a TransportError from a non-OK response (enveloped or bare error bodies). */
export async function errorFromResponse(res) {
    let body = null
    try {
        body = await res.json()
    } catch {}
    const raw = body?.error
    const code = typeof raw === 'string' ? raw : raw?.code || ''
    const serverMessage = (raw && typeof raw === 'object' && raw.message) || ''
    const details = (raw && typeof raw === 'object' && raw.details) || null
    const retryAfterMs = parseRetryAfter(res.headers?.get?.('Retry-After'))
    const opts = { status: res.status, code, serverMessage, details, retryAfterMs }

    // nginx's maintenance switch: not the agent being down, and not worth a
    // quick retry; Retry-After says when to come back.
    if (res.status === 503 && code === ERROR_CODE.MAINTENANCE) {
        return new MaintenanceError(serverMessage || 'maintenance', opts)
    }
    if (res.status === 503 && (code === ERROR_CODE.AGENT_UNAVAILABLE || !code)) {
        return new OfflineError(serverMessage || 'agent unavailable', { ...opts, code: ERROR_CODE.AGENT_UNAVAILABLE })
    }
    if (res.status === 401) return new AuthError(serverMessage || 'unauthorized', opts)
    if (res.status === 503 && (code === ERROR_CODE.AGENT_DISABLED || code === ERROR_CODE.AGENT_NOT_CONFIGURED)) {
        return new TransportError(serverMessage || code, { ...opts, retryable: false, fatal: true })
    }
    if (res.status === 403 || res.status === 404 || res.status === 400) {
        return new TransportError(serverMessage || `HTTP ${res.status}`, { ...opts, retryable: false, fatal: true })
    }
    return new TransportError(serverMessage || `HTTP ${res.status}`, {
        ...opts,
        retryable: res.status === 429 || res.status >= 500,
    })
}

/**
 * Why a token refresh failed. Only a refused refresh (401/403, after which
 * the client has signed the user out) ends the session; a network blip or a
 * 5xx from /auth/refresh/ leaves the user signed in, so the transport backs
 * off and tries again.
 */
function refreshFailure(err) {
    const status = Number(err?.response?.status) || 0
    const serverMessage = err?.message || ''
    if (status === 401 || status === 403 || !tokenFromHeaders(authHeaders())) {
        return new AuthError('refresh failed', { serverMessage })
    }
    if (!status) return new OfflineError('refresh failed', { code: ERROR_CODE.NETWORK, serverMessage })
    return new TransportError('refresh failed', { status, serverMessage, retryable: true })
}

/**
 * fetch with the app's auth headers. Refreshes first when the JWT is about
 * to expire, and once more after a 401. Network failures become an
 * OfflineError; aborts are rethrown as-is.
 */
export async function fetchWithAuth(url, init = {}) {
    await refreshIfExpiring()
    const send = () =>
        fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            ...init,
            headers: { ...authHeaders(), ...(init.headers || {}) },
        })
    let res
    try {
        res = await send()
        if (res.status === 401) {
            discardBody(res)
            try {
                await refreshAccessToken()
            } catch (err) {
                throw refreshFailure(err)
            }
            res = await send()
            if (res.status === 401) {
                discardBody(res)
                throw new AuthError()
            }
        }
    } catch (err) {
        if (isAbortError(err) || err instanceof TransportError) throw err
        throw new OfflineError('network error', { code: ERROR_CODE.NETWORK, serverMessage: err?.message || '' })
    }
    return res
}

function discardBody(res) {
    try {
        res.body?.cancel?.().catch?.(() => {})
    } catch {}
}

/**
 * Open a run's SSE stream and read it until it ends.
 *
 * onEvent(event) receives each parsed contract event ({v, seq, type, ...});
 * returning `false` stops reading (used for resync). Resolves with
 * {reason: 'terminal'|'reconnect'|'stopped'|'eof', lastEventId}. Rejects with
 * UnsupportedTransport, AuthError, OfflineError, TransportError or an AbortError.
 */
export async function openRunStream({
    runId,
    lastSeq = 0,
    signal,
    onEvent,
    onComment,
    onRetry,
    onBytes,
    onOpen,
} = {}) {
    const url = `${AGENT_LIVE_BASE}/runs/${encodeURIComponent(runId)}/stream/`
    const headers = { Accept: 'text/event-stream' }
    if (Number(lastSeq) > 0) headers['Last-Event-ID'] = String(lastSeq)

    const res = await fetchWithAuth(url, { method: 'GET', headers, signal })
    if (res.status === 404 || res.status === 405 || res.status === 406) {
        discardBody(res)
        throw new UnsupportedTransport(`stream answered ${res.status}`, { status: res.status })
    }
    if (!res.ok) throw await errorFromResponse(res)
    const contentType = res.headers?.get?.('content-type') || ''
    if (!contentType.toLowerCase().includes('text/event-stream') || !res.body) {
        discardBody(res)
        throw new UnsupportedTransport('response is not an event stream', { status: res.status })
    }
    onOpen?.(res)

    let stop = ''
    const parser = createSseParser({
        onComment,
        onRetry,
        onEvent(message) {
            if (stop) return
            if (message.type === EVENT.RECONNECT) {
                stop = 'reconnect'
                return
            }
            let event
            try {
                event = JSON.parse(message.data)
            } catch {
                return
            }
            if (!event || typeof event !== 'object') return
            if (!event.type) event.type = message.type
            if (event.type === EVENT.RECONNECT) {
                stop = 'reconnect'
                return
            }
            if ((event.seq === undefined || event.seq === null) && /^\d+$/.test(message.id)) {
                event.seq = Number(message.id)
            }
            const keepGoing = onEvent?.(event)
            if (TERMINAL_EVENT_TYPES.has(event.type)) stop = 'terminal'
            else if (keepGoing === false) stop = 'stopped'
        },
    })

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    try {
        while (!stop) {
            const { value, done } = await reader.read()
            if (done) break
            onBytes?.()
            if (value && value.length) parser.feed(decoder.decode(value, { stream: true }))
        }
        if (!stop) {
            parser.feed(decoder.decode())
            parser.end()
        }
    } finally {
        if (stop) {
            try {
                await reader.cancel()
            } catch {}
        }
        try {
            reader.releaseLock()
        } catch {}
    }
    return { reason: stop || 'eof', lastEventId: parser.lastEventId }
}
