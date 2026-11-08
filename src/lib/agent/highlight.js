// Find, keyword, brand and competitor highlighting for text the browser pane
// renders from captures (the reader view and Google results). Everything
// here takes and returns plain strings: the views render each segment as a
// text node, or a text node inside <mark>, so highlighting never turns page
// text into markup.
//
// Matching rules:
// - Terms are literals, never regular expressions.
// - Case-insensitive and locale-independent (the same on every device), on
//   NFC-normalised text. Dotted capital I and final sigma fold the way a
//   reader expects: "İstanbul" matches "istanbul", "ς" matches "σ".
// - Whole words: a term edge that is a letter or digit must not touch
//   another letter or digit, so "cat" does not match "category". Letters of
//   scripts written without spaces (Chinese, Japanese, Thai, ...) count as a
//   boundary, so "CanSee" still matches in "CanSeeの".
// - Overlaps: a find match always wins, so next/previous can land on it;
//   otherwise the longer match wins, then keyword > brand > competitor.

export const MARK_KINDS = Object.freeze(['find', 'keyword', 'brand', 'competitor'])
const RANK = { find: 0, keyword: 1, brand: 2, competitor: 3 }

export const MAX_TERMS = 24
export const MAX_TERM_LENGTH = 120
// Marks next/previous steps through in one view; past this the rest stays
// plain. In find mode the other marks get a budget of their own, so they
// can never crowd out find matches.
export const MAX_MARKS = 1000
// Matches collected per term in one string, so a one-letter term on a long
// code block stays cheap. A term past this is cut on its own; the terms
// after it are still searched.
const MAX_CANDIDATES_PER_TERM = 2000
// Content words taken from a keyword, besides the keyword itself.
const MAX_KEYWORD_WORDS = 8
const MAX_NAMES = 12

const WORD = /[\p{L}\p{N}\p{M}_]/u
const UNSPACED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u

// Words too common in tracked prompts to be worth marking on their own.
const STOPWORDS = new Set(
  (
    'a an and are as at be best by can do does for from good how i in into is it its me ' +
    'most my near of on or our should than that the their them there these they this ' +
    'those to top versus vs was we what when where which who why will with would you your'
  ).split(' ')
)

function foldChar(ch) {
  if (ch === 'İ') return 'i'
  if (ch === 'ς') return 'σ'
  return ch.toLowerCase()
}

function fold(text) {
  let out = ''
  for (const ch of text) out += foldChar(ch)
  return out
}

// Folds `text` code point by code point and records, for each code unit of
// the result, the offset in `text` it came from (plus an end sentinel), so a
// match in the folded string maps back to the original.
function foldWithMap(text) {
  let folded = ''
  const starts = []
  let i = 0
  for (const ch of text) {
    const low = foldChar(ch)
    for (let k = 0; k < low.length; k += 1) starts.push(i)
    folded += low
    i += ch.length
  }
  starts.push(i)
  return { folded, starts }
}

function cleanTerm(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const text = String(value).normalize('NFC').replace(/\s+/gu, ' ').trim()
  const chars = Array.from(text)
  return chars.length > MAX_TERM_LENGTH ? chars.slice(0, MAX_TERM_LENGTH).join('').trim() : text
}

function isWordChar(ch) {
  return Boolean(ch) && WORD.test(ch) && !UNSPACED.test(ch)
}

function charBefore(text, i) {
  if (i <= 0) return ''
  const code = text.charCodeAt(i - 1)
  if (code >= 0xdc00 && code <= 0xdfff && i >= 2) return text.slice(i - 2, i)
  return text[i - 1]
}

function charAt(text, i) {
  if (i >= text.length) return ''
  return String.fromCodePoint(text.codePointAt(i))
}

/**
 * Terms ready for splitHighlight, from `{find, keyword, brand, competitor}`
 * lists of strings. A term listed under two kinds keeps the higher-ranked
 * kind; at most MAX_TERMS terms, each cut to MAX_TERM_LENGTH characters.
 */
export function compileTerms(groups) {
  const out = []
  if (!groups || typeof groups !== 'object') return out
  const seen = new Set()
  for (const kind of MARK_KINDS) {
    const list = Array.isArray(groups[kind]) ? groups[kind] : []
    for (const raw of list) {
      if (out.length >= MAX_TERMS) return out
      const text = cleanTerm(raw)
      if (!text) continue
      const needle = fold(text)
      if (seen.has(needle)) continue
      seen.add(needle)
      const chars = Array.from(text)
      out.push({
        kind,
        text,
        needle,
        left: isWordChar(chars[0]),
        right: isWordChar(chars[chars.length - 1]),
      })
    }
  }
  return out
}

function byPriority(a, b) {
  const findFirst = (a.kind === 'find' ? 0 : 1) - (b.kind === 'find' ? 0 : 1)
  return (
    findFirst ||
    b.stop - b.start - (a.stop - a.start) ||
    RANK[a.kind] - RANK[b.kind] ||
    a.start - b.start
  )
}

/**
 * Splits `text` into `[{text}, {text, kind}, ...]` around matches of
 * `terms` (from compileTerms), or returns null when nothing matches. The
 * segments join to the NFC form of `text`, which renders the same.
 * Pass an `info` object to learn which kinds were cut short:
 * `info.truncated` is then a Set of kinds.
 */
export function splitHighlight(text, terms, info) {
  if (!Array.isArray(terms) || !terms.length) return null
  if (typeof text !== 'string' || !text) return null
  const source = text.normalize('NFC')
  const { folded, starts } = foldWithMap(source)
  const found = []
  for (const term of terms) {
    const size = term.needle.length
    if (!size || size > folded.length) continue
    let kept = 0
    let from = 0
    while (from <= folded.length - size) {
      const at = folded.indexOf(term.needle, from)
      if (at < 0) break
      const end = at + size
      const start = starts[at]
      const stop = starts[end]
      // Reject a match that starts or ends inside one character's folding.
      const whole = (at === 0 || starts[at - 1] !== start) && starts[end - 1] !== stop
      const leftOk = !term.left || !isWordChar(charBefore(source, start))
      const rightOk = !term.right || !isWordChar(charAt(source, stop))
      if (whole && leftOk && rightOk) {
        if (kept >= MAX_CANDIDATES_PER_TERM) {
          if (info) {
            if (!info.truncated) info.truncated = new Set()
            info.truncated.add(term.kind)
          }
          break
        }
        found.push({ start, stop, kind: term.kind })
        kept += 1
        from = end
      } else {
        from = at + 1
      }
    }
  }
  if (!found.length) return null

  found.sort(byPriority)
  const taken = new Uint8Array(source.length)
  const picked = []
  for (const m of found) {
    let free = true
    for (let i = m.start; i < m.stop; i += 1) {
      if (taken[i]) {
        free = false
        break
      }
    }
    if (!free) continue
    taken.fill(1, m.start, m.stop)
    picked.push(m)
  }
  picked.sort((a, b) => a.start - b.start)

  const segments = []
  let pos = 0
  for (const m of picked) {
    if (m.start > pos) segments.push({ text: source.slice(pos, m.start) })
    segments.push({ text: source.slice(m.start, m.stop), kind: m.kind })
    pos = m.stop
  }
  if (pos < source.length) segments.push({ text: source.slice(pos) })
  return segments
}

/**
 * Marks several strings in reading order. Marks that next/previous steps
 * through get an `index`: only find marks while a find term is set, every
 * mark otherwise. Those marks stop at `limit`, and `capped` turns true once
 * one is left out; the rest of the text then stays plain. In find mode the
 * other marks have their own `limit`, so they never use up the find budget.
 */
export function createMarker(terms, { limit = MAX_MARKS } = {}) {
  const list = Array.isArray(terms) ? terms : []
  const findOnly = list.some((t) => t.kind === 'find')
  const steppable = (kind) => !findOnly || kind === 'find'
  let count = 0
  let others = 0
  let capped = false
  return {
    mark(text) {
      if (capped) return null
      const info = {}
      const segments = splitHighlight(text, list, info)
      if (info.truncated && [...info.truncated].some(steppable)) capped = true
      if (!segments) return null
      return segments.map((seg) => {
        if (!seg.kind) return seg
        if (steppable(seg.kind)) {
          if (count >= limit) {
            capped = true
            return { text: seg.text }
          }
          count += 1
          return { ...seg, index: count - 1 }
        }
        if (others >= limit) return { text: seg.text }
        others += 1
        return seg
      })
    },
    get count() {
      return count
    },
    get total() {
      return count + others
    },
    get capped() {
      return capped
    },
  }
}

/**
 * The terms a keyword highlights: the keyword itself plus its content words
 * (stopwords and one- or two-letter words left out, acronyms such as "AI"
 * kept). A tracked prompt is usually a question that never appears word for
 * word on a page, so the words carry most of the marks; where the whole
 * phrase does appear, it wins as the longer match.
 */
export function keywordTerms(keyword) {
  const phrase = cleanTerm(keyword)
  if (!phrase) return []
  const out = [phrase]
  const seen = new Set([fold(phrase)])
  for (const raw of phrase.split(' ')) {
    const word = raw.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}+#]+$/u, '')
    if (!word) continue
    const acronym = /^\p{Lu}{2,}$/u.test(word)
    if (Array.from(word).length < 3 && !acronym && !UNSPACED.test(word)) continue
    const key = fold(word)
    if (STOPWORDS.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(word)
    if (out.length > MAX_KEYWORD_WORDS) break
  }
  return out
}

function bareDomain(value) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
}

/** Distinct names (case-insensitive), cleaned, at most `max`. */
export function uniqueNames(list, max = MAX_NAMES) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(list) ? list : []) {
    const text = cleanTerm(value)
    if (!text) continue
    const key = fold(text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= max) break
  }
  return out
}

/**
 * What a Google results capture can highlight: its query as the keyword,
 * the brand's name and domain, and the competitors on the page (by name,
 * else by domain).
 */
export function captureTerms(capture) {
  const c = capture && typeof capture === 'object' ? capture : {}
  const keyword = typeof c.query === 'string' ? c.query.replace(/\s+/g, ' ').trim() : ''
  const brand = c.brand && typeof c.brand === 'object' ? c.brand : {}
  const results = Array.isArray(c.results) ? c.results : []
  return {
    keyword,
    brand: uniqueNames([brand.name, bareDomain(brand.domain)]),
    competitors: uniqueNames(
      results
        .filter((r) => r && r.is_competitor && !r.is_yours)
        .map((r) => r.competitor_name || bareDomain(r.domain))
    ),
  }
}
