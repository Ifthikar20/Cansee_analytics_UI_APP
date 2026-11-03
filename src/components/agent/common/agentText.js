// Small text and data helpers shared by the shell's components.

/** Plain text from Markdown, for announcements and previews. */
export function plainText(markdown, max = 400) {
  let s = String(markdown ?? '')
  s = s.replace(/```[\s\S]*?(```|$)/g, ' ')
  s = s.replace(/`([^`]*)`/g, '$1')
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  s = s.replace(/^\s{0,3}>\s?/gm, '')
  s = s.replace(/^\s*[-*+]\s+/gm, '')
  s = s.replace(/^\s*\d+[.)]\s+/gm, '')
  s = s.replace(/^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-*:?\s*\|?\s*$/gm, ' ')
  s = s.replace(/\|/g, ' ')
  s = s.replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
  s = s.replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
  s = s.replace(/\s+/g, ' ').trim()
  if (!max || s.length <= max) return s
  const cut = s.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** An array from a store field that may be a list or a {items|results} wrapper. */
export function asList(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    for (const key of ['items', 'results', 'list', 'data']) {
      if (Array.isArray(value[key])) return value[key]
    }
  }
  return []
}

/** HTTP status of an axios or fetch-style error. */
export function errorStatus(err) {
  return err?.response?.status ?? err?.status ?? null
}

/** Contract error code ({success:false, error:{code}}) of an error, if any. */
export function errorCode(err) {
  return err?.response?.data?.error?.code ?? err?.code ?? err?.error?.code ?? null
}

/**
 * A readable message for an error, falling back to `fallback`. Store errors
 * (AgentError) already carry user-facing copy; raw Error messages do not.
 */
export function errorMessage(err, fallback) {
  const server = err?.response?.data?.error?.message
  if (typeof server === 'string' && server.trim()) return server.trim()
  if (err?.name === 'AgentError' && typeof err.message === 'string' && err.message.trim()) return err.message.trim()
  if (typeof err?.displayMessage === 'string' && err.displayMessage.trim()) return err.displayMessage.trim()
  return fallback
}

/** Hostname of a URL without "www.", or the input when it does not parse. */
export function hostOf(url) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
    return parsed.hostname.replace(/^www\./i, '')
  } catch {
    return raw
  }
}

/** "3 min ago", "2 days ago", or a short date beyond a week. */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, now - then) / 1000
  if (diff < 45) return 'just now'
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} min ago`
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  }
  if (diff < 7 * 86400) {
    const d = Math.floor(diff / 86400)
    return d === 1 ? 'yesterday' : `${d} days ago`
  }
  const date = new Date(then)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
