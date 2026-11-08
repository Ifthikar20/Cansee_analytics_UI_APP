/**
 * Client for the STAND-ALONE feedback service (feedback-service/).
 *
 * Deliberately not the shared axios instance: that client attaches the
 * app's Authorization header and auth-refresh interceptors, and the
 * feedback vendor must never receive our JWTs. Plain fetch, absolute
 * URL, zero coupling.
 */
import { readJSON, storageKeys, writeJSON } from '@/lib/agent/storage'

const BASE = (import.meta.env.VITE_FEEDBACK_API_URL || '').replace(/\/$/, '')

/** False when the build has no feedback service; the widget is not mounted. */
export const FEEDBACK_ENABLED = Boolean(BASE)

// Ticket tokens and the messages seen per ticket are kept per user
// (lib/agent/storage.js, removed on logout): a token opens its ticket, and
// the service appends a new request to an open ticket whose token is sent,
// so one account's tokens must never be read or sent for another.
const MAX_TOKENS = 50
const present = (uid) => uid !== null && uid !== undefined && uid !== ''

/** The ticket tokens of this user on this browser ([] without a user). */
export function loadTokens(uid) {
    if (!present(uid)) return []
    const raw = readJSON(storageKeys.feedbackTokens(uid), [])
    return Array.isArray(raw) ? raw.filter((t) => typeof t === 'string' && t) : []
}

/** Keep a new ticket's token for this user; nothing is kept without a user. */
export function rememberToken(uid, token) {
    if (!present(uid) || typeof token !== 'string' || !token) return false
    const tokens = loadTokens(uid).filter((t) => t !== token)
    tokens.unshift(token)
    return writeJSON(storageKeys.feedbackTokens(uid), tokens.slice(0, MAX_TOKENS))
}

/** {ticketId: messages seen} for this user ({} without a user). */
export function loadSeen(uid) {
    if (!present(uid)) return {}
    const raw = readJSON(storageKeys.feedbackSeen(uid), {})
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

export function saveSeen(uid, seen) {
    if (!present(uid)) return false
    return writeJSON(storageKeys.feedbackSeen(uid), seen || {})
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
