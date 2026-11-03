/**
 * Client for the STAND-ALONE feedback service (feedback-service/).
 *
 * Deliberately not the shared axios instance: that client attaches the
 * app's Authorization header and auth-refresh interceptors, and the
 * feedback vendor must never receive our JWTs. Plain fetch, absolute
 * URL, zero coupling.
 */
const BASE = (import.meta.env.VITE_FEEDBACK_API_URL || '').replace(/\/$/, '')

/** False when the build has no feedback service; the widget is not mounted. */
export const FEEDBACK_ENABLED = Boolean(BASE)

const TOKENS_KEY = 'cs-feedback-tokens'

export function loadTokens() {
    try {
        const raw = JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]')
        return Array.isArray(raw) ? raw.filter(t => typeof t === 'string') : []
    } catch { return [] }
}

export function rememberToken(token) {
    try {
        const tokens = loadTokens()
        if (!tokens.includes(token)) tokens.unshift(token)
        localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens.slice(0, 50)))
    } catch { /* private mode etc. — the thread just won't persist */ }
}

async function request(path, options = {}) {
    if (!FEEDBACK_ENABLED) throw new Error('Feedback is not available.')
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    })
    if (!res.ok) {
        let message = 'Something went wrong. Please try again.'
        try { message = (await res.json()).detail || message } catch { /* keep fallback */ }
        throw new Error(message)
    }
    return res.json()
}

export default {
    createTicket: (payload) =>
        request('/v1/tickets', { method: 'POST', body: JSON.stringify(payload) }),
    getTicket: (id, token) =>
        request(`/v1/tickets/${id}?token=${encodeURIComponent(token)}`),
    reply: (id, token, body, context = {}) =>
        request(`/v1/tickets/${id}/messages`, {
            method: 'POST', body: JSON.stringify({ token, body, context }),
        }),
    summaries: (tokens) =>
        request('/v1/tickets/summaries', {
            method: 'POST', body: JSON.stringify({ tokens }),
        }),
}
