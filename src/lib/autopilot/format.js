// Words and numbers of the Autopilot settings page (autopilot_frontend.md 2,
// autopilot_contract.md 3). Pure: no Vue, no API calls. A value the server
// did not measure (null) never reads as 0; a measured zero reads 0.

const integer = new Intl.NumberFormat('en-US')

function pad(n) {
    return String(n).padStart(2, '0')
}

/** "1,240" (0 for anything that is not a number). */
export function count(n) {
    return integer.format(Number(n) || 0)
}

/** "1 prompt", "9 prompts". */
export function plural(n, one, many) {
    const value = Number(n) || 0
    return `${integer.format(value)} ${value === 1 ? one : many}`
}

/** "$1.27" from "1.2700", "$0.0060" under a cent; '' when not measured. */
export function usd(value) {
    if (value === null || value === undefined || value === '') return ''
    const n = Number(value)
    if (!Number.isFinite(n)) return ''
    if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The 96 quarter hours of a day, "00:00" to "23:45". */
export const QUARTER_HOURS = Object.freeze(
    Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`),
)

/** "07:00" from "07:00", "07:00:00" or "7:00"; '' when it is not a time. */
export function hhmm(value) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''))
    return m ? `${pad(Number(m[1]))}:${m[2]}` : ''
}

// For browsers without Intl.supportedValuesOf.
const FALLBACK_ZONES = Object.freeze([
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
])

/**
 * The time zones of the select: UTC first, then the browser's IANA list (a
 * short list where the browser has none). `extra` zones (the saved one, the
 * browser's) are added when the list lacks them, so the select can show them.
 */
export function timeZones(...extra) {
    let zones = []
    try {
        if (typeof Intl.supportedValuesOf === 'function') zones = Intl.supportedValuesOf('timeZone')
    } catch {
        zones = []
    }
    if (!zones.length) zones = FALLBACK_ZONES
    const rest = [...new Set([...zones, ...extra.filter(Boolean)])].filter((z) => z !== 'UTC').sort()
    return ['UTC', ...rest]
}

/** The browser's time zone, or 'UTC'. */
export function browserTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
        return 'UTC'
    }
}

// A zone Intl can format in; anything else formats in UTC.
function validZone(timezone) {
    if (!timezone) return 'UTC'
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone })
        return timezone
    } catch {
        return 'UTC'
    }
}

/** "08:02" when it is today in `timezone`, else "Nov 4, 08:02"; '' when not a date. */
export function clockTime(iso, timezone, now = new Date()) {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const timeZone = validZone(timezone)
    const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
    const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    if (day.format(date) === day.format(now)) return time
    const on = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(date)
    return `${on}, ${time}`
}

/** "Dec 1" from "2026-12-01" (a calendar date, read without a time zone); '' otherwise. */
export function shortDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
    if (!m) return ''
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "ChatGPT", "ChatGPT and Claude", "ChatGPT, Claude and Gemini". */
export function joinLabels(labels) {
    const list = (labels || []).filter(Boolean)
    if (list.length <= 1) return list[0] || ''
    return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

/* ── Runs ── */

const RUN_STATUS_WORDS = Object.freeze({
    queued: 'Waiting to start',
    running: 'Running',
    done: 'Done',
    partial: 'Partly done',
    failed: 'Failed',
    skipped: 'Skipped',
    cancelled: 'Stopped',
    interrupted: 'Stopped before it finished',
})

/** The status word of a run (the runs table). */
export function runStatusWord(status) {
    return RUN_STATUS_WORDS[status] || ''
}

export const ACTIVE_RUN_STATUSES = Object.freeze(['queued', 'running'])

export function isActiveRun(run) {
    return Boolean(run && ACTIVE_RUN_STATUSES.includes(run.status))
}

// Why a text was not sent. The other reasons (cancelled, notice_sent,
// not_verified) have no line of their own.
const SKIPPED_TEXT = Object.freeze({
    opted_out: 'Not sent: this number texted STOP.',
    consent_needed: 'Not sent: agree to the daily text again for this number.',
    superseded: "Not sent: a newer run's text replaced it.",
    unavailable: "Not sent: text messages aren't set up on this server.",
    no_access: "Not sent: the number's owner can no longer open this project.",
})

/**
 * What happened to a run's text (RunSummary `text`), with times in the
 * project's `timezone`; '' when there is nothing to say (not requested,
 * sending, or a text that is due now and goes out on the next tick).
 */
export function textStatusLine(text, timezone, now = new Date()) {
    if (!text) return ''
    switch (text.status) {
        case 'sent': {
            const at = clockTime(text.sent_at, timezone, now)
            return at ? `Sent at ${at}` : ''
        }
        case 'waiting': {
            const due = text.due_at ? new Date(text.due_at) : null
            if (!due || Number.isNaN(due.getTime()) || due <= now) return ''
            return `Waiting for quiet hours to end (${clockTime(text.due_at, timezone, now)})`
        }
        case 'failed':
            return "Couldn't send the text."
        case 'skipped':
            return SKIPPED_TEXT[text.reason] || ''
        default:
            return ''
    }
}

/* ── Settings lines ── */

/**
 * Whether saving needs the number owner's consent (contract 3a): the daily
 * text turns on, or its number changes while it is on.
 */
export function consentNeeded(draft, saved) {
    if (!draft?.sms_digest) return false
    if (!saved?.sms_digest) return true
    return (draft.sms_subscription_id || null) !== (saved.sms_subscription_id || null)
}

/** The plan line under What runs, from the payload's `tracked`. */
export function planLine(tracked) {
    if (!tracked || tracked.used === null || tracked.used === undefined) return ''
    const used = Number(tracked.used) || 0
    const limit = tracked.limit === null || tracked.limit === undefined ? -1 : Number(tracked.limit)
    if (limit < 0) return `This account tracks ${plural(used, 'prompt', 'prompts')}.`
    if (used > limit) {
        return `This account tracks ${plural(used, 'prompt', 'prompts')} and your plan covers ${count(limit)}. Autopilot checks the ${count(limit)} oldest.`
    }
    return `Your plan covers ${plural(limit, 'tracked prompt', 'tracked prompts')}; this account tracks ${count(used)}.`
}

/**
 * The cost lines of the settings payload (`cost`, `allowance`): the last
 * run and the month it projects, or the bound before the first run, then
 * the reserve Autopilot leaves for the user.
 */
export function costLines(payload) {
    const out = []
    const cost = payload?.cost || {}
    const allowance = payload?.allowance || {}
    const last = cost.last_run
    if (last) {
        const parts = [plural(last.answers, 'answer', 'answers')]
        if (usd(last.ai_usd)) parts.push(`${usd(last.ai_usd)} of AI`)
        if (last.google_pages !== null && last.google_pages !== undefined) {
            const credits = last.credits === null || last.credits === undefined ? '' : ` (${count(last.credits)} ScraperAPI credits)`
            parts.push(`${plural(last.google_pages, 'Google page', 'Google pages')}${credits}`)
        }
        out.push(`Last run: ${parts.join(', ')}.`)
        if (usd(cost.month_projection_usd)) {
            const included = !allowance.unlimited && usd(allowance.cap_usd) ? ` Your plan includes ${usd(allowance.cap_usd)}.` : ''
            out.push(`At this rate a month of daily runs costs about ${usd(cost.month_projection_usd)} of AI.${included}`)
        }
        if (shortDate(cost.runs_out_on) && shortDate(allowance.resets_on)) {
            out.push(
                `At this rate the allowance runs out around ${shortDate(cost.runs_out_on)}. Autopilot then pauses until ${shortDate(allowance.resets_on)}.`,
            )
        }
    } else if (cost.bound && usd(cost.bound.ai_usd_max)) {
        out.push(
            `The first run measures the real cost. Each run costs at most ${usd(cost.bound.ai_usd_max)} of AI and ${plural(cost.bound.google_pages_max, 'Google page', 'Google pages')}.`,
        )
    }
    const reserve = Number(allowance.reserve_pct)
    if (!allowance.unlimited && allowance.reserve_pct !== null && allowance.reserve_pct !== undefined && Number.isFinite(reserve)) {
        out.push(
            `Autopilot stops for the month when ${100 - reserve}% of your AI allowance is used, so the rest stays free for your own questions.`,
        )
    }
    return out
}

/* ── Run now ── */

/**
 * The Run now dialog's sentence. The Google and analysis steps are named
 * only when the run does them: Google pages are planned (`pages_max`) and
 * analysis is on in the saved settings.
 */
export function runNowSentence(estimate, { analysis = true } = {}) {
    if (!estimate) return ''
    const prompts = plural(estimate.prompts, 'prompt', 'prompts')
    const engines = joinLabels((estimate.engines || []).map((e) => e.label))
    const google = Number(estimate.pages_max) > 0
    let sentence
    if (engines) {
        sentence = `Checks ${prompts} with ${engines}`
        if (google) sentence += ', then Google page one'
        if (analysis) sentence += ', then analyzes new answers'
    } else {
        sentence = google ? `Checks ${prompts} on Google page one` : `Checks ${prompts}`
    }
    return `${sentence}. This counts as today's run.`
}

/** The note when the allowance fits fewer prompts than are tracked; '' otherwise. */
export function limitedLine(estimate) {
    if (estimate?.limited_by !== 'allowance') return ''
    const n = Number(estimate.prompts) || 0
    return `Only ${plural(n, 'prompt', 'prompts')} ${n === 1 ? 'fits' : 'fit'} in your allowance today; the rest wait for the next run.`
}
