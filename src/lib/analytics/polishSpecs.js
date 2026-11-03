// Chart specs (contract 8a) and stat tiles for the pages that existed
// before the chart system: the Overview (KPI tiles, gap map, leaderboard,
// engines by prompt), the Prompt page's Google history, Sources and its URL
// detail, and Settings > AI usage. Pure functions: the pages render what
// these return through VizChart and VizStatTile.
//
// A value that was not measured is null with a state word, never 0. Counts
// of things that were measured (prompts in a gap class, retrievals) may be 0.
import { engineMeta } from '@/lib/engines'
import { GAP } from '@/lib/gap'

const DAY_MS = 86400000
const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round1(value) {
    return Math.round(value * 10) / 10
}

/* ── Overview ── */

/**
 * The Overview's five KPI tiles (VizStatTile props plus a key). AI
 * visibility gains a change against the previous 30 days from the
 * visibility dashboard's `headline`, only when both windows have a value.
 */
export function overviewTiles(kpis, headline = null) {
    const k = kpis || {}
    const now = num(headline?.visibility_pct)
    const before = num(headline?.visibility_prev_pct)
    const visibilityDelta =
        now !== null && before !== null
            ? { value: round1(now - before), unit: 'pts', label: 'vs previous 30 days', goodWhen: 'up' }
            : null
    const count = (value) => num(value) ?? 0
    return [
        {
            key: 'ai_visibility',
            label: 'AI visibility',
            value: num(k.ai_visibility_pct),
            kind: 'percent',
            stateText: 'No answers yet',
            delta: visibilityDelta,
            hint: 'Share of recent AI answers that name you',
        },
        {
            key: 'avg_google_position',
            label: 'Avg. Google position',
            value: num(k.avg_google_position),
            kind: 'rank',
            // No average: nothing was checked, or every check missed you.
            stateText: count(k.google_checked) > 0 ? 'Not found' : 'Not checked',
            hint: k.not_in_google
                ? `${k.not_in_google} not in the top 100`
                : `${count(k.google_checked)} of ${count(k.prompts)} checked`,
        },
        {
            key: 'ai_ahead',
            label: 'AI ahead',
            value: num(k.ai_ahead),
            kind: 'count',
            tone: GAP.ai_ahead.color,
            hint: 'AI ranks you higher than Google',
        },
        {
            key: 'google_ahead',
            label: 'Google ahead',
            value: num(k.google_ahead),
            kind: 'count',
            tone: GAP.google_ahead.color,
            hint: 'Google ranks you higher than AI',
        },
        {
            key: 'invisible_both',
            label: 'Invisible in both',
            value: num(k.invisible_both),
            kind: 'count',
            tone: GAP.invisible_both.color,
            hint: 'Neither surfaces you',
        },
    ]
}

// "Not in top {depth}" for a set of searches that missed: the smallest
// depth is true for every one of them.
function notInTop(depths) {
    const known = depths.filter((d) => typeof d === 'number' && d > 0)
    return known.length ? `Not in top ${Math.min(...known)}` : 'Not found'
}

function promptNames(rows) {
    return Object.fromEntries(rows.map((p) => [String(p.prompt_id), p.text || '']))
}

/**
 * The gap map panel: the scatter (custom "Map") and its table, one row per
 * prompt with its Google position, AI score and gap value.
 */
export function gapMapSpec(prompts) {
    const rows = Array.isArray(prompts) ? prompts : []
    const google = rows.map((p) => p.google || {})
    const missed = google.filter((g) => g.status === 'ok' && !g.position).map((g) => g.depth)
    return {
        id: 'overview.gap_map',
        title: 'The gap, prompt by prompt',
        subtitle: 'Left is better on Google, up is better in AI answers.',
        x: 'category',
        labels: rows.map((p) => String(p.prompt_id)),
        label_names: promptNames(rows),
        label_header: 'Prompt',
        datasets: [
            {
                key: 'google',
                label: 'Google',
                value: 'rank',
                data: google.map((g) => (g.status === 'ok' && g.position ? g.position : null)),
                states: google.map((g) => {
                    if (g.status === 'ok') return g.position ? null : 'not_found'
                    return g.status === 'error' ? 'failed' : 'not_checked'
                }),
            },
            {
                key: 'ai_score',
                label: 'AI score',
                value: 'count',
                data: rows.map((p) => num(p.gap?.ai_score)),
                states: rows.map((p) => (num(p.gap?.ai_score) === null ? 'not_measured' : null)),
            },
            {
                key: 'gap',
                label: 'Gap',
                value: 'number',
                data: rows.map((p) => num(p.gap?.value)),
                states: rows.map((p) => (num(p.gap?.value) === null ? 'not_checked' : null)),
                // The table names the class with its value ("Google ahead (-40)"),
                // so the gap never reads as a bare number.
                texts: rows.map((p) => gapText(p.gap)),
            },
        ],
        type: 'custom',
        representations: ['custom', 'table'],
        custom_label: 'Map',
        state_labels: { not_found: notInTop(missed), failed: 'Check failed', not_measured: 'No answers yet' },
    }
}

function gapText(gap) {
    const meta = GAP[gap?.class]
    if (!meta || gap.class === 'no_data') return null
    const value = num(gap.value)
    if (value === null) return meta.label
    return `${meta.label} (${value > 0 ? '+' : ''}${value})`
}

/** The five gap classes the map colours, for the legend under it. */
export const GAP_MAP_CLASSES = Object.freeze(['ai_ahead', 'google_ahead', 'strong_both', 'invisible_both', 'even'])

/** "Who AI recommends": the leaderboard as a list, bars or a table. */
export function leaderboardSpec(brands) {
    const list = Array.isArray(brands) ? brands : []
    return {
        id: 'overview.leaderboard',
        title: 'Who AI recommends',
        subtitle: 'Share of the latest answers that name each brand.',
        x: 'category',
        value: 'percent',
        labels: list.map((b) => String(b.name ?? '')),
        label_header: 'Brand',
        datasets: [{ key: 'visibility', label: 'AI visibility', data: list.map((b) => num(b.visibility_pct)) }],
        type: 'custom',
        representations: ['custom', 'hbar', 'table'],
        custom_label: 'List',
    }
}

/** The name of your own brand on the leaderboard ('' when it is not there). */
export function yourBrand(brands) {
    const you = (Array.isArray(brands) ? brands : []).find((b) => b.is_you)
    return you ? String(you.name ?? '') : ''
}

/**
 * Engines by prompt: the `limit` prompts with the largest absolute gap
 * (rows) by engine (columns), the share of recent answers that name you.
 */
export function engineHeatmapSpec(prompts, engines, { limit = 15 } = {}) {
    const rows = (Array.isArray(prompts) ? prompts : [])
        .map((p, i) => ({ p, i, size: Math.abs(num(p.gap?.value) ?? 0) }))
        .sort((a, b) => b.size - a.size || a.i - b.i)
        .slice(0, limit)
        .map((r) => r.p)
    const columns = (Array.isArray(engines) ? engines : []).map((e) => ({
        key: e.key,
        label: e.label || engineMeta(e.key).label,
        configured: e.configured !== false,
    }))
    return {
        id: 'overview.engines',
        title: 'Engines by prompt',
        subtitle: "Share of each engine's recent answers that name you.",
        x: 'category',
        value: 'percent',
        labels: rows.map((p) => String(p.prompt_id)),
        label_names: promptNames(rows),
        label_header: 'Prompt',
        datasets: columns.map((e) => {
            const cells = rows.map((p) => p.engines?.[e.key] || null)
            const configured = (c) => e.configured && c?.configured !== false
            const answered = (c) => configured(c) && (c?.answers || 0) > 0
            return {
                key: e.key,
                label: e.label,
                entity: `engine:${e.key}`,
                data: cells.map((c) => (answered(c) ? num(c.visibility_pct) : null)),
                states: cells.map((c) => {
                    if (!configured(c)) return 'not_configured'
                    return answered(c) ? null : 'not_checked'
                }),
            }
        }),
        type: 'heatmap',
        representations: ['heatmap', 'table'],
    }
}

/* ── Prompt page ── */

function sameLocation(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

/**
 * The prompt's Google position, one point per check from the prompt's own
 * location (oldest first). A failed check reads Failed; a search that did
 * not find you reads "Not in top {depth}".
 */
export function googleHistorySpec(history, { location = '' } = {}) {
    const checks = (Array.isArray(history) ? history : []).filter((h) => h && sameLocation(h.location, location))
    const missed = checks.filter((h) => !h.error && !h.position).map((h) => h.depth)
    return {
        id: 'prompt.google',
        title: 'Google position',
        subtitle: 'Your position in each Google check of this prompt.',
        x: 'time',
        time_unit: 'day',
        value: 'rank',
        labels: checks.map((h) => String(h.checked_at || '')),
        datasets: [
            {
                key: 'position',
                label: 'Google position',
                data: checks.map((h) => (!h.error && h.position ? h.position : null)),
                states: checks.map((h) => {
                    if (h.error) return 'failed'
                    return h.position ? null : 'not_found'
                }),
            },
        ],
        type: 'line',
        representations: ['line', 'table'],
        state_labels: { not_found: notInTop(missed) },
    }
}

/* ── Sources ── */

function shortDay(date) {
    return `${SHORT_MONTH.format(date)} ${String(date.getUTCDate()).padStart(2, '0')}`
}

function isoDate(text) {
    const m = String(text || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
}

/**
 * ISO dates for consecutive day labels the server printed as "%b %d"
 * ("Nov 03"): from `start` when the payload gives it, else ending on the day
 * near `today` (UTC) that the last label names. Null when any label does
 * not match its day, so the caller keeps the labels as plain categories.
 */
export function isoDays(labels, { start = null, today = new Date() } = {}) {
    const list = Array.isArray(labels) ? labels.map((l) => String(l ?? '')) : []
    if (!list.length) return null
    let first = start ? isoDate(start) : null
    if (!first) {
        const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
        const last = [0, -1, 1, -2, 2]
            .map((offset) => new Date(base + offset * DAY_MS))
            .find((d) => shortDay(d) === list[list.length - 1])
        if (!last) return null
        first = new Date(last.getTime() - (list.length - 1) * DAY_MS)
    }
    const out = []
    for (let i = 0; i < list.length; i++) {
        const day = new Date(first.getTime() + i * DAY_MS)
        if (shortDay(day) !== list[i]) return null
        out.push(day.toISOString().slice(0, 10))
    }
    return out
}

function dayAxis(labels, options) {
    const iso = isoDays(labels, options)
    return iso ? { x: 'time', time_unit: 'day', labels: iso } : { x: 'category', labels: labels || [] }
}

/**
 * Retrievals over time for the five most-used domains. `slots` is the
 * page's stableSlots() result, so a domain keeps its colour across filter
 * changes.
 */
export function retrievalsSpec(overview, slots, { start = null } = {}) {
    const series = Array.isArray(overview?.series) ? overview.series : []
    const keyOf = (s) => String(s.key ?? s.label ?? '')
    return {
        id: 'sources.retrievals',
        title: 'Retrievals over time',
        subtitle: 'Daily retrievals for the five most-used domains in this period',
        ...dayAxis(overview?.labels, { start }),
        value: 'count',
        datasets: series.map((s) => ({
            key: keyOf(s),
            label: String(s.label ?? keyOf(s)),
            entity: `slot:${slots?.get(keyOf(s)) ?? 'other'}`,
            data: Array.isArray(s.data) ? s.data : [],
        })),
        stacked: true,
        type: 'line',
        representations: ['line', 'area', 'stacked_bar', 'heatmap', 'table'],
    }
}

/** URL types: each format's share of all retrievals in the period. */
export function urlTypesSpec(urlTypes) {
    const list = Array.isArray(urlTypes) ? urlTypes : []
    return {
        id: 'sources.url_types',
        title: 'URL types',
        x: 'category',
        value: 'percent',
        labels: list.map((t) => String(t.type ?? '')),
        label_header: 'URL type',
        datasets: [{ key: 'share', label: 'Share of retrievals', data: list.map((t) => num(t.pct)) }],
        stacked: true,
    }
}

/** One URL's retrievals per day, this period against the previous one. */
export function urlRetrievalsSpec(overTime) {
    return {
        id: 'sources.url_retrievals',
        title: 'Retrievals',
        subtitle: 'No. of times AI uses this URL as a source',
        ...dayAxis(overTime?.labels),
        value: 'count',
        datasets: [
            { key: 'current', label: 'This period', entity: 'slot:1', data: overTime?.current || [] },
            { key: 'previous', label: 'Previous period', entity: 'muted', data: overTime?.previous || [] },
        ],
        type: 'bar',
        representations: ['bar', 'line', 'table'],
    }
}

/** One URL's retrievals by AI model: this period or the previous one. */
export function urlModelsSpec(rows) {
    const list = (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, key: engineMeta(r.model).key }))
    return {
        id: 'sources.url_models',
        title: 'Retrievals by model',
        subtitle: 'No. of times this URL is retrieved in chats',
        x: 'category',
        value: 'count',
        labels: list.map((r) => r.key),
        label_names: Object.fromEntries(list.map((r) => [r.key, engineMeta(r.key).label])),
        label_entities: Object.fromEntries(list.map((r) => [r.key, `engine:${r.key}`])),
        label_header: 'Model',
        datasets: [
            { key: 'current', label: 'This period', data: list.map((r) => num(r.current)) },
            { key: 'previous', label: 'Previous period', data: list.map((r) => num(r.previous)) },
        ],
        pick_one: true,
        stacked: true,
        type: 'bar',
        representations: ['bar', 'doughnut', 'table'],
    }
}

/* ── Settings ── */

/** AI spend per day across the current billing period. */
export function aiUsageSpec(daily, { subtitle = '' } = {}) {
    const days = Array.isArray(daily) ? daily : []
    return {
        id: 'settings.ai_usage',
        title: 'Daily usage',
        subtitle,
        x: 'time',
        time_unit: 'day',
        value: 'usd',
        labels: days.map((d) => String(d.day ?? '')),
        datasets: [{ key: 'cost', label: 'Estimated cost', data: days.map((d) => num(d.cost)) }],
        type: 'bar',
        representations: ['bar', 'line', 'table'],
    }
}
