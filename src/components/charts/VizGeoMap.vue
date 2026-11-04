<template>
  <div ref="mapEl" class="viz-geo" :class="{ 'is-selectable': selectable }">
    <div v-if="status === 'loading'" class="viz-geo-loading" aria-hidden="true"></div>

    <template v-else-if="status === 'failed'">
      <p class="viz-geo-note">The map couldn't load. Showing the table.</p>
      <VizTable :spec="spec" :compact="compact" :selected="selected" />
    </template>

    <svg
      v-else
      ref="svgEl"
      class="viz-geo-svg"
      :viewBox="`0 0 ${world.width} ${world.height}`"
      role="group"
      :aria-label="title || 'Map'"
      @keydown="onKeydown"
    >
      <path
        v-for="shape in shapes"
        :key="shape.key"
        :d="shape.d"
        class="viz-geo-country viz-fill"
        :class="[`is-${shape.look}`, { 'viz-geo-mark': shape.mark }]"
        :style="shape.style"
        v-bind="shape.attrs"
        @mouseenter="onEnter(shape, $event)"
        @mousemove="onMove(shape, $event)"
        @mouseleave="onLeave"
        @click="onClick(shape)"
        @focus="onFocus(shape, $event)"
        @blur="onBlur"
      />
      <circle
        v-for="dot in tinyDots"
        :key="`tiny:${dot.code}`"
        :cx="dot.cx"
        :cy="dot.cy"
        r="5"
        class="viz-geo-dot viz-fill"
        :class="`is-${dot.look}`"
        :style="dot.style"
        aria-hidden="true"
        @mouseenter="onEnter(dot, $event)"
        @mousemove="onMove(dot, $event)"
        @mouseleave="onLeave"
        @click="onClick(dot)"
      />
      <circle
        v-for="dot in pointDots"
        :key="`point:${dot.code}`"
        :cx="dot.cx"
        :cy="dot.cy"
        r="5"
        class="viz-geo-dot viz-geo-mark viz-fill"
        :class="`is-${dot.look}`"
        :style="dot.style"
        v-bind="dot.attrs"
        @mouseenter="onEnter(dot, $event)"
        @mousemove="onMove(dot, $event)"
        @mouseleave="onLeave"
        @click="onClick(dot)"
        @focus="onFocus(dot, $event)"
        @blur="onBlur"
      />
      <component :is="hoverMark.tag" v-if="hoverMark" v-bind="hoverMark.attrs" class="viz-geo-hover" aria-hidden="true" />
      <component
        :is="selectedMark.tag"
        v-if="selectedMark"
        v-bind="selectedMark.attrs"
        class="viz-geo-selected"
        aria-hidden="true"
      />
      <component :is="focusMark.tag" v-if="focusMark" v-bind="focusMark.attrs" class="viz-geo-focus" aria-hidden="true" />
    </svg>

    <VizTooltip v-if="tip" v-bind="tip" />
    <p v-if="alsoText" class="viz-map-also">{{ alsoText }}</p>
  </div>
</template>

<script setup>
// The world map: a choropleth on Equal Earth (lib/charts/geo/world), each
// country shaded by bin, or by state ("Not found" is the surface with a
// ring, anything unmeasured the no-data fill). Countries too small for a
// polygon at this scale are dots.
//
// Measured countries (a value, Named or Not found) are the marks: one tab
// stop, arrow keys move to the nearest mark in that direction, Home and
// End to the first and last in label order, Enter or Space selects. Each
// is labelled "{country}: {value}". The other shapes only show their
// tooltip on hover, so a keyboard user steps between measured countries
// rather than 176 shapes; the screen-reader table beside the map lists
// every row. Measured countries the map cannot draw are listed under it.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { countryName } from '@/lib/charts/format'
import { MAP_CODES, mapCode } from '@/lib/charts/geo/isoNumeric'
import { neighborMap } from '@/lib/charts/geo/keyboard'
import { loadWorld } from '@/lib/charts/geo/world'
import { fillOf } from '@/lib/charts/scales'
import { kindOf, pointText } from '@/lib/charts/spec'
import VizTable from './VizTable.vue'
import VizTooltip from './VizTooltip.vue'

const props = defineProps({
  // A normalized ChartSpec with x "country".
  spec: { type: Object, required: true },
  // The dataset the map shows (the picked one).
  dataset: { type: Object, required: true },
  // From binsFor().
  bins: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  selected: { type: String, default: '' },
  selectable: { type: Boolean, default: false },
  // Kept from the tile map's interface; the map scales instead.
  narrow: { type: Boolean, default: false },
  // A card: the off-map line names the three largest only.
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

// ── The geometry (one lazy load per session) ──
const world = shallowRef(null)
const status = ref('loading')
let alive = true

onMounted(() => {
  loadWorld().then(
    (loaded) => {
      if (!alive) return
      world.value = loaded
      status.value = 'ready'
    },
    () => {
      if (alive) status.value = 'failed'
    },
  )
})

onBeforeUnmount(() => {
  alive = false
})

// ── What each country reads ──
const datasetIndex = computed(() => props.spec.datasets.indexOf(props.dataset))

const indexByCode = computed(() => {
  const map = new Map()
  props.spec.labels.forEach((label, j) => {
    const code = mapCode(label)
    if (!map.has(code)) map.set(code, j)
  })
  return map
})

function nameOf(code) {
  return props.spec.label_names[code] || countryName(code)
}

function readCode(code) {
  const j = indexByCode.value.get(code)
  const has = j !== undefined
  const d = props.dataset
  const value = has ? d.data[j] : null
  const state = has ? d.states[j] : null
  const fill = fillOf(value, state, props.bins)
  return {
    code,
    j: has ? j : null,
    measured: has && fill.look !== 'nodata',
    look: fill.look,
    style: fill.look === 'bin' ? { fill: `var(--viz-seq-${fill.level})` } : null,
    name: nameOf(code),
    text: has ? pointText(props.spec, datasetIndex.value, j) : props.spec.missing_label,
    payload: { label: has ? props.spec.labels[j] : code, labelIndex: has ? j : null, datasetKey: d.key, value, state },
  }
}

// ── Marks: the measured countries, as polygons or dots ──
const focusCode = ref('')

const pointsByCode = computed(() => new Map((world.value?.points || []).map((p) => [p.code, p])))
const shapesByCode = computed(() => {
  const map = new Map()
  for (const shape of world.value?.shapes || []) if (shape.code && !map.has(shape.code)) map.set(shape.code, shape)
  return map
})

const readings = computed(() => {
  const out = new Map()
  for (const code of [...shapesByCode.value.keys(), ...pointsByCode.value.keys()]) out.set(code, readCode(code))
  return out
})

const markList = computed(() => {
  const list = []
  for (const [code, reading] of readings.value) {
    if (!reading.measured) continue
    const geo = shapesByCode.value.get(code) || pointsByCode.value.get(code)
    list.push({ code, cx: geo.cx, cy: geo.cy, j: reading.j })
  }
  return list
})

const markCodes = computed(() => new Set(markList.value.map((m) => m.code)))
const neighbors = computed(() => neighborMap(markList.value))
// Label order, for Home and End and the default tab stop.
const labelOrder = computed(() => [...markList.value].sort((a, b) => a.j - b.j).map((m) => m.code))

const selectedCode = computed(() => {
  const code = mapCode(props.selected)
  return MAP_CODES.has(code) ? code : ''
})

const rovingCode = computed(() => {
  if (focusCode.value && markCodes.value.has(focusCode.value)) return focusCode.value
  if (selectedCode.value && markCodes.value.has(selectedCode.value)) return selectedCode.value
  return labelOrder.value[0] || ''
})

function markAttrs(reading) {
  return {
    role: 'button',
    'data-code': reading.code,
    tabindex: reading.code === rovingCode.value ? 0 : -1,
    'aria-label': `${reading.name}: ${reading.text}`,
  }
}

const shapes = computed(() =>
  (world.value?.shapes || []).map((shape) => {
    // Not a country (N. Cyprus, Somaliland): no data, never hovered.
    if (!shape.code) return { key: shape.key, d: shape.d, look: 'nodata', mark: false, style: null, attrs: { 'aria-hidden': 'true' } }
    const reading = readings.value.get(shape.code)
    return {
      key: shape.key,
      code: shape.code,
      d: shape.d,
      cx: shape.cx,
      cy: shape.cy,
      tiny: shape.tiny,
      reading,
      look: reading.look,
      mark: reading.measured,
      style: reading.style,
      attrs: reading.measured ? markAttrs(reading) : { 'aria-hidden': 'true' },
    }
  }),
)

const tinyDots = computed(() =>
  shapes.value
    .filter((s) => s.tiny && s.mark)
    .map((s) => ({ code: s.code, cx: s.cx, cy: s.cy, reading: s.reading, look: s.look, style: s.style })),
)

const pointDots = computed(() =>
  (world.value?.points || [])
    .map((p) => ({ ...p, reading: readings.value.get(p.code) }))
    .filter((p) => p.reading?.measured)
    .map((p) => ({ ...p, look: p.reading.look, style: p.reading.style, attrs: markAttrs(p.reading) })),
)

// ── Overlays: hover, the selected country, the keyboard focus ──
const hoverCode = ref('')
const focusedCode = ref('')
const focusVisible = ref(false)

function overlay(code) {
  if (!code) return null
  const shape = shapesByCode.value.get(code)
  if (shape) return { tag: 'path', attrs: { d: shape.d } }
  const point = pointsByCode.value.get(code)
  return point ? { tag: 'circle', attrs: { cx: point.cx, cy: point.cy, r: 5 } } : null
}

const hoverMark = computed(() => overlay(hoverCode.value))
const selectedMark = computed(() => overlay(selectedCode.value))
const focusMark = computed(() => (focusVisible.value ? overlay(focusedCode.value) : null))

// ── Keyboard ──
const svgEl = ref(null)
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }

function focusOn(code) {
  if (!code) return
  focusCode.value = code
  svgEl.value?.querySelector(`[data-code="${code}"][tabindex]`)?.focus()
}

function choose(code) {
  const reading = readings.value.get(code)
  if (props.selectable && reading?.measured) emit('select', reading.payload)
}

function onKeydown(event) {
  const from = event.target?.getAttribute?.('data-code')
  if (!from || !markCodes.value.has(from)) return
  if (event.key === 'Enter' || event.key === ' ') {
    if (!props.selectable) return
    event.preventDefault()
    choose(from)
    return
  }
  let to
  if (KEYS[event.key]) to = neighbors.value[from]?.[KEYS[event.key]]
  else if (event.key === 'Home') to = labelOrder.value[0]
  else if (event.key === 'End') to = labelOrder.value[labelOrder.value.length - 1]
  else return
  event.preventDefault()
  focusOn(to)
}

function onClick(item) {
  if (!item.code || !item.reading?.measured) return
  focusCode.value = item.code
  choose(item.code)
}

// ── Tooltip: at the pointer on hover, at the country's centre on focus ──
const mapEl = ref(null)
const tip = shallowRef(null)

function tipAt(item, x, y, below) {
  const width = mapEl.value?.getBoundingClientRect().width || 0
  return {
    x,
    y,
    placement: below ? 'bottom' : 'top',
    align: x < 110 ? 'start' : width && x > width - 110 ? 'end' : 'center',
    title: '',
    rows: [{ key: item.code, label: '', text: `${item.reading.name} · ${item.reading.text}`, color: '', shape: 'rect' }],
  }
}

// The SVG's box inside the map frame, and its scale from viewBox units.
function frame() {
  const box = mapEl.value?.getBoundingClientRect()
  const svg = svgEl.value?.getBoundingClientRect()
  if (!box || !svg || !world.value) return null
  return { box, svg, sx: svg.width / world.value.width, sy: svg.height / world.value.height }
}

function onEnter(item, event) {
  if (!item.code || !item.reading) return
  hoverCode.value = item.code
  onMove(item, event)
}

function onMove(item, event) {
  if (!item.code || !item.reading) return
  const f = frame()
  if (!f) return
  const x = (event?.clientX ?? 0) - f.box.left
  const y = (event?.clientY ?? 0) - f.box.top
  // Near the top edge the tooltip goes under the pointer.
  const mapY = f.sy ? (y - (f.svg.top - f.box.top)) / f.sy : 0
  tip.value = tipAt(item, x, y, mapY < 60)
}

// The focused mark, so its tooltip comes back after the pointer leaves.
let focusedItem = null

function onLeave() {
  hoverCode.value = ''
  if (focusedItem) tipAtCentre(focusedItem)
  else tip.value = null
}

function isFocusVisible(el) {
  try {
    return el.matches(':focus-visible')
  } catch {
    return true
  }
}

function tipAtCentre(item) {
  const f = frame()
  if (!f) return
  const x = f.svg.left - f.box.left + item.cx * f.sx
  const y = f.svg.top - f.box.top + item.cy * f.sy
  tip.value = tipAt(item, x, y, item.cy < 60)
}

function onFocus(item, event) {
  focusCode.value = item.code
  focusedCode.value = item.code
  focusedItem = item
  focusVisible.value = isFocusVisible(event.target)
  tipAtCentre(item)
}

function onBlur() {
  focusedCode.value = ''
  focusedItem = null
  focusVisible.value = false
  tip.value = null
}

// ── Measured countries the map cannot draw ──
const offMap = computed(() => {
  const d = props.dataset
  const seen = new Set()
  const out = []
  props.spec.labels.forEach((label, j) => {
    const code = mapCode(label)
    if (MAP_CODES.has(code) || seen.has(code)) return
    seen.add(code)
    const state = d.states[j]
    if (d.data[j] === null && state !== 'not_found' && state !== 'named') return
    out.push({ value: d.data[j], text: `${nameOf(code)} ${pointText(props.spec, datasetIndex.value, j)}` })
  })
  return out
})

// Largest first; for ranks the best (smallest) first; words last.
function largestFirst(kind) {
  return (a, b) => {
    if (a.value === null || b.value === null) return (a.value === null) - (b.value === null)
    return kind === 'rank' ? a.value - b.value : b.value - a.value
  }
}

const alsoText = computed(() => {
  const list = offMap.value
  if (!list.length) return ''
  if (!props.compact) return `Also measured: ${list.map((i) => i.text).join(', ')}`
  const top = [...list].sort(largestFirst(kindOf(props.spec, props.dataset))).slice(0, 3)
  const more = list.length - top.length
  return `Also measured: ${top.map((i) => i.text).join(', ')}${more ? ` and ${more} more` : ''}`
})
</script>

<style scoped>
.viz-geo {
  position: relative;
}

.viz-geo-loading {
  aspect-ratio: 1000 / 440;
  border-radius: 8px;
  background: var(--viz-nodata);
}

.viz-geo-note {
  margin-bottom: 8px;
  color: var(--viz-ink-2);
  font-size: 12px;
  line-height: 1.5;
}

.viz-geo-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* Every stroke keeps its width in screen pixels as the map scales. */
.viz-geo-country,
.viz-geo-dot,
.viz-geo-hover,
.viz-geo-selected,
.viz-geo-focus {
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
}

.viz-geo-country {
  stroke: var(--viz-chart-surface, var(--viz-surface));
  stroke-width: 0.5px;
}

.viz-geo-country.is-nodata {
  fill: var(--viz-nodata);
  stroke: var(--viz-nodata-ring);
}

.viz-geo-country.is-named,
.viz-geo-dot.is-named {
  fill: var(--viz-seq-3);
}

.viz-geo-country.is-absent,
.viz-geo-dot.is-absent {
  fill: var(--viz-chart-surface, var(--viz-surface));
  stroke: var(--viz-axis);
  stroke-width: 1px;
}

.viz-geo-dot {
  stroke: var(--viz-chart-surface, var(--viz-surface));
  stroke-width: 1px;
}

.viz-geo-mark:focus {
  outline: none;
}

.is-selectable .viz-geo-mark {
  cursor: pointer;
}

.viz-geo-hover,
.viz-geo-selected,
.viz-geo-focus {
  fill: none;
  pointer-events: none;
}

.viz-geo-hover {
  stroke: var(--viz-ink-2);
  stroke-width: 1px;
}

.viz-geo-selected {
  stroke: var(--viz-ink-1);
  stroke-width: 1.5px;
}

.viz-geo-focus {
  stroke: var(--ring);
  stroke-width: 2px;
}

@media (forced-colors: active) {
  .viz-geo-selected {
    stroke: CanvasText;
  }

  .viz-geo-focus {
    stroke: Highlight;
  }
}

.viz-map-also {
  margin-top: 8px;
  color: var(--viz-ink-2);
  font-size: 12px;
  line-height: 1.5;
}
</style>
