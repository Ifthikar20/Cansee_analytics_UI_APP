// Rankings by country: chart specs (contract 8a) and the words the
// Countries page and the Prompt page print for the country payloads
// (contract 2d-2g). Pure functions. Country codes here are lowercase.
//
// A cell or summary without a measurement prints its state word ("Not
// checked", "Failed"), never a zero or a dash.
import { aiOverviewUnread } from '@/lib/gap'
import { engineMeta } from '@/lib/engines'
import { genericMethodLabel, methodNote } from './methods'

const CELL_STATE_TEXT = {
    failed: 'Failed',
    skipped: 'Skipped',
    cancelled: 'Stopped',
    queued: 'Waiting',
    running: 'Checking',
    not_checked: 'Not checked',
}

function notInTop(depth) {
    return depth ? `Not in top ${depth}` : 'Not found'
}

/**
 * What one cell says: "#4", "Named #2", "Named", "Not named",
 * "Not in top 10", "Failed", "Skipped", "Stopped", "Waiting", "Checking"
 * or "Not checked" (no cell). `depth` is the fallback for a Google cell
 * that does not carry its own.
 */
export function cellText(cell, { depth } = {}) {
    if (!cell) return 'Not checked'
    const state = cell.state || cell.status
    const google = cell.engine === 'google'
    if (state === 'ok') {
        if (google) return cell.position ? `#${cell.position}` : notInTop(cell.depth || depth)
        return cell.rank ? `Named #${cell.rank}` : 'Named'
    }
    if (state === 'not_found') return google ? notInTop(cell.depth || depth) : 'Not named'
    return CELL_STATE_TEXT[state] || 'Not checked'
}

function sameId(a, b) {
    return String(a) === String(b)
}

/**
 * The engines a country view shows as columns, in display order: the
 * configured ones plus any with results. `engine` is the page filter
 * ('' for all, 'google' for Google only, or one engine key).
 */
export function matrixEngines(matrix, { engine = '' } = {}) {
    if (engine === 'google') return []
    const cells = matrix?.cells || []
    const listed = (matrix?.engines || []).map((e) => ({
        key: e.key,
        label: e.label || engineMeta(e.key).label,
        configured: Boolean(e.configured),
    }))
    if (engine) {
        const one = listed.find((e) => e.key === engine)
        return [one || { key: engine, label: engineMeta(engine).label, configured: true }]
    }
    return listed.filter((e) => e.configured || cells.some((c) => c.engine === e.key))
}

/**
 * One prompt's latest result in each country it was checked in:
 * [{country, name, google: cell|null, engines: {key: cell|null}, gap}].
 */
export function promptCountryRows(matrix, promptId) {
    const cells = (matrix?.cells || []).filter((c) => sameId(c.prompt_id, promptId))
    if (!cells.length) return []
    const countries = matrix?.countries || []
    const checked = new Set(cells.map((c) => c.country))
    const codes = [
        ...countries.map((c) => c.country).filter((cc) => checked.has(cc)),
        ...[...checked].filter((cc) => !countries.some((c) => c.country === cc)),
    ]
    const engines = matrixEngines(matrix)
    return codes.map((cc) => {
        const mine = cells.filter((c) => c.country === cc)
        return {
            country: cc,
            name: countries.find((c) => c.country === cc)?.name || String(cc).toUpperCase(),
            google: mine.find((c) => c.engine === 'google') || null,
            engines: Object.fromEntries(engines.map((e) => [e.key, mine.find((c) => c.engine === e.key) || null])),
            gap: (matrix?.gaps || []).find((g) => sameId(g.prompt_id, promptId) && g.country === cc) || null,
        }
    })
}

// The smallest Google depth among the measured countries (10 or 20).
function minDepth(countries) {
    const depths = countries.map((c) => c.google?.depth).filter((d) => typeof d === 'number' && d > 0)
    return depths.length ? Math.min(...depths) : null
}

function googlePoint(summary) {
    if (!summary) return { value: null, state: 'not_checked' }
    if (summary.state === 'ok') {
        return typeof summary.avg_position === 'number'
            ? { value: summary.avg_position, state: null }
            : { value: null, state: 'not_found' }
    }
    if (summary.state === 'failed') return { value: null, state: 'failed' }
    if (summary.state === 'not_configured') return { value: null, state: 'not_configured' }
    return { value: null, state: 'not_checked' }
}

function aiPoint(country, engine) {
    if (!engine) {
        return typeof country.ai_visibility_pct === 'number'
            ? { value: country.ai_visibility_pct, state: null }
            : { value: null, state: 'not_checked' }
    }
    const summary = country.engines?.[engine]
    if (summary && typeof summary.visibility_pct === 'number') return { value: summary.visibility_pct, state: null }
    if (summary?.state === 'failed') return { value: null, state: 'failed' }
    if (summary?.state === 'not_configured') return { value: null, state: 'not_configured' }
    return { value: null, state: 'not_checked' }
}

// "Google set to each country, US connection" (or two, joined) from the
// countries' own labels.
function googleMethodSummary(countries) {
    const labels = []
    for (const c of countries) {
        const label = c.google?.method_label
        if (!label) continue
        const generic = genericMethodLabel(label, c.country)
        if (!labels.includes(generic)) labels.push(generic)
    }
    return labels.join(' or ')
}

/** Rankings by country: AI visibility and Google position, one measure at a time. */
export function countriesMap(matrix, { engine = '' } = {}) {
    const countries = matrix?.countries || []
    const datasets = []
    if (engine !== 'google') {
        const points = countries.map((c) => aiPoint(c, engine))
        datasets.push({
            key: 'ai',
            label: engine ? `${engineMeta(engine).label} visibility` : 'AI visibility',
            value: 'percent',
            data: points.map((p) => p.value),
            states: points.map((p) => p.state),
        })
    }
    if (!engine || engine === 'google') {
        const points = countries.map((c) => googlePoint(c.google))
        datasets.push({
            key: 'google',
            label: 'Google position',
            value: 'rank',
            data: points.map((p) => p.value),
            states: points.map((p) => p.state),
        })
    }
    const method = datasets.some((d) => d.key === 'google') ? googleMethodSummary(countries) : ''
    const engines = engine === 'google' ? '' : 'Engines: see How each result was localized below.'
    const footnote = [method ? `Google: ${method} where shown.` : '', engines].filter(Boolean).join(' ')
    return {
        id: 'countries.map',
        title: 'Rankings by country',
        subtitle:
            'AI visibility is the share of engine answers that name you; Google position is your average position where you were found.',
        x: 'country',
        value: datasets[0]?.value || 'percent',
        labels: countries.map((c) => c.country),
        label_names: Object.fromEntries(countries.map((c) => [c.country, c.name || String(c.country).toUpperCase()])),
        datasets,
        pick_one: true,
        type: 'map',
        state_labels: { not_found: notInTop(minDepth(countries)) },
        ...(footnote ? { footnote } : {}),
    }
}

/** The latest cell for (prompt, country, engine), or null. */
function findCell(cells, promptId, country, engine) {
    return cells.find((c) => sameId(c.prompt_id, promptId) && c.country === country && c.engine === engine) || null
}

function rankPoint(cell) {
    if (!cell) return { value: null, state: 'not_checked' }
    const state = cell.state || cell.status
    if (state === 'ok') {
        if (cell.engine === 'google') {
            return cell.position ? { value: cell.position, state: null } : { value: null, state: 'not_found' }
        }
        return cell.rank ? { value: cell.rank, state: null } : { value: null, state: 'named' }
    }
    if (state === 'not_found') return { value: null, state: 'not_found' }
    if (state === 'failed') return { value: null, state: 'failed' }
    if (state === 'skipped') return { value: null, state: 'skipped' }
    return { value: null, state: 'not_checked' }
}

/**
 * Prompts (rows) by checked country (columns). All engines: the AI score
 * (0-100) of each prompt and country; Google: your position; one engine:
 * where it names you. It opens as the table; the heatmap is the other view.
 */
export function promptsByCountry(matrix, { engine = '' } = {}) {
    const cells = matrix?.cells || []
    const prompts = (matrix?.prompts || []).filter((p) => cells.some((c) => sameId(c.prompt_id, p.prompt_id)))
    const countries = (matrix?.countries || []).filter((c) => cells.some((x) => x.country === c.country))
    const gaps = matrix?.gaps || []
    const point = (promptId, country) => {
        if (!engine) {
            const gap = gaps.find((g) => sameId(g.prompt_id, promptId) && g.country === country)
            return typeof gap?.ai_score === 'number'
                ? { value: gap.ai_score, state: null }
                : { value: null, state: 'not_checked' }
        }
        return rankPoint(findCell(cells, promptId, country, engine))
    }
    const engineName = engine && engine !== 'google' ? engineMeta(engine).label : ''
    let subtitle = 'The AI score of each prompt in each country, from 0 to 100.'
    if (engine === 'google') subtitle = 'Your Google position for each prompt in each country.'
    else if (engine) subtitle = `Where ${engineName} names you for each prompt in each country.`
    const stateLabels = {}
    if (engine === 'google') stateLabels.not_found = notInTop(minDepth(countries))
    else if (engine) stateLabels.not_found = 'Not named'
    return {
        id: 'countries.prompts',
        title: 'Prompts by country',
        subtitle,
        x: 'category',
        value: engine ? 'rank' : 'number',
        labels: prompts.map((p) => String(p.prompt_id)),
        label_names: Object.fromEntries(prompts.map((p) => [String(p.prompt_id), p.text])),
        datasets: countries.map((c) => {
            const points = prompts.map((p) => point(p.prompt_id, c.country))
            return {
                key: c.country,
                label: c.name || String(c.country).toUpperCase(),
                data: points.map((p) => p.value),
                states: points.map((p) => p.state),
            }
        }),
        type: 'table',
        representations: ['heatmap'],
        state_labels: stateLabels,
        ...(engine ? {} : { max: 100 }),
    }
}

function percentText(value) {
    if (typeof value !== 'number') return ''
    const shown = value < 10 && !Number.isInteger(value) ? value.toFixed(1) : String(Math.round(value))
    return `${shown}%`
}

function positionText(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** The Google column of the country table: {text, sub, measured}. */
export function googleSummary(summary) {
    const state = summary?.state || 'not_checked'
    if (state === 'not_configured') return { text: 'Not configured', sub: '', measured: false }
    if (state === 'failed') return { text: 'Failed', sub: '', measured: false }
    if (state !== 'ok') return { text: 'Not checked', sub: '', measured: false }
    const text =
        typeof summary.avg_position === 'number' ? `#${positionText(summary.avg_position)} avg` : notInTop(summary.depth)
    return { text, sub: `${summary.found ?? 0} of ${summary.checked ?? 0} found`, measured: true }
}

/** An engine column of the country table: {text, sub, measured}. */
export function engineSummary(summary) {
    const state = summary?.state || 'not_checked'
    if (state === 'not_configured') return { text: 'Not configured', sub: '', measured: false }
    if (state === 'failed') return { text: 'Failed', sub: '', measured: false }
    if (state !== 'ok' || typeof summary.visibility_pct !== 'number') return { text: 'Not checked', sub: '', measured: false }
    return {
        text: percentText(summary.visibility_pct),
        sub: `${summary.mentioned ?? 0} of ${summary.answered ?? 0} named`,
        measured: true,
    }
}

/** The AI visibility column: "35%" or "Not checked". */
export function aiVisibilityText(country) {
    return typeof country?.ai_visibility_pct === 'number' ? percentText(country.ai_visibility_pct) : 'Not checked'
}

/** Gap badges for a country: [{cls, count, text}], zero counts left out. */
export function gapBadges(counts) {
    if (!counts) return []
    return [
        { cls: 'ai_ahead', text: 'AI ahead' },
        { cls: 'google_ahead', text: 'Google ahead' },
        { cls: 'no_data', text: 'not definite' },
    ]
        .filter((b) => (counts[b.cls] || 0) > 0)
        .map((b) => ({ cls: b.cls, count: counts[b.cls], text: `${counts[b.cls]} ${b.text}` }))
}

// Up to this many countries are named in a method label ("Searched from
// AU / CA / DE"); more read as "each country". Slashes, because some labels
// already hold a comma ("Google set to GB, US connection").
const MAX_NAMED_COUNTRIES = 6

function namedMethodLabel(countries) {
    const first = countries[0]
    const codes = countries.map((c) => String(c.country).toUpperCase()).sort()
    return String(first.google_method_label).replace(String(first.country).toUpperCase(), codes.join(' / '))
}

/** Rows of "How each result was localized": Google per method, then each configured engine. */
export function localizationRows(options, { countries: checked = [] } = {}) {
    const rows = []
    const google = options?.google
    // Once countries are checked, describe how those were searched; before
    // that, how every country in the catalog would be.
    const only = new Set((checked || []).map((c) => String(c).toLowerCase()))
    const catalog = (options?.countries || []).filter((c) => !only.size || only.has(c.country))
    if (google?.configured) {
        for (const method of ['proxy', 'google_setting']) {
            const countries = catalog.filter((c) => c.google_method === method)
            if (!countries.length) continue
            const label =
                countries.length === 1
                    ? countries[0].google_method_label
                    : countries.length <= MAX_NAMED_COUNTRIES
                      ? namedMethodLabel(countries)
                      : genericMethodLabel(countries[0].google_method_label, countries[0].country)
            rows.push({
                key: `google:${method}`,
                name: `Google (${google.provider_label || 'Google'})`,
                method,
                label,
                note: methodNote(method),
            })
        }
    }
    for (const e of options?.engines || []) {
        if (!e.configured) continue
        rows.push({ key: e.key, name: e.label, method: e.method, label: e.method_label, note: methodNote(e.method) })
    }
    return rows
}

/**
 * Up to `n` countries the site's visitors come from that are not chosen
 * yet and can be checked: [{country, name}] (lowercase codes).
 */
export function visitorSuggestions(trafficCountries, options, chosen = [], n = 3) {
    const catalog = options?.countries || []
    const out = []
    for (const row of trafficCountries || []) {
        const code = String(row.code || '').toLowerCase()
        const cc = code === 'uk' ? 'gb' : code
        if (!cc || chosen.includes(cc) || out.some((o) => o.country === cc)) continue
        const known = catalog.find((c) => c.country === cc)
        if (!known) continue
        out.push({ country: cc, name: known.name })
        if (out.length >= n) break
    }
    return out
}

const integer = new Intl.NumberFormat('en-US')

/** A money string from the API ("0.4000") as "$0.40" ("$0.0060" under a cent). */
export function money(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return '$0.00'
    if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function plural(n, one, many) {
    return `${integer.format(n)} ${n === 1 ? one : many}`
}

/** "45 s", "2 min 5 s", "1 h 3 min"; '' when unknown. */
export function durationText(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return ''
    const total = Math.max(1, Math.round(ms / 1000))
    if (total < 60) return `${total} s`
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    if (minutes < 60) return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export const ACTIVE_RUN_STATUSES = Object.freeze(['queued', 'running'])

export function isActiveRun(run) {
    return Boolean(run && ACTIVE_RUN_STATUSES.includes(run.status))
}

/** The status word of a run (Recent checks). */
export const RUN_STATUS_TEXT = Object.freeze({
    queued: 'Waiting',
    running: 'Running',
    done: 'Done',
    partial: 'Partly done',
    failed: 'Failed',
    cancelled: 'Stopped',
    interrupted: 'Interrupted',
})

export const COUNTRY_STATUS_TEXT = Object.freeze({ queued: 'Waiting', running: 'Checking', done: 'Done' })

// Checks that ran to an end before a stop or an interruption. Cells the
// sweep closed as interrupted never finished, so they do not count.
function settledChecks(run) {
    const results = run?.results
    if (Array.isArray(results) && results.length) {
        return results.filter(
            (r) => ['done', 'failed', 'skipped'].includes(r.status) && r.error?.code !== 'interrupted',
        ).length
    }
    const p = run?.progress || {}
    if (run?.status === 'interrupted') return p.done || 0
    return (p.done || 0) + (p.failed || 0) + (p.skipped || 0)
}

/** The run panel's title for any status. */
export function runTitle(run) {
    const n = run?.countries?.length || 0
    const total = run?.progress?.total || 0
    switch (run?.status) {
        case 'queued':
        case 'running':
            return `Checking ${plural(n, 'country', 'countries')}`
        case 'cancelled':
            return `Stopped after ${integer.format(settledChecks(run))} of ${plural(total, 'check', 'checks')}`
        case 'interrupted':
            return `Interrupted after ${integer.format(settledChecks(run))} of ${plural(total, 'check', 'checks')}`
        case 'failed':
            return 'The check could not finish'
        default: {
            const took = durationText(run?.duration_ms)
            return `Checked ${plural(n, 'country', 'countries')}${took ? ` in ${took}` : ''}`
        }
    }
}

/** "12 done · 1 failed · 2 stopped"; zero counts left out except done. */
export function progressSummary(progress) {
    const p = progress || {}
    const parts = [`${integer.format(p.done || 0)} done`]
    if (p.failed) parts.push(`${integer.format(p.failed)} failed`)
    if (p.skipped) parts.push(`${integer.format(p.skipped)} skipped`)
    if (p.cancelled) parts.push(`${integer.format(p.cancelled)} stopped`)
    return parts.join(' · ')
}

/** Checks that have finished in any way, for the progress bar. */
export function finishedChecks(progress) {
    const p = progress || {}
    return (p.done || 0) + (p.failed || 0) + (p.skipped || 0) + (p.cancelled || 0)
}

/**
 * What a run used: Google pages (credits or dollars) and AI allowance. A
 * free account (hideUsd) sees no dollars: the Google pages, or nothing.
 */
export function costLine(run, { hideUsd = false } = {}) {
    const cost = run?.cost || {}
    const pages = cost.google_pages_fetched || 0
    const asked = (run?.confirmed?.engine_answers || 0) > 0 || (run?.engines?.length || 0) > 0
    let google = ''
    if (run?.include_google) {
        const used = plural(pages, 'Google page', 'Google pages')
        if (run.provider === 'serpapi') google = hideUsd ? used : `${used} (${money(cost.google_usd)})`
        else if (typeof cost.scraperapi_credits === 'number') {
            google = `${used} (about ${integer.format(cost.scraperapi_credits)} ScraperAPI credits)`
        } else google = used
    }
    if (hideUsd) return google ? `Used ${google}.` : ''
    const ai = `${money(cost.ai_usd)} of AI allowance`
    if (google && asked) return `Used ${google} and ${ai}.`
    if (google) return `Used ${google}.`
    return `Used ${ai}.`
}

/** What the AI Overview on a Google results page said about you, in words; '' when unknown. */
export function aiOverviewText(overview) {
    if (!overview || typeof overview.shown !== 'boolean') return ''
    if (!overview.shown) return 'Google showed no AI Overview for this search.'
    if (aiOverviewUnread(overview)) return 'Google showed an AI Overview, but its content was not captured.'
    // Each side only when it was measured: null is unknown, not "no".
    const parts = []
    if (typeof overview.mentions_you === 'boolean') parts.push(overview.mentions_you ? 'names you' : 'does not name you')
    if (typeof overview.cites_you === 'boolean') parts.push(overview.cites_you ? 'cites your site' : 'does not cite your site')
    return `Google showed an AI Overview. It ${parts.join(' and ')}.`
}
