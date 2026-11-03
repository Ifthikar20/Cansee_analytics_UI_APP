// Builds the srcdoc for previewing a generated landing page, and the cleaned
// HTML for its download.
//
// The server already sanitizes page artifacts; this is the second layer at
// the render boundary. DOMParser documents are inert (no scripts run, no
// resources load), so the HTML is parsed, cleaned and serialized back. The
// preview frame is also sandbox="" and gets a strict CSP, so a miss here
// still cannot run script or fetch anything but Google Fonts. The download
// has neither guard, so the cleaning applies the same resource policy itself
// and its output is parsed again until a parse finds nothing left to clean.

export const PREVIEW_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src data: https://fonts.gstatic.com',
  'img-src data:',
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

// sanitizePageHtml throws an Error with this message when the HTML never
// settles.
export const UNSETTLED_HTML = 'unsettled_html'

const HTML_NS = 'http://www.w3.org/1999/xhtml'
const SVG_NS = 'http://www.w3.org/2000/svg'
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

const REMOVE = [
  'noscript',
  'template',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'base',
  // Legacy raw-text elements: a page never needs them, and they are where
  // markup hides as text until a second parse.
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'meta[http-equiv]',
  'meta[name="referrer" i]',
].join(',')

const URL_ATTRS = new Set([
  'href',
  'src',
  'srcset',
  'action',
  'formaction',
  'xlink:href',
  'poster',
  'background',
  'data',
  'ping',
  'cite',
  'longdesc',
  'lowsrc',
  'dynsrc',
  'codebase',
  'manifest',
  'icon',
])

// Attributes removed whatever their value: forms post nowhere (the server
// drops form actions too) and nothing pings or nests a document.
const DROP_ATTRS = new Set(['srcdoc', 'action', 'formaction', 'ping'])

// Attributes that fetch their URL as soon as the page renders.
const RESOURCE_ATTRS = new Set(['src', 'srcset', 'poster', 'background', 'data', 'lowsrc', 'dynsrc', 'codebase', 'icon', 'manifest'])
// SVG elements whose href is a resource to load rather than a link.
const SVG_RESOURCE_TAGS = new Set(['image', 'feimage'])
// SVG presentation attributes that take CSS url() values.
const SVG_URL_ATTRS = new Set(['fill', 'stroke', 'filter', 'mask', 'clip-path', 'marker', 'marker-start', 'marker-mid', 'marker-end', 'cursor'])

const IMAGE_SRC_TAGS = new Set(['img', 'source', 'image', 'picture', 'input'])
// SVG element names are case-sensitive in selectors.
const SVG_ANIMATION = 'animate, set, animateMotion, animateTransform'
const GOOGLE_FONTS_CSS = /^https:\/\/fonts\.googleapis\.com\//i
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

// Where the HTML parser goes back to HTML inside SVG and MathML.
const SVG_HTML_POINTS = new Set(['foreignobject', 'desc', 'title'])
const MATHML_TEXT_POINTS = new Set(['mi', 'mo', 'mn', 'ms', 'mtext'])
// Names the parser never gives an element in the HTML namespace. Such an
// element serializes to a tag that the next parse reads as SVG or MathML.
const FOREIGN_NAMES = new Set(['svg', 'math', 'mglyph', 'malignmark'])

// A stand-in address for the page itself, to tell its own paths from other
// hosts.
const PAGE_BASE = 'https://page.invalid/'
const PAGE_HOST = 'page.invalid'

// Parse, clean and serialize at most this many times.
const MAX_PASSES = 4

function compact(value) {
  return Array.from(String(value || ''))
    .filter((ch) => ch.charCodeAt(0) > 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .toLowerCase()
}

function unsafeSingle(v, tag, attr) {
  if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true
  if (v.startsWith('data:')) {
    // Inline images are the only data: URLs a generated page needs.
    return !((attr === 'src' || attr === 'srcset') && IMAGE_SRC_TAGS.has(tag) && v.startsWith('data:image/'))
  }
  return false
}

function unsafeUrl(value, tag, attr) {
  if (attr === 'srcset') {
    return String(value)
      .split(',')
      .some((candidate) => unsafeSingle(compact(candidate.trim().split(/\s+/)[0]), tag, attr))
  }
  return unsafeSingle(compact(value), tag, attr)
}

// True when loading the URL would reach a host other than the page's own.
// Relative paths and fragments stay on the page; data: URLs are judged by
// unsafeSingle. Any other scheme reaches out, even "https:host" with no
// slashes, which a page that is not itself on https (the downloaded file)
// reads as https://host. The URL parser reads the rest, so `\\host`,
// `/\host` and stray tabs resolve the way a browser resolves them.
function offPage(value) {
  const v = compact(value)
  if (!v || v.startsWith('#') || v.startsWith('data:')) return false
  if (/^[a-z][a-z0-9+.-]*:/.test(v)) return true
  try {
    return new URL(v, PAGE_BASE).host !== PAGE_HOST
  } catch {
    return true
  }
}

function fontUrl(value) {
  try {
    const url = new URL(compact(value))
    return url.protocol === 'https:' && FONT_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

// CSS may load inline images, Google Fonts and the page's own paths.
function cssUrlAllowed(value) {
  const v = compact(value)
  if (v.startsWith('data:')) return v.startsWith('data:image/')
  return !offPage(v) || fontUrl(v)
}

function loadsOffPage(tag, name, value) {
  const resource = RESOURCE_ATTRS.has(name) || (SVG_RESOURCE_TAGS.has(tag) && (name === 'href' || name === 'xlink:href'))
  if (!resource) return false
  if (name === 'srcset') {
    return String(value)
      .split(',')
      .some((candidate) => offPage(candidate.trim().split(/\s+/)[0]))
  }
  return offPage(value)
}

// ── CSS ──
//
// CSS fetches through url() and src(), the addresses in image-set(), and
// @import. It is read token by token as a browser reads it: names are
// compared after resolving escapes (`u\72l(` is url( to a browser), and
// strings, comments and unquoted url(...) are taken whole. Whatever would
// load from another host becomes `none`, and such an @import is dropped.

const CSS_SPACE = ' \t\n\r\f'
const CSS_URL_FUNCTIONS = new Set(['url', 'src'])
const CSS_IMAGE_SETS = new Set(['image-set', '-webkit-image-set'])
const GRADIENT = /^(?:-webkit-|-moz-)?(?:repeating-)?(?:linear|radial|conic)-gradient$/

function isNameChar(ch) {
  return /[A-Za-z0-9_-]/.test(ch) || ch.charCodeAt(0) >= 0x80
}

function startsEscape(css, i) {
  return css[i] === '\\' && i + 1 < css.length && !'\n\r\f'.includes(css[i + 1])
}

// css[i] is a backslash that starts an escape: [character, index after it].
function readEscape(css, i) {
  const hex = /^[0-9a-fA-F]{1,6}/.exec(css.slice(i + 1, i + 7))
  if (hex) {
    let next = i + 1 + hex[0].length
    if (css[next] === '\r' && css[next + 1] === '\n') next += 2
    else if (next < css.length && CSS_SPACE.includes(css[next])) next += 1
    const cp = parseInt(hex[0], 16)
    const ch = cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '�' : String.fromCodePoint(cp)
    return [ch, next]
  }
  const ch = String.fromCodePoint(css.codePointAt(i + 1))
  return [ch, i + 1 + ch.length]
}

// [the name starting at i with escapes resolved, index after it]
function readName(css, i) {
  let name = ''
  while (i < css.length) {
    if (startsEscape(css, i)) {
      const [ch, next] = readEscape(css, i)
      name += ch
      i = next
    } else if (isNameChar(css[i])) {
      name += css[i]
      i += 1
    } else {
      break
    }
  }
  return [name, i]
}

// css[i] is a quote: [the string's value, index after it]. A newline ends a
// string early, as it does for a browser.
function readString(css, i) {
  const quote = css[i]
  let value = ''
  let j = i + 1
  while (j < css.length) {
    const ch = css[j]
    if (ch === quote) return [value, j + 1]
    if (ch === '\n' || ch === '\r' || ch === '\f') return [value, j]
    if (ch === '\\') {
      if (j + 1 >= css.length) return [value, j + 1]
      if ('\n\r\f'.includes(css[j + 1])) {
        j += css[j + 1] === '\r' && css[j + 2] === '\n' ? 3 : 2
        continue
      }
      const [escaped, next] = readEscape(css, j)
      value += escaped
      j = next
      continue
    }
    value += ch
    j += 1
  }
  return [value, j]
}

// An unquoted url(...) is one token up to its ")", whatever it holds.
function readUrl(css, i) {
  let value = ''
  while (i < css.length && css[i] !== ')') {
    if (startsEscape(css, i)) {
      const [ch, next] = readEscape(css, i)
      value += ch
      i = next
    } else {
      value += css[i]
      i += 1
    }
  }
  return { type: 'url', value: value.trim(), end: Math.min(css.length, i + 1) }
}

// The token at i: comment, string (value), url (value), function (name; end
// is after its "("), at (name), ident, or delim (ch).
function token(css, i) {
  const ch = css[i]
  if (ch === '/' && css[i + 1] === '*') {
    const close = css.indexOf('*/', i + 2)
    return { type: 'comment', end: close < 0 ? css.length : close + 2 }
  }
  if (ch === '"' || ch === "'") {
    const [value, end] = readString(css, i)
    return { type: 'string', value, end }
  }
  if (ch === '@') {
    const [name, end] = readName(css, i + 1)
    return name ? { type: 'at', name: name.toLowerCase(), end } : { type: 'delim', ch, end: i + 1 }
  }
  if (isNameChar(ch) || startsEscape(css, i)) {
    const [name, end] = readName(css, i)
    if (css[end] !== '(') return { type: 'ident', end }
    const fn = name.toLowerCase()
    if (fn === 'url') {
      let j = end + 1
      while (j < css.length && CSS_SPACE.includes(css[j])) j += 1
      if (css[j] !== '"' && css[j] !== "'") return readUrl(css, j)
    }
    return { type: 'function', name: fn, end: end + 1 }
  }
  return { type: 'delim', ch, end: i + 1 }
}

function opens(tok) {
  return tok.type === 'function' || (tok.type === 'delim' && tok.ch === '(')
}

function closes(tok) {
  return tok.type === 'delim' && tok.ch === ')'
}

function skippable(tok) {
  return tok.type === 'comment' || (tok.type === 'delim' && CSS_SPACE.includes(tok.ch))
}

// i is just after a function's "(": the index after its closing ")".
function argumentsEnd(css, i) {
  let depth = 1
  while (i < css.length) {
    const tok = token(css, i)
    if (opens(tok)) depth += 1
    else if (closes(tok) && --depth === 0) return tok.end
    i = tok.end
  }
  return css.length
}

// The string a function's arguments start with, or null.
function firstString(css, i) {
  while (i < css.length) {
    const tok = token(css, i)
    if (tok.type === 'string') return tok.value
    if (!skippable(tok)) return null
    i = tok.end
  }
  return null
}

// The strings directly inside image-set() are addresses, as are its url()
// and src(). Besides those it may hold type() and gradients; anything else,
// such as var() or attr(), could put an address there that cannot be read
// here.
function imageSetAllowed(css, i, end) {
  let depth = 0
  while (i < end) {
    const tok = token(css, i)
    if (tok.type === 'url' && !cssUrlAllowed(tok.value)) return false
    if (tok.type === 'string' && depth === 0 && !cssUrlAllowed(tok.value)) return false
    if (tok.type === 'function') {
      if (CSS_URL_FUNCTIONS.has(tok.name)) {
        const value = firstString(css, tok.end)
        if (value === null || !cssUrlAllowed(value)) return false
      } else if (depth === 0 && tok.name !== 'type' && !GRADIENT.test(tok.name)) {
        return false
      }
    }
    if (opens(tok)) depth += 1
    else if (closes(tok)) depth -= 1
    i = tok.end
  }
  return true
}

// i is just after "@import": the index after the rule's ";".
function importEnd(css, i) {
  let depth = 0
  while (i < css.length) {
    const tok = token(css, i)
    if (opens(tok)) depth += 1
    else if (closes(tok)) depth = Math.max(0, depth - 1)
    else if (tok.type === 'delim' && depth === 0 && tok.ch === ';') return tok.end
    else if (tok.type === 'delim' && depth === 0 && (tok.ch === '{' || tok.ch === '}')) return i
    i = tok.end
  }
  return css.length
}

// Only Google Fonts stylesheets may be imported.
function importAllowed(css, i) {
  while (i < css.length) {
    const tok = token(css, i)
    if (tok.type === 'string' || tok.type === 'url') return fontUrl(tok.value)
    if (tok.type === 'function' && tok.name === 'url') return fontUrl(firstString(css, tok.end) || '')
    if (!skippable(tok)) return false
    i = tok.end
  }
  return false
}

export function cleanCss(input) {
  const css = String(input ?? '')
  let out = ''
  let copied = 0
  let i = 0
  while (i < css.length) {
    const tok = token(css, i)
    let next = tok.end
    let replacement = null
    if (tok.type === 'url') {
      if (!cssUrlAllowed(tok.value)) replacement = 'none'
    } else if (tok.type === 'function' && CSS_URL_FUNCTIONS.has(tok.name)) {
      next = argumentsEnd(css, tok.end)
      const value = firstString(css, tok.end)
      if (value === null || !cssUrlAllowed(value)) replacement = 'none'
    } else if (tok.type === 'function' && CSS_IMAGE_SETS.has(tok.name)) {
      // Checked and passed over whole, so the text is read in one pass.
      next = argumentsEnd(css, tok.end)
      if (!imageSetAllowed(css, tok.end, next)) replacement = 'none'
    } else if (tok.type === 'at' && tok.name === 'import') {
      next = importEnd(css, tok.end)
      if (!importAllowed(css, tok.end)) replacement = ''
    }
    if (replacement !== null) {
      out += css.slice(copied, i) + replacement
      copied = next
    }
    i = next
  }
  return copied ? out + css.slice(copied) : css
}

// ── Elements ──

// True when an element sits where the HTML parser never puts one, so its
// serialization parses into a different tree: the namespace mix-up that
// mutation XSS uses to turn text into markup on the next parse.
function misplaced(el) {
  const name = el.localName.toLowerCase()
  const parent = el.parentElement
  const parentNs = parent ? parent.namespaceURI : HTML_NS
  const parentName = parent ? parent.localName.toLowerCase() : ''
  switch (el.namespaceURI) {
    case HTML_NS:
      if (parentNs === SVG_NS && !SVG_HTML_POINTS.has(parentName)) return true
      if (parentNs === MATHML_NS && !MATHML_TEXT_POINTS.has(parentName)) return true
      return FOREIGN_NAMES.has(name)
    case SVG_NS:
      if (parentNs === SVG_NS) return false
      if (parentNs === MATHML_NS && !MATHML_TEXT_POINTS.has(parentName) && parentName !== 'annotation-xml') return true
      return name !== 'svg'
    case MATHML_NS:
      if (parentNs === MATHML_NS) return false
      if (parentNs === SVG_NS && !SVG_HTML_POINTS.has(parentName)) return true
      return name !== 'math'
    default:
      return true
  }
}

// The text a JSON-LD block keeps in the download, or null to drop the
// script. Valid JSON has `<` only inside strings, where < reads the
// same, so the text can neither close the element nor open a comment.
function jsonLdText(el) {
  if (el.namespaceURI !== HTML_NS) return null
  if ((el.getAttribute('type') || '').trim().toLowerCase() !== 'application/ld+json') return null
  const text = el.textContent
  try {
    JSON.parse(text)
  } catch {
    return null
  }
  return text.replace(/</g, '\\u003c')
}

// Leaves the script with only type="application/ld+json" and `text`.
function keepJsonLd(el, text) {
  let changed = false
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === 'type') continue
    el.removeAttributeNode(attr)
    changed = true
  }
  if (el.getAttribute('type') !== 'application/ld+json') {
    el.setAttribute('type', 'application/ld+json')
    changed = true
  }
  if (el.textContent !== text) {
    el.textContent = text
    changed = true
  }
  return changed
}

// A style element's CSS is its text children, joined.
function styleText(el) {
  return Array.from(el.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.data)
    .join('')
}

// The attribute's cleaned value, or null to remove it.
function cleanAttribute(el, tag, name, value) {
  if (name.startsWith('on') || DROP_ATTRS.has(name)) return null
  if (URL_ATTRS.has(name) && unsafeUrl(value, tag, name)) return null
  if (loadsOffPage(tag, name, value)) return null
  if (name === 'style') return /javascript:|expression\s*\(/i.test(value) ? null : cleanCss(value)
  if (el.namespaceURI === SVG_NS && SVG_URL_ATTRS.has(name)) return cleanCss(value)
  return value
}

function cleanAttributes(el) {
  const tag = el.localName.toLowerCase()
  let changed = false
  for (const attr of Array.from(el.attributes)) {
    const next = cleanAttribute(el, tag, attr.name.toLowerCase(), attr.value)
    if (next === null) {
      el.removeAttributeNode(attr)
      changed = true
    } else if (next !== attr.value) {
      attr.value = next
      changed = true
    }
  }
  return changed
}

// Cleans the parsed page in place and says whether anything changed. With
// jsonLd, application/ld+json scripts stay (the download); the preview drops
// every script.
function clean(doc, { jsonLd = false } = {}) {
  let changed = false
  const drop = (el) => {
    el.remove()
    changed = true
  }
  doc.querySelectorAll('*').forEach((el) => {
    if (el.isConnected && misplaced(el)) drop(el)
  })
  doc.querySelectorAll('script').forEach((el) => {
    const text = jsonLd ? jsonLdText(el) : null
    if (text === null) drop(el)
    else if (keepJsonLd(el, text)) changed = true
  })
  doc.querySelectorAll(REMOVE).forEach(drop)
  doc.querySelectorAll('link').forEach((link) => {
    const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
    const href = (link.getAttribute('href') || '').trim()
    if (!rel.includes('stylesheet') || !GOOGLE_FONTS_CSS.test(href)) drop(link)
  })
  doc.querySelectorAll(SVG_ANIMATION).forEach((el) => {
    const target = (el.getAttribute('attributeName') || '').toLowerCase()
    if (target.includes('href')) drop(el)
  })
  doc.querySelectorAll('use').forEach((el) => {
    const ref = el.getAttribute('href') || el.getAttribute('xlink:href') || ''
    if (ref && !ref.trim().startsWith('#')) drop(el)
  })
  doc.querySelectorAll('style').forEach((el) => {
    const css = styleText(el)
    const cleaned = cleanCss(css)
    if (cleaned !== css) {
      el.textContent = cleaned
      changed = true
    }
  })
  doc.querySelectorAll('*').forEach((el) => {
    if (cleanAttributes(el)) changed = true
  })
  return changed
}

function injectPolicy(doc) {
  let head = doc.head
  if (!head) {
    head = doc.createElement('head')
    doc.documentElement.insertBefore(head, doc.documentElement.firstChild)
  }
  const csp = doc.createElement('meta')
  csp.setAttribute('http-equiv', 'Content-Security-Policy')
  csp.setAttribute('content', PREVIEW_CSP)
  const referrer = doc.createElement('meta')
  referrer.setAttribute('name', 'referrer')
  referrer.setAttribute('content', 'no-referrer')
  const base = doc.createElement('base')
  base.setAttribute('target', '_blank')
  // First in <head>, so the policy covers every style and link after it.
  head.prepend(csp, referrer, base)
}

function parseDocument(html) {
  return new DOMParser().parseFromString(String(html ?? ''), 'text/html')
}

function serialize(doc) {
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

// Cleans, serializes and parses the result again until a parse finds
// nothing to clean. One pass is not enough: the parse of a serialized tree
// can differ from the tree (mutation XSS), so markup that one parse kept as
// <style> text can come back as elements in the next. Returns the last
// parse, the HTML it was parsed from, and whether that parse was clean.
function cleanUntilSettled(html, options) {
  let doc = parseDocument(html)
  clean(doc, options)
  let text = serialize(doc)
  for (let pass = 1; pass < MAX_PASSES; pass += 1) {
    doc = parseDocument(text)
    if (!clean(doc, options)) return { doc, html: text, settled: true }
    text = serialize(doc)
  }
  return { doc, html: text, settled: false }
}

// HTML for <iframe sandbox="" srcdoc>: cleaned, with the CSP, a no-referrer
// policy and <base target="_blank"> injected at the top of <head>. HTML that
// never settles still previews its last cleaned parse; the frame's sandbox
// and CSP are the guard there.
export function buildSrcdoc(html) {
  const { doc } = cleanUntilSettled(html)
  injectPolicy(doc)
  return serialize(doc)
}

// The same cleaning without the injected preview policy, for the HTML
// download, keeping the page's JSON-LD. Nothing guards a downloaded page, so
// HTML that never settles is refused (an Error with UNSETTLED_HTML).
export function sanitizePageHtml(html) {
  const result = cleanUntilSettled(html, { jsonLd: true })
  if (!result.settled) throw new Error(UNSETTLED_HTML)
  return result.html
}
