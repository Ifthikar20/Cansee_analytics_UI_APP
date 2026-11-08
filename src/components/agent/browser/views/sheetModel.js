import { charCount } from '../format'

// Google Ads limits for responsive search ads and sitelinks, used to flag
// text the agent wrote over the limit (nothing is trimmed).
export const LIMITS = Object.freeze({
  headline: 30,
  description: 90,
  path: 15,
  sitelinkText: 25,
  sitelinkDescription: 35,
})

export const AD_COUNTS = Object.freeze({
  headlines: [3, 15],
  descriptions: [2, 4],
})

export function measure(text, limit) {
  const length = charCount(text)
  return { length, limit, over: length > limit }
}

export function matchSyntax(text, match) {
  const value = String(text || '')
  if (match === 'exact') return `[${value}]`
  if (match === 'phrase') return `"${value}"`
  return value
}

export function matchLabel(match) {
  return { exact: 'Exact', phrase: 'Phrase', broad: 'Broad' }[match] || 'Not set'
}

export function platformLabel(platform) {
  if (platform === 'google_search') return 'Google Search'
  return platform ? String(platform) : ''
}

const SEGMENT_LABELS = {
  ad_groups: 'Ad group',
  ads: 'Ad',
  keywords: 'Keyword',
  negatives: 'Negative keyword',
  headlines: 'Headline',
  descriptions: 'Description',
  sitelinks: 'Sitelink',
}

const FIELD_LABELS = {
  campaign: 'Campaign',
  path1: 'Path 1',
  path2: 'Path 2',
  final_url: 'Final URL',
  daily_budget: 'Daily budget',
  bid_strategy: 'Bid strategy',
  text: 'Text',
  url: 'URL',
  description1: 'Description 1',
  description2: 'Description 2',
  name: 'Name',
}

// "ad_groups[0].ads[1].headlines[3]" or "ad_groups.0.ads.1.headlines.3" ->
// "Ad group 1 › Ad 2 › Headline 4". Unknown shapes come back as given.
export function describePath(path) {
  if (typeof path !== 'string' || !path.trim()) return ''
  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split(/[./]/)
    .filter(Boolean)
  const out = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const next = tokens[i + 1]
    if (SEGMENT_LABELS[token] && next !== undefined && /^\d+$/.test(next)) {
      out.push(`${SEGMENT_LABELS[token]} ${Number(next) + 1}`)
      i += 1
    } else if (SEGMENT_LABELS[token]) {
      out.push(`${SEGMENT_LABELS[token]}s`)
    } else if (FIELD_LABELS[token]) {
      out.push(FIELD_LABELS[token])
    } else {
      return path
    }
  }
  return out.join(' › ')
}

export function sheetWarnings(sheet, extra = []) {
  const seen = new Set()
  const out = []
  for (const w of [...(Array.isArray(sheet?.warnings) ? sheet.warnings : []), ...(Array.isArray(extra) ? extra : [])]) {
    if (!w) continue
    const item = typeof w === 'string' ? { path: '', message: w } : { path: w.path || '', message: w.message || '' }
    if (!item.message) continue
    const key = `${item.path}|${item.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...item, where: describePath(item.path) })
  }
  return out
}

export function countIssue(count, [min, max], noun) {
  if (count < min) return `${count} ${noun}${count === 1 ? '' : 's'}; Google needs at least ${min}.`
  if (count > max) return `${count} ${noun}s; Google allows at most ${max}.`
  return ''
}
