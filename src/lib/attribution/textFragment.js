// "Open original" links (attribution_contract.md 3): the source page's URL
// with a text fragment, `#:~:text=start[,end]`, so Chrome, Edge and Safari
// scroll to and highlight the passage. Browsers without text-fragment
// support ignore it and open the page normally. Pure.
import { safeHref } from '@/utils/safeHref'

// Quotes up to this many words are sent whole; longer ones as their first
// and last EDGE_WORDS words (textStart,textEnd), which match the same range
// and keep the URL short.
export const MAX_WHOLE_WORDS = 8
export const EDGE_WORDS = 4

/**
 * One text-directive term. encodeURIComponent already escapes `,` and `&`;
 * the spec also reserves `-` (the prefix-/-suffix marker), which it leaves.
 */
export function encodeFragmentTerm(term) {
    return encodeURIComponent(term).replace(/-/g, '%2D')
}

/** The `text=` value for `quote`, or '' when the quote has no words. */
export function textDirective(quote) {
    const words = String(quote ?? '').trim().split(/\s+/).filter(Boolean)
    if (!words.length) return ''
    if (words.length <= MAX_WHOLE_WORDS) return encodeFragmentTerm(words.join(' '))
    const start = words.slice(0, EDGE_WORDS).join(' ')
    const end = words.slice(-EDGE_WORDS).join(' ')
    return `${encodeFragmentTerm(start)},${encodeFragmentTerm(end)}`
}

/**
 * `url` without any fragment it had, plus a text fragment for `quote`.
 * Null when `url` is not an absolute http(s) URL; the bare URL when there is
 * no quote.
 */
export function textFragmentUrl(url, quote) {
    const safe = safeHref(url)
    if (!safe) return null
    const hash = safe.indexOf('#')
    const base = hash === -1 ? safe : safe.slice(0, hash)
    const directive = textDirective(quote)
    return directive ? `${base}#:~:text=${directive}` : base
}
