// Chart specs (contract 8a), stat tiles and words for Products (contract 9).
// Pure functions.
//
// A product's `latest` is null before its first check, and its `google` or
// `engines` part is null when that side was never checked: those read "Not
// checked", never 0. Prices are the strings Google showed; nothing here
// converts or adds them.
import { engineMeta } from '@/lib/engines'

const integer = new Intl.NumberFormat('en-US')

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function count(value) {
    return integer.format(value)
}

function productsOf(payload) {
    return Array.isArray(payload?.products) ? payload.products : []
}

/** The four Products tiles. */
export function productTiles(payload) {
    const products = productsOf(payload)
    let checked = 0
    let found = 0
    let sold = 0
    let answers = 0
    let named = 0
    for (const p of products) {
        const google = p?.latest?.google
        if (google && (google.state === 'found' || google.state === 'not_found')) {
            checked += 1
            if (google.state === 'found') {
                found += 1
                if (google.sold_by_you) sold += 1
            }
        }
        const engines = p?.latest?.engines
        if (engines && num(engines.answers) !== null) {
            answers += engines.answers
            named += num(engines.named) ?? 0
        }
    }
    return [
        { key: 'products', label: 'Products', value: products.length, kind: 'count' },
        {
            key: 'found',
            label: 'Found in Google Shopping',
            value: checked ? `${count(found)} of ${count(checked)}` : null,
            stateText: 'Not checked',
        },
        {
            key: 'named',
            label: 'Named by engines',
            value: answers ? `${count(named)} of ${count(answers)}` : null,
            stateText: 'Not checked',
        },
        {
            key: 'sold',
            label: 'Sold by you',
            value: found ? `${count(sold)} of ${count(found)}` : null,
            stateText: checked ? 'Not found' : 'Not checked',
        },
    ]
}

/** The engines a per-product view shows: configured, or holding results. */
function shownEngines(payload) {
    const products = productsOf(payload)
    return (Array.isArray(payload?.engines) ? payload.engines : []).filter(
        (e) => e.configured || products.some((p) => p?.latest?.engines?.by_engine?.[e.key]),
    )
}

/** Share of each engine's answers that name each product (rows). */
export function productEngines(payload) {
    const products = productsOf(payload)
    return {
        id: 'products.engines',
        title: 'Named by engine',
        subtitle: "Share of each engine's shopping answers that name the product.",
        x: 'category',
        value: 'percent',
        labels: products.map((p) => String(p.id)),
        label_names: Object.fromEntries(products.map((p) => [String(p.id), p.name])),
        label_header: 'Product',
        datasets: shownEngines(payload).map((e) => {
            const cells = products.map((p) => p?.latest?.engines?.by_engine?.[e.key] || null)
            return {
                key: e.key,
                label: e.label || engineMeta(e.key).label,
                entity: `engine:${e.key}`,
                data: cells.map((c) =>
                    c && num(c.answers) > 0 ? Math.round(((num(c.named) ?? 0) / c.answers) * 1000) / 10 : null,
                ),
                states: cells.map((c) => (c && num(c.answers) > 0 ? null : 'not_checked')),
            }
        }),
        type: 'heatmap',
        representations: ['bar', 'heatmap'],
    }
}

/**
 * What a product's Google Shopping cell reads: {text, sub, measured}
 * (`#3` + `of 40 results`, `Not in the {results} results`, `Not checked`,
 * `Failed`, `Not configured`).
 */
export function shoppingText(google) {
    const state = google?.state || 'not_checked'
    const results = num(google?.results)
    if (state === 'found') {
        const position = num(google.position ?? google.best_position)
        return {
            text: position === null ? 'Found' : `#${position}`,
            sub: results !== null ? `of ${count(results)} results` : '',
            measured: true,
        }
    }
    if (state === 'not_found') {
        return { text: results !== null ? `Not in the ${count(results)} results` : 'Not found', sub: '', measured: false }
    }
    if (state === 'failed') return { text: 'Failed', sub: '', measured: false }
    if (state === 'not_configured') return { text: 'Not configured', sub: '', measured: false }
    return { text: 'Not checked', sub: '', measured: false }
}

/** `#3 of 40 results` / `not in the 40 results` for the `product` ask template. */
export function shoppingWord(google) {
    const state = google?.state
    const results = num(google?.results)
    if (state === 'found') {
        const position = num(google.position ?? google.best_position)
        if (position === null) return null
        return results !== null ? `#${position} of ${count(results)} results` : `#${position}`
    }
    if (state === 'not_found' && results !== null) return `not in the ${count(results)} results`
    return null
}

/** An engine answer's state word: Named, Not named, Failed, Not checked. */
export function engineStateWord(state) {
    switch (state) {
        case 'named':
            return 'Named'
        case 'not_named':
            return 'Not named'
        case 'failed':
            return 'Failed'
        default:
            return 'Not checked'
    }
}

/** The project's own host (no `www.`), from its URL; '' when unknown. */
export function siteHost(url) {
    try {
        return new URL(String(url || '')).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
        return ''
    }
}

/** True when `url` is a page of the site whose host is `host`. */
export function onSite(url, host) {
    if (!host) return false
    const other = siteHost(url)
    return Boolean(other) && (other === host || other.endsWith(`.${host}`))
}
