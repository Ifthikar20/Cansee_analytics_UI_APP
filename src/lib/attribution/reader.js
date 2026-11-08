// The source viewer's reader blocks (attribution_contract.md 2) and where
// the cited passage sits in them. Page text is untrusted: these helpers only
// split strings, and the viewer renders every piece as a text node. Pure.

const TEXT_TYPES = new Set(['heading', 'paragraph', 'quote', 'code'])

/** The string an anchor addresses: block.text, or block.items[item] for lists. */
export function anchorText(blocks, block, item) {
    const b = Array.isArray(blocks) ? blocks[block] : null
    if (!b || typeof b !== 'object') return null
    if (item == null) return typeof b.text === 'string' ? b.text : null
    const items = Array.isArray(b.items) ? b.items : null
    return items && typeof items[item] === 'string' ? items[item] : null
}

function validAnchor(blocks, anchor, quote) {
    if (!anchor || !Number.isInteger(anchor.block)) return null
    const item = Number.isInteger(anchor.item) ? anchor.item : null
    const text = anchorText(blocks, anchor.block, item)
    const { start, end } = anchor
    if (text == null || !Number.isInteger(start) || !Number.isInteger(end)) return null
    if (start < 0 || end <= start || end > text.length) return null
    if (quote && text.slice(start, end) !== quote) return null
    return { block: anchor.block, item, start, end }
}

/**
 * The passage's location as {block, item, start, end}, or null. Trusts
 * `anchor` when it slices out `quote`; otherwise looks for the quote's first
 * occurrence in the blocks' text and list items.
 */
export function locatePassage(blocks, anchor, quote) {
    const list = Array.isArray(blocks) ? blocks : []
    const direct = validAnchor(list, anchor, quote)
    if (direct) return direct
    if (typeof quote !== 'string' || !quote) return null
    for (let block = 0; block < list.length; block++) {
        const b = list[block]
        if (typeof b?.text === 'string') {
            const at = b.text.indexOf(quote)
            if (at !== -1) return { block, item: null, start: at, end: at + quote.length }
        }
        if (Array.isArray(b?.items)) {
            for (let item = 0; item < b.items.length; item++) {
                const s = b.items[item]
                const at = typeof s === 'string' ? s.indexOf(quote) : -1
                if (at !== -1) return { block, item, start: at, end: at + quote.length }
            }
        }
    }
    return null
}

/** `text` as [{text, mark}] pieces, the [start, end) range marked. */
export function splitPassage(text, start, end) {
    const s = String(text ?? '')
    const parts = []
    if (start > 0) parts.push({ text: s.slice(0, start), mark: false })
    parts.push({ text: s.slice(start, end), mark: true })
    if (end < s.length) parts.push({ text: s.slice(end), mark: false })
    return parts
}

const plain = (text) => [{ text: String(text ?? ''), mark: false }]

/**
 * Blocks ready to render: [{key, type, level?, ordered?, parts?, items?, rows?}]
 * where `parts` (text blocks) and each of `items` (lists) are [{text, mark}]
 * and `rows` (tables) are lists of cell strings. Unknown block types with
 * text read as paragraphs; anything else is dropped. `at` is the passage
 * from locatePassage, or null.
 */
export function readerBlocks(blocks, at) {
    const out = []
    ;(Array.isArray(blocks) ? blocks : []).forEach((b, index) => {
        if (!b || typeof b !== 'object') return
        const here = at && at.block === index ? at : null
        if (b.type === 'list' && Array.isArray(b.items)) {
            out.push({
                key: index,
                type: 'list',
                ordered: Boolean(b.ordered),
                items: b.items.map((s, i) =>
                    here && here.item === i ? splitPassage(s, here.start, here.end) : plain(s),
                ),
            })
            return
        }
        if (b.type === 'table' && Array.isArray(b.rows)) {
            out.push({
                key: index,
                type: 'table',
                rows: b.rows.filter(Array.isArray).map((row) => row.map((c) => String(c ?? ''))),
            })
            return
        }
        if (typeof b.text !== 'string') return
        const type = TEXT_TYPES.has(b.type) ? b.type : 'paragraph'
        const parts = here && here.item == null ? splitPassage(b.text, here.start, here.end) : plain(b.text)
        const row = { key: index, type, parts }
        if (type === 'heading') row.level = Number.isInteger(b.level) ? Math.min(Math.max(b.level, 1), 6) : 2
        out.push(row)
    })
    return out
}
