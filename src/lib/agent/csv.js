// CSV (RFC 4180) and TSV writers for exports from the browser pane.
//
// Spreadsheet apps evaluate a text cell that starts with = + - @, a tab or a
// carriage return (and their full-width forms) as a formula, so such cells
// get a leading apostrophe (OWASP CSV injection guidance). Numbers are left
// as numbers.

const FORMULA_START = /^[=+\-@\t\r＝＋－＠]/

function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  return String(value)
}

export function guardCell(value) {
  const text = cellText(value)
  if (typeof value !== 'string') return text
  return FORMULA_START.test(text) ? `'${text}` : text
}

export function csvField(value, { guard = true } = {}) {
  const text = guard ? guardCell(value) : cellText(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// rows: array of arrays. CRLF line breaks; a UTF-8 BOM so Excel reads the
// file as UTF-8.
export function toCsv(rows, { bom = true, guard = true } = {}) {
  const lines = (rows || []).map((row) => (row || []).map((c) => csvField(c, { guard })).join(','))
  return `${bom ? '﻿' : ''}${lines.join('\r\n')}\r\n`
}

// TSV has no quoting, so tabs and line breaks inside a cell become spaces.
export function toTsv(rows, { guard = true } = {}) {
  const lines = (rows || []).map((row) =>
    (row || [])
      .map((c) => {
        const text = guard ? guardCell(c) : cellText(c)
        return text.replace(/[\t\r\n]+/g, ' ')
      })
      .join('\t')
  )
  return `${lines.join('\n')}\n`
}

const MATCH_LABELS = { exact: 'Exact', phrase: 'Phrase', broad: 'Broad' }
const MAX_HEADLINES = 15
const MAX_DESCRIPTIONS = 4

const range = (n, label) => Array.from({ length: n }, (_, i) => `${label} ${i + 1}`)

export const AD_CAMPAIGN_COLUMNS = [
  'Campaign',
  'Campaign Type',
  'Budget',
  'Bid Strategy Type',
  'Ad Group',
  'Keyword',
  'Criterion Type',
  ...range(MAX_HEADLINES, 'Headline'),
  ...range(MAX_DESCRIPTIONS, 'Description'),
  'Path 1',
  'Path 2',
  'Final URL',
  'Link Text',
  'Description Line 1',
  'Description Line 2',
]

const list = (value) => (Array.isArray(value) ? value : [])

// The ad campaign sheet as one flat table in the column layout Google Ads
// Editor uses: a campaign row, then per ad group its keywords, negatives and
// responsive search ads, then the sitelinks. Values are copied as written;
// nothing is trimmed to fit a limit.
export function adCampaignRows(content) {
  const columns = AD_CAMPAIGN_COLUMNS
  const at = Object.fromEntries(columns.map((c, i) => [c, i]))
  const blank = () => new Array(columns.length).fill('')
  const campaign = (content && content.campaign) || {}
  const name = campaign.name || ''
  const rows = [columns.slice()]

  const head = blank()
  head[at.Campaign] = name
  if (campaign.platform === 'google_search') head[at['Campaign Type']] = 'Search'
  head[at.Budget] = campaign.daily_budget ?? ''
  head[at['Bid Strategy Type']] = campaign.bid_strategy || ''
  head[at['Final URL']] = campaign.final_url || ''
  rows.push(head)

  for (const group of list(content && content.ad_groups)) {
    const groupName = (group && group.name) || ''
    const groupRow = blank()
    groupRow[at.Campaign] = name
    groupRow[at['Ad Group']] = groupName
    rows.push(groupRow)

    for (const kw of list(group && group.keywords)) {
      const row = blank()
      row[at.Campaign] = name
      row[at['Ad Group']] = groupName
      row[at.Keyword] = (kw && kw.text) || ''
      row[at['Criterion Type']] = MATCH_LABELS[kw && kw.match] || ''
      rows.push(row)
    }
    for (const neg of list(group && group.negatives)) {
      const row = blank()
      row[at.Campaign] = name
      row[at['Ad Group']] = groupName
      row[at.Keyword] = typeof neg === 'string' ? neg : ''
      row[at['Criterion Type']] = 'Negative Broad'
      rows.push(row)
    }
    for (const ad of list(group && group.ads)) {
      const row = blank()
      row[at.Campaign] = name
      row[at['Ad Group']] = groupName
      list(ad && ad.headlines)
        .slice(0, MAX_HEADLINES)
        .forEach((h, i) => {
          row[at[`Headline ${i + 1}`]] = h
        })
      list(ad && ad.descriptions)
        .slice(0, MAX_DESCRIPTIONS)
        .forEach((d, i) => {
          row[at[`Description ${i + 1}`]] = d
        })
      row[at['Path 1']] = (ad && ad.path1) || ''
      row[at['Path 2']] = (ad && ad.path2) || ''
      row[at['Final URL']] = campaign.final_url || ''
      rows.push(row)
    }
  }

  for (const link of list(content && content.sitelinks)) {
    const row = blank()
    row[at.Campaign] = name
    row[at['Link Text']] = (link && link.text) || ''
    row[at['Description Line 1']] = (link && link.description1) || ''
    row[at['Description Line 2']] = (link && link.description2) || ''
    row[at['Final URL']] = (link && link.url) || ''
    rows.push(row)
  }
  return rows
}

// SERP capture -> rows for a results export.
export function serpRows(capture) {
  const rows = [['Position', 'Title', 'URL', 'Domain', 'Snippet', 'Yours', 'Competitor']]
  for (const r of list(capture && capture.results)) {
    rows.push([
      typeof r.position === 'number' ? r.position : '',
      r.title || '',
      r.url || '',
      r.domain || '',
      r.snippet || '',
      r.is_yours ? 'Yes' : 'No',
      r.is_competitor ? r.competitor_name || 'Yes' : 'No',
    ])
  }
  return rows
}
