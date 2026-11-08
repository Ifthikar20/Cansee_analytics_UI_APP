// Long-poll transport, the fallback when SSE is unsupported or keeps
// failing. GET live/runs/<rid>/events/?after=&wait= is NOT enveloped:
// {events, next_after, terminal, run_status, queue}. `queue` (contract
// RunQueue {position, ahead, slots}, or null) is the run's place in line
// while it waits for a free run slot; older servers leave it out.
import { normalizeQueue } from './normalize'
import { AGENT_LIVE_BASE, errorFromResponse, fetchWithAuth } from './streamClient'

export const POLL_WAIT_SECONDS = 25

/**
 * One long-poll request. Resolves {events, nextAfter, terminal, runStatus, queue};
 * `queue` is undefined when the server sent no such field.
 * rejects with the same error classes as openRunStream.
 */
export async function pollRunEvents({ runId, after = 0, wait = POLL_WAIT_SECONDS, signal } = {}) {
    const query = new URLSearchParams({ after: String(Math.max(0, Number(after) || 0)), wait: String(wait) })
    const url = `${AGENT_LIVE_BASE}/runs/${encodeURIComponent(runId)}/events/?${query}`
    const res = await fetchWithAuth(url, { method: 'GET', headers: { Accept: 'application/json' }, signal })
    if (!res.ok) throw await errorFromResponse(res)
    let body
    try {
        body = await res.json()
    } catch {
        body = null
    }
    // Tolerate an envelope in case a proxy or a future server version adds one.
    const payload = body && body.success === true && body.data && typeof body.data === 'object' ? body.data : body
    const events = Array.isArray(payload?.events) ? payload.events.filter((e) => e && typeof e === 'object') : []
    const nextAfter = Number(payload?.next_after)
    return {
        events,
        nextAfter: Number.isFinite(nextAfter) ? nextAfter : Number(after) || 0,
        terminal: Boolean(payload?.terminal),
        runStatus: payload?.run_status || null,
        queue: payload && typeof payload === 'object' && 'queue' in payload ? normalizeQueue(payload.queue) : undefined,
    }
}
