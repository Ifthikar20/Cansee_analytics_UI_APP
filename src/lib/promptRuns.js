// Free prompt runs, in words. One place for every screen that would
// otherwise show the free plan a dollar amount.
//
// A prompt run is one prompt answered by one AI engine. The Free plan has a
// monthly number of them, shared by every project and engine of the
// account; paid plans are unlimited. The server sends the same "runs block"
// everywhere (GET billing/prompt-runs/, agent/status/ prompt_runs, the
// session's limits.prompt_runs, auth/me/ai-usage/ prompt_runs):
//   {unlimited, limit, used, reserved, remaining, plan, scope, period_start,
//    resets_at, by_engine, by_feature}
// and estimates carry {needed, remaining, limit, unlimited, enough, resets_at}.
//
// Free accounts never see dollars: a screen shows "N free prompt runs left"
// instead whenever the block says the account is metered (unlimited false),
// or agent/status/ says allowance.show_usd is false. Paid accounts keep their
// dollar text. A missing or malformed block changes nothing: every helper
// returns null or '' and the screen keeps what it showed before.

export const RUNS_EXHAUSTED = 'prompt_runs_exhausted'
export const RUNS_INSUFFICIENT = 'insufficient_prompt_runs'
export const RUNS_ERROR_CODES = Object.freeze([RUNS_EXHAUSTED, RUNS_INSUFFICIENT])

function count(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
    const n = Number(value)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null
}

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`
}

const runs = (n) => plural(n, 'free prompt run', 'free prompt runs')

// A block normalizeRuns() already made (it has resetsAt), or a raw one.
const asMetered = (raw) => (raw && typeof raw === 'object' && 'resetsAt' in raw ? (raw.unlimited ? null : raw) : meteredRuns(raw))

/**
 * The runs block as {unlimited, limit, used, reserved, remaining, resetsAt},
 * or null when it is missing or says nothing usable. A metered block needs a
 * limit or a remaining count; remaining falls back to limit - used - reserved.
 */
export function normalizeRuns(raw) {
    if (!raw || typeof raw !== 'object') return null
    const used = count(raw.used) ?? 0
    const reserved = count(raw.reserved) ?? 0
    const resetsAt = typeof raw.resets_at === 'string' ? raw.resets_at : ''
    if (raw.unlimited === true) return { unlimited: true, limit: null, used, reserved, remaining: null, resetsAt }
    if (raw.unlimited !== false) return null
    const limit = count(raw.limit)
    let remaining = count(raw.remaining)
    if (remaining === null && limit !== null) remaining = Math.max(0, limit - used - reserved)
    if (remaining === null) return null
    return { unlimited: false, limit, used, reserved, remaining, resetsAt }
}

/** The normalized block when the account counts prompt runs (Free), else null. */
export function meteredRuns(raw) {
    const block = normalizeRuns(raw)
    return block && !block.unlimited ? block : null
}

/**
 * Whether a screen must hide dollars: agent/status/ allowance.show_usd is
 * false, or the runs block is metered. Takes any object with `allowance`
 * and/or `prompt_runs` (agent status, ai-usage, an estimate).
 */
export function hidesUsd(payload) {
    if (!payload || typeof payload !== 'object') return false
    if (payload.allowance && payload.allowance.show_usd === false) return true
    return Boolean(meteredRuns(payload.prompt_runs))
}

/** "November 30" (UTC: the period runs by UTC calendar month), or ''. */
export function renewDate(iso) {
    if (typeof iso !== 'string' || !iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** "They renew on November 30." or '' without a date. */
export function renewSentence(block) {
    const date = renewDate(block?.resetsAt ?? block?.resets_at)
    return date ? `They renew on ${date}.` : ''
}

/** "13 free prompt runs left", "1 free prompt run left", "No free prompt runs left"; '' when not metered. */
export function runsLeftText(raw) {
    const block = asMetered(raw)
    if (!block) return ''
    if (block.remaining <= 0) return 'No free prompt runs left'
    return `${runs(block.remaining)} left`
}

/** "7 of 20 free prompt runs used"; '' when not metered or the limit is unknown. */
export function runsUsedText(raw) {
    const block = asMetered(raw)
    if (!block || block.limit === null) return ''
    return `${block.used} of ${plural(block.limit, 'free prompt run', 'free prompt runs')} used`
}

/**
 * What `needed` runs mean against what is left, as {text, enough}:
 * "Uses 6 of your 13 free prompt runs left.", or why it cannot run. Null
 * when the account is not metered or nothing is needed.
 */
export function runsNeeded(needed, raw) {
    const block = asMetered(raw)
    const n = count(needed)
    if (!block || !n) return null
    const left = block.remaining
    if (left <= 0) {
        const used = block.limit !== null ? `You have used this month's ${runs(block.limit)}.` : 'This month\'s free prompt runs are used up.'
        return { enough: false, text: [used, renewSentence(block)].filter(Boolean).join(' ') }
    }
    if (n > left) {
        const of = block.limit !== null ? `${left} of your ${block.limit}` : `${left}`
        return {
            enough: false,
            text: `This needs ${runs(n)} and ${of} ${left === 1 ? 'is' : 'are'} left this month. Choose fewer prompts or engines.`,
        }
    }
    return { enough: true, text: `Uses ${n} of your ${runs(left)} left.` }
}

/**
 * An estimate's prompt_runs block ({needed, remaining, limit, unlimited,
 * enough, resets_at}) as runsNeeded() words, or null for unlimited accounts
 * or a missing block.
 */
export function estimateRuns(raw) {
    if (!raw || typeof raw !== 'object' || raw.unlimited !== false) return null
    const block = normalizeRuns({ unlimited: false, limit: raw.limit, remaining: raw.remaining, resets_at: raw.resets_at })
    if (!block) return null
    const result = runsNeeded(raw.needed, block)
    if (!result) return null
    // The server's own verdict wins when it sends one.
    return typeof raw.enough === 'boolean' ? { ...result, enough: raw.enough } : result
}

/** Whether `code` is one of the prompt-runs refusals. */
export function isRunsError(code) {
    return RUNS_ERROR_CODES.includes(code)
}

/**
 * The words for a prompt-runs refusal (403 details {needed, remaining,
 * limit, resets_at}). The server's message is used when it sends one; the
 * details are the fallback; '' for any other code.
 */
export function runsErrorText(code, { message = '', details = null } = {}) {
    if (!isRunsError(code)) return ''
    const server = typeof message === 'string' ? message.trim() : ''
    if (server) return server
    const d = details && typeof details === 'object' ? details : {}
    const block = normalizeRuns({ unlimited: false, limit: d.limit, remaining: d.remaining ?? 0, resets_at: d.resets_at })
    const result = code === RUNS_EXHAUSTED ? runsNeeded(1, { ...block, remaining: 0 }) : runsNeeded(d.needed ?? 1, block)
    if (result && !result.enough) return result.text
    return code === RUNS_EXHAUSTED ? "This month's free prompt runs are used up." : 'Not enough free prompt runs are left this month.'
}
