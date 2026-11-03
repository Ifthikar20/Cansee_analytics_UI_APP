// Structured drafts (p2_contract.md 12d): a document artifact whose version
// `data` keeps its parts. The pane picks a view by `data.type`. While a
// snapshot writer drafts, `data` is the latest artifact.snapshot: the parts
// the server read before writing plus the model's partial output, in the
// model's shapes (a social post's parts are strings, a correction target is
// {source_id, quote, letter_markdown}). These helpers turn either shape into
// one the views render, tolerating parts that have not arrived yet.
import { engineMeta } from '@/lib/engines'

export const DATA_TYPES = Object.freeze(['page_revision', 'comparison', 'social_posts', 'press', 'corrections', 'llms_txt'])

// The types with their own view; `press` and `llms_txt` render as documents.
export const STRUCTURED_VIEW_TYPES = Object.freeze(['page_revision', 'comparison', 'social_posts', 'corrections'])

export const CHANGE_KINDS = Object.freeze({
    rewrite: 'Rewrite',
    add: 'Add',
    remove: 'Remove',
    metadata: 'Title and description',
    structured_data: 'Structured data',
})

export const SIGNAL_KINDS = Object.freeze([
    'google',
    'citations',
    'retrieved_not_cited',
    'fanout',
    'ai_visits',
    'crawler',
    'audit',
])

export const CHANNEL_GROUPS = Object.freeze([
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'x', label: 'X' },
    { key: 'x_thread', label: 'X thread' },
])

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v) => (typeof v === 'string' ? v : '')
const list = (v) => (Array.isArray(v) ? v : [])
const num = (v) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

/** The data type of a version's `data` ('' when there is none). */
export function structuredType(data) {
    if (!isObject(data)) return ''
    return DATA_TYPES.includes(data.type) ? data.type : ''
}

/** True when `data` has its own structured view. */
export function hasStructuredView(data) {
    return STRUCTURED_VIEW_TYPES.includes(structuredType(data))
}

export function isDrafting(data) {
    return isObject(data) && data.drafting === true
}

export function changeKindWord(kind) {
    return CHANGE_KINDS[kind] || 'Change'
}

function meta(value) {
    const m = isObject(value) ? value : {}
    return {
        title: text(m.title),
        meta_description: text(m.meta_description),
        h1: text(m.h1),
        structured_data: list(m.structured_data).filter((s) => typeof s === 'string'),
    }
}

/** page_revision: {source, current, proposed, changes, signals, drafting}. */
export function pageRevision(data) {
    const d = isObject(data) ? data : {}
    const source = isObject(d.source) ? d.source : {}
    const signals = list(d.signals)
        .filter(isObject)
        .map((s, i) => ({ id: text(s.id) || `s${i + 1}`, kind: text(s.kind), text: text(s.text) }))
    const known = new Map(signals.map((s) => [s.id, s]))
    const changes = list(d.changes)
        .filter(isObject)
        .map((c, i) => ({
            id: text(c.id) || `c${i + 1}`,
            kind: text(c.kind),
            word: changeKindWord(c.kind),
            section: text(c.section),
            before: text(c.before),
            after: text(c.after),
            reason: text(c.reason),
            signals: list(c.signal_ids)
                .map((id) => known.get(String(id)))
                .filter(Boolean),
        }))
    // Saved: `proposed`. While drafting, the model's partial output keeps the
    // proposed title, description and H1 at the top level.
    const proposed = isObject(d.proposed)
        ? d.proposed
        : { title: d.title, meta_description: d.meta_description, h1: d.h1 }
    return {
        source: {
            url: text(source.url),
            final_url: text(source.final_url),
            title: text(source.title),
            status_code: num(source.status_code),
            read_at: text(source.read_at),
            words: num(source.words),
        },
        current: meta(d.current),
        proposed: meta(proposed),
        changes,
        signals,
        drafting: isDrafting(d),
    }
}

/** comparison: {competitor, sources, claims, verified, drafting}. */
export function comparison(data) {
    const d = isObject(data) ? data : {}
    const competitor = isObject(d.competitor) ? d.competitor : {}
    const sources = list(d.sources)
        .filter(isObject)
        .map((s, i) => ({
            id: text(s.id) || `c${i + 1}`,
            owner: s.owner === 'you' ? 'you' : 'competitor',
            url: text(s.url),
            title: text(s.title),
            read_at: text(s.read_at),
            state: s.state === 'failed' ? 'failed' : 'ok',
        }))
    const byId = new Map(sources.map((s) => [s.id, s]))
    const claims = list(d.claims)
        .filter(isObject)
        .map((c) => ({
            about: c.about === 'competitor' ? 'competitor' : 'you',
            text: text(c.text),
            source_id: text(c.source_id),
            source: byId.get(text(c.source_id)) || null,
            quote: text(c.quote),
            // Checked by the server when the draft is saved; until then neither.
            verified: typeof c.verified === 'boolean' ? c.verified : null,
        }))
    return {
        competitor: { name: text(competitor.name), domain: text(competitor.domain) },
        sources,
        claims,
        verified: claims.filter((c) => c.verified === true).length,
        checked: claims.length > 0 && claims.every((c) => c.verified !== null),
        drafting: isDrafting(d),
    }
}

/** social_posts: {source, groups: [{key, label, posts}], posts, drafting}. */
export function socialPosts(data) {
    const d = isObject(data) ? data : {}
    const source = isObject(d.source) ? d.source : null
    const posts = list(d.posts)
        .filter(isObject)
        .map((p, i) => ({
            id: text(p.id) || `p${i + 1}`,
            channel: CHANNEL_GROUPS.some((g) => g.key === p.channel) ? p.channel : 'linkedin',
            link_url: text(p.link_url),
            parts: list(p.parts).map((part) => {
                // The model's partial output has plain strings; the saved
                // draft has the server's counts.
                if (typeof part === 'string') return { text: part, length: null, limit: null, over: null }
                const o = isObject(part) ? part : {}
                return {
                    text: text(o.text),
                    length: num(o.length),
                    limit: num(o.limit),
                    over: typeof o.over === 'boolean' ? o.over : null,
                }
            }),
        }))
    return {
        source: source
            ? { artifact_id: text(source.artifact_id), title: text(source.title), version: num(source.version) }
            : null,
        posts,
        groups: CHANNEL_GROUPS.map((g) => ({ ...g, posts: posts.filter((p) => p.channel === g.key) })).filter(
            (g) => g.posts.length
        ),
        drafting: isDrafting(d),
    }
}

/** The text Copy puts on the clipboard: a thread's parts separated by blank lines. */
export function postCopyText(post) {
    return list(post?.parts)
        .map((p) => text(p?.text))
        .filter(Boolean)
        .join('\n\n')
}

/** corrections: {claim, targets, not_repeating, unreadable, drafting}. */
export function corrections(data) {
    const d = isObject(data) ? data : {}
    const claim = isObject(d.claim) ? d.claim : {}
    const evidence = isObject(claim.evidence) ? claim.evidence : {}
    const targets = list(d.targets)
        .filter(isObject)
        .map((t, i) => ({
            id: text(t.id) || text(t.source_id) || `t${i + 1}`,
            url: text(t.url),
            publisher: text(t.publisher),
            quote: text(t.quote),
            read_at: text(t.read_at),
            // Saved: `letter`; while drafting, the model's `letter_markdown`.
            letter: text(t.letter) || text(t.letter_markdown),
        }))
    const pages = (rows) =>
        list(rows)
            .filter(isObject)
            .map((r) => ({ url: text(r.url), publisher: text(r.publisher), reason: text(r.reason) }))
    return {
        claim: {
            key: text(claim.key),
            text: text(claim.text),
            // Engine keys (contract 3d), shown by their labels.
            engines: list(claim.engines)
                .map((e) => (isObject(e) ? text(e.label) || engineMeta(text(e.key)).label : engineMeta(text(e)).label))
                .filter(Boolean),
            answers: num(claim.answers),
            evidence: { kind: text(evidence.kind), url: text(evidence.url), quote: text(evidence.quote) },
        },
        targets,
        not_repeating: pages(d.not_repeating),
        unreadable: pages(d.unreadable),
        drafting: isDrafting(d),
    }
}

/** The structured tab's label: `Changes (3)`, `Sources and claims (2 of 3 verified)`, `Posts (4)`, `Letters (2)`. */
export function structuredTabLabel(data) {
    switch (structuredType(data)) {
        case 'page_revision':
            return `Changes (${pageRevision(data).changes.length})`
        case 'comparison': {
            const c = comparison(data)
            // Before the server checked the quotes there is no verified count to show.
            if (!c.checked) return `Sources and claims (${c.claims.length})`
            return `Sources and claims (${c.verified} of ${c.claims.length} verified)`
        }
        case 'social_posts':
            return `Posts (${socialPosts(data).posts.length})`
        case 'corrections':
            return `Letters (${corrections(data).targets.length})`
        default:
            return ''
    }
}
