// Normalisation of agent API payloads and errors into the shapes the store
// keeps. Unknown fields pass through untouched (the contract allows extra
// fields); missing ones get explicit empty values, never invented data.
import { ERROR_CODE } from './types'

/* ── Errors ── */

const FALLBACK_COPY = {
    [ERROR_CODE.AGENT_DISABLED]: 'The agent is turned off for this workspace.',
    [ERROR_CODE.AGENT_UNAVAILABLE]: 'The agent is temporarily unavailable. Try again in a moment.',
    [ERROR_CODE.AGENT_NOT_CONFIGURED]: 'The agent is not set up yet: no Anthropic API key is configured.',
    [ERROR_CODE.ALLOWANCE_EXCEEDED]: "You've used this month's AI allowance.",
    [ERROR_CODE.AGENT_BUSY]: 'You already have a run in progress. Wait for it to finish, then try again.',
    [ERROR_CODE.RUN_IN_PROGRESS]: 'This chat already has a run in progress.',
    [ERROR_CODE.REVISION_CONFLICT]: 'Someone changed this since you opened it. Reload to see their version.',
    [ERROR_CODE.ALREADY_SAVED]: 'This reply is already saved to Reports.',
    [ERROR_CODE.NETWORK]: "Couldn't reach CanSee. Check your connection and try again.",
    [ERROR_CODE.UNAUTHORIZED]: 'Your session has expired. Sign in again.',
    [ERROR_CODE.NOT_FOUND]: "We couldn't find that. It may have been deleted.",
    [ERROR_CODE.INTERRUPTED]: 'The run stopped unexpectedly before it finished.',
}

const STATUS_COPY = {
    400: "Something didn't look right. Please check your input.",
    403: "You don't have permission to do that.",
    404: FALLBACK_COPY[ERROR_CODE.NOT_FOUND],
    409: 'This conflicts with something already in progress.',
    429: 'Too many requests. Please wait a moment.',
    500: 'Something went wrong on our end. Please try again.',
    502: 'Our servers are temporarily unavailable. Please try again shortly.',
    503: 'This feature is temporarily unavailable. Please try again shortly.',
}

export class AgentError extends Error {
    constructor({ status = 0, code = '', message = '', details = null, retryable } = {}) {
        super(message || FALLBACK_COPY[code] || STATUS_COPY[status] || STATUS_COPY[500])
        this.name = 'AgentError'
        this.status = Number(status) || 0
        this.code = code || ''
        this.details = details ?? null
        this.retryable = retryable ?? isRetryableStatus(this.status, this.code)
    }

    toJSON() {
        return {
            status: this.status,
            code: this.code,
            message: this.message,
            details: this.details,
            retryable: this.retryable,
        }
    }
}

function isRetryableStatus(status, code) {
    if (code === ERROR_CODE.NETWORK || code === ERROR_CODE.AGENT_UNAVAILABLE) return true
    if (code === ERROR_CODE.AGENT_BUSY || code === ERROR_CODE.RUN_IN_PROGRESS) return true
    return status === 429 || status >= 500
}

/** User-facing copy for an error code (or HTTP status), for code paths with no server message. */
export function errorCopy(code, status = 0) {
    return FALLBACK_COPY[code] || STATUS_COPY[status] || STATUS_COPY[500]
}

/**
 * Turn anything thrown by the axios client, the fetch transports or the
 * store into an AgentError. Handles the enveloped error shape
 * {success:false, error:{code, message, details}} and the bare {error:'code'}.
 */
export function normalizeError(err) {
    if (err instanceof AgentError) return err
    if (!err) return new AgentError({})

    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.__CANCEL__) {
        return new AgentError({ code: 'aborted', message: 'Cancelled.', retryable: false })
    }

    // fetch transports (lib/agent/streamClient.js TransportError)
    if (err.isTransportError) {
        return new AgentError({
            status: err.status,
            code: err.code || (err.status ? '' : ERROR_CODE.NETWORK),
            message: err.serverMessage || '',
            details: err.details,
            retryable: err.retryable,
        })
    }

    // axios
    if (err.isAxiosError || err.response || err.config) {
        const res = err.response
        if (!res) {
            return new AgentError({ code: ERROR_CODE.NETWORK })
        }
        const body = res.data
        const raw = body?.error
        const code = typeof raw === 'string' ? raw : raw?.code || ''
        const message = (typeof raw === 'object' && raw?.message) || ''
        return new AgentError({
            status: res.status,
            code,
            message: message || (code ? '' : err.displayMessage || ''),
            details: (typeof raw === 'object' && raw?.details) || null,
        })
    }

    return new AgentError({ message: '', code: err.code && typeof err.code === 'string' ? err.code : '' })
}

/* ── Payloads ── */

const str = (v) => (v === null || v === undefined ? null : String(v))
const arr = (v) => (Array.isArray(v) ? v : [])
const num = (v, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

let partCounter = 0

function normalizePart(part) {
    if (!part || typeof part !== 'object') return null
    if (part.id !== undefined && part.id !== null && part.id !== '') return part
    partCounter += 1
    return { ...part, id: `local-part-${partCounter}` }
}

export function normalizeResearch(research) {
    const r = research && typeof research === 'object' ? research : {}
    return {
        ...r,
        serp: r.serp && typeof r.serp === 'object' ? r.serp : {},
        pages: r.pages && typeof r.pages === 'object' ? r.pages : {},
    }
}

export function normalizeMessage(raw) {
    if (!raw || typeof raw !== 'object' || raw.id === undefined || raw.id === null) return null
    const id = String(raw.id)
    const siblings = arr(raw.sibling_ids).map(String)
    return {
        ...raw,
        id,
        chat_id: str(raw.chat_id),
        parent_id: str(raw.parent_id),
        role: raw.role === 'user' ? 'user' : 'assistant',
        status: raw.status || 'complete',
        parts: arr(raw.parts).map(normalizePart).filter(Boolean),
        parts_seq: num(raw.parts_seq, 0),
        sibling_ids: siblings.length ? siblings : [id],
        research: normalizeResearch(raw.research),
        feedback: raw.feedback ?? null,
        saved_report_id: str(raw.saved_report_id),
        run_id: str(raw.run_id),
        error_code: raw.error_code || '',
        error_message: raw.error_message || '',
    }
}

export function normalizeChatSummary(raw) {
    if (!raw || typeof raw !== 'object' || raw.id === undefined || raw.id === null) return null
    return {
        ...raw,
        id: String(raw.id),
        title: raw.title || '',
        preview: raw.preview || '',
        created_at: raw.created_at || null,
        last_message_at: raw.last_message_at || raw.created_at || null,
        active_run_id: str(raw.active_run_id),
    }
}

export function normalizeRun(raw) {
    if (!raw || typeof raw !== 'object' || raw.id === undefined || raw.id === null) return null
    return {
        ...raw,
        id: String(raw.id),
        chat_id: str(raw.chat_id),
        message_id: str(raw.message_id),
        status: raw.status || 'queued',
        last_seq: num(raw.last_seq, 0),
    }
}

export function normalizeChatDetail(raw) {
    const summary = normalizeChatSummary(raw)
    if (!summary) return null
    const activeRun = normalizeRun(raw.active_run)
    const messages = arr(raw.messages).map(normalizeMessage).filter(Boolean)
    messages.forEach((m) => {
        if (!m.chat_id) m.chat_id = summary.id
    })
    return {
        ...summary,
        title_source: raw.title_source || '',
        current_leaf_id: str(raw.current_leaf_id) || (messages.length ? messages[messages.length - 1].id : null),
        messages,
        active_run: activeRun,
        active_run_id: activeRun ? activeRun.id : summary.active_run_id,
    }
}

export function normalizeArtifact(raw) {
    if (!raw || typeof raw !== 'object' || raw.id === undefined || raw.id === null) return null
    return {
        ...raw,
        id: String(raw.id),
        warnings: Array.isArray(raw.warnings) ? raw.warnings : raw.warnings ? [raw.warnings] : [],
        source_chat_id: str(raw.source_chat_id),
    }
}

/** Epoch ms from an ISO string, epoch seconds or epoch ms; null when unknown. */
export function toEpochMs(ts) {
    if (ts === null || ts === undefined || ts === '') return null
    if (typeof ts === 'number') return ts < 1e12 ? Math.round(ts * 1000) : Math.round(ts)
    const parsed = Date.parse(ts)
    return Number.isFinite(parsed) ? parsed : null
}
