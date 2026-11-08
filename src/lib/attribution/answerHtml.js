// The chat viewer's answer markup (attribution_contract.md 1): the raw
// model response, HTML-escaped, with **bold** rendered, brand names wrapped
// in colored marks, and each finding's span (answer_start/answer_end) wrapped
// in a numbered, clickable source mark. The result is meant for v-html, so
// every character of the response is escaped here; only the tags this module
// writes reach the DOM. Pure: no Vue, no requests.

export const COMPETITOR_CLASS_COUNT = 8

const OWNERS = Object.freeze(['you', 'competitor', 'third_party'])

const ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })

export function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** `owner` when it is one the contract names, else third_party. */
export function normalizeOwner(owner) {
    return OWNERS.includes(owner) ? owner : 'third_party'
}

/**
 * Lowercased brand name -> mark class. The tracked brand gets
 * cdm-mark--own, competitors cdm-mark--c0..c7 in ranking order, and generic
 * terms cdm-mark--info. "YNAB (You Need A Budget)"-style names also answer
 * to either half, so bare mentions light up in the same color.
 *
 * `brands` are the brand rows in ranking order, `info` the informational
 * rows, `own` the tracked brand's name.
 */
export function buildBrandClassMap({ own = '', brands = [], info = [] } = {}) {
    const map = new Map()
    const ownKey = String(own || '').trim().toLowerCase()
    const register = (name, cls) => {
        const key = String(name || '').trim().toLowerCase()
        if (!key || map.has(key)) return
        map.set(key, cls)
        const short = key.replace(/\s*\(.*\)\s*$/, '')
        const inner = (key.match(/\(([^)]{3,})\)\s*$/) || [])[1]
        for (const alias of [short, inner]) {
            const a = (alias || '').trim()
            if (a && a.length > 2 && !map.has(a)) map.set(a, cls)
        }
    }
    let i = 0
    for (const b of brands) {
        const key = String(b?.name || '').trim().toLowerCase()
        if (!key || map.has(key)) continue
        register(key, key === ownKey ? 'cdm-mark--own' : `cdm-mark--c${i++ % COMPETITOR_CLASS_COUNT}`)
    }
    for (const b of info) {
        const key = String(b?.name || '').trim().toLowerCase()
        if (!key || map.has(key)) continue
        register(key, 'cdm-mark--info')
    }
    // The tracked brand is highlightable even when this answer's brand list
    // does not include it (it may only appear in the prompt).
    if (ownKey && !map.has(ownKey)) register(ownKey, 'cdm-mark--own')
    return map
}

/** UTF-16 index of code point `cp` in `text` (Python offsets count code points). */
function codePointToIndex(text, cp) {
    let index = 0
    let count = 0
    while (count < cp && index < text.length) {
        const code = text.charCodeAt(index)
        index += code >= 0xd800 && code <= 0xdbff && index + 1 < text.length ? 2 : 1
        count++
    }
    return count === cp ? index : -1
}

function nearestOccurrence(text, quote, near) {
    let best = -1
    for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
        if (best === -1 || Math.abs(i - near) < Math.abs(best - near)) best = i
    }
    return best
}

/**
 * Where a finding sits in `text`, as {start, end} UTF-16 indices, or null.
 * Uses the contract's offsets when they slice out answer_quote; otherwise
 * tries them as code-point offsets (answers with emoji), then the quote's
 * occurrence nearest the given start.
 */
export function locateFinding(text, finding) {
    const src = String(text ?? '')
    const quote = typeof finding?.answer_quote === 'string' ? finding.answer_quote : ''
    const s = finding?.answer_start
    const e = finding?.answer_end
    const numeric = Number.isInteger(s) && Number.isInteger(e) && s >= 0 && s < e
    if (numeric) {
        if (e <= src.length && (!quote || src.slice(s, e) === quote)) return { start: s, end: e }
        const s16 = codePointToIndex(src, s)
        const e16 = codePointToIndex(src, e)
        if (s16 !== -1 && e16 > s16 && (!quote || src.slice(s16, e16) === quote)) return { start: s16, end: e16 }
    }
    if (!quote) return null
    const at = nearestOccurrence(src, quote, numeric ? s : 0)
    return at === -1 ? null : { start: at, end: at + quote.length }
}

/**
 * Number the findings in answer order and place their spans.
 * Returns {items: [{finding, n, span}], spans: [{id, start, end, owner, n}]}:
 * items in display order (located findings by position, the rest after,
 * each keeping its relative order), spans sorted and never overlapping
 * (a span overlapping an earlier one is left unmarked; its row stays).
 */
export function layoutFindings(text, findings) {
    const list = Array.isArray(findings) ? findings.filter((f) => f && typeof f === 'object') : []
    const located = list.map((finding, index) => ({ finding, index, span: locateFinding(text, finding) }))
    located.sort((a, b) => {
        const pa = a.span ? a.span.start : Infinity
        const pb = b.span ? b.span.start : Infinity
        return pa === pb ? a.index - b.index : pa - pb
    })
    const items = []
    const spans = []
    let lastEnd = -1
    located.forEach((row, i) => {
        const n = i + 1
        let span = row.span
        if (span && span.start < lastEnd) span = null
        if (span) {
            lastEnd = span.end
            spans.push({
                id: String(row.finding.id ?? n),
                start: span.start,
                end: span.end,
                owner: normalizeOwner(row.finding.source?.owner),
                n,
            })
        }
        items.push({ finding: row.finding, n, span })
    })
    return { items, spans }
}

/**
 * The answer as safe HTML.
 *
 * Every character is escaped. **bold** pairs (per line, as before) become
 * <strong>; whole-word brand names (keys of `brandClasses`) become
 * <mark class="cdm-mark {cls}">; each of `spans` becomes
 * <mark class="cdm-src cdm-src--{owner}" data-finding="{id}"> ending in a
 * numbered <sup>. Tags nest span > strong > brand mark, and are closed and
 * reopened where a span boundary cuts through bold text or a brand name, so
 * the markup is always well formed.
 */
export function buildAnswerHtml(text, { brandClasses = new Map(), spans = [], activeId = null } = {}) {
    const src = String(text ?? '')
    const n = src.length
    if (!n) return ''

    // Bold: the ** markers are hidden, the text between them is bold. The
    // lazy dot never crosses a newline, so an unmatched ** cannot swallow a
    // paragraph.
    const hidden = new Uint8Array(n)
    const bold = new Uint8Array(n)
    for (const m of src.matchAll(/\*\*(.+?)\*\*/g)) {
        const s = m.index
        const e = s + m[0].length
        hidden.fill(1, s, s + 2)
        hidden.fill(1, e - 2, e)
        bold.fill(1, s + 2, e - 2)
    }

    // Brands: matched on the raw text, so names with & or quotes match and
    // tag names can never be matched. Lookarounds instead of \b: a word
    // boundary never matches next to a name ending in ")".
    const brand = new Int32Array(n).fill(-1)
    const brandCls = new Map()
    const names = [...brandClasses.keys()].filter(Boolean).sort((a, b) => b.length - a.length)
    if (names.length) {
        const re = new RegExp(`(?<!\\w)(${names.map(escapeRegExp).join('|')})(?!\\w)`, 'gi')
        for (const m of src.matchAll(re)) {
            const s = m.index
            const e = s + m[0].length
            const cls = brandClasses.get(m[0].toLowerCase())
            if (!cls || hidden.subarray(s, e).some(Boolean)) continue
            brand.fill(s, s, e)
            brandCls.set(s, cls)
        }
    }

    const span = new Int32Array(n).fill(-1)
    const spanList = (Array.isArray(spans) ? spans : []).filter(
        (sp) => Number.isInteger(sp?.start) && Number.isInteger(sp?.end) && sp.start >= 0 && sp.start < sp.end,
    )
    spanList.forEach((sp, i) => {
        for (let k = sp.start; k < Math.min(sp.end, n); k++) if (span[k] === -1) span[k] = i
    })

    const openSpan = (i) => {
        const sp = spanList[i]
        const cls = `cdm-src cdm-src--${normalizeOwner(sp.owner)}${sp.id === activeId ? ' cdm-src--active' : ''}`
        return `<mark class="${cls}" data-finding="${escapeHtml(sp.id)}" tabindex="0" role="button">`
    }
    const closeSpan = (i) => {
        const num = escapeHtml(spanList[i].n ?? i + 1)
        return `<sup class="cdm-src-n"><span class="sr-only">source </span>${num}</sup></mark>`
    }

    let out = ''
    let cur = { span: -1, bold: 0, brand: -1 }
    const closeFrom = (level) => {
        if (level <= 2 && cur.brand !== -1) out += '</mark>'
        if (level <= 1 && cur.bold) out += '</strong>'
        if (level <= 0 && cur.span !== -1) out += closeSpan(cur.span)
    }
    const openFrom = (level, next) => {
        if (level <= 0 && next.span !== -1) out += openSpan(next.span)
        if (level <= 1 && next.bold) out += '<strong>'
        if (level <= 2 && next.brand !== -1) out += `<mark class="cdm-mark ${brandCls.get(next.brand)}">`
    }

    for (let i = 0; i < n; i++) {
        if (hidden[i]) continue
        const next = { span: span[i], bold: bold[i], brand: brand[i] }
        let level = 3
        if (next.span !== cur.span) level = 0
        else if (next.bold !== cur.bold) level = 1
        else if (next.brand !== cur.brand) level = 2
        if (level < 3) {
            closeFrom(level)
            openFrom(level, next)
            cur = next
        }
        const c = src[i]
        out += ESCAPES[c] || c
    }
    closeFrom(0)
    return out
}
