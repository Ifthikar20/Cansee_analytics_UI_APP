// Pure helpers for the consolidated results table (SwarmTable): which sheets
// show, sorting, the rows that can become findings, cell classes and CSV
// rows. The table itself is the server's SwarmTable (swarm_contract.md 5e);
// every text shown or exported is a cell's own `text`.
import { safeFilename } from '@/lib/agent/download'

export const SHEET_ORDER = Object.freeze(['prompts', 'gaps', 'sources'])

const STATES = new Set(['ok', 'not_found', 'not_measured', 'not_configured', 'not_selected', 'failed', 'skipped', 'stopped'])
const TONES = new Set(['good', 'warn', 'bad', 'muted'])

function list(value) {
  return Array.isArray(value) ? value.filter((v) => v !== null && typeof v === 'object') : []
}

/** DOM id of a swarm_table part, so the chat can scroll to it. */
export function tableDomId(messageId, partId) {
  return `ag-swarm-table-${messageId}-${partId}`
}

/**
 * The sheets to show, in the fixed order: `prompts` always, `gaps` and
 * `sources` only when they have rows. Sheets this client does not know
 * follow when they have rows.
 */
export function tableSheets(table) {
  const sheets = list(table && table.sheets).filter((s) => typeof s.key === 'string' && s.key)
  const out = []
  for (const key of SHEET_ORDER) {
    const sheet = sheets.find((s) => s.key === key)
    if (sheet && (key === 'prompts' || list(sheet.rows).length)) out.push(sheet)
  }
  for (const sheet of sheets) {
    if (!SHEET_ORDER.includes(sheet.key) && list(sheet.rows).length && !out.includes(sheet)) out.push(sheet)
  }
  return out
}

export function sheetColumns(sheet) {
  return list(sheet && sheet.columns).filter((c) => typeof c.key === 'string' && c.key)
}

export function sheetRows(sheet) {
  return list(sheet && sheet.rows).filter((r) => r.key !== undefined && r.key !== null)
}

/** A cell of a row; every column has one, but a missing one renders empty. */
export function cellOf(row, key) {
  const cell = row && row.cells && row.cells[key]
  return cell && typeof cell === 'object' ? cell : null
}

export function cellText(cell) {
  if (!cell) return ''
  return typeof cell.text === 'string' ? cell.text : cell.text === null || cell.text === undefined ? '' : String(cell.text)
}

// The sort key: a number, a string, or null (no value; sorts last).
function sortValue(row, key) {
  const cell = cellOf(row, key)
  const v = cell ? cell.v : null
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 1 : 0
  return String(v)
}

function compare(a, b) {
  const an = typeof a === 'number'
  const bn = typeof b === 'number'
  if (an && bn) return a - b
  if (an !== bn) return an ? -1 : 1
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

/**
 * Rows sorted by cells[columnKey].v; stable; null last in both directions.
 * dir is 'asc' or 'desc'; anything else keeps the server's order.
 */
export function sortRows(rows, columnKey, dir) {
  const items = Array.isArray(rows) ? rows.slice() : []
  if (!columnKey || (dir !== 'asc' && dir !== 'desc')) return items
  const sign = dir === 'desc' ? -1 : 1
  return items
    .map((row, index) => ({ row, index, v: sortValue(row, columnKey) }))
    .sort((x, y) => {
      if (x.v === null || y.v === null) {
        if (x.v === null && y.v === null) return x.index - y.index
        return x.v === null ? 1 : -1
      }
      const order = compare(x.v, y.v)
      return order !== 0 ? sign * order : x.index - y.index
    })
    .map((item) => item.row)
}

/** Clicking a header cycles ascending, descending, none. */
export function nextSort(sort, key) {
  if (!sort || sort.key !== key || !sort.dir) return { key, dir: 'asc' }
  if (sort.dir === 'asc') return { key, dir: 'desc' }
  return { key: null, dir: null }
}

/** aria-sort for a sortable column header. */
export function ariaSort(sort, key) {
  if (!sort || sort.key !== key) return 'none'
  if (sort.dir === 'asc') return 'ascending'
  if (sort.dir === 'desc') return 'descending'
  return 'none'
}

export function hasDraft(row) {
  return Boolean(row && row.finding && typeof row.finding === 'object')
}

/** Keys of the rows that have a finding draft and are not in Findings yet. */
export function addableRowKeys(sheet, isAdded = () => false) {
  return sheetRows(sheet)
    .filter((row) => hasDraft(row) && !isAdded(String(row.key)))
    .map((row) => String(row.key))
}

/** The row's name: its first column's text. */
export function rowLabel(sheet, row) {
  const first = sheetColumns(sheet)[0]
  return (first && cellText(cellOf(row, first.key))) || String((row && row.key) || '')
}

/** The cell was measured in an earlier version than the table's. */
export function isCarried(cell, tableVersion) {
  const v = Number(cell && cell.version)
  const t = Number(tableVersion)
  return Number.isFinite(v) && Number.isFinite(t) && v > 0 && v < t
}

/** Classes for a cell's state and tone. */
export function cellClasses(cell) {
  if (!cell) return ['is-empty']
  const state = STATES.has(cell.state) ? cell.state : 'ok'
  const classes = [`is-${state.replace(/_/g, '-')}`]
  if (TONES.has(cell.tone) && (state === 'ok' || state === 'not_found')) classes.push(`is-tone-${cell.tone}`)
  return classes
}

/** Header row of column labels, then each row's cell text per column. */
export function csvRows(sheet) {
  const columns = sheetColumns(sheet)
  const rows = [columns.map((c) => c.label || c.key)]
  for (const row of sheetRows(sheet)) rows.push(columns.map((c) => cellText(cellOf(row, c.key))))
  return rows
}

/** `Research Notion v2 Prompts.csv`. */
export function csvFilename(table, sheet) {
  const title = (table && table.title) || 'Research results'
  const version = table && table.version ? ` v${table.version}` : ''
  const sheetTitle = (sheet && (sheet.title || sheet.key)) || ''
  return safeFilename(`${title}${version} ${sheetTitle}`.trim(), 'csv')
}
