// Ask the agent: the drafted messages of every analytics tab (p2_contract.md
// 1g and 15c), word for word. askText(id, values) fills a template; a line
// holding a placeholder whose value is missing (empty, null, undefined or
// an empty list) is left out, so the agent never reads "null". The text is
// handed over by lib/agent/askAgent.js and the user reviews it before
// anything is sent.
//
// Values are keyed by placeholder name. Lists (engines, domains, sources,
// prompts, failed checks) are arrays or ready text; engine keys in
// `engines` become their labels. `facts` is an array of lines
// (pageFactLines). Numbers are formatted; `*_pct` values as percentages.
// Two templates pick their agent from a value:
//   fact_contradicted / fact_publishers: evidenceKind ('page' | 'fact') and
//     evidence_url; evidence_label ("brand fact" or the page URL) and target
//     (the page URL, else "our site") are derived unless given.
//   product: urlOnSite (true when the product page is on the project's site).
import { formatValue } from '@/lib/charts/format'
import { engineMeta } from '@/lib/engines'
import { CHECKS } from './insightWords'

const T = (id, from, agents, text) => Object.freeze({ id, from, agents: Object.freeze(agents), agent: agents[agents.length - 1], text })

export const ASK_TEMPLATES = Object.freeze({
    fact_contradicted: T(
        'fact_contradicted',
        'fact-check',
        ['page_optimizer', 'aeo_article'],
        'AI engines state something about us that our own evidence contradicts.\n' +
            'Claim ({engines}, {answers} answers): "{claim}"\n' +
            'Our evidence ({evidence_label}): "{evidence_quote}"\n' +
            'Draft the correction for {target}, so the engines can find the right fact, and tell me where to publish it.'
    ),
    fact_unverifiable: T(
        'fact_unverifiable',
        'fact-check',
        ['aeo_article'],
        'AI engines state "{claim}" about us ({answers} answers), and none of our pages or brand facts covers it. ' +
            'Check whether it is true and, if it is, draft a short section for our site that states it clearly.'
    ),
    fact_publishers: T(
        'fact_publishers',
        'fact-check',
        ['pr_writer'],
        'Draft correction requests to the publishers whose pages repeat this claim: "{claim}" (Fact check claim {key}).\n' +
            'Our evidence ({evidence_label}): "{evidence_quote}"'
    ),
    theme: T(
        'theme',
        'sentiment',
        ['gap_analyst'],
        'AI engines describe us as "{theme}" ({tone}) in {answers} answers ({engines}). Example: "{quote}"\n' +
            'Find what drives this description and draft content that reinforces or corrects it honestly.'
    ),
    competitor_prompt: T(
        'competitor_prompt',
        'competitors',
        ['gap_analyst'],
        'For "{prompt}", AI engines name {competitor} in {their_pct} of answers and us in {our_pct}.\n' +
            'On Google we are {our_google} and they are {their_google}.\n' +
            'Find why and draft a plan to close the gap.'
    ),
    citation_gap: T(
        'citation_gap',
        'sources',
        ['aeo_article'],
        'For "{prompt}", AI engines cited competitor pages {competitor_citations} times and ours never. Most cited domains: {domains}.\n' +
            'Draft a page that answers this prompt well enough to be cited.'
    ),
    page_optimize: T(
        'page_optimize',
        'pages',
        ['page_optimizer'],
        'Optimize {url} so AI engines read and cite it.\n' +
            'What Cansee measured:\n' +
            '{facts}\n' +
            'Suggest concrete changes to this page and draft them.'
    ),
    crawler_fix: T(
        'crawler_fix',
        'crawler-access',
        ['page_optimizer'],
        'Make {url} readable for AI crawlers. Failed checks: {failed_checks}.\n' + 'Explain each fix and draft the changes.'
    ),
    idea: T(
        'idea',
        'prompt-research',
        ['aeo_article'],
        'Draft an answer page for this question: "{idea}".\n' +
            'Where it came from: {sources}.\n' +
            'Related tracked prompts: {prompts}.'
    ),
    fanout: T(
        'fanout',
        'fan-outs',
        ['aeo_article'],
        'While answering "{prompt}", {engines} searched the web for "{query}".\n' +
            'On Google we are {google} for that search.\n' +
            'Draft a page that answers that search.'
    ),
    product: T(
        'product',
        'products',
        ['page_optimizer', 'aeo_article'],
        'Improve how shopping answers show {product}.\n' +
            'Google Shopping: {google}.\n' +
            'Engines named it in {named} of {answers} answers.\n' +
            'Product page: {url}.\n' +
            'Suggest fixes to the page and its product data, and draft them.'
    ),
})

const integer = new Intl.NumberFormat('en-US')
const PLACEHOLDER = /\{([a-z_]+)\}/g

function missing(value) {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
}

/** "A", "A and B", "A, B and C". */
export function listText(items) {
    const list = (items || []).map((v) => String(v ?? '').trim()).filter(Boolean)
    if (list.length <= 1) return list[0] || ''
    return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

function engineLabel(key) {
    const meta = engineMeta(key)
    return meta.label || String(key)
}

function textOf(name, value) {
    if (missing(value)) return null
    if (name === 'facts') return Array.isArray(value) ? value.filter(Boolean).join('\n') || null : String(value)
    if (Array.isArray(value)) {
        const list = name === 'engines' ? value.map(engineLabel) : value
        return listText(list) || null
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null
        if (name.endsWith('_pct')) return formatValue(value, { value: 'percent' })
        return Number.isInteger(value) ? integer.format(value) : String(value)
    }
    return String(value)
}

// Values a template derives from others (contract 1g notes).
function derived(id, values) {
    const out = { ...values }
    if (id === 'fact_contradicted' || id === 'fact_publishers') {
        const pageUrl = values.evidenceKind === 'page' ? values.evidence_url || '' : ''
        if (missing(out.evidence_label)) {
            out.evidence_label = pageUrl || (values.evidenceKind === 'fact' ? 'brand fact' : null)
        }
        if (id === 'fact_contradicted' && missing(out.target)) out.target = pageUrl || 'our site'
    }
    return out
}

/** The drafted message of template `id` with `values`; '' for an unknown id. */
export function askText(id, values = {}) {
    const template = ASK_TEMPLATES[id]
    if (!template) return ''
    const filled = derived(id, values || {})
    const lines = []
    for (const line of template.text.split('\n')) {
        let dropped = false
        const out = line.replace(PLACEHOLDER, (_, name) => {
            const text = textOf(name, filled[name])
            if (text === null) dropped = true
            return text ?? ''
        })
        if (!dropped) lines.push(out)
    }
    return lines.join('\n')
}

/** The agent a template hands its draft to, for these values. */
export function askAgentKey(id, values = {}) {
    const template = ASK_TEMPLATES[id]
    if (!template) return null
    if (id === 'fact_contradicted') return values?.evidenceKind === 'page' ? 'page_optimizer' : 'aeo_article'
    if (id === 'product') return values?.urlOnSite === true ? 'page_optimizer' : 'aeo_article'
    return template.agent
}

/** "#4" for a position, "not on page one" when checked without a match, null when not checked. */
export function googlePlace(position, { checked = true } = {}) {
    if (typeof position === 'number' && Number.isFinite(position)) return `#${integer.format(position)}`
    return checked ? 'not on page one' : null
}

/**
 * The `{facts}` lines of page_optimize from a Pages row (contract 6): only
 * what was measured, and only signals with something to say (a zero or a
 * source that is not on sends no line). `days` is the period's length; the
 * crawler report always covers the last 7 days.
 */
export function pageFactLines(page, { days = 30, checks = null, maxPrompts = 5 } = {}) {
    if (!page) return []
    const lines = []
    const google = page.google
    if (google && Array.isArray(google.prompts)) {
        const ranked = google.prompts
            .filter((p) => typeof p?.position === 'number')
            .sort((a, b) => a.position - b.position)
            .slice(0, maxPrompts)
        for (const p of ranked) lines.push(`- Google: #${integer.format(p.position)} for "${p.text}"`)
    }
    const cites = page.citations
    if (cites && cites.citations > 0) {
        const engines = listText((cites.engines || []).map(engineLabel))
        const head = `- AI citations: ${integer.format(cites.citations)} in ${integer.format(cites.answers || 0)} answers`
        lines.push(engines ? `${head} (${engines})` : head)
        if (cites.cited_in_text === 0) lines.push('- Retrieved by engines but never cited in the answer text')
    }
    const visits = page.ai_visits
    if (visits && visits.sessions > 0) {
        lines.push(`- AI visits: ${integer.format(visits.sessions)} in the last ${days} days`)
    }
    const crawl = page.crawler_requests
    if (crawl && crawl.requests > 0) {
        lines.push(`- AI crawler requests: ${integer.format(crawl.requests)} in the last 7 days`)
    }
    const audit = page.audit
    if (audit && typeof audit.passed === 'number' && typeof audit.total === 'number') {
        const failing = (audit.failed || []).map((key) => checks?.[key] || CHECKS[key] || key)
        const head = `- Audit: ${audit.passed} of ${audit.total} checks pass`
        lines.push(failing.length ? `${head}; failing: ${listText(failing)}` : head)
    }
    return lines
}
