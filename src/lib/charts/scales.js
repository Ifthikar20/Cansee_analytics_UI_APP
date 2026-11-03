// Value bins for the heatmap and the tile map: five steps of the
// sequential ramp (--viz-seq-1..5), so a cell's shade reads against the
// scale legend under it.
//   percent  fixed: 0-19%, 20-39%, 40-59%, 60-79%, 80-100%
//   rank     ordinal, best first: #1-3, #4-10, #11-20, #21-50, #51-100;
//            the best bin is the strongest shade (level 5)
//   count, number, usd  five equal bins from 0 to a rounded max
// Each bin is { min, max, label, level, integer }: `level` is the ramp step
// (1..5, 5 strongest). Integer bins hold whole values from min to max
// inclusive and values are rounded before binning, so a cell that reads
// "20%" is never shaded as 0-19%.
import { formatValue, toNumber } from './format'
import { kindOf, normalizeVizSpec } from './spec'

const PERCENT_BINS = Object.freeze(
  [
    [0, 19],
    [20, 39],
    [40, 59],
    [60, 79],
    [80, 100],
  ].map(([min, max], i) => Object.freeze({ min, max, label: `${min}-${max}%`, level: i + 1, integer: true })),
)

const RANK_BINS = Object.freeze(
  [
    [1, 3],
    [4, 10],
    [11, 20],
    [21, 50],
    [51, 100],
  ].map(([min, max], i) => Object.freeze({ min, max, label: `#${min}-${max}`, level: 5 - i, integer: true })),
)

function niceStep(raw, integer) {
  if (!(raw > 0)) return 1
  const base = 10 ** Math.floor(Math.log10(raw))
  const f = raw / base
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  const step = nice * base
  return integer ? Math.max(1, Math.ceil(step)) : step
}

function rangeLabel(min, max, kind, integer) {
  const as = kind === 'usd' ? 'usd' : integer ? 'count' : 'number'
  const fmt = (n) => formatValue(n, { value: as, compact: true })
  return min === max ? fmt(min) : `${fmt(min)}-${fmt(max)}`
}

/**
 * The five bins for `dataset` of `spec` (or for all of its datasets).
 * -> [{ min, max, label, level, integer }], in reading order.
 */
export function binsFor(spec, dataset = null) {
  const s = spec?.normalized === true ? spec : normalizeVizSpec(spec)
  if (!s) return [...PERCENT_BINS]
  const list = dataset ? [dataset] : s.datasets
  const kind = list.length === 1 ? kindOf(s, list[0]) : s.value
  if (kind === 'percent') return [...PERCENT_BINS]
  if (kind === 'rank') return [...RANK_BINS]

  const values = list.flatMap((d) => d.data).filter((v) => v !== null)
  const top = Math.max(0, s.max ?? 0, ...values)
  const integer = kind === 'count' || (kind === 'number' && values.every((v) => Number.isInteger(v)))
  const step = niceStep(top / 5, integer)
  return [0, 1, 2, 3, 4].map((i) => {
    const min = i * step
    const last = i === 4
    const max = integer ? (last ? 5 * step : (i + 1) * step - 1) : (i + 1) * step
    return { min, max, label: rangeLabel(min, max, kind, integer), level: i + 1, integer }
  })
}

/**
 * How a heatmap cell or map tile is filled: { look, level }.
 *   'bin'    a value, shaded by its bin (`level` 1..5)
 *   'named'  measured without a position: the middle step
 *   'absent' not_found (measured, absent): the surface with a ring
 *   'nodata' every other state, and no value at all
 */
export function fillOf(value, state, bins) {
  if (state === 'not_found') return { look: 'absent', level: null }
  if (state === 'named') return { look: 'named', level: 3 }
  if (state) return { look: 'nodata', level: null }
  const level = binOf(value, bins)
  return level ? { look: 'bin', level } : { look: 'nodata', level: null }
}

/** The ramp level (1..5) for a value, or null when there is no value. */
export function binOf(value, bins) {
  const n = toNumber(value)
  if (n === null || !Array.isArray(bins) || !bins.length) return null
  const v = bins[0].integer ? Math.round(n) : n
  const ordered = [...bins].sort((a, b) => a.min - b.min)
  const lowest = ordered[0]
  const highest = ordered[ordered.length - 1]
  if (v < lowest.min) return lowest.level
  if (v > highest.max) return highest.level
  for (const bin of ordered) {
    const inside = bin.integer || bin === highest ? v <= bin.max : v < bin.max
    if (v >= bin.min && inside) return bin.level
  }
  // A fractional value between two whole bins (only when not rounded).
  return ordered.find((bin) => v < bin.min)?.level ?? highest.level
}
