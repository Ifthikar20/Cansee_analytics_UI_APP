// Brand highlighting for agent replies: the tracked brand and its
// competitors are wrapped in <mark> so a reply shows at a glance where the
// brand stands. Runs on markup that has already been sanitized
// (sanitize.js); it only splits text nodes and inserts elements it creates
// itself, so it cannot introduce markup from the text. Code, preformatted
// text and existing marks are left alone.

const SKIP = new Set(['CODE', 'PRE', 'MARK', 'SCRIPT', 'STYLE', 'BUTTON'])

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Terms to highlight: `{ own, competitors }` names -> a matcher, or null when
 * there is nothing to mark. Names shorter than three characters are ignored
 * (they would match inside ordinary words).
 */
export function brandMatcher({ own = '', competitors = [] } = {}) {
    const kinds = new Map()
    const add = (name, kind) => {
        const key = String(name || '').trim().toLowerCase()
        if (key.length >= 3 && !kinds.has(key)) kinds.set(key, kind)
    }
    add(own, 'own')
    for (const c of competitors) add(typeof c === 'string' ? c : c?.name, 'competitor')
    if (!kinds.size) return null
    // Longest first, so "Acme Cloud" wins over "Acme".
    const names = [...kinds.keys()].sort((a, b) => b.length - a.length)
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
    return { pattern, kinds }
}

/** `html` with matcher terms wrapped in <mark class="ag-brand ag-brand--own|--competitor">. */
export function markBrands(html, matcher, doc = typeof document !== 'undefined' ? document : null) {
    if (!html || !matcher || !doc) return html
    const tpl = doc.createElement('template')
    tpl.innerHTML = html
    const walker = doc.createTreeWalker(tpl.content, 4 /* NodeFilter.SHOW_TEXT */)
    const texts = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let el = node.parentNode
        let skipped = false
        while (el && el !== tpl.content) {
            if (SKIP.has(el.nodeName)) {
                skipped = true
                break
            }
            el = el.parentNode
        }
        if (!skipped && node.nodeValue && node.nodeValue.trim()) texts.push(node)
    }
    let changed = false
    for (const node of texts) {
        const value = node.nodeValue
        matcher.pattern.lastIndex = 0
        let last = 0
        let match
        const frag = doc.createDocumentFragment()
        while ((match = matcher.pattern.exec(value))) {
            const kind = matcher.kinds.get(match[0].toLowerCase()) || 'competitor'
            if (match.index > last) frag.appendChild(doc.createTextNode(value.slice(last, match.index)))
            const mark = doc.createElement('mark')
            mark.className = `ag-brand ag-brand--${kind}`
            mark.textContent = match[0]
            frag.appendChild(mark)
            last = match.index + match[0].length
        }
        if (!last) continue
        if (last < value.length) frag.appendChild(doc.createTextNode(value.slice(last)))
        node.parentNode.replaceChild(frag, node)
        changed = true
    }
    return changed ? tpl.innerHTML : html
}
