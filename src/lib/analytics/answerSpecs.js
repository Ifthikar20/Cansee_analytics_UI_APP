// Chart specs (contract 8a) and stat tiles for Sentiment (contract 3c) and
// Fact check (contract 3d). Pure functions: the pages render what these
// return through VizChart and VizStatTile.
//
// Tone is the label stored with every answer that names you, so it needs
// no analysis. Themes, claims and verdicts exist only for analyzed answers:
// before any analysis they are null and read "Not analyzed", never 0.
import { engineMeta } from '@/lib/engines'
import { TONES as TONE_WORDS, VERDICTS } from './insightWords'

// Stacks run negative, neutral, positive (the diverging order).
const TONES = ['negative', 'neutral', 'positive'].map((key) => ({ key, label: TONE_WORDS[key] }))

// The three verdicts a chart draws; "Not checked" claims are listed in the
// table only. Status colours always come with the legend word.
const VERDICT_SERIES = [
    { key: 'contradicted', label: VERDICTS.contradicted.word, entity: 'status:critical' },
    { key: 'not_verifiable', label: VERDICTS.not_verifiable.word, entity: 'muted' },
    { key: 'supported', label: VERDICTS.supported.word, entity: 'status:good' },
]

const NOT_ANALYZED = 'Not analyzed'
const integer = new Intl.NumberFormat('en-US')

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function count(value) {
    return integer.format(value)
}

function buckets(payload) {
    return [...(payload?.window?.buckets || [])]
}

function timeUnit(payload) {
    return payload?.window?.interval === 'week' ? 'week' : 'day'
}

// Pad or cut a series to the bucket count; anything that is not a finite
// number is null (a gap, never a zero).
function fit(values, length) {
    const out = []
    for (let i = 0; i < length; i++) out.push(num(values?.[i]))
    return out
}

function engineLabel(payload, key) {
    const listed = (payload?.engines || []).find((e) => e.key === key)
    return listed?.label || engineMeta(key).label
}

function analyzedCount(payload) {
    return num(payload?.coverage?.analyzed)
}

/** `{analyzed} of {named}` answers that name you, or null. */
function analyzedText(payload) {
    const c = payload?.coverage || {}
    const analyzed = num(c.analyzed)
    const named = num(c.named_answers)
    return analyzed !== null && named !== null ? `${count(analyzed)} of ${count(named)}` : null
}

/* ── Sentiment ── */

/** The five Sentiment tiles (VizStatTile props plus a key). */
export function sentimentTiles(payload) {
    const named = num(payload?.coverage?.named_answers)
    const tone = payload?.tone || {}
    const ofNamed = named !== null ? `of ${count(named)} answers that name you` : ''
    const analyzed = analyzedCount(payload)
    const themes = Array.isArray(payload?.themes) ? payload.themes : []
    return [
        { key: 'named', label: 'Answers that name you', value: named, kind: 'count' },
        { key: 'positive', label: 'Positive', value: num(tone.positive), kind: 'count', hint: ofNamed },
        { key: 'negative', label: 'Negative', value: num(tone.negative), kind: 'count', hint: ofNamed },
        {
            key: 'themes',
            label: 'Themes found',
            value: analyzed > 0 ? themes.length : null,
            kind: 'count',
            stateText: NOT_ANALYZED,
        },
        { key: 'analyzed', label: 'Answers analyzed', value: analyzedText(payload), stateText: NOT_ANALYZED },
    ]
}

/** The tone stored with each answer that names you, per bucket. */
export function toneOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.tone?.series || {}
    return {
        id: 'sentiment.tone',
        title: 'Tone of answers that name you',
        subtitle: 'From every answer that names you; no analysis needed.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'count',
        labels,
        datasets: TONES.map((t) => ({
            key: t.key,
            label: t.label,
            entity: `sentiment:${t.key}`,
            data: fit(series[t.key], labels.length),
        })),
        stacked: true,
        type: 'stacked_bar',
    }
}

/** The theme rows of one tone, most answers first. */
export function themesOfTone(payload, tone, { limit = 10 } = {}) {
    return (Array.isArray(payload?.themes) ? payload.themes : [])
        .filter((t) => t && t.tone === tone)
        .sort((a, b) => (num(b.answers) ?? 0) - (num(a.answers) ?? 0))
        .slice(0, limit)
}

/** The top themes of one tone ('positive' or 'negative'), as bars. */
export function themesChart(payload, tone) {
    const rows = themesOfTone(payload, tone)
    return {
        id: `sentiment.themes_${tone}`,
        title: tone === 'negative' ? 'Negative themes' : 'Positive themes',
        subtitle: 'Answers that describe you this way.',
        x: 'category',
        value: 'count',
        labels: rows.map((t) => String(t.key)),
        label_names: Object.fromEntries(rows.map((t) => [String(t.key), t.label])),
        label_header: 'Theme',
        datasets: [
            {
                key: 'answers',
                label: 'Answers',
                value: 'count',
                entity: `sentiment:${tone}`,
                data: rows.map((t) => num(t.answers)),
            },
        ],
        type: 'hbar',
    }
}

// A theme count per engine reads "Not analyzed" until an answer of that
// engine is analyzed (the payload sends null), then a measured count.
function themeCounts(rows, key) {
    return rows.map((r) => {
        const value = num(r[key])
        return value === null ? NOT_ANALYZED : count(value)
    })
}

/** Tone per engine; the theme counts ride along in the table view. */
export function sentimentByEngine(payload) {
    const rows = Array.isArray(payload?.by_engine) ? payload.by_engine : []
    return {
        id: 'sentiment.by_engine',
        title: 'By engine',
        subtitle: 'Tone of the answers that name you, engine by engine.',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => r.key),
        label_names: Object.fromEntries(rows.map((r) => [r.key, engineLabel(payload, r.key)])),
        label_header: 'Engine',
        datasets: [
            ...TONES.map((t) => ({
                key: t.key,
                label: t.label,
                entity: `sentiment:${t.key}`,
                data: rows.map((r) => num(r[t.key])),
            })),
            // Text columns: shown in the table, never drawn.
            { key: 'themes_positive', label: 'Positive themes', data: [], texts: themeCounts(rows, 'themes_positive') },
            { key: 'themes_negative', label: 'Negative themes', data: [], texts: themeCounts(rows, 'themes_negative') },
        ],
        stacked: true,
        type: 'stacked_bar',
    }
}

/** Tone per prompt (rows) as a heatmap; a row opens the prompt page. */
export function sentimentByPrompt(payload) {
    const rows = Array.isArray(payload?.by_prompt) ? payload.by_prompt : []
    return {
        id: 'sentiment.by_prompt',
        title: 'By prompt',
        subtitle: 'Tone of the answers that name you, prompt by prompt.',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => String(r.prompt_id)),
        label_names: Object.fromEntries(rows.map((r) => [String(r.prompt_id), r.text])),
        label_header: 'Prompt',
        datasets: TONES.map((t) => ({
            key: t.key,
            label: t.label,
            entity: `sentiment:${t.key}`,
            data: rows.map((r) => num(r[t.key])),
        })),
        stacked: true,
        type: 'heatmap',
    }
}

/* ── Fact check ── */

/**
 * The five Fact check tiles. Before any analysis (`totals` null) the four
 * claim tiles read "Not analyzed", never 0.
 */
export function factCheckTiles(payload) {
    const t = payload?.totals || null
    const claims = num(t?.claims)
    const checked = claims === null ? null : claims - (num(t?.unchecked) ?? 0)
    const hint = checked === null ? '' : `of ${count(checked)} claims checked`
    const tile = (key, label) => ({
        key,
        label,
        value: t ? num(t[key]) : null,
        kind: 'count',
        stateText: NOT_ANALYZED,
        hint: t ? hint : '',
    })
    return [
        { key: 'checked', label: 'Claims checked', value: checked, kind: 'count', stateText: NOT_ANALYZED },
        tile('supported', 'Supported'),
        tile('contradicted', 'Contradicted'),
        tile('not_verifiable', 'Not verifiable'),
        { key: 'analyzed', label: 'Answers analyzed', value: analyzedText(payload), stateText: NOT_ANALYZED },
    ]
}

/** Claims per bucket (the answer's date), by verdict. */
export function verdictsOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.series || {}
    return {
        id: 'factcheck.verdicts',
        title: 'Claims over time',
        subtitle: 'Claims in analyzed answers, by what your evidence says.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'count',
        labels,
        datasets: VERDICT_SERIES.map((v) => ({ ...v, data: fit(series[v.key], labels.length) })),
        stacked: true,
        type: 'stacked_bar',
    }
}

function verdictCategories(rows, { id, title, subtitle, header, keyOf, nameOf }) {
    return {
        id,
        title,
        subtitle,
        x: 'category',
        value: 'count',
        labels: rows.map(keyOf),
        label_names: Object.fromEntries(rows.map((r) => [keyOf(r), nameOf(r)])),
        label_header: header,
        datasets: VERDICT_SERIES.map((v) => ({ ...v, data: rows.map((r) => num(r[v.key])) })),
        stacked: true,
        type: 'stacked_bar',
    }
}

/** Claims per topic, by verdict. */
export function verdictsByTopic(payload) {
    const rows = Array.isArray(payload?.by_topic) ? payload.by_topic : []
    return verdictCategories(rows, {
        id: 'factcheck.topics',
        title: 'Claims by topic',
        subtitle: 'What the claims are about, by what your evidence says.',
        header: 'Topic',
        keyOf: (r) => String(r.topic),
        nameOf: (r) => r.label || String(r.topic),
    })
}

/** Claims per engine, by verdict. */
export function verdictsByEngine(payload) {
    const rows = Array.isArray(payload?.by_engine) ? payload.by_engine : []
    return verdictCategories(rows, {
        id: 'factcheck.engines',
        title: 'Claims by engine',
        subtitle: 'Which engine made each claim, by what your evidence says.',
        header: 'Engine',
        keyOf: (r) => String(r.key),
        nameOf: (r) => engineLabel(payload, r.key),
    })
}
