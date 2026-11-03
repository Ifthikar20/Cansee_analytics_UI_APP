// ChartSpec: the one shape every chart in the app is described with
// (contract 8a). Pages build a spec from their payload; VizChart
// normalizes it, offers the representations that suit its shape (8b) and
// draws it. Every chart can always be read as a table.
//
//   ChartSpec { id?, title, subtitle?, x?: category|time|country, time_unit?,
//     value?: number|percent|count|rank|usd, unit?, labels[], label_names?,
//     datasets: [{key, label, data[], states?[], entity?, value?}], type?,
//     representations?[], stacked?, pick_one?, custom_label?, palette?,
//     emphasis?, state_labels?, missing_label?, footnote?, max? }
//
// Optional extras beyond the contract: `label_header` (the table's first
// column heading; default Date / Week / Month, Country or Name),
// `label_entities` ({label: entity}, the slice colours of a donut whose
// labels are entities, e.g. engines) and `Dataset.texts` (per-point text
// that replaces the formatted value, e.g. "Check failed"; a dataset with
// texts only, such as a gap label or an operator name, is a table column
// and is never drawn: `text_columns`).
//
// A value that was not measured is null, or null with a state; it reads as
// the state word (STATE_LABELS, or the spec's state_labels), else as
// missing_label ("No data"); never as 0.
import { countryName, formatDateLabel, formatValue, toNumber, VALUE_KINDS } from './format'

export const REPRESENTATIONS = Object.freeze([
  'line',
  'area',
  'bar',
  'hbar',
  'stacked_bar',
  'doughnut',
  'heatmap',
  'map',
  'table',
  'custom',
])
export const REP_LABELS = Object.freeze({
  line: 'Line',
  area: 'Area',
  bar: 'Bars',
  hbar: 'Bars',
  stacked_bar: 'Stacked',
  doughnut: 'Donut',
  heatmap: 'Heatmap',
  map: 'Map',
  table: 'Table',
})
export const PAGE_LIMITS = Object.freeze({ labels: 400, datasets: 8 })
export const STATE_LABELS = Object.freeze({
  not_measured: 'Not measured',
  not_found: 'Not found',
  named: 'Named',
  not_configured: 'Not configured',
  not_checked: 'Not checked',
  failed: 'Failed',
  skipped: 'Skipped',
  not_connected: 'Not connected',
})

const X_KINDS = ['category', 'time', 'country']
const TIME_UNITS = ['day', 'week', 'month']
const PALETTES = ['categorical', 'sequential', 'ordinal', 'diverging', 'emphasis']
const MAX = { title: 120, subtitle: 200, unit: 8, footnote: 300, name: 200, short: 40 }
// Category labels longer than this turn bars horizontal (8b).
const LONG_LABEL = 14

function clip(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function oneOf(value, list, fallback) {
  return list.includes(value) ? value : fallback
}

function isState(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATE_LABELS, value)
}

function countryCode(label) {
  const code = String(label ?? '').trim().toUpperCase()
  return code === 'UK' ? 'GB' : code
}

function textMap(raw, keyOf = (k) => k) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value) out[keyOf(key)] = value.slice(0, MAX.name)
  }
  return out
}

function normalizeDataset(raw, index, count) {
  if (!raw || typeof raw !== 'object') return null
  const data = Array.isArray(raw.data) ? raw.data : []
  const rawStates = Array.isArray(raw.states) ? raw.states : []
  const rawTexts = Array.isArray(raw.texts) ? raw.texts : []
  const states = []
  const values = []
  const texts = []
  for (let i = 0; i < count; i++) {
    const state = isState(rawStates[i]) ? rawStates[i] : null
    states.push(state)
    values.push(state ? null : toNumber(data[i]))
    const text = rawTexts[i]
    texts.push(typeof text === 'string' && text.trim() ? text.slice(0, MAX.name) : null)
  }
  const measured = values.some((v) => v !== null) || states.some(Boolean)
  if (!measured && !texts.some(Boolean)) return null
  return {
    key: String(raw.key ?? '').trim() || `s${index + 1}`,
    label: clip(String(raw.label ?? ''), MAX.name) || `Series ${index + 1}`,
    data: values,
    states,
    texts,
    entity: typeof raw.entity === 'string' && raw.entity ? raw.entity : null,
    value: oneOf(raw.value, VALUE_KINDS, null),
    textOnly: !measured,
  }
}

/**
 * Clean a ChartSpec for drawing. Strings are clipped, labels stringified,
 * every dataset padded or cut to the labels, non-numbers become null, a
 * state forces null, datasets with neither a value nor a state are dropped
 * (unless they carry texts: then they are `text_columns`, table only) and
 * at most `limits.datasets` are kept (`truncated`, `total_datasets`).
 * Returns null when no label or no drawable dataset remains.
 */
export function normalizeVizSpec(spec, { limits = PAGE_LIMITS } = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (spec.normalized === true) return spec

  const x = oneOf(spec.x, X_KINDS, 'category')
  const rawLabels = Array.isArray(spec.labels) ? spec.labels.slice(0, limits.labels) : []
  const labels = rawLabels.map((l) => (x === 'country' ? countryCode(l) : String(l ?? '')))
  if (!labels.length) return null

  const seen = new Set()
  const all = (Array.isArray(spec.datasets) ? spec.datasets : [])
    .map((d, i) => normalizeDataset(d, i, labels.length))
    .filter(Boolean)
    .map((d, i) => {
      let key = d.key
      if (seen.has(key)) key = `${key}-${i + 1}`
      seen.add(key)
      return { ...d, key }
    })
  const datasets = all.filter((d) => !d.textOnly)
  if (!datasets.length) return null
  const kept = datasets.slice(0, limits.datasets)
  const textColumns = all.filter((d) => d.textOnly).slice(0, limits.datasets)

  const keyOf = x === 'country' ? countryCode : (k) => k
  const stateLabels = {}
  for (const [state, text] of Object.entries(textMap(spec.state_labels))) {
    if (isState(state)) stateLabels[state] = text
  }
  const max = toNumber(spec.max)
  const requested = Array.isArray(spec.representations)
    ? spec.representations.filter((r) => REPRESENTATIONS.includes(r))
    : null

  const out = {
    normalized: true,
    id: clip(spec.id, MAX.name),
    title: clip(spec.title, MAX.title),
    subtitle: clip(spec.subtitle, MAX.subtitle),
    x,
    time_unit: x === 'time' ? oneOf(spec.time_unit, TIME_UNITS, 'day') : null,
    value: oneOf(spec.value, VALUE_KINDS, 'number'),
    unit: clip(spec.unit, MAX.unit),
    labels,
    label_names: textMap(spec.label_names, keyOf),
    label_entities: textMap(spec.label_entities, keyOf),
    label_header: clip(spec.label_header, MAX.short),
    datasets: kept,
    text_columns: textColumns,
    type: oneOf(spec.type, REPRESENTATIONS, null),
    requested_representations: requested && requested.length ? requested : null,
    stacked: spec.stacked === true,
    pick_one: spec.pick_one === true && kept.length > 1,
    custom_label: clip(spec.custom_label, MAX.short),
    palette: oneOf(spec.palette, PALETTES, 'categorical'),
    emphasis: typeof spec.emphasis === 'string' ? spec.emphasis : '',
    state_labels: stateLabels,
    missing_label: clip(spec.missing_label, MAX.short) || 'No data',
    footnote: clip(spec.footnote, MAX.footnote),
    max,
    truncated: datasets.length > kept.length,
    total_datasets: datasets.length,
  }
  out.representations = representationsFor(out)
  return out
}

function ensure(spec) {
  return spec?.normalized === true ? spec : normalizeVizSpec(spec)
}

/** The dataset a `pick_one` chart draws: the one with `key`, else the first. */
export function pickedDataset(spec, key = null) {
  const s = ensure(spec)
  if (!s) return null
  return s.datasets.find((d) => d.key === key) || s.datasets[0]
}

/** The value kind of a dataset (its own, else the spec's). */
export function kindOf(spec, dataset) {
  return dataset?.value || spec?.value || 'number'
}

/** The text a label reads as: its name, its date, its country, or itself. */
export function labelText(spec, index) {
  const s = ensure(spec)
  if (!s) return ''
  const label = s.labels[index] ?? ''
  if (s.label_names[label]) return s.label_names[label]
  if (s.x === 'time') return formatDateLabel(label, s.time_unit)
  if (s.x === 'country') return countryName(label)
  return label
}

function drawnKind(s, list) {
  return list.length === 1 ? kindOf(s, list[0]) : s.value
}

function barKind(s, list) {
  if (s.x === 'country') return 'hbar'
  if (list.length !== 1) return 'bar'
  if (s.type === 'hbar' || s.labels.length > 8) return 'hbar'
  return s.labels.some((_, i) => labelText(s, i).length > LONG_LABEL) ? 'hbar' : 'bar'
}

function doughnutFits(s, list) {
  if (!s.stacked || list.length !== 1 || s.labels.length > 6) return false
  const data = list[0].data
  return data.every((v) => v !== null && v >= 0) && data.some((v) => v > 0)
}

function canDraw(rep, s, list) {
  const kind = drawnKind(s, list)
  switch (rep) {
    case 'table':
    case 'custom':
      return true
    case 'map':
      return s.x === 'country'
    case 'line':
    case 'area':
      return s.x !== 'country'
    case 'bar':
      return s.x !== 'country' && kind !== 'rank'
    case 'hbar':
      return kind !== 'rank'
    case 'stacked_bar':
      return s.stacked && list.length >= 2 && s.x !== 'country' && kind !== 'rank'
    case 'doughnut':
      return doughnutFits(s, list)
    case 'heatmap':
      return s.x !== 'country' && (s.x !== 'time' || s.labels.length <= 31)
    default:
      return false
  }
}

function byShape(s, list) {
  const n = list.length
  const kind = drawnKind(s, list)
  if (s.x === 'country') return kind === 'rank' ? ['map'] : ['map', 'hbar']
  if (s.x === 'time') {
    if (kind === 'rank') return ['line']
    if (n === 1) return ['line', 'area', 'bar']
    const out = ['line', 'area', 'bar']
    if (s.stacked) out.push('stacked_bar')
    if (s.labels.length <= 31) out.push('heatmap')
    return out
  }
  if (kind === 'rank') return n >= 2 ? ['heatmap'] : []
  if (n === 1) return doughnutFits(s, list) ? [barKind(s, list), 'doughnut'] : [barKind(s, list)]
  return s.stacked ? ['bar', 'stacked_bar', 'heatmap'] : ['bar', 'heatmap']
}

/**
 * The representations a spec offers, default first and `table` last
 * (contract 8b). An explicit `representations` list wins, filtered to what
 * can draw the spec (plus `custom`). With `pick_one` the list is for the
 * picked dataset alone (`picked` key, default the first).
 */
export function representationsFor(spec, { picked = null } = {}) {
  const s = ensure(spec)
  if (!s) return ['table']
  const list = s.pick_one ? [pickedDataset(s, picked)] : s.datasets
  let reps
  if (s.requested_representations) {
    reps = s.requested_representations.filter((r) => r !== 'table' && canDraw(r, s, list))
    if (reps.includes('bar') && reps.includes('hbar')) {
      const drop = barKind(s, list) === 'hbar' ? 'bar' : 'hbar'
      reps = reps.filter((r) => r !== drop)
    }
  } else {
    reps = byShape(s, list)
  }
  return [...new Set([...reps, 'table'])]
}

/** `spec.type` when offered, else the first offered; a narrow map starts as bars. */
export function defaultRepresentation(spec, { narrow = false, picked = null } = {}) {
  const s = ensure(spec)
  if (!s) return 'table'
  const offered = representationsFor(s, { picked })
  let rep = s.type && offered.includes(s.type) ? s.type : offered[0]
  if (narrow && rep === 'map' && offered.includes('hbar')) rep = 'hbar'
  return rep
}

/** The word a state reads as (the spec's own wording first). */
export function stateText(spec, state) {
  return spec?.state_labels?.[state] || STATE_LABELS[state] || ''
}

// What one point reads as, and what kind of text that is:
// 'text' (the caller's own words), 'state', 'value' or 'missing'.
function readPoint(s, d, j) {
  if (d.texts?.[j]) return { text: d.texts[j], kind: 'text' }
  const state = d.states[j]
  if (state) return { text: stateText(s, state), kind: 'state' }
  const text = d.textOnly ? null : formatValue(d.data[j], { value: kindOf(s, d), unit: s.unit })
  return text === null ? { text: s.missing_label, kind: 'missing' } : { text, kind: 'value' }
}

/** One point as text: its own text, the state word, the formatted value, or missing_label. */
export function pointText(spec, datasetIndex, labelIndex) {
  const s = ensure(spec)
  const d = s?.datasets[datasetIndex]
  if (!d) return ''
  return readPoint(s, d, labelIndex).text
}

function defaultHeader(s) {
  if (s.x === 'country') return 'Country'
  if (s.x === 'time') return s.time_unit === 'week' ? 'Week' : s.time_unit === 'month' ? 'Month' : 'Date'
  return 'Name'
}

/**
 * The table every chart can be read as: one row per label, one column per
 * dataset (each formatted with its own kind), then the text columns.
 * -> { caption, labelHeader, columns: [{key, label, align, text}],
 *      rows: [{key, label, sortValue, cells: [{text, value, state, kind}]}] }
 */
export function tableModel(spec) {
  const s = ensure(spec)
  if (!s) return { caption: '', labelHeader: '', columns: [], rows: [] }
  const columns = [...s.datasets, ...(s.text_columns || [])]
  return {
    caption: s.title,
    labelHeader: s.label_header || defaultHeader(s),
    columns: columns.map((d) => ({ key: d.key, label: d.label, align: d.textOnly ? 'left' : 'right', text: d.textOnly })),
    rows: s.labels.map((label, j) => ({
      key: `${j}:${label}`,
      label: labelText(s, j),
      // Dates sort by their ISO text; everything else by what it reads as.
      sortValue: s.x === 'time' ? label : labelText(s, j),
      cells: columns.map((d) => ({ ...readPoint(s, d, j), value: d.data[j], state: d.states[j] })),
    })),
  }
}
