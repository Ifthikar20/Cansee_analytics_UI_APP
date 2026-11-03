// Chart specs (contract 8a), stat tiles and table rows for the Competitors
// benchmark (contract 4a) and the citation analytics section of the
// Citations page (contract 4b). Pure functions.
//
// Brands are `you` and `b1`..`b5` in the project's competitor order; each
// wears its brand colour (`brand:{key}`) on every chart. A value that was
// not measured (no answers, Google not configured or never checked, no
// citation rows) is null with its state word, never 0.
import { engineMeta } from '@/lib/engines'
import { entityToken } from '@/lib/charts/palette'
import { googlePlace } from './askTemplates'

export const NAMED_FOOTNOTE =
    "A competitor counts as named when an answer lists its name or its domain name; its rank is its place in the answer's list."
export const GOOGLE_FOOTNOTE = "From each prompt's latest Google check. Competitors are seen only on page one."

const integer = new Intl.NumberFormat('en-US')

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function count(value) {
    return integer.format(value)
}

function round1(value) {
    return Math.round(value * 10) / 10
}

// "33%" (one decimal under 10%: "4.5%"), as the chart system prints percents.
function pct(value) {
    const n = num(value)
    if (n === null) return ''
    const digits = Math.abs(n) < 10 ? 1 : 0
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n)}%`
}

function buckets(payload) {
    return [...(payload?.window?.buckets || [])]
}

function timeUnit(payload) {
    return payload?.window?.interval === 'week' ? 'week' : 'day'
}

function fit(values, length) {
    const out = []
    for (let i = 0; i < length; i++) out.push(num(values?.[i]))
    return out
}

function brandsOf(payload) {
    return (Array.isArray(payload?.brands) ? payload.brands : []).slice(0, 6)
}

function brandName(brand) {
    return brand?.name || brand?.domain || ''
}

/** The colour of a brand's slot as a CSS value (`var(--viz-cat-2)`). */
export function brandColor(key) {
    return `var(${entityToken(`brand:${key}`)})`
}

function answersCount(payload) {
    return num(payload?.ai?.answers)
}

/** True when the window has AI answers to compare. */
export function hasAnswers(payload) {
    return (answersCount(payload) ?? 0) > 0
}

/* ── Competitors ── */

/** One tile per brand, in brand order: its AI visibility this period. */
export function brandTiles(payload) {
    const answers = answersCount(payload)
    return brandsOf(payload).map((b) => {
        const row = payload?.ai?.brands?.[b.key] || null
        const named = num(row?.named)
        return {
            key: b.key,
            label: brandName(b),
            value: num(row?.visibility_pct),
            kind: 'percent',
            stateText: 'No answers',
            hint: answers > 0 && named !== null ? `Named in ${count(named)} of ${count(answers)} answers` : '',
            tone: brandColor(b.key),
        }
    })
}

/** AI visibility per bucket, one line per brand. */
export function visibilityByBrand(payload) {
    const labels = buckets(payload)
    return {
        id: 'competitors.visibility',
        title: 'AI visibility by brand',
        subtitle: 'Share of engine answers that name each brand.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'percent',
        labels,
        datasets: brandsOf(payload).map((b) => ({
            key: b.key,
            label: brandName(b),
            entity: `brand:${b.key}`,
            data: fit(payload?.ai?.brands?.[b.key]?.series, labels.length),
        })),
        type: 'line',
        missing_label: 'No answers',
        footnote: NAMED_FOOTNOTE,
    }
}

function measure(key, label, value, points) {
    return {
        key,
        label,
        value,
        data: points.map((p) => (p.state ? null : p.value)),
        states: points.map((p) => p.state || null),
    }
}

/** Google's state for the whole comparison: 'ok', 'not_configured' or 'not_checked'. */
export function googleState(payload) {
    const g = payload?.google || {}
    if (g.configured === false) return 'not_configured'
    if (!g.brands || !(num(g.prompts_checked) > 0)) return 'not_checked'
    return 'ok'
}

/** This period by brand: one measure at a time (pick_one). */
export function compareBrands(payload) {
    const brands = brandsOf(payload)
    const ai = payload?.ai || {}
    const citations = payload?.citations || {}
    const google = googleState(payload)
    const answered = hasAnswers(payload)
    const aiRow = (key) => ai.brands?.[key] || null
    const plain = (value) => ({ value: num(value), state: null })
    return {
        id: 'competitors.compare',
        title: 'This period by brand',
        x: 'category',
        value: 'percent',
        labels: brands.map((b) => b.key),
        label_names: Object.fromEntries(brands.map((b) => [b.key, brandName(b)])),
        label_header: 'Brand',
        datasets: [
            measure('visibility', 'AI visibility', 'percent', brands.map((b) => plain(aiRow(b.key)?.visibility_pct))),
            measure('named', 'Answers naming them', 'count', brands.map((b) => plain(answered ? aiRow(b.key)?.named : null))),
            measure('first_place', 'Ranked first', 'count', brands.map((b) => plain(answered ? aiRow(b.key)?.first_place : null))),
            measure(
                'avg_rank',
                'Avg. rank when named',
                'rank',
                brands.map((b) => {
                    const row = aiRow(b.key)
                    if (!answered || !row) return { value: null, state: null }
                    if (num(row.avg_rank) !== null) return { value: row.avg_rank, state: null }
                    return { value: null, state: num(row.named) > 0 ? 'named' : 'not_found' }
                }),
            ),
            measure(
                'citations',
                'Citations',
                'count',
                brands.map((b) =>
                    citations.has_data === false
                        ? { value: null, state: 'not_measured' }
                        : plain(citations.brands?.[b.key]?.citations),
                ),
            ),
            measure(
                'google_page_one',
                'Prompts on Google page one',
                'count',
                brands.map((b) =>
                    google === 'ok'
                        ? plain(payload.google.brands[b.key]?.on_page_one)
                        : { value: null, state: google },
                ),
            ),
        ],
        pick_one: true,
        type: 'bar',
        missing_label: 'No answers',
        state_labels: { not_found: 'Not named' },
    }
}

function promptsOf(payload) {
    return Array.isArray(payload?.by_prompt) ? payload.by_prompt : []
}

/** AI visibility of every brand, prompt by prompt (rows). */
export function aiByPrompt(payload) {
    const prompts = promptsOf(payload)
    return {
        id: 'competitors.ai_by_prompt',
        title: 'AI visibility by prompt',
        subtitle: 'Share of the answers to each prompt that name each brand.',
        x: 'category',
        value: 'percent',
        labels: prompts.map((p) => String(p.prompt_id)),
        label_names: Object.fromEntries(prompts.map((p) => [String(p.prompt_id), p.text])),
        label_header: 'Prompt',
        datasets: brandsOf(payload).map((b) => ({
            key: b.key,
            label: brandName(b),
            entity: `brand:${b.key}`,
            data: prompts.map((p) => (num(p.answers) > 0 ? num(p.ai?.[b.key]) : null)),
            states: prompts.map((p) => (num(p.answers) > 0 ? null : 'not_checked')),
        })),
        type: 'heatmap',
        representations: ['heatmap'],
    }
}

/** Each brand's Google position per prompt, from the prompt's latest check. */
export function googleByPrompt(payload) {
    const prompts = promptsOf(payload)
    return {
        id: 'competitors.google_by_prompt',
        title: 'Google position by prompt',
        subtitle: "Each brand's best position on Google for each prompt.",
        x: 'category',
        value: 'rank',
        labels: prompts.map((p) => String(p.prompt_id)),
        label_names: Object.fromEntries(prompts.map((p) => [String(p.prompt_id), p.text])),
        label_header: 'Prompt',
        datasets: brandsOf(payload).map((b) => {
            const points = prompts.map((p) => {
                if (p.google_state === 'failed') return { value: null, state: 'failed' }
                if (p.google_state !== 'ok') return { value: null, state: 'not_checked' }
                const position = num(p.google?.[b.key]?.position)
                return position === null ? { value: null, state: 'not_found' } : { value: position, state: null }
            })
            return { ...measure(b.key, brandName(b), 'rank', points), entity: `brand:${b.key}` }
        }),
        type: 'heatmap',
        representations: ['heatmap'],
        state_labels: { not_found: 'Not on page one' },
        footnote: GOOGLE_FOOTNOTE,
    }
}

// `#4` or `not on page one` for the ask-the-agent text; null without a
// Google check of the prompt (the template then drops that line).
function googleWord(prompt, key) {
    return googlePlace(num(prompt?.google?.[key]?.position), { checked: prompt?.google_state === 'ok' })
}

/**
 * The prompts where a competitor's AI visibility most exceeds yours (at
 * most `limit`): `{text, competitor, their_pct, our_pct, values}`, where
 * `values` feeds the `competitor_prompt` ask template.
 */
export function biggestGaps(payload, { limit = 5 } = {}) {
    const competitors = brandsOf(payload).filter((b) => b.key !== 'you')
    const out = []
    for (const p of promptsOf(payload)) {
        if (!(num(p.answers) > 0)) continue
        const ours = num(p.ai?.you)
        if (ours === null) continue
        let best = null
        for (const c of competitors) {
            const theirs = num(p.ai?.[c.key])
            if (theirs === null || theirs <= ours) continue
            if (!best || theirs - ours > best.gap) best = { brand: c, theirs, gap: round1(theirs - ours) }
        }
        if (!best) continue
        const values = {
            prompt: p.text,
            competitor: brandName(best.brand),
            their_pct: best.theirs,
            our_pct: ours,
            our_google: googleWord(p, 'you'),
            their_google: googleWord(p, best.brand.key),
        }
        out.push({
            key: `${p.prompt_id}|${best.brand.key}`,
            promptId: String(p.prompt_id),
            text: `${p.text}: ${values.competitor} ${pct(best.theirs)}, you ${pct(ours)}`,
            gap: best.gap,
            values,
        })
    }
    return out.sort((a, b) => b.gap - a.gap).slice(0, limit)
}

/** Head to head, one row per tracked competitor. */
export function headToHeadRows(payload) {
    const names = Object.fromEntries(brandsOf(payload).map((b) => [b.key, brandName(b)]))
    return (Array.isArray(payload?.head_to_head) ? payload.head_to_head : [])
        .filter((h) => names[h.key])
        .map((h) => ({
            key: h.key,
            name: names[h.key],
            color: brandColor(h.key),
            both: num(h.both_named),
            youAhead: num(h.you_ahead),
            theyAhead: num(h.they_ahead),
            noOrder: num(h.no_order),
        }))
}

/** Site readiness: each brand's latest home page audit. */
export function siteRows(payload) {
    return brandsOf(payload).map((b) => {
        const site = payload?.site?.[b.key] || null
        const passed = num(site?.checks_passed)
        const total = num(site?.checks_total)
        let aiSearch = 'Not audited'
        if (site) aiSearch = site.ai_search_allowed === true ? 'Yes' : site.ai_search_allowed === false ? 'No' : 'Unknown'
        return {
            key: b.key,
            name: brandName(b),
            color: brandColor(b.key),
            audited: Boolean(site),
            checks: site && passed !== null && total !== null ? `${count(passed)} of ${count(total)}` : 'Not audited',
            aiSearch,
        }
    })
}

/* ── Citation analytics (Citations page) ── */

/** The four tiles of the section; null totals read "Not recorded". */
export function citationTiles(payload) {
    const t = payload?.has_data === false ? null : payload?.totals || null
    const ratio = (part, whole) =>
        num(part) !== null && num(whole) !== null ? `${count(part)} of ${count(whole)}` : null
    return [
        {
            key: 'with_sources',
            label: 'Answers with sources',
            value: t ? ratio(t.answers_with_sources, t.answers) : null,
            stateText: 'Not recorded',
        },
        { key: 'listed', label: 'Sources listed', value: t ? num(t.citations) : null, kind: 'count', stateText: 'Not recorded' },
        {
            key: 'in_text',
            label: 'Cited in the answer text',
            value: t ? ratio(t.cited_in_text, t.citations) : null,
            stateText: 'Not recorded',
        },
        // The distinct own pages cited, not the length of the 25-row list.
        { key: 'your_pages', label: 'Your pages cited', value: t ? num(t.your_pages) : null, kind: 'count', stateText: 'Not recorded' },
    ]
}

/** Sources listed by source type (parts of the whole). */
export function citationClasses(payload) {
    const rows = Array.isArray(payload?.by_class) ? payload.by_class : []
    return {
        id: 'citations.classes',
        title: 'Sources by type',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => String(r.key)),
        label_names: Object.fromEntries(rows.map((r) => [String(r.key), r.label || String(r.key)])),
        label_header: 'Type',
        datasets: [{ key: 'citations', label: 'Sources listed', data: rows.map((r) => num(r.citations)) }],
        stacked: true,
        type: 'hbar',
    }
}

/** Per engine: answers with sources, sources listed, your pages listed. */
export function citationEngines(payload) {
    const rows = Array.isArray(payload?.by_engine) ? payload.by_engine : []
    const series = (key, label) => ({ key, label, value: 'count', data: rows.map((r) => num(r[key])) })
    return {
        id: 'citations.engines',
        title: 'Sources by engine',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => String(r.key)),
        label_names: Object.fromEntries(rows.map((r) => [String(r.key), r.label || engineMeta(r.key).label])),
        label_header: 'Engine',
        datasets: [
            series('answers_with_sources', 'Answers with sources'),
            series('citations', 'Sources listed'),
            series('your_citations', 'Your pages listed'),
        ],
        pick_one: true,
        type: 'bar',
    }
}
