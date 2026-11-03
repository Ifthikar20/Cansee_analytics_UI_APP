// Chart specs (contract 8a), stat tiles and words for Prompt research
// (contract 7) and Query fan-outs (contract 8). Pure functions.
//
// Prompt research shows where each idea came from, never a volume, rank or
// score: Cansee has no data on how often people ask. A source Cansee never
// read (no Google check recorded its questions, web search off, AI
// suggestions not run) reads its state word, never 0.
import { engineMeta } from '@/lib/engines'
import { IDEA_SOURCES, SOURCE_STATE_WORDS, sourceStateWord } from './insightWords'

// Contract 7 sources, in tile and chart order.
export const IDEA_SOURCE_KEYS = Object.keys(IDEA_SOURCES)

// Source states that mean the source was never read, with their words
// (contract 1f). `none_seen` (Google showed none) and `none` are measured
// zeros.
const UNREAD_WORDS = {
    no_checks: SOURCE_STATE_WORDS.no_checks,
    web_search_off: 'No web search',
    none_recorded: 'Not recorded',
    not_run: SOURCE_STATE_WORDS.not_run,
}

const integer = new Intl.NumberFormat('en-US')

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function count(value) {
    return integer.format(value)
}

/** The label of an idea source key ('paa' -> 'People also ask'). */
export function ideaSourceLabel(key) {
    return IDEA_SOURCES[key] || String(key || '')
}

// An idea count per source: the count, or null with the source's state word
// when Cansee never read that source and holds no idea from it.
function sourceCount(payload, key) {
    const value = num(payload?.counts?.by_source?.[key])
    const state = payload?.sources?.[key]?.state
    if ((value === null || value === 0) && UNREAD_WORDS[state]) return { value: null, word: UNREAD_WORDS[state] }
    return { value, word: null }
}

/* ── Prompt research ── */

/** The six tiles, all from `counts` (never from the filtered list). */
export function ideaTiles(payload) {
    const counts = payload?.counts || {}
    const fromSource = (key, label) => {
        const c = sourceCount(payload, key)
        return { key, label, value: c.value, kind: 'count', stateText: c.word || 'Not measured' }
    }
    return [
        { key: 'new', label: 'New ideas', value: num(counts.new), kind: 'count' },
        fromSource('paa', 'From People also ask'),
        fromSource('related_search', 'From related searches'),
        fromSource('fanout', 'From engine searches'),
        fromSource('ai_suggestion', 'AI suggestions'),
        { key: 'tracked', label: 'Tracked', value: num(counts.tracked), kind: 'count' },
    ]
}

/** Ideas per source; an idea seen in two sources counts in both. */
export function ideasBySource(payload) {
    const points = IDEA_SOURCE_KEYS.map((key) => sourceCount(payload, key))
    return {
        id: 'prompts.sources',
        title: 'Ideas by source',
        subtitle: 'Where the ideas come from. An idea seen in two sources counts in both.',
        x: 'category',
        value: 'count',
        labels: [...IDEA_SOURCE_KEYS],
        label_names: { ...IDEA_SOURCES },
        label_header: 'Source',
        datasets: [
            {
                key: 'ideas',
                label: 'Ideas',
                value: 'count',
                data: points.map((p) => p.value),
                states: points.map((p) => (p.word ? 'not_measured' : null)),
                texts: points.map((p) => p.word),
            },
        ],
        type: 'hbar',
    }
}

// The word of each source state (contract 7), for the source chips.
const STATE_WORDS = {
    ok: SOURCE_STATE_WORDS.ok,
    none_seen: 'None seen',
    none: SOURCE_STATE_WORDS.no_data,
    ...UNREAD_WORDS,
}

const NO_CHECKS_NOTE =
    'Google questions are read from Google checks made after this release. Check a prompt or use Find prompt ideas.'

/** The five sources as SourceStates chips: `{key, label, word, ok, note}`. */
export function ideaSourceStates(payload) {
    return IDEA_SOURCE_KEYS.map((key) => {
        const state = payload?.sources?.[key]?.state || ''
        return {
            key,
            label: IDEA_SOURCES[key],
            word: STATE_WORDS[state] || sourceStateWord(state),
            ok: state === 'ok',
            note: state === 'no_checks' ? NO_CHECKS_NOTE : '',
        }
    })
}

/** `{prompts} prompts · {engines} engines`, parts with 0 left out. */
export function seenText(seen) {
    const prompts = num(seen?.prompts) ?? 0
    const engines = num(seen?.engines) ?? 0
    const parts = []
    if (prompts > 0) parts.push(`${count(prompts)} ${prompts === 1 ? 'prompt' : 'prompts'}`)
    if (engines > 0) parts.push(`${count(engines)} ${engines === 1 ? 'engine' : 'engines'}`)
    return parts.join(' · ')
}

/** One evidence line of an idea (contract 7 `evidence[]`). */
export function evidenceText(item) {
    const prompt = item?.prompt_text || ''
    switch (item?.source) {
        case 'paa':
            return `People also ask on "${prompt}"`
        case 'related_search':
            return `Related search on "${prompt}"`
        case 'fanout':
            return `${engineMeta(item.engine).label} searched it while answering "${prompt}"`
        case 'ai_suggestion':
            return `AI suggestion: ${item.why || ''}`.trim()
        case 'sub_query':
            return `Predicted sub-query of "${prompt}"`
        default:
            return ''
    }
}

/* ── Query fan-outs ── */

/**
 * The VizState props for a fan-outs payload's `empty_reason` (contract 8),
 * or null when there is something to show. `days` is the window's length.
 */
export function fanoutsEmpty(payload, { days = 30 } = {}) {
    const overview = { label: 'Go to Overview', to: { name: 'dashboard' } }
    switch (payload?.empty_reason) {
        case 'web_search_off':
            return {
                kind: 'not_available',
                title: "The engines aren't searching the web on this server.",
                body: 'Query fan-outs are the web searches an engine runs while it answers. Cansee records them for ChatGPT and Claude when web search is on (LLM_WEBSEARCH_ENABLED). Answers with web search cost more.',
            }
        case 'none_recorded':
            return {
                kind: 'empty',
                title: 'No searches recorded yet.',
                body: 'Searches are recorded from answers collected after web search was turned on. Check a prompt now to record some.',
                action: overview,
            }
        case 'no_answers':
            return { kind: 'empty', title: `No AI answers in the last ${days} days.`, action: overview }
        default:
            return null
    }
}

/** The four fan-out tiles. */
export function fanoutTiles(payload) {
    const t = payload?.totals || null
    const value = (key) => (t ? num(t[key]) : null)
    const searched = value('searched')
    const recorded = value('recorded')
    return [
        {
            key: 'searched',
            label: 'Answers that searched',
            value: searched !== null && recorded !== null ? `${count(searched)} of ${count(recorded)}` : null,
            stateText: 'Not recorded',
        },
        { key: 'searches', label: 'Searches run', value: value('searches'), kind: 'count', stateText: 'Not recorded' },
        { key: 'queries', label: 'Search texts reported', value: value('queries'), kind: 'count', stateText: 'Not recorded' },
        { key: 'unique', label: 'Unique searches', value: value('unique_queries'), kind: 'count', stateText: 'Not recorded' },
    ]
}

/** The engines that report their searches (ChatGPT and Claude today). */
export function reportingEngines(payload) {
    return (payload?.web_search?.engines || []).filter((e) => e.reports_queries).map((e) => e.key)
}

/**
 * Searches by engine, for the engines that report them; one measure at a
 * time. The average is per answer whose search data was recorded.
 */
export function fanoutEngines(payload) {
    const keys = reportingEngines(payload)
    const rows = Array.isArray(payload?.by_engine) ? payload.by_engine : []
    const row = (key) => rows.find((r) => r.key === key) || null
    const plain = (key, label, value, pick) => ({
        key,
        label,
        value,
        data: keys.map((k) => pick(row(k))),
        states: keys.map((k) => (row(k) && num(row(k).recorded) > 0 ? null : 'not_measured')),
    })
    return {
        id: 'fanouts.engines',
        title: 'Searches by engine',
        x: 'category',
        value: 'count',
        labels: keys,
        label_names: Object.fromEntries(keys.map((k) => [k, engineMeta(k).label])),
        label_header: 'Engine',
        datasets: [
            plain('searched', 'Answers that searched', 'count', (r) => num(r?.searched)),
            plain('searches', 'Searches', 'count', (r) => num(r?.searches)),
            plain('average', 'Average searches per answer', 'number', (r) => {
                const recorded = num(r?.recorded)
                const searches = num(r?.searches)
                return recorded > 0 && searches !== null ? Math.round((searches / recorded) * 10) / 10 : null
            }),
        ],
        pick_one: true,
        type: 'bar',
        state_labels: { not_measured: 'Not recorded' },
        footnote: "Gemini, Grok and Perplexity don't report their searches, so they are not shown.",
    }
}

/**
 * What the Google column of a fan-out query reads:
 * {text, sub, measured} (`#4` + `Checked {when}`, `Not on page one`,
 * `Not checked`, `Failed`). `when` formats `checked_at`.
 */
export function fanoutGoogleText(google, when = (iso) => iso) {
    const state = google?.state || 'not_checked'
    if (state === 'found' && num(google.position) !== null) {
        return { text: `#${google.position}`, sub: google.checked_at ? `Checked ${when(google.checked_at)}` : '', measured: true }
    }
    if (state === 'not_found') return { text: 'Not on page one', sub: '', measured: false }
    if (state === 'failed') return { text: 'Failed', sub: '', measured: false }
    return { text: 'Not checked', sub: '', measured: false }
}

/** `#4` or `not on page one` for the `fanout` ask template; null when not checked. */
export function fanoutGoogleWord(google) {
    if (google?.state === 'found' && num(google.position) !== null) return `#${google.position}`
    if (google?.state === 'not_found') return 'not on page one'
    return null
}

/**
 * Searches an engine ran without sending their text, from the totals:
 * searches minus the texts reported (0 when every search sent its text).
 */
export function unreportedSearches(totals) {
    const searches = num(totals?.searches)
    const queries = num(totals?.queries)
    if (searches === null || queries === null) return 0
    return Math.max(0, searches - queries)
}
