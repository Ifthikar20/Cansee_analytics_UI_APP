// Chart.js configuration for the canvas representations (line, area, bar,
// hbar, stacked bar, donut), built from a normalized ChartSpec with the
// house mark specs: 2px round lines with a ringed dot on the last point,
// 10% area washes, bars at most 24px thick with square ends and
// a 2px surface gap between touching marks, hairline solid gridlines on
// the value axis only, at most five value ticks, no animation.
//
// Every colour comes from the --viz-* tokens through cssVar, so a config
// built inside a computed() is rebuilt, and the chart recoloured, when the
// theme flips. Tooltips are HTML (VizTooltip, through `onTooltip`) so the
// value can lead in bold and a state prints its word.
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { formatTick } from './format'
import { datasetToken, labelToken, resolveColor, tokenColor, withAlpha } from './palette'
import { kindOf, labelText, normalizeVizSpec, pickedDataset, pointText } from './spec'

Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Tooltip)

export const CANVAS_REPRESENTATIONS = Object.freeze(['line', 'area', 'bar', 'hbar', 'stacked_bar', 'doughnut'])

const COMPONENT = { line: 'line', area: 'line', bar: 'bar', hbar: 'bar', stacked_bar: 'bar', doughnut: 'doughnut' }
// Country bars show the top 15 countries.
const COUNTRY_BARS = 15
const ROW_HEIGHT = 28
const FONT_SIZE = 12
// Rough width of a 12px label character, for padding reserved before layout.
const CHAR_WIDTH = 6.6
// Line-end labels need room beside the plot; narrower charts use the legend.
const END_LABELS_MIN_WIDTH = 440

// Characters a horizontal bar label may use. Chart.js gives a vertical
// axis at most half of the width left after padding, and the label needs
// its tick padding on both sides; past that it would run off the canvas.
function labelBudget(width, reserved = 0) {
  if (!width) return 28
  const room = (width - reserved) / 2 - 16
  return Math.max(6, Math.min(28, Math.floor(room / CHAR_WIDTH)))
}

function clipText(text, max) {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

// Room for a vertical bar's label: its slot of the plot (less the value
// axis), in characters. Under 4 there is no room for a word.
const VALUE_AXIS_WIDTH = 48
function slotChars(width, count) {
  if (!width || !count) return 0
  return Math.floor((width - VALUE_AXIS_WIDTH) / count / CHAR_WIDTH)
}

// A label in at most two lines of `max` characters, broken between words;
// what does not fit is clipped with an ellipsis.
function wrapLabel(text, max) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const joined = line ? `${line} ${words[i]}` : words[i]
    if (!line || joined.length <= max) {
      line = joined
      continue
    }
    if (lines.length === 1) {
      line = [line, ...words.slice(i)].join(' ')
      break
    }
    lines.push(line)
    line = words[i]
  }
  lines.push(line)
  const out = lines.map((l) => clipText(l, max))
  return out.length === 1 ? out[0] : out
}

function isValue(v) {
  return v !== null && v !== undefined
}

// Line points: no dot except the last value and values with no neighbour
// (a lone day between gaps would otherwise be invisible).
function pointRadii(data) {
  let last = -1
  data.forEach((v, i) => {
    if (isValue(v)) last = i
  })
  return data.map((v, i) => {
    if (!isValue(v)) return 0
    if (i === last) return 4
    return !isValue(data[i - 1]) && !isValue(data[i + 1]) ? 4 : 0
  })
}

// ── Plugins (options under options.plugins[id]) ──

// A 1px vertical line at the active index of a line or area chart.
const crosshair = {
  id: 'vizCrosshair',
  beforeDatasetsDraw(chart, _args, opts) {
    if (!opts?.enabled) return
    const active = chart.tooltip?.getActiveElements?.() || []
    const x = active[0]?.element?.x
    if (!Number.isFinite(x)) return
    const { ctx, chartArea } = chart
    const px = Math.round(x) + 0.5
    ctx.save()
    ctx.strokeStyle = opts.color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, chartArea.top)
    ctx.lineTo(px, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

// Series names at the right end of each line, for 2-4 visible series whose
// ends are at least 14px apart; otherwise the legend carries the names.
const endLabels = {
  id: 'vizEndLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts?.enabled) return
    const items = []
    chart.data.datasets.forEach((dataset, i) => {
      if (!chart.isDatasetVisible(i)) return
      const points = chart.getDatasetMeta(i).data
      for (let j = dataset.data.length - 1; j >= 0; j--) {
        if (isValue(dataset.data[j]) && Number.isFinite(points[j]?.y)) {
          items.push({ y: points[j].y, text: dataset.label })
          break
        }
      }
    })
    if (items.length < 2 || items.length > 4) return
    const ys = items.map((item) => item.y).sort((a, b) => a - b)
    for (let k = 1; k < ys.length; k++) if (ys[k] - ys[k - 1] < 14) return
    const { ctx, chartArea } = chart
    const x = chartArea.right + 8
    ctx.save()
    ctx.font = `${FONT_SIZE}px ${opts.family || 'sans-serif'}`
    const room = chart.width - x - 2
    if (items.some((item) => ctx.measureText(item.text).width > room)) {
      ctx.restore()
      return
    }
    ctx.fillStyle = opts.color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const item of items) ctx.fillText(item.text, x, item.y)
    ctx.restore()
  },
}

// The value at the tip of each bar of a one-series bar or hbar chart with
// at most 12 bars; a missing bar prints its state word at the baseline
// when the word fits its slot.
const barTips = {
  id: 'vizBarTips',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts?.enabled || !chart.isDatasetVisible(0)) return
    const horizontal = chart.options.indexAxis === 'y'
    const indexScale = chart.scales[horizontal ? 'y' : 'x']
    const valueScale = chart.scales[horizontal ? 'x' : 'y']
    const data = chart.data.datasets[0]?.data || []
    const { ctx } = chart
    ctx.save()
    ctx.font = `${FONT_SIZE}px ${opts.family || 'sans-serif'}`
    ctx.fillStyle = opts.color
    const slot = data.length ? (horizontal ? indexScale.height : indexScale.width) / data.length : 0
    data.forEach((value, j) => {
      const text = opts.texts?.[j]
      if (!text) return
      const at = indexScale.getPixelForValue(j)
      const tip = valueScale.getPixelForValue(isValue(value) ? value : 0)
      if (!isValue(value) && !horizontal && ctx.measureText(text).width > slot - 4) return
      if (horizontal) {
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, tip + 6, at)
      } else {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(text, at, tip - 4)
      }
    })
    ctx.restore()
  },
}

export const VIZ_PLUGINS = Object.freeze([crosshair, endLabels, barTips])

/** The datasets a representation draws, as indexes into spec.datasets. */
export function drawnIndexes(spec, representation, picked = null) {
  const s = spec?.normalized === true ? spec : normalizeVizSpec(spec)
  if (!s) return []
  if (s.pick_one || representation === 'doughnut' || representation === 'map') {
    return [s.datasets.indexOf(pickedDataset(s, picked))]
  }
  return s.datasets.map((_, i) => i)
}

// Label order: country bars are the top 15 by value; everything else keeps
// the spec's order.
function labelOrder(s, representation, first) {
  const all = s.labels.map((_, j) => j)
  if (!(representation === 'hbar' && s.x === 'country') || !first) return all
  return all
    .filter((j) => isValue(first.data[j]) || first.states[j])
    .sort((a, b) => (first.data[b] ?? -Infinity) - (first.data[a] ?? -Infinity))
    .slice(0, COUNTRY_BARS)
}

function matchesSelected(s, j, selected) {
  if (!selected) return false
  const wanted = selected.toLowerCase()
  return s.labels[j].toLowerCase() === wanted || labelText(s, j).toLowerCase() === wanted
}

function percentMax(s, kind, sets, stacked) {
  if (kind !== 'percent') return s.max ?? undefined
  if (s.max !== null) return s.max
  let top = 0
  const length = sets[0]?.data.length || 0
  for (let j = 0; j < length; j++) {
    const values = sets.map((d) => d.data[j]).filter(isValue)
    const v = stacked ? values.reduce((sum, n) => sum + Math.max(0, n), 0) : Math.max(0, ...values)
    top = Math.max(top, v)
  }
  return top <= 100 ? 100 : undefined
}

/**
 * -> { component: 'line' | 'bar' | 'doughnut', data, options, plugins,
 *      height, order, drawn, colors, kind, horizontal } or null.
 * `order` maps chart index -> spec label index; `drawn` lists the spec
 * dataset index of each chart dataset; `colors` their series colours.
 */
export function buildChartConfig(
  spec,
  representation,
  {
    width = 0,
    surface = '',
    hidden = [],
    picked = null,
    selected = '',
    font = '',
    height = 240,
    onTooltip = null,
    onSelect = null,
  } = {},
) {
  const s = spec?.normalized === true ? spec : normalizeVizSpec(spec)
  if (!s) return null
  const rep = COMPONENT[representation] ? representation : 'bar'
  const component = COMPONENT[rep]
  const drawn = drawnIndexes(s, rep, picked)
  const sets = drawn.map((i) => s.datasets[i])
  const kind = sets.length === 1 ? kindOf(s, sets[0]) : s.value
  const order = labelOrder(s, rep, sets[0])
  const labels = order.map((j) => labelText(s, j))
  const horizontal = rep === 'hbar'
  const lineLike = rep === 'line' || rep === 'area'
  const stackedArea = rep === 'area' && s.stacked && sets.length > 1
  const stacked = rep === 'stacked_bar' || stackedArea

  const ink2 = tokenColor('--viz-ink-2')
  const grid = tokenColor('--viz-grid')
  const axis = tokenColor('--viz-axis')
  const other = tokenColor('--viz-other')
  const surfaceColor = resolveColor(surface)
  const family = font || undefined
  const tickFont = { family, size: FONT_SIZE }

  const colors = sets.map((d, k) => tokenColor(datasetToken(s, d, drawn[k], { drawn: sets.length })))
  const hiddenSet = new Set(hidden)
  const emphasized = sets.length === 1 && (rep === 'bar' || rep === 'hbar') && order.some((j) => matchesSelected(s, j, selected))

  let datasets
  if (component === 'doughnut') {
    const d = sets[0]
    datasets = [
      {
        key: d.key,
        label: d.label,
        data: order.map((j) => d.data[j]),
        backgroundColor: order.map((j) => tokenColor(labelToken(s, j))),
        hoverBackgroundColor: order.map((j) => tokenColor(labelToken(s, j))),
        borderColor: surfaceColor,
        hoverBorderColor: surfaceColor,
        borderWidth: 2,
        hoverOffset: 0,
      },
    ]
  } else if (lineLike) {
    datasets = sets.map((d, k) => {
      const data = order.map((j) => d.data[j])
      const color = colors[k]
      return {
        key: d.key,
        label: d.label,
        data,
        hidden: hiddenSet.has(d.key),
        borderColor: color,
        backgroundColor: rep === 'area' ? withAlpha(color, stackedArea ? 0.22 : 0.1) : color,
        fill: rep === 'area' ? (stackedArea ? 'stack' : 'origin') : false,
        borderWidth: 2,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        cubicInterpolationMode: 'monotone',
        spanGaps: false,
        pointRadius: pointRadii(data),
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        pointHoverBackgroundColor: color,
        pointBorderColor: surfaceColor,
        pointHoverBorderColor: surfaceColor,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2,
        pointStyle: 'circle',
        clip: 6,
      }
    })
  } else {
    // The 2px surface gap sits only where marks touch: between stacked
    // segments (the data end of each), and between neighbouring bars (1px
    // on each side, so two bars meet with 2px between them). A border on
    // every side would eat thin bars on narrow charts.
    const gap =
      rep === 'stacked_bar'
        ? { top: 2, right: 0, bottom: 0, left: 0 }
        : horizontal
          ? { top: 1, right: 0, bottom: 1, left: 0 }
          : { top: 0, right: 1, bottom: 0, left: 1 }
    datasets = sets.map((d, k) => {
      const color = colors[k]
      const fill = emphasized ? order.map((j) => (matchesSelected(s, j, selected) ? color : other)) : color
      return {
        key: d.key,
        label: d.label,
        data: order.map((j) => d.data[j]),
        hidden: hiddenSet.has(d.key),
        backgroundColor: fill,
        hoverBackgroundColor: fill,
        borderColor: surfaceColor,
        hoverBorderColor: surfaceColor,
        borderWidth: gap,
        borderRadius: 0,
        borderSkipped: 'start',
        maxBarThickness: 24,
        barPercentage: 1,
      }
    })
  }

  // Direct labels: line ends for 2-4 series on a plot wide enough to give
  // them room, bar tips for one short series.
  const visibleCount = sets.filter((d) => !hiddenSet.has(d.key)).length
  const showEnds = lineLike && visibleCount >= 2 && visibleCount <= 4 && (!width || width >= END_LABELS_MIN_WIDTH)
  const showTips = (rep === 'bar' || rep === 'hbar') && sets.length === 1 && order.length <= 12
  const tipTexts = showTips ? order.map((j) => pointText(s, drawn[0], j)) : []
  const padding = { top: lineLike ? 6 : 0, right: 4, bottom: 0, left: 0 }
  if (showEnds) {
    const longest = Math.max(...sets.map((d) => d.label.length))
    padding.right = Math.min(150, Math.ceil(longest * CHAR_WIDTH) + 12)
  }
  if (showTips && horizontal) {
    const longest = Math.max(...tipTexts.map((t) => t.length))
    padding.right = Math.min(150, Math.ceil(longest * CHAR_WIDTH) + 10)
  } else if (showTips) {
    padding.top = FONT_SIZE + 8
  }

  const plugins = {
    legend: { display: false },
    tooltip: { enabled: false, external: onTooltip || undefined },
    vizCrosshair: { enabled: lineLike, color: axis },
    vizEndLabels: { enabled: showEnds, color: ink2, family },
    vizBarTips: { enabled: showTips, color: ink2, family, texts: tipTexts },
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding },
    interaction:
      component === 'doughnut'
        ? { mode: 'nearest', intersect: true }
        : { mode: 'index', intersect: false, axis: horizontal ? 'y' : 'x' },
    plugins,
    onClick: onSelect
      ? (_event, elements) => {
          const el = elements?.[0]
          if (el) onSelect({ index: el.index, datasetIndex: el.datasetIndex })
        }
      : undefined,
  }

  if (component === 'doughnut') {
    options.cutout = '62%'
  } else {
    const valueAxis = {
      type: 'linear',
      stacked,
      beginAtZero: kind !== 'rank',
      reverse: kind === 'rank',
      min: kind === 'rank' ? 1 : undefined,
      max: percentMax(s, kind, sets, stacked),
      grid: { color: grid, lineWidth: 1, drawTicks: false },
      border: { display: false },
      ticks: {
        color: ink2,
        font: tickFont,
        padding: 8,
        maxTicksLimit: 5,
        precision: kind === 'count' || kind === 'rank' ? 0 : undefined,
        callback: (value) => formatTick(value, kind, s.unit),
      },
    }
    const chars = horizontal ? labelBudget(width, padding.left + padding.right) : 24
    // Dates may skip labels (the next one dates the bar); categories may
    // not, or bars go unnamed: each label wraps onto two lines in its slot.
    const perSlot = slotChars(width, order.length)
    const nameEvery = !horizontal && s.x !== 'time' && perSlot >= 4
    const labelAxis = {
      type: 'category',
      stacked: rep === 'stacked_bar',
      // No tick marks drawn, so none reserved either.
      grid: { display: false, drawTicks: false },
      border: { display: true, color: axis },
      ticks: {
        color: ink2,
        font: tickFont,
        padding: 6,
        maxRotation: 0,
        autoSkip: !nameEvery,
        autoSkipPadding: 12,
        callback: (value) => (nameEvery ? wrapLabel(labels[value], Math.min(chars, perSlot)) : clipText(labels[value], chars)),
      },
    }
    if (horizontal) {
      options.indexAxis = 'y'
      options.scales = { x: valueAxis, y: labelAxis }
    } else {
      options.scales = { x: labelAxis, y: valueAxis }
    }
  }

  return {
    component,
    data: { labels, datasets },
    options,
    plugins: VIZ_PLUGINS,
    height: horizontal ? order.length * ROW_HEIGHT + 48 : height,
    order,
    drawn,
    colors: component === 'doughnut' ? datasets[0].backgroundColor : colors,
    kind,
    horizontal,
  }
}

/**
 * What a tooltip or the keyboard cursor reads at chart index `index`:
 * { title, labelIndex, rows: [{ key, label, text, color, shape }] }, every
 * visible series listed (a state prints its word).
 */
export function pointReadout(spec, config, index, { hidden = [] } = {}) {
  const s = spec?.normalized === true ? spec : normalizeVizSpec(spec)
  const j = config?.order?.[index]
  if (!s || j === undefined) return null
  const title = labelText(s, j)
  if (config.component === 'doughnut') {
    const di = config.drawn[0]
    return {
      title,
      labelIndex: j,
      rows: [{ key: s.labels[j], label: s.datasets[di].label, text: pointText(s, di, j), color: config.colors[index], shape: 'rect' }],
    }
  }
  const shape = config.component === 'line' ? 'line' : 'rect'
  const rows = config.drawn
    .map((di, k) => ({ di, k }))
    .filter(({ di }) => !hidden.includes(s.datasets[di].key))
    .map(({ di, k }) => ({
      key: s.datasets[di].key,
      label: s.datasets[di].label,
      text: pointText(s, di, j),
      color: config.colors[k],
      shape,
    }))
  return { title, labelIndex: j, rows }
}
