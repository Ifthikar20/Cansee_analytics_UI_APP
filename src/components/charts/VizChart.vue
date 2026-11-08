<template>
  <figure
    ref="rootEl"
    class="viz"
    :class="{ 'is-compact': compact, 'is-narrow': narrow }"
    :style="{ '--viz-chart-surface': surfaceCss }"
    :aria-labelledby="title ? titleId : undefined"
  >
    <header v-if="title || subtitle || $slots.actions || showPicker || showSwitcher" class="viz-head">
      <div class="viz-head-text">
        <component :is="headingTag" v-if="title" :id="titleId" class="viz-title">{{ title }}</component>
        <p v-if="subtitle" class="viz-sub">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions || showPicker || showSwitcher" class="viz-tools">
        <slot name="actions" />
        <label v-if="showPicker" class="viz-pick">
          <span class="viz-pick-label">Show</span>
          <select :value="picked?.key" class="viz-pick-select" @change="pickedKey = $event.target.value">
            <option v-for="d in norm.datasets" :key="d.key" :value="d.key">{{ d.label }}</option>
          </select>
        </label>
        <VizSwitcher v-if="showSwitcher" :model-value="current" :options="switchOptions" @update:model-value="choose" />
      </div>
    </header>

    <div v-if="mode === 'skeleton'" class="viz-skeleton" :style="{ height: `${height}px` }" aria-busy="true">
      <span class="viz-sr-only">Loading</span>
    </div>

    <VizState
      v-else-if="mode === 'error'"
      kind="error"
      :title="error"
      :action="{ label: 'Try again' }"
      :compact="compact"
      @action="emit('retry')"
    />

    <template v-else-if="mode === 'empty'">
      <slot name="empty">
        <VizState
          :kind="empty?.kind || 'empty'"
          :title="empty?.title || missingLabel"
          :body="empty?.body || ''"
          :action="empty?.action || null"
          :compact="compact"
          @action="onEmptyAction"
        />
      </slot>
    </template>

    <template v-else>
      <VizLegend
        v-if="legendItems.length > 1"
        class="viz-legend-row"
        :items="legendItems"
        :interactive="legendInteractive"
        :hidden="hiddenKeys"
        @toggle="toggleSeries"
      />
      <div class="viz-body" :class="{ 'is-busy': loading }" :aria-busy="loading ? 'true' : undefined">
        <VizCanvas
          v-if="CANVAS.includes(current)"
          :spec="norm"
          :representation="current"
          :height="height"
          :surface="surface"
          :hidden="hiddenKeys"
          :picked="picked?.key ?? null"
          :selected="selected"
          :selectable="selectable"
          @select="onSelect"
        />
        <VizHeatmap
          v-else-if="current === 'heatmap'"
          :spec="norm"
          :bins="bins"
          :title="title"
          :selected="selected"
          :selectable="selectable"
          @select="onSelect"
        />
        <VizGeoMap
          v-else-if="current === 'map' && picked"
          :spec="norm"
          :dataset="picked"
          :bins="bins"
          :title="title"
          :selected="selected"
          :selectable="selectable"
          :compact="compact"
          @select="onSelect"
        />
        <slot v-else-if="current === 'custom'" name="custom" :spec="norm" :representation="current" />
        <VizTable v-else :spec="norm" :compact="compact" :selected="selected" />
      </div>
      <VizScaleLegend
        v-if="current === 'map' || current === 'heatmap'"
        :bins="bins"
        :states="statesPresent"
        :state-labels="norm.state_labels"
        :missing="missingPresent"
        :missing-label="norm.missing_label"
      />
      <VizTable v-if="current !== 'table'" :spec="norm" sr-only />
    </template>

    <footer v-if="(mode === 'chart' && (norm.footnote || norm.truncated)) || $slots.footnote" class="viz-foot">
      <template v-if="mode === 'chart'">
        <p v-if="norm.footnote">{{ norm.footnote }}</p>
        <p v-if="norm.truncated">Showing {{ norm.datasets.length }} of {{ norm.total_datasets }} series.</p>
      </template>
      <slot name="footnote" />
    </footer>
  </figure>
</template>

<script setup>
// Every chart in the app goes through here. It normalizes the ChartSpec,
// offers the representations that suit its shape (a radio switcher, the
// table always last; `hideSwitcher` drops it for compact cards), keeps the
// reader's choice per chart (localStorage 'cs-viz-v1', keyed by persistKey
// or spec.id), draws one of canvas, heatmap, world map, table or the
// caller's custom view, and keeps a screen-reader table beside every
// representation that is not the table. The world map and its geometry
// load lazily, on the first map.
//
// States: first load -> skeleton; a refetch keeps the last frame dimmed
// (aria-busy); `error` -> error panel with Try again (emits retry);
// `empty` (or a spec with nothing to draw) -> empty panel, whose action
// without a destination emits retry too.
import { computed, defineAsyncComponent, getCurrentInstance, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import {
  defaultRepresentation,
  labelText,
  normalizeVizSpec,
  pickedDataset,
  pointText,
  REP_LABELS,
  representationsFor,
} from '@/lib/charts/spec'
import { datasetToken, labelToken } from '@/lib/charts/palette'
import { binsFor } from '@/lib/charts/scales'
import { CANVAS_REPRESENTATIONS as CANVAS } from '@/lib/charts/chartjs'
import { MAP_CODES } from '@/lib/charts/geo/isoNumeric'
import VizCanvas from './VizCanvas.vue'
import VizHeatmap from './VizHeatmap.vue'
import VizLegend from './VizLegend.vue'
import VizScaleLegend from './VizScaleLegend.vue'
import VizState from './VizState.vue'
import VizSwitcher from './VizSwitcher.vue'
import VizTable from './VizTable.vue'

const VizGeoMap = defineAsyncComponent(() => import('./VizGeoMap.vue'))

const props = defineProps({
  // ChartSpec (contract 8a); normalized here.
  spec: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // { title, body?, action?: { label, to? }, kind? }: an action without `to`
  // ("Try again") emits retry; `kind` picks the VizState icon (default empty).
  empty: { type: Object, default: null },
  // Plot height of line, area, bar, stacked and donut charts.
  height: { type: Number, default: 240 },
  // Optional v-model:representation.
  representation: { type: String, default: '' },
  // localStorage key for the chosen representation (default spec.id).
  persistKey: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  // CSS colour for the 2px gaps and rings (default var(--viz-surface)).
  surface: { type: String, default: '' },
  headingLevel: { type: Number, default: 3 },
  // A label to highlight (country, heatmap row, bar).
  selected: { type: String, default: '' },
  // Hide the representation switcher (board cards); the screen-reader
  // table stays.
  hideSwitcher: { type: Boolean, default: false },
})
const emit = defineEmits(['update:representation', 'select', 'retry'])

const STORE_KEY = 'cs-viz-v1'

const titleId = useId()
const norm = computed(() => normalizeVizSpec(props.spec))
const title = computed(() => norm.value?.title || (typeof props.spec?.title === 'string' ? props.spec.title.slice(0, 120) : ''))
const subtitle = computed(() => norm.value?.subtitle || (typeof props.spec?.subtitle === 'string' ? props.spec.subtitle.slice(0, 200) : ''))
const missingLabel = computed(() => (typeof props.spec?.missing_label === 'string' && props.spec.missing_label) || 'No data')
const headingTag = computed(() => `h${Math.min(6, Math.max(1, Math.round(props.headingLevel) || 3))}`)
const surfaceCss = computed(() => props.surface || 'var(--viz-surface)')

// ── Width (narrow under 560px) ──
// The frame's outer (border-box) width: its padding shrinks when narrow, so
// measuring the content box would flip `narrow` back and forth every frame
// for frames a few pixels either side of the threshold.
const rootEl = ref(null)
const width = ref(0)
const narrow = computed(() => width.value > 0 && width.value < 560)
let observer = null

function outerWidth(entry) {
  const box = Array.isArray(entry?.borderBoxSize) ? entry.borderBoxSize[0] : entry?.borderBoxSize
  if (typeof box?.inlineSize === 'number') return box.inlineSize
  return rootEl.value?.getBoundingClientRect().width || 0
}

onMounted(() => {
  width.value = Math.round(rootEl.value?.getBoundingClientRect().width || 0)
  if (typeof ResizeObserver !== 'function' || !rootEl.value) return
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.round(outerWidth(entry))
  })
  observer.observe(rootEl.value, { box: 'border-box' })
})

onBeforeUnmount(() => observer?.disconnect())

// ── The dataset a pick_one chart (or a multi-dataset map) draws ──
const pickedKey = ref(null)
// Series the reader toggled off in the legend.
const hiddenKeys = ref([])
const picked = computed(() => (norm.value ? pickedDataset(norm.value, pickedKey.value) : null))

watch(
  () => norm.value?.datasets.map((d) => d.key).join('|'),
  () => {
    if (pickedKey.value && !norm.value?.datasets.some((d) => d.key === pickedKey.value)) pickedKey.value = null
    hiddenKeys.value = hiddenKeys.value.filter((key) => norm.value?.datasets.some((d) => d.key === key))
  },
)

const pickKey = computed(() => (norm.value?.pick_one ? picked.value?.key : null))
const offered = computed(() => (norm.value ? representationsFor(norm.value, { picked: pickKey.value }) : []))

// ── The chosen representation: v-model, else the remembered choice ──
const internal = ref('')
const storageKey = computed(() => props.persistKey || norm.value?.id || '')

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function persist(rep) {
  const key = storageKey.value
  if (!key) return
  try {
    const all = readStore()
    all[key] = rep
    localStorage.setItem(STORE_KEY, JSON.stringify(all))
  } catch {}
}

watch(
  storageKey,
  (key) => {
    const stored = key ? readStore()[key] : ''
    internal.value = typeof stored === 'string' ? stored : ''
  },
  { immediate: true },
)

const current = computed(() => {
  if (!norm.value) return 'table'
  const wanted = props.representation || internal.value
  if (wanted && offered.value.includes(wanted)) return wanted
  return defaultRepresentation(norm.value, { picked: pickKey.value })
})

const switchOptions = computed(() =>
  offered.value.map((rep) => ({
    value: rep,
    label: rep === 'custom' ? norm.value?.custom_label || 'Chart' : REP_LABELS[rep],
  })),
)

const showSwitcher = computed(() => !props.hideSwitcher && switchOptions.value.length > 1)

function choose(rep) {
  if (!rep || rep === current.value) return
  internal.value = rep
  persist(rep)
  emit('update:representation', rep)
}

const showPicker = computed(
  () => Boolean(norm.value && norm.value.datasets.length > 1 && (norm.value.pick_one || current.value === 'map')),
)

// ── What is on screen ──
const hasFrame = ref(false)

const mode = computed(() => {
  if (props.loading) return hasFrame.value && norm.value ? 'chart' : 'skeleton'
  if (props.error) return 'error'
  if (props.empty || !norm.value) return 'empty'
  return 'chart'
})

watch(
  mode,
  (value) => {
    if (value === 'chart') hasFrame.value = true
    else if (value === 'error' || value === 'empty') hasFrame.value = false
  },
  { immediate: true },
)

// The series drawn: one for pick_one and maps, else all of them.
const drawn = computed(() => {
  if (!norm.value) return []
  if (norm.value.pick_one || current.value === 'map') return picked.value ? [picked.value] : []
  return norm.value.datasets
})

// ── Legend (two or more series on a canvas chart) ──
const legendInteractive = computed(() => current.value !== 'doughnut')

const legendItems = computed(() => {
  const s = norm.value
  if (!s || !CANVAS.includes(current.value)) return []
  if (current.value === 'doughnut') {
    const d = drawn.value[0]
    const index = s.datasets.indexOf(d)
    return s.labels.map((label, j) => ({
      key: label,
      label: labelText(s, j),
      color: `var(${labelToken(s, j)})`,
      shape: 'rect',
      value: pointText(s, index, j),
    }))
  }
  if (drawn.value.length < 2) return []
  return drawn.value.map((d) => ({
    key: d.key,
    label: d.label,
    color: `var(${datasetToken(s, d, s.datasets.indexOf(d), { drawn: drawn.value.length })})`,
    shape: current.value === 'line' ? 'line' : 'rect',
  }))
})

function toggleSeries(key) {
  if (hiddenKeys.value.includes(key)) {
    hiddenKeys.value = hiddenKeys.value.filter((k) => k !== key)
    return
  }
  // Keep at least one series on screen.
  const visible = drawn.value.filter((d) => !hiddenKeys.value.includes(d.key))
  if (visible.length <= 1) return
  hiddenKeys.value = [...hiddenKeys.value, key]
}

// ── Bins and the scale legend (map and heatmap) ──
const bins = computed(() => {
  if (!norm.value) return []
  if (current.value === 'map') return binsFor(norm.value, picked.value)
  if (current.value === 'heatmap') return binsFor(norm.value, null)
  return []
})

const statesPresent = computed(() => {
  if (!norm.value) return []
  const list = current.value === 'map' ? [picked.value].filter(Boolean) : norm.value.datasets
  return [...new Set(list.flatMap((d) => d.states.filter(Boolean)))]
})

// Something on screen has no value and no state: a country the map draws
// with no label, or a null point.
const missingPresent = computed(() => {
  const s = norm.value
  if (!s) return false
  if (current.value === 'map') {
    const d = picked.value
    if (!d) return true
    for (const code of MAP_CODES) {
      const j = s.labels.indexOf(code)
      if (j < 0 || (d.data[j] === null && !d.states[j])) return true
    }
    return false
  }
  return s.datasets.some((d) => d.data.some((v, j) => v === null && !d.states[j]))
})

// Rows and tiles become buttons only when someone listens to `select`.
const instance = getCurrentInstance()
const selectable = computed(() => Boolean(instance?.vnode.props?.onSelect))

function onSelect(payload) {
  emit('select', payload)
}

function onEmptyAction() {
  const action = props.empty?.action
  if (typeof action?.onClick === 'function') action.onClick()
  else emit('retry')
}
</script>

<style scoped>
.viz {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  margin: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--viz-chart-surface);
  color: var(--viz-ink-1);
}

.viz.is-narrow {
  padding: 16px;
}

.viz.is-compact {
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.viz-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 16px;
}

.viz-head-text {
  flex: 1 1 220px;
  min-width: 0;
}

.viz-title {
  margin: 0;
  color: var(--viz-ink-1);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.is-compact .viz-title {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 18px;
}

.viz-sub {
  margin-top: 2px;
  color: var(--viz-ink-2);
  font-size: 13px;
  line-height: 1.45;
}

.is-compact .viz-sub {
  font-size: 12px;
}

.viz-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.viz-pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--viz-ink-2);
  font-size: 12px;
}

.viz-pick-select {
  height: 28px;
  max-width: 220px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--viz-chart-surface);
  color: var(--viz-ink-1);
  font: inherit;
  font-size: 12px;
}

.viz-pick-select:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.viz-skeleton {
  border-radius: 12px;
  background: var(--viz-nodata);
  animation: viz-pulse 1.6s ease-in-out infinite;
}

@keyframes viz-pulse {
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .viz-skeleton {
    animation: none;
  }
}

.viz-body {
  position: relative;
  min-width: 0;
  transition: opacity 150ms ease;
}

.viz-body.is-busy {
  opacity: 0.5;
}

.viz-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--viz-ink-2);
  font-size: 12px;
  line-height: 1.5;
}
</style>
