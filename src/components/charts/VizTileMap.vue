<template>
  <div ref="mapEl" class="viz-map" :class="{ 'is-narrow': narrow }">
    <div
      ref="scrollEl"
      class="viz-map-scroll"
      :tabindex="scrollable ? 0 : undefined"
      :role="scrollable ? 'region' : undefined"
      :aria-label="scrollable ? `${title || 'Map'}, scrolls sideways` : undefined"
      @scroll="onScroll"
    >
      <div ref="gridEl" class="viz-map-grid" role="group" :aria-label="title || 'Map'" @keydown="onKeydown">
        <button
          v-for="tile in tiles"
          :key="tile.code"
          type="button"
          class="viz-tile viz-fill"
          :class="[`is-${tile.look}`, { 'is-selected': tile.selected }]"
          :style="tile.style"
          :data-code="tile.code"
          :tabindex="tile.code === rovingCode ? 0 : -1"
          :aria-label="`${tile.name}: ${tile.text}`"
          @focus="onFocus(tile, $event)"
          @blur="hideTip"
          @mouseenter="showTip(tile, $event)"
          @mouseleave="hideTip"
          @click="onClick(tile)"
        >
          {{ tile.code }}
        </button>
      </div>
    </div>
    <VizTooltip v-if="tip" v-bind="tip" />
    <p v-if="offGrid.length" class="viz-map-also">Also measured: {{ offGrid.join(', ') }}</p>
  </div>
</template>

<script setup>
// The country map: one square per country on the tile grid
// (lib/charts/tileGrid), shaded by bin, or by state ("Not found" is the
// surface with a ring, anything unmeasured the no-data fill). Each tile is
// a button labelled "{country}: {value}"; one tab stop, arrow keys move to
// the nearest tile in that direction, Enter or Space selects, and hover or
// focus shows "{country} · {value}". Measured countries that are not on
// the grid are listed under it.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { countryName } from '@/lib/charts/format'
import { fillOf } from '@/lib/charts/scales'
import { pointText } from '@/lib/charts/spec'
import { neighbors, TILES, tileOf } from '@/lib/charts/tileGrid'
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
  narrow: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const datasetIndex = computed(() => props.spec.datasets.indexOf(props.dataset))

const indexByCode = computed(() => {
  const map = new Map()
  props.spec.labels.forEach((label, j) => {
    if (!map.has(label)) map.set(label, j)
  })
  return map
})

const selectedCode = computed(() => tileOf(props.selected)?.code || '')

function nameOf(code) {
  return props.spec.label_names[code] || countryName(code)
}

const tiles = computed(() => {
  const d = props.dataset
  return TILES.map((tile) => {
    const j = indexByCode.value.get(tile.code)
    const has = j !== undefined
    const fill = fillOf(has ? d.data[j] : null, has ? d.states[j] : null, props.bins)
    const style = { gridColumn: tile.x + 1, gridRow: tile.y + 1 }
    if (fill.level) {
      style.background = `var(--viz-seq-${fill.level})`
      style.color = `var(--viz-seq-ink-${fill.level})`
    }
    return {
      code: tile.code,
      y: tile.y,
      name: nameOf(tile.code),
      text: has ? pointText(props.spec, datasetIndex.value, j) : props.spec.missing_label,
      look: fill.look,
      style,
      selected: tile.code === selectedCode.value,
      payload: {
        label: has ? props.spec.labels[j] : tile.code,
        labelIndex: has ? j : null,
        datasetKey: d.key,
        value: has ? d.data[j] : null,
        state: has ? d.states[j] : null,
      },
    }
  })
})

const offGrid = computed(() =>
  props.spec.labels
    .map((code, j) => ({ code, j }))
    .filter(({ code, j }) => {
      if (tileOf(code)) return false
      const state = props.dataset.states[j]
      return props.dataset.data[j] !== null || state === 'not_found' || state === 'named'
    })
    .map(({ code, j }) => `${nameOf(code)} ${pointText(props.spec, datasetIndex.value, j)}`),
)

// ── Roving focus ──
const focusCode = ref('')
const gridEl = ref(null)

const rovingCode = computed(() => {
  if (focusCode.value && tileOf(focusCode.value)) return focusCode.value
  if (selectedCode.value) return selectedCode.value
  return tiles.value.find((t) => t.look !== 'nodata')?.code || TILES[0].code
})

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }

function focusTile(code) {
  if (!code) return
  focusCode.value = code
  gridEl.value?.querySelector(`[data-code="${code}"]`)?.focus()
}

function onKeydown(event) {
  const from = event.target?.dataset?.code
  if (!from) return
  let to
  if (KEYS[event.key]) to = neighbors[from]?.[KEYS[event.key]]
  else if (event.key === 'Home') to = TILES[0].code
  else if (event.key === 'End') to = TILES[TILES.length - 1].code
  else return
  event.preventDefault()
  focusTile(to)
}

function onClick(tile) {
  focusCode.value = tile.code
  if (props.selectable) emit('select', tile.payload)
}

// ── Tooltip ──
const mapEl = ref(null)
const tip = shallowRef(null)
// The tile the tooltip points at, so a sideways scroll can move it along.
let anchor = null

function placeTip() {
  const box = mapEl.value?.getBoundingClientRect()
  const at = anchor?.el?.getBoundingClientRect?.()
  if (!box || !at) return
  const { tile } = anchor
  const x = at.left - box.left + at.width / 2
  const below = tile.y <= 1
  tip.value = {
    x,
    y: below ? at.bottom - box.top : at.top - box.top,
    placement: below ? 'bottom' : 'top',
    align: x < 110 ? 'start' : x > box.width - 110 ? 'end' : 'center',
    title: '',
    rows: [{ key: tile.code, label: '', text: `${tile.name} · ${tile.text}`, color: '', shape: 'rect' }],
  }
}

function showTip(tile, event) {
  anchor = { tile, el: event?.currentTarget }
  placeTip()
}

function onFocus(tile, event) {
  focusCode.value = tile.code
  showTip(tile, event)
}

function hideTip() {
  anchor = null
  tip.value = null
}

// Focusing a tile can scroll the grid; keep its tooltip on it.
function onScroll() {
  if (anchor) placeTip()
}

// ── The scroll region is focusable only when it scrolls ──
const scrollEl = ref(null)
const scrollable = ref(false)
let observer = null

function measure() {
  const el = scrollEl.value
  if (el) scrollable.value = el.scrollWidth > el.clientWidth + 1
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'function' && scrollEl.value) {
    observer = new ResizeObserver(measure)
    observer.observe(scrollEl.value)
  }
})

watch(() => props.narrow, () => requestAnimationFrame(measure))

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.viz-map {
  --tile: 30px;
  position: relative;
}

.viz-map.is-narrow {
  --tile: 24px;
}

.viz-map-scroll {
  overflow-x: auto;
  padding: 3px;
  border-radius: 8px;
}

.viz-map-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.viz-map-grid {
  display: grid;
  grid-template-columns: repeat(23, var(--tile));
  grid-auto-rows: var(--tile);
  gap: 2px;
  width: max-content;
}

.viz-tile {
  display: grid;
  place-items: center;
  width: var(--tile);
  height: var(--tile);
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: var(--viz-nodata);
  box-shadow: inset 0 0 0 1px var(--viz-nodata-ring);
  color: var(--viz-ink-2);
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: default;
}

.is-narrow .viz-tile {
  font-size: 9px;
}

.viz-tile.is-bin {
  box-shadow: none;
}

.viz-tile.is-named {
  background: var(--viz-seq-3);
  box-shadow: none;
  color: var(--viz-seq-ink-3);
}

.viz-tile.is-absent {
  background: var(--viz-chart-surface, var(--viz-surface));
  box-shadow: inset 0 0 0 1px var(--viz-axis);
  color: var(--viz-ink-2);
}

.viz-tile.is-selected {
  position: relative;
  z-index: 1;
  box-shadow: 0 0 0 2px var(--viz-ink-1);
}

.viz-tile:focus-visible {
  position: relative;
  z-index: 2;
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.viz-map-also {
  margin-top: 8px;
  color: var(--viz-ink-2);
  font-size: 12px;
  line-height: 1.5;
}
</style>
