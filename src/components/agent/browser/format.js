// Small formatters shared by the browser pane views.

export function formatCapturedAt(iso, now = new Date()) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const sameYear = date.getFullYear() === now.getFullYear()
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: sameYear ? undefined : 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ')
  }
}

// "us" -> "United States"; other strings are shown as given.
export function regionName(code) {
  if (typeof code !== 'string' || !code.trim()) return ''
  const value = code.trim()
  if (!/^[a-z]{2}$/i.test(value)) return value
  try {
    const name = new Intl.DisplayNames(undefined, { type: 'region' }).of(value.toUpperCase())
    if (name && name !== value.toUpperCase()) return name
  } catch {}
  return value.toUpperCase()
}

export function formatBytes(n) {
  const value = Number(n)
  if (!Number.isFinite(value) || value < 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function formatMs(n) {
  const value = Number(n)
  if (!Number.isFinite(value) || value < 0) return ''
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(1)} s`
}

export function formatNumber(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return ''
  try {
    return new Intl.NumberFormat().format(value)
  } catch {
    return String(value)
  }
}

// Characters as people count them (code points, so an emoji or accented
// letter counts once).
export function charCount(text) {
  return Array.from(String(text ?? '')).length
}
