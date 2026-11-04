// Group A cards (board_frontend.md 11a): what the Summary, Prompts,
// Countries, Traffic, AI traffic and AI crawlers cards show, built from the
// board's sources (board_contract.md 5). Pure functions. Compact chart
// specs have ids under `board.` and the emphasis palette, the one measured
// series being the accent; lists are BarList items
// [{key, label, value, text, emphasis?, hint?}], whose bars are the accent
// when they are yours (your countries, your pages) and gray for others
// (assistants, crawlers), as on group B's cards.
//
// A value that was not measured is null and reads as its state word; a
// measured zero reads 0.
import { countryName, formatValue } from '@/lib/charts/format'
import { normalizeVizSpec, pointText } from '@/lib/charts/spec'
import { gapDisplay } from '@/lib/gap'
import { widgetMeta } from '@/lib/board/widgets'
import { countriesMap as rankingsMap } from '@/lib/analytics/countrySpecs'
import { overviewTiles } from '@/lib/analytics/polishSpecs'
import {
    byAssistant,
    countriesMap as trafficCountriesMap,
    crawlerRows,
    crawlersEmpty,
    crawlerTiles,
    referralsEmpty,
    referralTiles,
    trafficEmpty,
    trafficSeries,
    trafficTiles,
} from '@/lib/analytics/trafficSpecs'

const CONNECTIONS = Object.freeze({ name: 'settings-connections' })

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const countText = (value) => (isNumber(value) ? formatValue(value, { value: 'count' }) : 'Not measured')

// ── Every card ──

/**
 * What a card shows when its source failed with nothing to show yet:
 * Insights turned off, or "We couldn't load {Title}." with Try again.
 */
export function failureState(key, failure) {
    if (failure?.code === 'insights_disabled') {
        return { kind: 'disabled', title: 'Insights are turned off on this server.', body: '', action: null }
    }
    const title = widgetMeta(key)?.title || 'this widget'
    return { kind: 'error', title: `We couldn't load ${title}.`, body: '', action: { label: 'Try again' } }
}

/** The foot line a card adds when a refetch failed and it keeps the last numbers. */
export const STALE_NOTE = "Couldn't refresh."

// ── Summary ──

/** The overview's headline sentence. */
export function summaryHeadline(kpis) {
    const k = kpis || {}
    const { ai_ahead: ai = 0, google_ahead: google = 0, prompts = 0, google_checked: checked = 0 } = k
    if (!checked) return `Tracking ${plural(prompts ?? 0, 'prompt', 'prompts')}. Check Google to see the gap.`
    if (!ai && !google) {
        // They agree only when every checked prompt is in a class that says
        // so. A prompt whose Google side is a range (not definite), or with
        // no AI answer yet, agrees on nothing.
        const agreeing = (k.strong_both || 0) + (k.invisible_both || 0) + (k.even || 0)
        return agreeing >= checked
            ? 'Google and the AI engines agree on every checked prompt.'
            : 'Neither Google nor the AI engines rank you clearly higher on any checked prompt.'
    }
    return `AI ranks you higher than Google on ${plural(ai, 'prompt', 'prompts')}. Google ranks you higher on ${google}.`
}

// The depth Google was read to for the prompts it did not rank you in.
function googleDepth(prompts) {
    const miss = (Array.isArray(prompts) ? prompts : []).find((r) => r?.google?.status === 'ok' && !r.google.position)
    return miss?.google?.depth ?? 10
}

/**
 * The line under the headline (the panel): the other gap classes. Empty
 * until Google checked a prompt, when every class count is unknown.
 */
export function summarySubline(kpis, prompts = []) {
    const k = kpis || {}
    if (!k.google_checked) return ''
    const { strong_both: strong = 0, invisible_both: invisible = 0, not_definite: unsure = 0, prompts: count = 0 } = k
    const parts = [`${strong} strong in both`, `${invisible} invisible in both`]
    // Google read only to the top {depth}: where you rank past it decides the class.
    if (unsure) parts.push(`${unsure} not definite (Google was read to the top ${googleDepth(prompts)})`)
    return `${parts.join(', ')}, out of ${plural(count, 'tracked prompt', 'tracked prompts')}.`
}

const SUMMARY_TILES = ['ai_visibility', 'avg_google_position', 'ai_ahead', 'google_ahead']

/** The card's four tiles: AI visibility (with its change), Google position, AI ahead, Google ahead. */
export function summaryTiles(kpis, headline = null, prompts = []) {
    return overviewTiles(kpis, headline, prompts).filter((t) => SUMMARY_TILES.includes(t.key))
}

// ── Prompts ──

export const PROMPTS_ON_CARD = 6

/** "Google #4", "Not in Google's top 10", "Google check failed" or "Google not checked". */
export function googleCell(google) {
    const g = google || {}
    if (g.status === 'ok') return g.position ? `Google #${g.position}` : `Not in Google's top ${g.depth || 100}`
    if (g.status === 'error') return 'Google check failed'
    return 'Google not checked'
}

/** "Named by 2 of 3 engines" over the engines that answered, or "No AI answers yet". */
export function aiCell(engines) {
    const answered = Object.values(engines || {}).filter((c) => (c?.answers || 0) > 0)
    if (!answered.length) return 'No AI answers yet'
    const named = answered.filter((c) => c.mentioned).length
    return `Named by ${named} of ${plural(answered.length, 'engine', 'engines')}`
}

/** The card's rows: the overview's prompts in API order (biggest gap first). */
export function promptRows(prompts, limit = PROMPTS_ON_CARD) {
    return (Array.isArray(prompts) ? prompts : []).slice(0, limit).map((p) => ({
        id: String(p.prompt_id),
        text: p.text || '',
        google: googleCell(p.google),
        ai: aiCell(p.engines),
        gap: gapDisplay(p.gap).label,
    }))
}

/** How many engines are configured (Add prompts' cost note), or null when unknown. */
export function engineCount(engines) {
    return Array.isArray(engines) ? engines.filter((e) => e?.configured).length : null
}

/** The Overview's two alerts, as foot lines. */
export function promptsNotes(overview) {
    if (!overview) return []
    const notes = []
    if (!overview.serp_configured) notes.push("Google rank checks aren't available yet.")
    const engines = overview.engines || []
    if (engines.length && !engines.some((e) => e.configured)) notes.push("AI engines aren't available yet.")
    return notes
}

// ── Countries ──

export const COUNTRIES_ON_CARD = 5

/** The traffic measure's name: the API's metric label ("Requests" for Cloudflare). */
export function trafficMetricLabel(traffic) {
    return traffic?.metric_label || (traffic?.source === 'cloudflare' ? 'Requests' : 'Visitors')
}

function trafficHasCountries(traffic) {
    return Boolean(traffic) && !traffic.empty_reason && (traffic.countries || []).some((c) => isNumber(c?.value))
}

/** The measures the card offers ({value, label}, for VizSwitcher), first the default. */
export function countryMeasures(matrix, traffic) {
    const out = []
    if ((matrix?.countries || []).length) {
        out.push({ value: 'ai', label: 'AI' }, { value: 'google', label: 'Google' })
    }
    if (trafficHasCountries(traffic)) out.push({ value: 'traffic', label: trafficMetricLabel(traffic) })
    return out
}

const RANKING_TITLES = { ai: 'AI visibility by country', google: 'Google position by country' }

/** The map of one measure: AI visibility, Google position, or traffic. */
export function countriesCardSpec(measure, matrix, traffic) {
    if (measure === 'traffic') {
        return {
            ...trafficCountriesMap(traffic, { id: 'board.countries.traffic', footnote: '' }),
            palette: 'emphasis',
            emphasis: 'value',
        }
    }
    const full = rankingsMap(matrix)
    const dataset = full.datasets.find((d) => d.key === measure)
    return {
        id: `board.countries.${measure}`,
        title: RANKING_TITLES[measure] || RANKING_TITLES.ai,
        x: 'country',
        value: dataset?.value || 'percent',
        labels: full.labels,
        label_names: full.label_names,
        datasets: dataset ? [dataset] : [],
        type: 'map',
        state_labels: full.state_labels,
        palette: 'emphasis',
        emphasis: measure,
    }
}

// Measured values first: the largest (the best rank) first, then the
// state words in the order states read best.
const STATE_ORDER = ['named', 'not_found', 'failed', 'not_configured', 'not_checked']

function byMeasure(rank) {
    return (a, b) => {
        if (a.value !== null && b.value !== null) return rank ? a.value - b.value : b.value - a.value
        if (a.value !== null || b.value !== null) return a.value === null ? 1 : -1
        return STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)
    }
}

/**
 * The top five beside the map. AI and traffic carry their values (AI is a
 * percentage: the caller passes max 100); Google is text only ("#4",
 * "Not in top 10"), since a lower rank is the better one.
 */
export function countryBars(measure, matrix, traffic) {
    if (measure === 'traffic') {
        return (traffic?.countries || [])
            .filter((c) => isNumber(c?.value))
            .sort((a, b) => b.value - a.value)
            .slice(0, COUNTRIES_ON_CARD)
            .map((c) => {
                const code = String(c.code || '').toUpperCase()
                return { key: code, label: countryName(code), value: c.value, text: countText(c.value), emphasis: true }
            })
    }
    const spec = normalizeVizSpec(countriesCardSpec(measure, matrix, traffic))
    if (!spec) return []
    const d = spec.datasets[0]
    const rank = measure === 'google'
    return spec.labels
        .map((code, j) => ({
            key: code,
            label: spec.label_names[code] || countryName(code),
            value: d.data[j],
            state: d.states[j],
            text: pointText(spec, 0, j),
        }))
        .sort(byMeasure(rank))
        .slice(0, COUNTRIES_ON_CARD)
        .map(({ key, label, value, text }) => ({ key, label, value: rank ? null : value, text, emphasis: true }))
}

/** The card's foot line for a measure. */
export function countriesFoot(measure, traffic) {
    if (measure !== 'traffic') return 'From your latest country checks.'
    const line = `${trafficMetricLabel(traffic)} from ${traffic?.source_label || 'your traffic source'}, last 30 days.`
    return traffic?.source === 'cloudflare' ? `${line} Bots included.` : line
}

/**
 * The card's state from its two sources: 'loading', 'ready' (a measure to
 * show, even while the other source loads), 'error' (a source failed and
 * the other has nothing) or 'empty' (both answered, nothing by country).
 */
export function countriesState({ matrix, matrixFailed = false, traffic, trafficFailed = false }) {
    if (countryMeasures(matrix, traffic).length) return 'ready'
    if ((!matrix && !matrixFailed) || (!traffic && !trafficFailed)) return 'loading'
    if (matrixFailed || trafficFailed || traffic?.empty_reason === 'source_error') return 'error'
    return 'empty'
}

export const NO_COUNTRY_DATA = Object.freeze({
    kind: 'empty',
    title: 'No country data yet.',
    body: 'Check how Google and the AI engines rank you in other countries, or connect a traffic source to see traffic by country.',
    action: Object.freeze({ label: 'Check countries' }),
})

// ── Traffic ──

export const PATHS_ON_CARD = 5

/** The tile's caption: where the numbers come from (contract 7). */
export function trafficSourceLine(payload) {
    if (payload?.source === 'cloudflare') return 'Cloudflare · last 30 days · requests, bots included'
    return payload?.source_label ? `${payload.source_label} · last 30 days` : 'Last 30 days'
}

/** The lead tile: the metric with its change against the previous 30 days. */
export function trafficLead(payload) {
    const tile = trafficTiles(payload, { period: '30d' })[0]
    return { ...tile, hint: trafficSourceLine(payload) }
}

/** The metric per day, one line in the accent. */
export function trafficCardSeries(payload) {
    const full = trafficSeries(payload)
    return {
        id: 'board.traffic.series',
        title: `${trafficMetricLabel(payload)} per day`,
        x: 'time',
        time_unit: 'day',
        value: 'count',
        labels: full.labels,
        datasets: full.datasets.filter((d) => d.key === 'visitors'),
        type: 'line',
        representations: ['line'],
        palette: 'emphasis',
        emphasis: 'visitors',
    }
}

/** What the paths are counted in. */
export function pathsMeasure(payload) {
    return payload?.source === 'cloudflare' ? 'Requests' : 'Page views'
}

/** The top paths, or null when Cloudflare's breakdown could not be loaded. */
export function pathBars(payload) {
    if (payload?.pages === null) return null
    return (payload?.pages || []).slice(0, PATHS_ON_CARD).map((p) => ({
        key: String(p.path),
        label: String(p.path),
        value: isNumber(p.views) ? p.views : null,
        text: countText(p.views),
        emphasis: true,
    }))
}

/** "Top countries: United States 62%, Germany 9%, India 4%", or ''. */
export function topCountriesLine(payload) {
    const rows = (payload?.countries || []).filter((c) => isNumber(c?.share_pct)).slice(0, 3)
    if (!rows.length) return ''
    const parts = rows.map((c) => `${countryName(c.code)} ${formatValue(c.share_pct, { value: 'percent' })}`)
    return `Top countries: ${parts.join(', ')}`
}

/**
 * The foot for Cloudflare: its paths are sampled, maybe over a shorter
 * window. Nothing when the breakdown failed and no path is shown.
 */
export function trafficFoot(payload) {
    if (payload?.source !== 'cloudflare' || payload?.pages === null) return ''
    const hours = payload?.breakdown_hours
    return isNumber(hours) && hours > 0
        ? `Top paths are sampled. They cover the last ${hours} hours.`
        : 'Top paths are sampled.'
}

/** What the card shows instead of numbers, or null: no source has its own words. */
export function trafficCardEmpty(payload) {
    if (payload?.empty_reason === 'no_source') {
        return {
            kind: 'not_connected',
            title: 'Connect a traffic source to see real traffic.',
            body: 'Cloudflare counts every request to your site, bots included. Google Analytics 4 and the Cansee pixel count visitors.',
            action: { label: 'Open Connections', to: CONNECTIONS },
        }
    }
    return trafficEmpty(payload)
}

// ── AI traffic and AI crawlers ──

const REFERRAL_TILES = ['ai_sessions', 'ai_share']

/** AI sessions and their share of all sessions. */
export function aiTrafficTiles(referrals) {
    return referralTiles(referrals).filter((t) => REFERRAL_TILES.includes(t.key))
}

/** The top three assistants by sessions. */
export function assistantBars(referrals, limit = 3) {
    const spec = byAssistant(referrals)
    const sessions = spec.datasets[0].data
    return spec.labels.slice(0, limit).map((key, i) => ({
        key,
        label: spec.label_names[key] || key,
        value: isNumber(sessions[i]) ? sessions[i] : null,
        text: countText(sessions[i]),
        emphasis: false,
    }))
}

/** What AI visits show instead of numbers: unavailable (no tiles) or a measured zero. */
export function aiTrafficState(referrals) {
    const empty = referralsEmpty(referrals)
    if (!empty) return { empty: null, tiles: true }
    return { empty, tiles: referrals?.available !== false }
}

/** "AI-referred sessions" source line for the foot. */
export function aiTrafficFoot(referrals) {
    return referrals?.source_label ? `${referrals.source_label} · last 30 days` : ''
}

/** Crawler requests in Cloudflare's window. */
export function crawlerLead(crawlers) {
    return crawlerTiles(crawlers).find((t) => t.key === 'requests')
}

/** The top three crawlers, "{name} · {operator}". */
export function crawlerBars(crawlers, limit = 3) {
    return crawlerRows(crawlers)
        .slice(0, limit)
        .map((r) => ({
            key: r.key,
            label: r.operator ? `${r.name} · ${r.operator}` : r.name,
            value: isNumber(r.requests) ? r.requests : null,
            text: countText(r.requests),
            emphasis: false,
        }))
}

/** What crawlers show instead of numbers: unavailable (no tile) or a measured zero. */
export function aiCrawlersState(crawlers) {
    const empty = crawlersEmpty(crawlers)
    if (!empty) return { empty: null, tiles: true }
    return { empty, tiles: crawlers?.available !== false }
}
