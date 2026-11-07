// How chart values read, everywhere: axis ticks, tooltips, tables, stat
// tiles and map tiles all go through these, so "42%" on a bar is "42%" in
// its table. A value that was not measured is null here and the caller
// shows a state word ("Not measured"), never 0.
//
// Kinds (ChartSpec `value`): percent "42%" (one decimal under 10: "4.5%"),
// count "1,204" (compact "12.9K"), rank "#4" ("#3.2" for averages, lower is
// better), usd "$0.42" (four decimals under one cent), number "1,204 visits"
// with the spec's unit. Output is en-US and dates are UTC, so a label never
// shifts with the reader's locale or time zone.

export const VALUE_KINDS = Object.freeze(['number', 'percent', 'count', 'rank', 'usd'])

const MINUS = '−'
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const formats = new Map()

function numberFormat(options) {
  const key = JSON.stringify(options)
  let fmt = formats.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', options)
    formats.set(key, fmt)
  }
  return fmt
}

/** A finite number, or null (null, '', booleans, NaN and text are not values). */
export function toNumber(raw) {
  if (raw === null || raw === undefined || typeof raw === 'boolean') return null
  if (typeof raw === 'string' && !raw.trim()) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function plain(n, digits) {
  return numberFormat({ maximumFractionDigits: digits }).format(n)
}

function compactText(n) {
  return numberFormat({ notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function usdText(n, compact) {
  if (compact && Math.abs(n) >= 1000) {
    // Currency style defaults minimumFractionDigits to 2; without an explicit
    // 0 some ICU versions pad compact values ("$12.0K" instead of "$12K").
    return numberFormat({
      style: 'currency', currency: 'USD', notation: 'compact',
      minimumFractionDigits: 0, maximumFractionDigits: 1,
    }).format(n)
  }
  const digits = n !== 0 && Math.abs(n) < 0.01 ? 4 : 2
  return numberFormat({ style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

function withUnit(text, unit) {
  if (!unit) return text
  return unit === '%' ? `${text}%` : `${text} ${unit}`
}

/**
 * One value as text, or null when there is no value.
 * `compact` shortens values from 1,000 up ("12.9K", "$4.2M").
 */
export function formatValue(value, { value: kind = 'number', unit = '', compact = false } = {}) {
  const n = toNumber(value)
  if (n === null) return null
  const big = compact && Math.abs(n) >= 1000
  switch (kind) {
    case 'percent':
      return `${plain(n, Math.abs(n) < 10 ? 1 : 0)}%`
    case 'count':
      return big ? compactText(n) : plain(n, 0)
    case 'rank':
      return `#${plain(n, 1)}`
    case 'usd':
      return usdText(n, compact)
    default:
      return withUnit(big ? compactText(n) : plain(n, 2), unit)
  }
}

/** Axis tick text: compact from 1,000 up, "#1" for ranks, "%" for percents. */
export function formatTick(value, kind = 'number', unit = '') {
  const n = toNumber(value)
  if (n === null) return ''
  switch (kind) {
    case 'percent':
      return `${plain(n, 1)}%`
    case 'rank':
      return `#${plain(n, 1)}`
    case 'usd':
      return usdText(n, true)
    default: {
      const text = Math.abs(n) >= 1000 ? compactText(n) : plain(n, 2)
      return unit === '%' ? `${text}%` : text
    }
  }
}

function parseDate(iso) {
  const text = String(iso ?? '').trim()
  if (!text) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "3 Nov" (day), "Week of 3 Nov" (week), "Nov 2026" (month); UTC. */
export function formatDateLabel(iso, timeUnit = 'day') {
  const date = parseDate(iso)
  if (!date) return String(iso ?? '')
  const month = MONTH.format(date)
  if (timeUnit === 'month') return `${month} ${date.getUTCFullYear()}`
  const day = `${date.getUTCDate()} ${month}`
  return timeUnit === 'week' ? `Week of ${day}` : day
}

/**
 * A change between two periods: pct "+12.7%", pts "+4.1 pts", rank "+0.6".
 * Negative changes use a true minus sign; a change that rounds to nothing
 * reads "0%" / "0 pts" / "0". Whether up is good is the caller's call.
 */
export function formatDelta(value, unit = 'pct') {
  const n = toNumber(value)
  if (n === null) return null
  const rounded = Math.round(n * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? MINUS : ''
  const text = plain(Math.abs(rounded), 1)
  if (unit === 'pts') return `${sign}${text} pts`
  if (unit === 'rank') return `${sign}${text}`
  return `${sign}${text}%`
}

let regionNames = null

/** "United Kingdom" for "gb", "GB" or "uk"; the code itself when unknown. */
export function countryName(code) {
  const raw = String(code ?? '').trim()
  if (!raw) return ''
  let upper = raw.toUpperCase()
  if (upper === 'UK') upper = 'GB'
  if (!/^[A-Z]{2}$/.test(upper)) return raw
  try {
    regionNames ||= new Intl.DisplayNames(['en'], { type: 'region' })
    const name = regionNames.of(upper)
    // ZZ is CLDR's 'Unknown Region'; the code says as much.
    return name && name !== upper && upper !== 'ZZ' ? name : upper
  } catch {
    return upper
  }
}
