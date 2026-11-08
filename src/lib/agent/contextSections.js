// The Context page's vocabulary (p2_contract.md 11a): the six sections in
// order with their help text, the limits the server enforces, and the
// words for each kind and state of a source. GET context/ sends the
// sections too; these are the same table, used before it loads.
import { markRaw } from 'vue'
import {
    BadgeCheck as BadgeCheckIcon,
    BookText as BookTextIcon,
    FileText as FileTextIcon,
    Swords as SwordsIcon,
} from '@lucide/vue'

export const CONTEXT_SECTIONS = Object.freeze([
    {
        key: 'company',
        label: 'Company',
        help: 'Who you are: what you do, for whom, since when, and proof such as customers and awards.',
    },
    {
        key: 'audience',
        label: 'Audience',
        help: 'Who buys, what they need, what holds them back and how they decide.',
    },
    {
        key: 'competitors',
        label: 'Competitors',
        help: 'The competitors you track and how you differ from each.',
    },
    {
        key: 'offerings',
        label: 'Offerings',
        help: 'Products, plans, prices, features and integrations.',
    },
    {
        key: 'strategy',
        label: 'Strategy',
        help: 'What you are trying to win: positioning, priorities, target questions and markets.',
    },
    {
        key: 'execution',
        label: 'Execution',
        help: 'How to write for you: voice, words to use or avoid, rules and review steps.',
    },
])

export const CONTEXT_SECTION_KEYS = Object.freeze(CONTEXT_SECTIONS.map((s) => s.key))

// Same caps as the server (contract 11a, 11c).
export const CONTEXT_LIMITS = Object.freeze({
    title: 120,
    body: 4000,
    entries: 40,
    references: 10,
    quote: 500,
    documents: 30,
    documentTitle: 200,
    documentChars: 50000,
    extraUrls: 5,
    buildDocuments: 10,
    buildPages: 8,
})

export const REFERENCE_KINDS = Object.freeze({
    page: { label: 'Page of your site', icon: markRaw(FileTextIcon) },
    fact: { label: 'Brand fact', icon: markRaw(BadgeCheckIcon) },
    document: { label: 'Document', icon: markRaw(BookTextIcon) },
    competitor: { label: 'Competitor', icon: markRaw(SwordsIcon) },
})

// A source in any of these states shows its word with a CircleAlert icon;
// `ok` shows none.
export const REFERENCE_STATE_WORDS = Object.freeze({
    changed: 'Changed since it was read',
    failed: "Couldn't load",
    unchecked: 'Not checked yet',
    retired: 'No longer approved',
    untracked: 'No longer tracked',
})

const count = new Intl.NumberFormat('en-US')

/** "1 entry", "3 entries" (any noun pair). */
export function plural(n, one, many) {
    const value = Number(n) || 0
    return `${count.format(value)} ${value === 1 ? one : many}`
}

/** The sections to show: the server's when sent (label and help), in contract order. */
export function contextSections(fromServer = null) {
    const sent = Array.isArray(fromServer) ? fromServer : []
    return CONTEXT_SECTIONS.map((base) => {
        const row = sent.find((s) => s && s.key === base.key) || {}
        return {
            key: base.key,
            label: row.label || base.label,
            help: row.help || base.help,
            entries: Number(row.entries) || 0,
            suggested: Number(row.suggested) || 0,
            references: Number(row.references) || 0,
        }
    })
}

/** The label of a section key, '' for an unknown one. */
export function contextSectionLabel(key) {
    return CONTEXT_SECTIONS.find((s) => s.key === key)?.label || ''
}

/** "{entries} entries · {references} sources" with singular forms. */
export function sectionCountLine(section) {
    return `${plural(section?.entries, 'entry', 'entries')} · ${plural(section?.references, 'source', 'sources')}`
}

/** The path of a URL ("/pricing"), "/" for the home page, the input when it does not parse. */
export function pathOf(url) {
    const raw = String(url ?? '').trim()
    if (!raw) return ''
    try {
        const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
        return `${parsed.pathname || '/'}${parsed.search || ''}`
    } catch {
        return raw
    }
}

/** The hostname without "www." and without a port; '' when it does not parse. */
export function domainOf(url) {
    const raw = String(url ?? '').trim()
    if (!raw) return ''
    try {
        const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
        return parsed.hostname.replace(/^www\./i, '').toLowerCase()
    } catch {
        return ''
    }
}

/**
 * Whether `url` is a page of `domain` (the project's site): the same host
 * or a subdomain of it. The server decides with the registrable domain; this
 * check only catches an obvious slip before the request.
 */
export function onSite(url, domain) {
    const host = domainOf(url)
    const site = String(domain || '').replace(/^www\./i, '').toLowerCase()
    if (!host || !site) return false
    return host === site || host.endsWith(`.${site}`)
}

/** A URL with https:// added when the scheme is missing, or '' when it is not a web address. */
export function normalizeUrl(raw) {
    const value = String(raw || '').trim()
    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value
    if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value)) return `https://${value}`
    return ''
}
