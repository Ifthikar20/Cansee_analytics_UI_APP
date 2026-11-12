<template>
  <div class="viz-canvas">
    <div
      ref="boxEl"
      class="viz-canvas-plot"
      :class="{ 'is-selectable': selectable }"
      :style="{ height: `${plotHeight}px` }"
      role="img"
      :aria-label="ariaLabel"
      tabindex="0"
      @keydown="onKeydown"
      @blur="onBlur"
    >
      <!-- chart.js caches its first measurement; mount only at a real width. -->
      <component
        :is="chartComponent"
        v-if="boxWidth > 0 && config"
        ref="chartRef"
        :key="`${representation}:${boxWidth}`"
        :data="config.data"
        :options="config.options"
        :plugins="config.plugins"
        dataset-id-key="key"
      />
    </div>
    <VizTooltip v-if="tipView" v-bind="tipView" />
    <p class="viz-sr-only" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<script setup>
// The canvas representations (line, area, bar, hbar, stacked bar, donut)
// through vue-chartjs. Keyboard: the plot is one tab stop; Left/Right
// (Up/Down for horizontal bars) move a data cursor, Home/End jump, Escape
// clears, Enter selects; a polite live region reads the values at the
// cursor. The colours come from tokens via cssVar, so the config is
// rebuilt and the chart recoloured when the theme flips.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { buildChartConfig, pointReadout } from '@/lib/charts/chartjs'
import { REP_LABELS } from '@/lib/charts/spec'
import VizTooltip from './VizTooltip.vue'

const props = defineProps({
  // A normalized ChartSpec.
  spec: { type: Object, required: true },
  representation: { type: String, required: true },
  height: { type: Number, default: 240 },
  surface: { type: String, default: '' },
  // Dataset keys toggled off in the legend.
  hidden: { type: Array, default: () => [] },
  // The drawn dataset of a pick_one spec.
  picked: { type: String, default: null },
  selected: { type: String, default: '' },
  selectable: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const COMPONENTS = { line: Line, bar: Bar, doughnut: Doughnut }

const boxEl = ref(null)
const chartRef = ref(null)
const boxWidth = ref(0)
const font = ref('')
let observer = null

function setWidth(raw) {
  const w = Math.round(raw || 0)
  const bucket = w > 0 ? Math.max(24, Math.round(w / 24) * 24) : 0
  if (bucket !== boxWidth.value) boxWidth.value = bucket
}

onMounted(() => {
  if (boxEl.value) font.value = getComputedStyle(boxEl.value).fontFamily || ''
  setWidth(boxEl.value?.getBoundingClientRect().width)
  if (typeof ResizeObserver !== 'function' || !boxEl.value) {
    if (!boxWidth.value) boxWidth.value = 24
    return
  }
  observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect?.width))
  observer.observe(boxEl.value)
})

onBeforeUnmount(() => observer?.disconnect())

// ── Tooltip: chart.js reports the active index, VizTooltip draws it ──
const tip = shallowRef(null)

function onTooltip({ chart, tooltip }) {
  const point = tooltip?.dataPoints?.[0]
  if (!tooltip || tooltip.opacity === 0 || !point) {
    tip.value = null
    return
  }
  let x = tooltip.caretX
  let y = tooltip.caretY
  // An index with no value anywhere has no caret; anchor on the axis.
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const horizontal = chart.options.indexAxis === 'y'
    const at = chart.scales[horizontal ? 'y' : 'x']?.getPixelForValue(point.dataIndex)
    const area = chart.chartArea
    x = horizontal ? (area.left + area.right) / 2 : at
    y = horizontal ? at : (area.top + area.bottom) / 2
  }
  tip.value = { index: point.dataIndex, x, y, width: chart.width }
}

function onChartClick({ index, datasetIndex }) {
  emit('select', payload(index, datasetIndex))
}

const config = computed(() =>
  buildChartConfig(props.spec, props.representation, {
    width: boxWidth.value,
    surface: props.surface,
    hidden: props.hidden,
    picked: props.picked,
    selected: props.selected,
    font: font.value,
    height: props.height,
    onTooltip,
    onSelect: props.selectable ? onChartClick : null,
  }),
)

const chartComponent = computed(() => COMPONENTS[config.value?.component] || Bar)
const plotHeight = computed(() => config.value?.height || props.height)

const ariaLabel = computed(() => {
  const title = props.spec?.title || 'Chart'
  const count = config.value?.drawn.length || 0
  return `${title}: ${REP_LABELS[props.representation] || 'Chart'} of ${count} series; values are in the table view.`
})

const tipView = computed(() => {
  const t = tip.value
  if (!t || !config.value) return null
  const readout = pointReadout(props.spec, config.value, t.index, { hidden: props.hidden })
  if (!readout) return null
  return { x: t.x, y: t.y, title: readout.title, rows: readout.rows, flip: t.x > (t.width || 0) / 2 }
})

// ── Keyboard data cursor ──
const activeIndex = ref(-1)
const announcement = ref('')

function payload(chartIndex, chartDataset = 0) {
  const cfg = config.value
  const j = cfg.order[chartIndex]
  const di = cfg.drawn[chartDataset] ?? cfg.drawn[0]
  const d = props.spec.datasets[di]
  return {
    label: props.spec.labels[j],
    labelIndex: j,
    datasetKey: d?.key ?? null,
    value: d?.data[j] ?? null,
    state: d?.states[j] ?? null,
  }
}

function chartInstance() {
  return toRaw(chartRef.value?.chart) || null
}

function setActive(index) {
  const chart = chartInstance()
  const cfg = config.value
  activeIndex.value = index
  if (!chart || !cfg) return
  if (index < 0) {
    chart.setActiveElements([])
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 })
    chart.update()
    announcement.value = ''
    tip.value = null
    return
  }
  const elements =
    cfg.component === 'doughnut'
      ? [{ datasetIndex: 0, index }]
      : cfg.data.datasets.map((_, i) => i).filter((i) => chart.isDatasetVisible(i)).map((datasetIndex) => ({ datasetIndex, index }))
  chart.setActiveElements(elements)
  chart.tooltip?.setActiveElements(elements, { x: 0, y: 0 })
  chart.update()
  const readout = pointReadout(props.spec, cfg, index, { hidden: props.hidden })
  announcement.value = readout
    ? `${readout.title}: ${readout.rows.map((r) => (cfg.component === 'doughnut' ? r.text : `${r.label} ${r.text}`)).join(', ')}`
    : ''
}

function onKeydown(event) {
  const cfg = config.value
  const count = cfg?.data.labels.length || 0
  if (!count) return
  const back = cfg.horizontal ? 'ArrowUp' : 'ArrowLeft'
  const forward = cfg.horizontal ? 'ArrowDown' : 'ArrowRight'
  const current = activeIndex.value
  let next = null
  if (event.key === forward) next = current < 0 ? 0 : Math.min(count - 1, current + 1)
  else if (event.key === back) next = current < 0 ? count - 1 : Math.max(0, current - 1)
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = count - 1
  else if (event.key === 'Escape' && current >= 0) next = -1
  else if ((event.key === 'Enter' || event.key === ' ') && current >= 0 && props.selectable) {
    event.preventDefault()
    emit('select', payload(current))
    return
  }
  if (next === null) return
  event.preventDefault()
  setActive(next)
}

function onBlur() {
  if (activeIndex.value >= 0) setActive(-1)
}

// A new chart (another representation or width) starts without a cursor.
watch(
  () => `${props.representation}:${boxWidth.value}`,
  () => {
    activeIndex.value = -1
    announcement.value = ''
    tip.value = null
  },
)
</script>

<style scoped>
.viz-canvas {
  position: relative;
}

.viz-canvas-plot {
  position: relative;
  width: 100%;
  border-radius: var(--radius);
}

.viz-canvas-plot.is-selectable {
  cursor: pointer;
}

.viz-canvas-plot:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 4px;
}

/* Canvas text takes the element's font features; the agent's ss02 turns
   chart.js labels into mixed glyphs, so reset them here. */
.viz-canvas-plot :deep(canvas) {
  font-feature-settings: normal;
}
</style>
