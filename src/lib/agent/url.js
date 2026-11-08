// URL helpers for the agent browser pane. Every URL handled here comes from
// the model, a search provider, a fetched page or the address bar, so none
// is trusted: only absolute http(s) URLs survive.

function stripControl(value) {
  // Browsers ignore control and space characters inside a scheme
  // ("java\tscript:"), so drop them before any scheme check.
  return Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
}

function parse(value, base) {
  try {
    return base === undefined ? new URL(value) : new URL(value, base)
  } catch {
    return null
  }
}

function isHttp(u) {
  return Boolean(u) && (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname)
}

export function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  return isHttp(parse(stripControl(value)))
}

// Address bar input -> absolute URL, or null when it is not a web address.
// Bare hosts get https://; any other scheme (javascript:, data:, mailto:)
// and text with spaces are refused.
export function normalizeAddress(input) {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text || /\s/.test(text)) return null
  if (/^https?:\/\//i.test(text)) {
    const u = parse(text)
    return isHttp(u) ? u.href : null
  }
  if (text.startsWith('//')) return normalizeAddress(`https:${text}`)
  // A scheme followed by anything but a port number ("mailto:x", "data:x").
  if (/^[a-z][a-z\d+.-]*:(?!\d)/i.test(text)) return null
  const u = parse(`https://${text}`)
  if (!isHttp(u)) return null
  const host = u.hostname
  // "notes" alone is not an address; a dotted host or an IPv6 literal is.
  if (!host.includes('.') && !host.startsWith('[')) return null
  return u.href
}

// Resolves a link found in a captured page against that page's URL.
export function resolveHref(href, base) {
  if (typeof href !== 'string' || !href.trim()) return null
  const u = base ? parse(stripControl(href), base) : parse(stripControl(href))
  return isHttp(u) ? u.href : null
}

export function hostOf(url) {
  const u = typeof url === 'string' ? parse(url) : null
  if (!u || !u.hostname) return ''
  return u.hostname.replace(/^www\./i, '')
}

// "host/path?query" without the scheme or a trailing slash, for labels.
export function displayUrl(url) {
  const u = typeof url === 'string' ? parse(url) : null
  if (!isHttp(u)) return typeof url === 'string' ? url : ''
  let path = `${u.pathname}${u.search}`
  if (path === '/') path = ''
  let text = `${u.hostname.replace(/^www\./i, '')}${path}`
  try {
    text = decodeURI(text)
  } catch {}
  return text
}

function currentOrigin() {
  try {
    return window.location.origin
  } catch {
    return ''
  }
}

function bareHost(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '')
}

// True when the URL is on the app's own site: the same host, or one host a
// subdomain of the other. Such pages are never framed with allow-same-origin.
export function isOwnSite(url, appOrigin = currentOrigin()) {
  const u = typeof url === 'string' ? parse(url) : null
  const app = appOrigin ? parse(appOrigin) : null
  if (!u || !app) return false
  const a = bareHost(u.hostname)
  const b = bareHost(app.hostname)
  if (!a || !b) return false
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

// A captured page may be shown live only when the server found it
// frameable, it is https, and it is not the app's own site.
export function canFrameLive(capture, appOrigin = currentOrigin()) {
  if (!capture || capture.frameable !== true) return false
  const target = capture.final_url || capture.url
  const u = typeof target === 'string' ? parse(target) : null
  if (!u || u.protocol !== 'https:') return false
  return !isOwnSite(u.href, appOrigin)
}

export function googleSearchUrl(query, page = 1, location = '') {
  if (typeof query !== 'string' || !query.trim()) return null
  const params = new URLSearchParams({ q: query.trim() })
  const p = Number(page)
  if (Number.isFinite(p) && p > 1) params.set('start', String((Math.floor(p) - 1) * 10))
  if (typeof location === 'string' && /^[a-z]{2}$/i.test(location)) params.set('gl', location.toLowerCase())
  return `https://www.google.com/search?${params.toString()}`
}

// First letter or digit of a domain or title, for letter avatars (third-party
// favicons are never loaded).
export function firstLetter(value) {
  const text = String(value || '').replace(/^www\./i, '')
  for (const ch of text) {
    if (/[\p{L}\p{N}]/u.test(ch)) return ch.toLocaleUpperCase()
  }
  return '?'
}
