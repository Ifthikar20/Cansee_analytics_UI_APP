// Ask AI and Prompt ranking (autopilot_frontend.md 6): the words the two
// cards and their panels show, built from the prompt box API (contract 4)
// and the ranking payload (contract 3c). Pure functions, no Vue.
//
// A value that was not measured is null and reads as its state word; a
// measured zero reads 0. Shares are whole percents; ranges are the 95%
// Wilson bounds the server sends.
import { engineMeta } from '@/lib/engines'
import { timeAgo } from '@/utils/timeAgo'

// ── Copy ──

export const COPY = Object.freeze({
    placeholder: 'Type a question a buyer would ask, for example: best note taking app for small teams',
    intro: 'One answer can misjudge you. Asking several times shows how often each engine really names you.',
    noEngines: "AI engines aren't available yet.",
    viewer: 'Only members of this project can ask.',
    tooLong: 'Ask one question, up to 300 characters.',
    requestTitle: 'This looks like a question for the agent.',
    requestBody: "Ask AI puts a buyer's question to the AI engines. To ask about your own data, ask the agent.",
    costChanged: 'The cost changed. Check it and ask again.',
    stays: 'These answers stay here. Tracked prompts are measured the same way every day by Autopilot.',
    trackedNext: 'Tracked. Autopilot asks it from its next run.',
    alreadyTracked: 'You already track this prompt.',
    autopilotOff: 'Autopilot is off for this project.',
    shareFoot: 'Share of answers that name you, last 7 days.',
    staleNote: "Couldn't refresh.",
    fallbackError: 'Something went wrong on our end. Please try again.',
})

// ── Ask AI: the question ──

export const MIN_CHARS = 3
export const MAX_CHARS = 300
export const SAMPLE_CHOICES = Object.freeze([1, 3, 5, 10])
export const DEFAULT_SAMPLES = 3
export const ESTIMATE_DELAY_MS = 400
export const POLL_MS = 1500

const integer = new Intl.NumberFormat('en-US')
const USD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

function toNumber(value) {
    const n = typeof value === 'number' ? value : Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
}

const count = (n) => integer.format(n || 0)

function plural(n, one, many) {
    return `${count(n)} ${n === 1 ? one : many}`
}

/** A share as a whole percent: "67%". */
export function pct(value) {
    return `${Math.round(value)}%`
}

/** The question as it is asked: one line, spaces collapsed. */
export function normalizeQuestion(text) {
    return String(text ?? '')
        .replace(/\s+/g, ' ')
        .trim()
}

/** What the box holds: line breaks become spaces (Enter asks). */
export function withoutLineBreaks(text) {
    return String(text ?? '').replace(/[\r\n]+/g, ' ')
}

/** True when the question is long enough to estimate and short enough to ask. */
export function questionReady(text) {
    const n = normalizeQuestion(text).length
    return n >= MIN_CHARS && n <= MAX_CHARS
}

export function questionTooLong(text) {
    return normalizeQuestion(text).length > MAX_CHARS
}

// ── Money ──

/** An upper bound, rounded up to the cent: "$0.48". */
export function usdUpTo(value) {
    const n = toNumber(value)
    if (n === null) return ''
    const cents = Math.ceil(Math.round(n * 10000) / 100)
    return USD.format(cents / 100)
}

/** A cost: "$0.07", "<$0.01" under a cent, "$0.00" for none. */
export function usdCost(value) {
    const n = toNumber(value)
    if (n === null) return ''
    if (n > 0 && n < 0.005) return '<$0.01'
    return USD.format(Math.round(n * 100) / 100)
}

/** An amount the server already rounded to the cent: "$2.24". */
export function usdAmount(value) {
    const n = toNumber(value)
    return n === null ? '' : USD.format(n)
}

// ── Ask AI: the estimate ──

/**
 * "6 answers, up to $0.48 of your AI allowance ($2.24 left this month).",
 * or "6 answers, up to $0.48." when the allowance is unlimited.
 */
export function estimateLine(estimate) {
    if (!estimate || !isNumber(estimate.answers)) return ''
    const head = `${plural(estimate.answers, 'answer', 'answers')}, up to ${usdUpTo(estimate.usd_max)}`
    const allowance = estimate.allowance || {}
    const left = toNumber(allowance.left_usd)
    if (allowance.unlimited || left === null) return `${head}.`
    return `${head} of your AI allowance (${usdAmount(left)} left this month).`
}

/** The first blocker of an estimate: {code, message}, or null. */
export function estimateBlocker(estimate) {
    const blockers = Array.isArray(estimate?.blockers) ? estimate.blockers : []
    return blockers.find((b) => b && b.message) || null
}

// ── Ask AI: a run ──

export const ACTIVE_STATUSES = Object.freeze(['queued', 'running'])

export function isActiveRun(run) {
    return Boolean(run) && ACTIVE_STATUSES.includes(run.status)
}

// Answers that came to an end so far: back, or failed.
function settled(progress) {
    const p = progress || {}
    return (p.done || 0) + (p.failed || 0)
}

/** "Asking... 2 of 6 answers" */
export function progressLine(run) {
    const total = run?.progress?.total || 0
    return `Asking... ${count(settled(run?.progress))} of ${plural(total, 'answer', 'answers')}`
}

/** How a stopped or interrupted run ended; '' for every other status. */
export function endLine(run) {
    const p = run?.progress || {}
    const total = p.total || 0
    if (run?.status === 'cancelled') return `Stopped after ${count(settled(p))} of ${plural(total, 'answer', 'answers')}.`
    // Answers the sweep closed never finished: only what came back counts.
    if (run?.status === 'interrupted') return `Interrupted after ${count(p.done || 0)} of ${plural(total, 'answer', 'answers')}.`
    return ''
}

const FAILED = ['failed', 'skipped']

/** "2 answers failed: {the most common message}", or ''. Stopped answers are not failures. */
export function failureLine(answers) {
    const failed = (Array.isArray(answers) ? answers : []).filter((a) => FAILED.includes(a?.status))
    if (!failed.length) return ''
    const counts = new Map()
    for (const a of failed) {
        const message = a.error?.message || ''
        if (message) counts.set(message, (counts.get(message) || 0) + 1)
    }
    let message = ''
    let best = 0
    for (const [text, n] of counts) {
        if (n > best) {
            best = n
            message = text
        }
    }
    const head = `${plural(failed.length, 'answer', 'answers')} failed`
    return message ? `${head}: ${message}` : `${head}.`
}

function engineLabel(engine) {
    return engine?.label || engineMeta(engine?.key).label
}

function measuredShare(engine) {
    return (engine?.answered || 0) > 0 && isNumber(engine?.share_pct)
}

/** "Likely 21% to 94%", or '' without a measured range. */
export function rangeText(low, high) {
    return isNumber(low) && isNumber(high) ? `Likely ${pct(low)} to ${pct(high)}` : ''
}

/** "#1.5", "#2" */
export function rankText(rank) {
    if (!isNumber(rank)) return ''
    const rounded = Math.round(rank * 10) / 10
    return `#${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`
}

/** "Named in 2 of 3 answers", or "No answers" (the panel's line under each engine). */
export function namedLine(engine, { active = false } = {}) {
    if (!measuredShare(engine)) return active ? 'No answers yet' : 'No answers'
    return `Named in ${count(engine.named || 0)} of ${plural(engine.answered, 'answer', 'answers')}`
}

/**
 * One engine of a run on the card: a BarList item (the accent bar is
 * you), the range, the average rank when named and the failures. An
 * engine with no answer back reads "No answers" ("No answers yet" while
 * the run is still asking), never 0%.
 */
export function engineResult(engine, { active = false } = {}) {
    const label = engineLabel(engine)
    const measured = measuredShare(engine)
    return {
        key: String(engine?.key || label),
        item: {
            key: String(engine?.key || label),
            label: measured
                ? `${label}: named in ${count(engine.named || 0)} of ${plural(engine.answered, 'answer', 'answers')}`
                : label,
            value: measured ? engine.share_pct : null,
            text: measured ? pct(engine.share_pct) : active ? 'No answers yet' : 'No answers',
            emphasis: true,
            hint: measured ? rangeText(engine.share_low_pct, engine.share_high_pct) : '',
        },
        rank: measured && isNumber(engine.avg_rank) ? `Average rank ${rankText(engine.avg_rank)} when named` : '',
        failures: failureLine(engine?.answers),
    }
}

// ── Ask AI: the panel ──

const TONES = Object.freeze({ positive: 'Positive', neutral: 'Neutral', negative: 'Negative' })

/** "Asked 5m ago, 3 per engine, AI $0.07" */
export function askedLine(run) {
    const when = timeAgo(run?.created_at)
    return [when ? `Asked ${when}` : 'Asked', `${count(run?.samples)} per engine`, `AI ${usdCost(run?.cost?.ai_usd) || '$0.00'}`].join(
        ', '
    )
}

/** One answer's outcome: "Named, rank #2", "Not named", "Failed: {message}"... */
export function answerStatus(answer) {
    switch (answer?.status) {
        case 'done':
            if (!answer.mentioned) return 'Not named'
            return isNumber(answer.rank) ? `Named, rank #${answer.rank}` : 'Named'
        case 'failed':
        case 'skipped':
            return answer.error?.message ? `Failed: ${answer.error.message}` : 'Failed'
        case 'cancelled':
            return 'Stopped'
        case 'running':
            return 'Asking...'
        default:
            return 'Waiting'
    }
}

/** The tone of an answer that named you: "Positive", "Neutral", "Negative", or ''. */
export function toneWord(sentiment) {
    return TONES[sentiment] || ''
}

/** "Also named: Evernote, OneNote", or '' when no other brand was named. */
export function alsoNamed(brands) {
    const list = (Array.isArray(brands) ? brands : [])
        .filter((b) => b && b.name)
        .slice()
        .sort((a, b) => (isNumber(a.position) ? a.position : Infinity) - (isNumber(b.position) ? b.position : Infinity))
    return list.length ? `Also named: ${list.map((b) => b.name).join(', ')}` : ''
}

/** "4 sources" */
export function sourcesText(n) {
    return plural(isNumber(n) ? n : 0, 'source', 'sources')
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function parseDate(iso) {
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
}

/** A row of Recent questions: the text, the day it was asked, per engine "{m}/{n}". */
export function recentRow(run) {
    const date = parseDate(run?.created_at)
    return {
        id: String(run?.id ?? ''),
        text: run?.text || '',
        date: date ? SHORT_DATE.format(date) : '',
        engines: (Array.isArray(run?.engines) ? run.engines : []).map((e) => ({
            key: String(e?.key || ''),
            text: `${engineLabel(e)}: ${(e?.answered || 0) > 0 ? `${count(e.named || 0)}/${count(e.answered)}` : 'No answers'}`,
        })),
    }
}

/** An API error as the widgets read it: {status, code, message, details}. */
export function failureOf(err) {
    const body = err?.response?.data?.error
    const object = body && typeof body === 'object' ? body : null
    return {
        status: err?.response?.status || 0,
        code: typeof body === 'string' ? body : object?.code || '',
        message: object?.message || err?.displayMessage || COPY.fallbackError,
        details: object?.details || null,
    }
}

// ── Prompt ranking ──

export const TOP_ON_CARD = 5
export const WEAKEST_ON_CARD = 3

/** "Google #4", "Not in Google's top 10", "Google check failed" or "Google not checked". */
export function googleCell(google) {
    const g = google || {}
    if (g.status === 'ok') return isNumber(g.position) && g.position > 0 ? `Google #${g.position}` : `Not in Google's top ${g.depth || 10}`
    if (g.status === 'error') return 'Google check failed'
    return 'Google not checked'
}

/** " (+14)", " (-3)" or " (0)" in whole points; '' when the change was not measured. */
export function changeSuffix(pts) {
    if (!isNumber(pts)) return ''
    const r = Math.round(pts)
    if (r > 0) return ` (+${r})`
    if (r < 0) return ` (-${Math.abs(r)})`
    return ' (0)'
}

/** One prompt as a BarList item: its share as the accent bar, "{named}/{answers}" and the Google cell. */
export function rankingItem(row) {
    const measured = (row?.answers || 0) > 0 && isNumber(row?.share_pct)
    return {
        key: String(row?.prompt_id ?? ''),
        label: row?.text || '',
        value: measured ? row.share_pct : null,
        text: `${count(row?.named || 0)}/${count(row?.answers || 0)}${changeSuffix(row?.change_pts)}`,
        emphasis: true,
        hint: googleCell(row?.google),
    }
}

function byRank(a, b) {
    return (isNumber(a.rank) ? a.rank : Infinity) - (isNumber(b.rank) ? b.rank : Infinity)
}

function rankedOf(prompts) {
    return (Array.isArray(prompts) ? prompts : []).filter((p) => p?.ranked).sort(byRank)
}

/**
 * The card's two lists: Keep you visible (up to 5, best first) and Weakest
 * (up to 3, weakest first). They never share a row; with fewer than two
 * ranked prompts there is no Weakest, and with few prompts the two split
 * them, the better half on top.
 */
export function rankingLists(prompts) {
    const ranked = rankedOf(prompts)
    const n = ranked.length
    if (n < 2) return { top: ranked.map(rankingItem), weakest: [] }
    const weak = Math.min(WEAKEST_ON_CARD, Math.floor(n / 2))
    const top = Math.min(TOP_ON_CARD, n - weak)
    return {
        top: ranked.slice(0, top).map(rankingItem),
        weakest: ranked.slice(n - weak).reverse().map(rankingItem),
    }
}

/** "Share of answers that name you, last 7 days." plus how many need more answers. */
export function rankingFoot(payload) {
    const prompts = Array.isArray(payload?.prompts) ? payload.prompts : []
    const ranked = prompts.filter((p) => p?.ranked).length
    if (!ranked) return ''
    const waiting = prompts.length - ranked
    if (!waiting) return COPY.shareFoot
    return `${COPY.shareFoot} ${count(waiting)} ${waiting === 1 ? 'prompt needs' : 'prompts need'} more answers to rank.`
}

/** What the card shows instead of its lists, or null: {title, action}. */
export function rankingEmpty(payload) {
    const prompts = Array.isArray(payload?.prompts) ? payload.prompts : []
    if (!prompts.length) return { title: 'Track a prompt first.', action: 'Add prompts' }
    if (!prompts.some((p) => p?.ranked)) {
        const min = isNumber(payload?.min_answers) ? payload.min_answers : 4
        return { title: `Prompts are ranked once they have ${count(min)} answers in 7 days.`, action: '' }
    }
    return null
}

/** Over the plan's cap: "You track 120 prompts and your plan covers 100. ...", or ''. */
export function overCapLine(tracked) {
    const t = tracked || {}
    if (!isNumber(t.limit) || t.limit < 0 || !((t.over_limit || 0) > 0)) return ''
    const limit = count(t.limit)
    return `You track ${count(t.count)} prompts and your plan covers ${limit}. Autopilot checks the ${limit} oldest.`
}

const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "today at 7:04 AM", "yesterday at 7:04 AM", "tomorrow at 7:00 AM", "on Nov 2 at 7:04 AM" (local time). */
export function whenText(iso, now = new Date()) {
    const date = parseDate(iso)
    if (!date) return ''
    const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
    const time = TIME.format(date).replace(/\s/g, ' ')
    if (days === 0) return `today at ${time}`
    if (days === -1) return `yesterday at ${time}`
    if (days === 1) return `tomorrow at ${time}`
    return `on ${SHORT_DATE.format(date)} at ${time}`
}

/**
 * The card's first line: {text, turnOn}. The last run's share, Autopilot's
 * first run, or that it is off for this project (`turnOn`: the card links to
 * its settings). Null without the autopilot block.
 */
export function autopilotLine(autopilot, now = new Date()) {
    if (!autopilot) return null
    if (!autopilot.enabled) return { text: COPY.autopilotOff, turnOn: true }
    const last = autopilot.last_run
    if (last) {
        const when = whenText(last.finished_at || last.started_at, now)
        const ran = when ? `Autopilot ran ${when}` : 'Autopilot ran'
        const answers = last.answers || {}
        if ((answers.answered || 0) > 0 && isNumber(answers.share_pct)) {
            return {
                text: `${ran}: named in ${count(answers.named || 0)} of ${plural(answers.answered, 'answer', 'answers')} (${pct(answers.share_pct)}).`,
                turnOn: false,
            }
        }
        return { text: `${ran}: no AI answers.`, turnOn: false }
    }
    const next = whenText(autopilot.next_run_at, now)
    return next ? { text: `Autopilot runs first ${next}.`, turnOn: false } : null
}

// ── Prompt ranking: the panel ──

export const ORDERS = Object.freeze([
    { value: 'best', label: 'Best first' },
    { value: 'weakest', label: 'Weakest first' },
])

export function normalizeOrder(raw) {
    const value = Array.isArray(raw) ? raw[0] : raw
    return value === 'weakest' ? 'weakest' : 'best'
}

/** "up 6 pts", "down 1 pt", "no change" (under half a point), or ''. */
export function changeWords(pts) {
    if (!isNumber(pts)) return ''
    if (Math.abs(pts) < 0.5) return 'no change'
    const r = Math.round(Math.abs(pts))
    return `${pts > 0 ? 'up' : 'down'} ${r} ${r === 1 ? 'pt' : 'pts'}`
}

/**
 * "Named in 49 of 126 answers in the last 7 days (39%), up 6 pts on the 7
 * days before." The change clause is left out when it was not measured.
 */
export function rankingHeadline(headline) {
    const h = headline || {}
    if (!((h.answers || 0) > 0) || !isNumber(h.share_pct)) return 'No AI answers in the last 7 days.'
    const head = `Named in ${count(h.named || 0)} of ${plural(h.answers, 'answer', 'answers')} in the last 7 days (${pct(h.share_pct)})`
    const change = changeWords(h.change_pts)
    return change ? `${head}, ${change} on the 7 days before.` : `${head}.`
}

/** The table's rows: ranked prompts in the chosen order, then the ones that need more answers. */
export function orderedRows(prompts, order = 'best') {
    const ranked = rankedOf(prompts)
    const waiting = (Array.isArray(prompts) ? prompts : []).filter((p) => p && !p.ranked)
    return [...(order === 'weakest' ? ranked.reverse() : ranked), ...waiting]
}

/** The engines of the table's columns, in the order the server sends them. */
export function engineColumns(prompts) {
    const keys = []
    for (const p of Array.isArray(prompts) ? prompts : []) {
        for (const key of Object.keys(p?.engines || {})) if (!keys.includes(key)) keys.push(key)
    }
    return keys.map((key) => ({ key, label: engineMeta(key).label }))
}

export function rankCell(row) {
    return row?.ranked && isNumber(row.rank) ? count(row.rank) : 'Needs more answers'
}

/** "86%, likely 60-96%", or "No answers". */
export function namedCell(row) {
    if (!((row?.answers || 0) > 0) || !isNumber(row?.share_pct)) return 'No answers'
    const range =
        isNumber(row.share_low_pct) && isNumber(row.share_high_pct)
            ? `, likely ${Math.round(row.share_low_pct)}-${Math.round(row.share_high_pct)}%`
            : ''
    return `${pct(row.share_pct)}${range}`
}

/** "+14 pts", "-3 pts", "0 pts", or "Not measured" with too few answers the week before. */
export function changeCell(pts) {
    if (!isNumber(pts)) return 'Not measured'
    const r = Math.round(pts)
    const size = Math.abs(r)
    return `${r > 0 ? '+' : r < 0 ? '-' : ''}${size} ${size === 1 ? 'pt' : 'pts'}`
}

/** "{named}/{answers}" for one engine, or "No answers". */
export function engineCell(cell) {
    const n = cell?.answers || 0
    return n > 0 ? `${count(cell.named || 0)}/${count(n)}` : 'No answers'
}
