// Reconnect timing for run transports: exponential with equal jitter, so
// a fleet of clients that dropped together does not reconnect together.

export const BACKOFF_BASE_MS = 500
export const BACKOFF_CAP_MS = 15000

/**
 * Delay before reconnect attempt `attempt` (0-based): half of
 * min(cap, base * 2^attempt) plus a random share of the other half.
 */
export function backoffDelay(attempt, { base = BACKOFF_BASE_MS, cap = BACKOFF_CAP_MS, random = Math.random } = {}) {
    const n = Math.max(0, Math.floor(Number(attempt) || 0))
    const safeBase = Math.max(1, Number(base) || BACKOFF_BASE_MS)
    const ceiling = Math.min(cap, safeBase * 2 ** Math.min(n, 30))
    const half = ceiling / 2
    return Math.round(half + random() * half)
}

/**
 * Promise that resolves after `ms`, or as soon as `signal` aborts (it
 * resolves rather than rejects, so callers just re-check their state).
 */
export function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve()
            return
        }
        const timer = setTimeout(done, Math.max(0, ms))
        function done() {
            clearTimeout(timer)
            signal?.removeEventListener?.('abort', done)
            resolve()
        }
        signal?.addEventListener?.('abort', done, { once: true })
    })
}
