// Builds the srcdoc for previewing a generated landing page.
//
// The server already sanitizes page artifacts; this is the second layer at
// the render boundary. DOMParser documents are inert (no scripts run, no
// resources load), so the HTML is parsed, cleaned and serialized back. The
// preview frame is also sandbox="" and gets a strict CSP, so a miss here
// still cannot run script or fetch anything but Google Fonts.

export const PREVIEW_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src data: https://fonts.gstatic.com',
  'img-src data:',
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

const REMOVE = [
  'script',
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

const IMAGE_SRC_TAGS = new Set(['img', 'source', 'image', 'picture', 'input'])
// SVG element names are case-sensitive in selectors.
const SVG_ANIMATION = 'animate, set, animateMotion, animateTransform'
const GOOGLE_FONTS_CSS = /^https:\/\/fonts\.googleapis\.com\//i

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

function cleanAttributes(el) {
  const tag = el.localName
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || name === 'ping') {
      el.removeAttribute(attr.name)
    } else if (URL_ATTRS.has(name) && unsafeUrl(attr.value, tag, name)) {
      el.removeAttribute(attr.name)
    } else if (name === 'style' && /javascript:|expression\s*\(/i.test(attr.value)) {
      el.removeAttribute(attr.name)
    }
  }
}

function clean(doc) {
  doc.querySelectorAll(REMOVE).forEach((el) => el.remove())
  doc.querySelectorAll('link').forEach((link) => {
    const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
    const href = (link.getAttribute('href') || '').trim()
    if (!rel.includes('stylesheet') || !GOOGLE_FONTS_CSS.test(href)) link.remove()
  })
  doc.querySelectorAll(SVG_ANIMATION).forEach((el) => {
    const target = (el.getAttribute('attributeName') || '').toLowerCase()
    if (target.includes('href')) el.remove()
  })
  doc.querySelectorAll('use').forEach((el) => {
    const ref = el.getAttribute('href') || el.getAttribute('xlink:href') || ''
    if (ref && !ref.trim().startsWith('#')) el.remove()
  })
  doc.querySelectorAll('*').forEach(cleanAttributes)
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

// HTML for <iframe sandbox="" srcdoc>: cleaned, with the CSP, a no-referrer
// policy and <base target="_blank"> injected at the top of <head>.
export function buildSrcdoc(html) {
  const doc = parseDocument(html)
  clean(doc)
  injectPolicy(doc)
  return serialize(doc)
}

// The same cleaning without the injected preview policy, for the HTML
// download.
export function sanitizePageHtml(html) {
  const doc = parseDocument(html)
  clean(doc)
  return serialize(doc)
}
