// Compact specs, tiles, rows and states of the group B cards
// (board_frontend.md 11b, board_contract.md 4). Pure: the cards render what
// these return through VizStatTile, VizChart, BarList and LineList.
//
// Cards read fixed windows (30 days, the latest audit and checks). A value
// that was not measured is null with its state word, never 0; a measured
// zero is 0. Bars are the accent only for you (`emphasis`), gray otherwise.
import { formatValue } from '@/lib/charts/format'
import { stateText } from '@/lib/charts/spec'
import { factCheckTiles, sentimentTiles } from '@/lib/analytics/answerSpecs'
import { brandTiles } from '@/lib/analytics/benchmarkSpecs'
import { TONES, VERDICTS, sourceStateWord } from '@/lib/analytics/insightWords'
import { productTiles, shoppingText, shoppingWord } from '@/lib/analytics/productSpecs'
import { fanoutGoogleText, fanoutTiles, ideaSourceLabel, ideaTiles } from '@/lib/analytics/researchSpecs'
import { crawlerTiles } from '@/lib/analytics/siteSpecs'
import { byEngine, headlineTiles } from '@/lib/analytics/visibilitySpecs'

const integer = new Intl.NumberFormat('en-US')

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function count(value) {
    return integer.format(value)
}

function plural(n, one, many) {
    return `${count(n)} ${n === 1 ? one : many}`
}

function pct(value) {
    return formatValue(value, { value: 'percent' })
}

/* ── States (contract 4) ── */

// A state is {kind?, title, body?, action?}. An action opens a widget's
// panel (`open: [key, query]`), the card's own panel (`panel`), follows a
// route (`to`) or reloads the card's source (`retry`).
export const NO_PROMPTS = Object.freeze({
    title: 'Track a prompt first.',
    action: Object.freeze({ label: 'Add prompts', open: Object.freeze(['prompts', Object.freeze({ add: '1' })]) }),
})

export const NOT_NAMED = Object.freeze({ title: "The engines didn't name you in the last 30 days." })

// Nothing analyzed yet: the action opens the panel, whose dialog shows the cost.
export const NOT_ANALYZED = Object.freeze({
    title: 'No answers analyzed yet.',
    action: Object.freeze({ label: 'Analyze answers', panel: true }),
})

/** The state of a card whose source failed before it had any data. */
export function loadFailure(failure, title) {
    if (failure?.code === 'insights_disabled') return { kind: 'disabled', title: 'Insights are turned off on this server.' }
    return { kind: 'error', title: `We couldn't load ${title}.`, action: { label: 'Try again', retry: true } }
}

/** VizStatTile props of one tile of a page's tile list, without its key or tone. */
export function tileProps(tiles, key) {
    const tile = (tiles || []).find((t) => t.key === key)
    if (!tile) return null
    const { key: _key, tone: _tone, ...props } = tile
    return props
}

/* ── The visibility family (visibility, by engine, share of voice) ── */

/** The family's states for a visibility dashboard payload, or null when it has answers. */
export function visibilityEmpty(payload) {
    const reason = payload?.empty_reason || (payload?.has_data === false ? 'no_answers' : null)
    if (reason === 'no_prompts') return NO_PROMPTS
    if (reason === 'no_engines') return { kind: 'not_connected', title: 'No AI engine is connected yet.' }
    if (reason === 'no_answers') return { title: 'No AI answers in the last 30 days.' }
    return null
}

/** `board.visibility`: the share of every engine's answers that name you, one line. */
export function visibilityAll(payload) {
    const labels = [...(payload?.window?.buckets || [])]
    const values = payload?.visibility?.all?.visibility_pct
    return {
        id: 'board.visibility',
        x: 'time',
        time_unit: payload?.window?.interval === 'week' ? 'week' : 'day',
        value: 'percent',
        labels,
        datasets: [{ key: 'all', label: 'All engines', data: labels.map((_, i) => num(values?.[i])) }],
        type: 'line',
        palette: 'emphasis',
        emphasis: 'all',
        missing_label: 'No answers',
    }
}

export function visibilityTile(payload) {
    return tileProps(headlineTiles(payload, { period: '30d' }), 'visibility')
}

/** Each shown engine's AI visibility; every bar is you, so every bar is the accent. */
export function engineItems(payload) {
    const spec = byEngine(payload)
    const dataset = spec.datasets.find((d) => d.key === 'visibility')
    return spec.labels.map((key, i) => {
        const value = num(dataset?.data[i])
        return {
            key,
            label: spec.label_names[key] || key,
            value,
            text: value === null ? stateText(spec, dataset?.states?.[i] || 'not_measured') : pct(value),
            emphasis: true,
        }
    })
}

export function voiceTile(payload) {
    return tileProps(headlineTiles(payload, { period: '30d' }), 'share_of_voice')
}

/** True when any brand was named in the window's answers. */
export function anyBrandNamed(payload) {
    return (payload?.share_of_voice?.brands || []).some((b) => (num(b?.mentions) ?? 0) > 0)
}

/**
 * The `limit` brands with the largest share of voice, you included (your
 * row is added when you are lower). "Other brands" is a sum, not a brand.
 */
export function voiceItems(payload, { limit = 4 } = {}) {
    const brands = (payload?.share_of_voice?.brands || []).filter((b) => b && b.key !== 'other')
    const ranked = [...brands].sort((a, b) => (num(b.share_pct) ?? -1) - (num(a.share_pct) ?? -1))
    const top = ranked.slice(0, limit)
    const you = brands.find((b) => b.is_you)
    if (you && !top.includes(you)) top.push(you)
    return top.map((b) => {
        const value = num(b.share_pct)
        return {
            key: String(b.key),
            label: b.name || String(b.key),
            value,
            text: value === null ? 'Not named' : pct(value),
            emphasis: Boolean(b.is_you),
        }
    })
}

/* ── Who AI recommends ── */

/** The top `limit` brands of the overview's leaderboard, plus your row when you rank lower. */
export function leaderboardItems(leaderboard, { limit = 5 } = {}) {
    const list = (Array.isArray(leaderboard) ? leaderboard : []).filter(Boolean)
    const top = list.slice(0, limit)
    const you = list.find((b) => b.is_you)
    if (you && !top.includes(you)) top.push(you)
    return top.map((b) => {
        const value = num(b.visibility_pct)
        return {
            key: String(b.name ?? ''),
            label: String(b.name ?? ''),
            value,
            text: value === null ? 'Not measured' : pct(value),
            emphasis: Boolean(b.is_you),
        }
    })
}

/* ── Sentiment ── */

export function sentimentTile(payload) {
    return tileProps(sentimentTiles(payload), 'named')
}

/** Positive, neutral and negative answers; the words carry the meaning, so every bar is gray. */
export function toneItems(payload) {
    const tone = payload?.tone || {}
    return ['positive', 'neutral', 'negative'].map((key) => {
        const value = num(tone[key])
        return { key, label: TONES[key], value, text: value === null ? 'Not measured' : count(value), emphasis: false }
    })
}

/** True when at least one answer that names you was analyzed. */
export function anyAnalyzed(payload) {
    return (num(payload?.coverage?.analyzed) ?? 0) > 0
}

/** `Most repeated: "{label}" ({tone}, {answers} answers)` from the most repeated theme, or ''. */
export function themeLine(payload) {
    const themes = (Array.isArray(payload?.themes) ? payload.themes : []).filter((t) => t && t.label)
    if (!themes.length) return ''
    const top = [...themes].sort((a, b) => (num(b.answers) ?? 0) - (num(a.answers) ?? 0))[0]
    const parts = []
    if (TONES[top.tone]) parts.push(TONES[top.tone].toLowerCase())
    const answers = num(top.answers)
    if (answers !== null) parts.push(plural(answers, 'answer', 'answers'))
    return `Most repeated: "${top.label}"${parts.length ? ` (${parts.join(', ')})` : ''}`
}

/* ── Fact check ── */

export function factCheckTile(payload) {
    return tileProps(factCheckTiles(payload), 'checked')
}

/** The fact check's states, or null when it has claims to show. */
export function factCheckEmpty(payload) {
    switch (payload?.empty_reason) {
        case 'no_answers':
            return NOT_NAMED
        case 'not_analyzed':
            return NOT_ANALYZED
        case 'no_claims':
            return { title: 'The analyzed answers make no checkable claims about you.' }
        default:
            return null
    }
}

// The verdicts a card counts, in Fact check's order; claims whose check
// didn't finish are listed only when there are some.
const VERDICT_ROWS = ['contradicted', 'not_verifiable', 'supported']

/** Claims by verdict, all gray: the verdict words carry the meaning. */
export function verdictItems(payload) {
    const totals = payload?.totals || null
    const keys = [...VERDICT_ROWS]
    if ((num(totals?.unchecked) ?? 0) > 0) keys.push('unchecked')
    return keys.map((key) => {
        const value = totals ? num(totals[key]) : null
        return { key, label: VERDICTS[key].word, value, text: value === null ? 'Not analyzed' : count(value), emphasis: false }
    })
}

/** The text of the contradicted claim repeated in the most answers, or ''. */
export function topContradicted(payload) {
    const claims = (Array.isArray(payload?.claims) ? payload.claims : []).filter(
        (c) => c && c.verdict === 'contradicted' && c.text,
    )
    if (!claims.length) return ''
    return [...claims].sort((a, b) => (num(b.answers) ?? 0) - (num(a.answers) ?? 0))[0].text
}

/* ── Citations ── */

/** The citations card's states, or null when the answers cite sources. */
export function citationsEmpty(payload) {
    if (payload?.empty_reason === 'no_prompts') return NO_PROMPTS
    if (payload?.citations?.has_data === false || !(payload?.citations?.top_domains || []).length) {
        return { title: 'No cited sources yet.', body: 'Engines that answer without sources leave this empty.' }
    }
    return null
}

/** `{yours} of {total} citations point to your site`, or '' without citation rows. */
export function citationLead(payload) {
    const c = payload?.citations
    if (!c || c.has_data === false) return ''
    const yours = num(c.totals?.yours)
    const total = num(c.totals?.total)
    if (yours === null || total === null) return ''
    return `${count(yours)} of ${count(total)} citations point to your site`
}

/** The `limit` most cited domains; your site is the accent. */
export function domainItems(payload, { limit = 5 } = {}) {
    return (payload?.citations?.top_domains || [])
        .filter(Boolean)
        .slice(0, limit)
        .map((d) => {
            const value = num(d.citations)
            return {
                key: String(d.domain),
                label: String(d.domain),
                value,
                text: value === null ? 'Not recorded' : count(value),
                emphasis: Boolean(d.is_yours),
                hint: d.is_yours ? 'Your site' : d.is_competitor ? 'Competitor' : '',
            }
        })
}

/* ── Crawler access ── */

/** Three lines: AI search bots allowed, robots.txt and llms.txt. */
export function crawlerLines(payload) {
    const tiles = crawlerTiles(payload)
    return ['search_bots', 'robots', 'llms'].map((key) => {
        const tile = tiles.find((t) => t.key === key)
        const measured = tile.value !== null && tile.value !== undefined && tile.value !== ''
        return { key, label: tile.label, text: measured ? String(tile.value) : tile.stateText, measured }
    })
}

/* ── Pages ── */

/**
 * Your `limit` pages with the most AI citations: `{path}` with `{n}
 * citations`. While the citations source is off, the pages keep the API's
 * order and read that source's state word.
 */
export function pageItems(payload, { limit = 5 } = {}) {
    const source = payload?.sources?.citations
    const on = source?.state === 'ok'
    const citations = (p) => (on ? num(p?.citations?.citations) : null)
    const pages = (payload?.pages || []).filter(Boolean)
    const ranked = on ? [...pages].sort((a, b) => (citations(b) ?? -1) - (citations(a) ?? -1)) : pages
    return ranked.slice(0, limit).map((p) => {
        const value = citations(p)
        return {
            key: String(p.url),
            label: p.path || String(p.url),
            value,
            text: value === null ? sourceStateWord(source?.state) : plural(value, 'citation', 'citations'),
            emphasis: true,
        }
    })
}

/* ── Query fan-outs ── */

export function fanoutTile(payload) {
    return tileProps(fanoutTiles(payload), 'searches')
}

/** The `limit` searches the engines ran in the most answers, each with its Google place. */
export function fanoutLines(payload, { limit = 3 } = {}) {
    const rows = []
    for (const p of payload?.prompts || []) {
        for (const q of p?.queries || []) {
            if (q && q.text) rows.push({ prompt: p, query: q })
        }
    }
    rows.sort(
        (a, b) =>
            (num(b.query.answers) ?? 0) - (num(a.query.answers) ?? 0) ||
            String(b.query.last_seen_at || '').localeCompare(String(a.query.last_seen_at || '')),
    )
    return rows.slice(0, limit).map(({ prompt, query }) => {
        const google = fanoutGoogleText(query.google)
        return {
            key: `${prompt.prompt_id}|${query.key ?? query.text}`,
            label: query.text,
            text: google.text,
            measured: google.measured,
        }
    })
}

/* ── Prompt research ── */

export function ideaTile(payload) {
    return tileProps(ideaTiles(payload), 'new')
}

/** True when there is no idea in any status yet. */
export function noIdeas(payload) {
    const c = payload?.counts || {}
    return !((num(c.new) ?? 0) + (num(c.tracked) ?? 0) + (num(c.dismissed) ?? 0))
}

/** The first `limit` new ideas, each with where it came from. */
export function ideaLines(payload, { limit = 3 } = {}) {
    return (payload?.ideas || [])
        .filter((idea) => idea && idea.text && (idea.status || 'new') === 'new')
        .slice(0, limit)
        .map((idea) => ({
            key: String(idea.id),
            label: idea.text,
            text: (idea.sources || []).map(ideaSourceLabel).join(', '),
            measured: false,
        }))
}

/* ── Competitors ── */

/** AI visibility of you and each competitor you track; you are the accent. */
export function brandItems(payload) {
    return brandTiles(payload).map((t) => ({
        key: t.key,
        label: t.label,
        value: t.value,
        text: t.value === null ? t.stateText : pct(t.value),
        emphasis: t.key === 'you',
    }))
}

/* ── Products ── */

export function productsTile(payload) {
    return tileProps(productTiles(payload), 'products')
}

function capitalized(text) {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Each tracked product (at most `limit`) with its Google Shopping word. */
export function productLines(payload, { limit = 5 } = {}) {
    return (payload?.products || [])
        .filter(Boolean)
        .slice(0, limit)
        .map((p) => {
            if (!p.latest) return { key: String(p.id), label: p.name, text: 'Not checked yet', measured: false }
            const google = p.latest.google || null
            const word = shoppingWord(google)
            return {
                key: String(p.id),
                label: p.name,
                text: word ? capitalized(word) : shoppingText(google).text,
                measured: google?.state === 'found',
            }
        })
}
