// Chart specs (contract 8a) and stat tiles for the visibility dashboard
// payload (contract 5). Pure functions: the page and the board's cards
// render what these return through VizChart and VizStatTile.
//
// A null in the payload is a gap or a state word, never a zero: buckets
// without answers have null rates, and the charts keep them as gaps.
import { engineMeta } from '@/lib/engines'

const SENTIMENTS = [
    { key: 'negative', label: 'Negative' },
    { key: 'neutral', label: 'Neutral' },
    { key: 'positive', label: 'Positive' },
]

function buckets(payload) {
    return [...(payload?.window?.buckets || [])]
}

function timeUnit(payload) {
    return payload?.window?.interval === 'week' ? 'week' : 'day'
}

// Pad or cut a series to the bucket count; anything that is not a finite
// number is null.
function fit(values, length) {
    const out = []
    for (let i = 0; i < length; i++) {
        const v = values?.[i]
        out.push(typeof v === 'number' && Number.isFinite(v) ? v : null)
    }
    return out
}

function engineLabel(payload, key) {
    const listed = (payload?.engines || []).find((e) => e.key === key)
    return listed?.label || engineMeta(key).label
}

/**
 * Visibility over time, one line per engine. Also used by the Prompt
 * page's history (with its own id and title).
 */
export function visibilityOverTime(
    payload,
    {
        id = 'visibility.engines',
        title = 'Visibility over time',
        subtitle = 'Share of answers that name you, by engine.',
    } = {},
) {
    const labels = buckets(payload)
    const unit = timeUnit(payload)
    return {
        id,
        title,
        subtitle,
        x: 'time',
        time_unit: unit,
        value: 'percent',
        labels,
        datasets: (payload?.visibility?.by_engine || []).map((row) => ({
            key: row.key,
            label: engineLabel(payload, row.key),
            entity: `engine:${row.key}`,
            data: fit(row.visibility_pct, labels.length),
        })),
        type: 'line',
        missing_label: 'No answers',
        footnote: `Each point is the share of that ${unit}'s answers that name you. Days without answers are gaps.`,
    }
}

// The engines a per-prompt or per-engine view shows: the configured ones,
// plus any that still has answers in the window. The engine filter wins.
function shownEngines(payload, hasAnswers) {
    const filter = payload?.filters?.engine
    const listed = payload?.engines || []
    if (filter) {
        const one = listed.find((e) => e.key === filter)
        return [{ key: filter, label: one?.label || engineMeta(filter).label, configured: one ? one.configured !== false : true }]
    }
    return listed
        .filter((e) => e.configured || hasAnswers(e.key))
        .map((e) => ({ key: e.key, label: e.label || engineMeta(e.key).label, configured: Boolean(e.configured) }))
}

/**
 * Prompts (rows) by engine (columns): the share of answers that name you.
 * It starts as the table (calm, board_contract.md 10); the heatmap stays
 * one switch away.
 */
export function byPromptHeatmap(payload) {
    const prompts = payload?.by_prompt || []
    const engines = shownEngines(payload, (key) => prompts.some((p) => (p.engines?.[key]?.answers || 0) > 0))
    return {
        id: 'visibility.by_prompt',
        title: 'By prompt',
        subtitle: "Share of each engine's answers that name you, prompt by prompt.",
        x: 'category',
        value: 'percent',
        labels: prompts.map((p) => String(p.prompt_id)),
        label_names: Object.fromEntries(prompts.map((p) => [String(p.prompt_id), p.text])),
        label_header: 'Prompt',
        datasets: engines.map((e) => {
            const cells = prompts.map((p) => p.engines?.[e.key] || null)
            return {
                key: e.key,
                label: e.label,
                entity: `engine:${e.key}`,
                data: cells.map((c) => (e.configured && c && c.answers > 0 ? c.visibility_pct ?? null : null)),
                states: cells.map((c) => {
                    if (!e.configured) return 'not_configured'
                    if (!c || !(c.answers > 0)) return 'not_checked'
                    return null
                }),
            }
        }),
        type: 'table',
        representations: ['heatmap'],
    }
}

/** True when any brand was named in the window's answers. */
export function hasBrandMentions(payload) {
    return (payload?.share_of_voice?.brands || []).some((b) => (b.mentions || 0) > 0)
}

/** Share of voice per bucket, one series per brand (you first). */
export function shareOfVoiceOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.share_of_voice?.series || {}
    return {
        id: 'visibility.sov',
        title: 'Share of voice over time',
        subtitle: 'Your share of all brand mentions in the answers.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'percent',
        labels,
        datasets: (payload?.share_of_voice?.brands || []).map((b) => ({
            key: b.key,
            label: b.name,
            entity: `brand:${b.key}`,
            data: fit(series[b.key], labels.length),
        })),
        stacked: true,
        type: 'line',
        representations: ['line', 'area', 'stacked_bar'],
        missing_label: 'No brands named',
    }
}

/** Each brand's share of all mentions over the whole window. */
export function shareOfVoiceTotal(payload) {
    const brands = payload?.share_of_voice?.brands || []
    return {
        id: 'visibility.sov_total',
        title: 'Share of voice in this period',
        subtitle: "Each brand's share of all brand mentions.",
        x: 'category',
        value: 'percent',
        labels: brands.map((b) => b.key),
        label_names: Object.fromEntries(brands.map((b) => [b.key, b.name])),
        label_entities: Object.fromEntries(brands.map((b) => [b.key, `brand:${b.key}`])),
        label_header: 'Brand',
        datasets: [
            {
                key: 'share',
                label: 'Share of voice',
                data: brands.map((b) => (typeof b.share_pct === 'number' ? b.share_pct : null)),
            },
        ],
        stacked: true,
        type: 'hbar',
    }
}

/** True when any answer named you with a tone. */
export function hasSentiment(payload) {
    const totals = payload?.sentiment?.totals || {}
    return SENTIMENTS.some((s) => (totals[s.key] || 0) > 0)
}

/** The tone of the answers that name you, per bucket. */
export function sentimentOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.sentiment?.series || {}
    return {
        id: 'visibility.sentiment',
        title: 'Sentiment when you are named',
        subtitle: 'Tone of the answers that name you.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'count',
        labels,
        datasets: SENTIMENTS.map((s) => ({
            key: s.key,
            label: s.label,
            entity: `sentiment:${s.key}`,
            data: fit(series[s.key], labels.length),
        })),
        stacked: true,
        type: 'stacked_bar',
        representations: ['stacked_bar', 'line'],
    }
}

/** Citations per bucket: your site, competitors' sites and every other site. */
export function citationsOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.citations?.series || {}
    const parts = [
        { key: 'yours', label: 'Yours', entity: 'brand:you' },
        { key: 'competitors', label: 'Competitors', entity: 'brand:b1' },
        { key: 'other', label: 'Other', entity: 'muted' },
    ]
    return {
        id: 'visibility.citations',
        title: 'Citations over time',
        subtitle: "Sources cited in the answers: yours, competitors' and others.",
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'count',
        labels,
        datasets: parts.map((p) => ({ ...p, data: fit(series[p.key], labels.length) })),
        stacked: true,
        type: 'stacked_bar',
        representations: ['stacked_bar', 'line', 'area'],
    }
}

/** The most cited domains: citations, or the answers citing each one. */
export function topDomains(payload) {
    const domains = payload?.citations?.top_domains || []
    const name = (d) => `${d.domain}${d.is_yours ? ' (yours)' : d.is_competitor ? ' (competitor)' : ''}`
    return {
        id: 'visibility.domains',
        title: 'Most cited domains',
        subtitle: 'The sites the engines cite most often.',
        x: 'category',
        value: 'count',
        labels: domains.map((d) => d.domain),
        label_names: Object.fromEntries(domains.map((d) => [d.domain, name(d)])),
        label_header: 'Domain',
        datasets: [
            { key: 'citations', label: 'Citations', value: 'count', data: domains.map((d) => d.citations ?? null) },
            { key: 'answers', label: 'Answers citing it', value: 'count', data: domains.map((d) => d.answers ?? null) },
        ],
        pick_one: true,
        type: 'hbar',
        representations: ['hbar'],
    }
}

/** Visibility, answers and rank per engine; one measure drawn at a time. */
export function byEngine(payload) {
    const rows = payload?.by_engine || []
    const engines = shownEngines(payload, (key) => (rows.find((r) => r.key === key)?.answers || 0) > 0)
    const row = (key) => rows.find((r) => r.key === key) || null
    const measure = (pick) =>
        engines.map((e) => {
            const r = row(e.key)
            if (!e.configured) return { value: null, state: 'not_configured' }
            return pick(r)
        })
    const visibility = measure((r) =>
        r && r.answers > 0 && typeof r.visibility_pct === 'number'
            ? { value: r.visibility_pct, state: null }
            : { value: null, state: 'not_measured' },
    )
    const answers = measure((r) => ({ value: r?.answers ?? 0, state: null }))
    const rank = measure((r) => {
        if (!r || !(r.answers > 0)) return { value: null, state: 'not_measured' }
        if (typeof r.avg_rank === 'number') return { value: r.avg_rank, state: null }
        return { value: null, state: r.mentioned > 0 ? 'named' : 'not_found' }
    })
    const dataset = (key, label, value, points) => ({
        key,
        label,
        value,
        data: points.map((p) => p.value),
        states: points.map((p) => p.state),
    })
    return {
        id: 'visibility.by_engine_bar',
        title: 'By engine',
        subtitle: 'How each engine treats you in this period.',
        x: 'category',
        value: 'percent',
        labels: engines.map((e) => e.key),
        label_names: Object.fromEntries(engines.map((e) => [e.key, e.label])),
        label_header: 'Engine',
        datasets: [
            dataset('visibility', 'AI visibility', 'percent', visibility),
            dataset('answers', 'Answers', 'count', answers),
            dataset('avg_rank', 'Avg. rank when named', 'rank', rank),
        ],
        pick_one: true,
        type: 'bar',
        state_labels: { not_measured: 'No answers', not_found: 'Not named' },
    }
}

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 }

/** Days in a period key ('30d' -> 30); 30 when unknown. */
export function periodDays(period) {
    return PERIOD_DAYS[period] || 30
}

function round1(value) {
    return Math.round(value * 10) / 10
}

function difference(now, before) {
    if (typeof now !== 'number' || typeof before !== 'number') return null
    return round1(now - before)
}

const count = new Intl.NumberFormat('en-US')

/**
 * The five headline tiles (VizStatTile props plus a key). Deltas compare
 * with the previous window of equal length and exist only when both
 * windows have the number.
 */
export function headlineTiles(payload, { period = payload?.window?.period || '30d' } = {}) {
    const h = payload?.headline || {}
    const vs = `vs previous ${periodDays(period)} days`
    const delta = (value, unit, goodWhen) => (value === null ? null : { value, unit, label: vs, goodWhen })
    const answersChange =
        typeof h.answers === 'number' && typeof h.answers_prev === 'number' && h.answers_prev > 0
            ? round1(((h.answers - h.answers_prev) / h.answers_prev) * 100)
            : null
    const citationsKnown =
        payload?.citations?.has_data !== false && typeof h.citations === 'number' && typeof h.your_citations === 'number'
    return [
        {
            key: 'visibility',
            label: 'AI visibility',
            value: h.visibility_pct ?? null,
            kind: 'percent',
            stateText: 'No answers',
            delta: delta(difference(h.visibility_pct, h.visibility_prev_pct), 'pts', 'up'),
        },
        {
            key: 'share_of_voice',
            label: 'Share of voice',
            value: h.share_of_voice_pct ?? null,
            kind: 'percent',
            stateText: 'No brands named',
            delta: delta(difference(h.share_of_voice_pct, h.share_of_voice_prev_pct), 'pts', 'up'),
        },
        {
            key: 'avg_rank',
            label: 'Avg. rank when named',
            value: h.avg_rank ?? null,
            kind: 'rank',
            stateText: 'Not named',
            delta: delta(difference(h.avg_rank, h.avg_rank_prev), 'rank', 'down'),
        },
        {
            key: 'answers',
            label: 'Answers collected',
            value: typeof h.answers === 'number' ? h.answers : null,
            kind: 'count',
            stateText: 'Not measured',
            delta: delta(answersChange, 'pct', 'up'),
        },
        {
            key: 'citations',
            label: 'Your citations',
            value: citationsKnown ? `${count.format(h.your_citations)} of ${count.format(h.citations)}` : null,
            kind: 'number',
            stateText: 'Not recorded',
            delta: null,
        },
    ]
}
