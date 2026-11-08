<template>
  <div
    ref="scrollEl"
    class="viz-heat-scroll"
    :tabindex="scrollable ? 0 : undefined"
    :role="scrollable ? 'region' : undefined"
    :aria-label="scrollable ? `${title || 'Heatmap'}, scrolls sideways` : undefined"
  >
    <table ref="tableEl" class="viz-heat" @keydown="onKeydown">
      <caption class="viz-sr-only">{{ title || 'Heatmap' }}</caption>
      <thead>
        <tr>
          <th scope="col" class="viz-heat-corner"><span class="viz-sr-only">{{ rowHeader }}</span></th>
          <th v-for="col in model.columns" :key="col.key" scope="col" class="viz-heat-col">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in model.rows" :key="row.key" :class="{ 'is-selected': row.selected }">
          <th scope="row" class="viz-heat-row">
            <button
              v-if="selectable"
              type="button"
              class="viz-heat-row-btn"
              :data-r="r"
              data-c="-1"
              :tabindex="isFocus(r, -1) ? 0 : -1"
              :title="row.label"
              @focus="focus = { r, c: -1 }"
              @click="emit('select', row.payload)"
            >
              <span class="viz-heat-row-text">{{ row.label }}</span>
            </button>
            <span v-else class="viz-heat-row-text" :title="row.label">{{ row.label }}</span>
          </th>
          <td
            v-for="(cell, c) in row.cells"
            :key="c"
            class="viz-heat-cell viz-fill"
            :class="`is-${cell.look}`"
            :style="cell.style"
            :data-r="r"
            :data-c="c"
            :tabindex="isFocus(r, c) ? 0 : -1"
            :aria-label="`${row.label}, ${model.columns[c].label}: ${cell.text}`"
            @focus="focus = { r, c }"
            @click="onCellClick(cell)"
          >
            {{ cell.text }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
// A heatmap as a real table: rows are the labels and columns the datasets,
// except over time, where rows are the datasets and columns the dates.
// Cells are shaded by bin (--viz-seq-N with its ink); a state prints its
// word on the no-data fill ("Not found" on the surface with a ring). One
// tab stop: arrow keys move across cells (and onto the row headers when
// rows can be selected), Home/End jump within a row, Enter selects.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fillOf } from '@/lib/charts/scales'
import { labelText, pointText } from '@/lib/charts/spec'

const props = defineProps({
  // A normalized ChartSpec.
  spec: { type: Object, required: true },
  // From binsFor().
  bins: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  selected: { type: String, default: '' },
  selectable: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const byTime = computed(() => props.spec.x === 'time')
const rowHeader = computed(() => (byTime.value ? 'Series' : props.spec.label_header || 'Name'))

function cellOf(s, di, j) {
  const d = s.datasets[di]
  const fill = fillOf(d.data[j], d.states[j], props.bins)
  return {
    text: pointText(s, di, j),
    look: fill.look,
    style: fill.level ? { background: `var(--viz-seq-${fill.level})`, color: `var(--viz-seq-ink-${fill.level})` } : null,
    payload: { label: s.labels[j], labelIndex: j, datasetKey: d.key, value: d.data[j], state: d.states[j] },
  }
}

function isSelected(key, text) {
  if (!props.selected) return false
  const wanted = props.selected.toLowerCase()
  return String(key).toLowerCase() === wanted || String(text).toLowerCase() === wanted
}

const model = computed(() => {
  const s = props.spec
  if (byTime.value) {
    return {
      columns: s.labels.map((label, j) => ({ key: `${j}:${label}`, label: labelText(s, j) })),
      rows: s.datasets.map((d, di) => ({
        key: d.key,
        label: d.label,
        selected: isSelected(d.key, d.label),
        payload: { label: null, labelIndex: null, datasetKey: d.key, value: null, state: null },
        cells: s.labels.map((_, j) => cellOf(s, di, j)),
      })),
    }
  }
  return {
    columns: s.datasets.map((d) => ({ key: d.key, label: d.label })),
    rows: s.labels.map((label, j) => ({
      key: `${j}:${label}`,
      label: labelText(s, j),
      selected: isSelected(label, labelText(s, j)),
      payload: { label, labelIndex: j, datasetKey: null, value: null, state: null },
      cells: s.datasets.map((_, di) => cellOf(s, di, j)),
    })),
  }
})

// ── Roving focus ──
const focus = ref({ r: 0, c: 0 })
const tableEl = ref(null)

function isFocus(r, c) {
  const rows = model.value.rows.length
  const cols = model.value.columns.length
  const at = focus.value
  const valid = at.r < rows && at.c < cols && (at.c >= 0 || props.selectable)
  return valid ? at.r === r && at.c === c : r === 0 && c === 0
}

function moveTo(r, c) {
  const rows = model.value.rows.length
  const cols = model.value.columns.length
  const minC = props.selectable ? -1 : 0
  const next = { r: Math.min(rows - 1, Math.max(0, r)), c: Math.min(cols - 1, Math.max(minC, c)) }
  focus.value = next
  tableEl.value?.querySelector(`[data-r="${next.r}"][data-c="${next.c}"]`)?.focus()
}

function onKeydown(event) {
  const { r, c } = focus.value
  const cols = model.value.columns.length
  const moves = {
    ArrowRight: [r, c + 1],
    ArrowLeft: [r, c - 1],
    ArrowDown: [r + 1, c],
    ArrowUp: [r - 1, c],
    Home: [r, props.selectable ? -1 : 0],
    End: [r, cols - 1],
  }
  if (moves[event.key]) {
    event.preventDefault()
    moveTo(...moves[event.key])
    return
  }
  if (event.key === 'Enter' && props.selectable && c >= 0 && event.target?.tagName === 'TD') {
    event.preventDefault()
    emit('select', model.value.rows[r]?.cells[c]?.payload)
  }
}

function onCellClick(cell) {
  if (props.selectable) emit('select', cell.payload)
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

watch(model, () => requestAnimationFrame(measure))

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.viz-heat-scroll {
  overflow-x: auto;
  border-radius: 8px;
}

.viz-heat-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.viz-heat {
  border-collapse: separate;
  border-spacing: 2px;
  color: var(--viz-ink-1);
  font-size: 12px;
  line-height: 1.3;
}

.viz-heat-col {
  min-width: 76px;
  padding: 4px 6px 6px;
  color: var(--viz-ink-2);
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
}

/* Row names keep a readable width (the table scrolls sideways instead)
   and stop at two lines; the full text is in the title and the table. */
.viz-heat-row {
  min-width: 112px;
  max-width: 260px;
  padding: 0 12px 0 0;
  color: var(--viz-ink-1);
  font-weight: 500;
  text-align: left;
}

.viz-heat-row-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: break-word;
}

.viz-heat tr.is-selected .viz-heat-row {
  font-weight: 600;
}

.viz-heat-row-btn {
  padding: 2px 4px;
  margin-left: -4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.viz-heat-row-btn:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.viz-heat tr.is-selected .viz-heat-row-btn,
.viz-heat tr.is-selected .viz-heat-row-text {
  border-radius: 4px;
  background: var(--viz-nodata);
}

.viz-heat-cell {
  min-width: 76px;
  height: 36px;
  padding: 0 8px;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
}

.viz-heat-cell.is-named {
  background: var(--viz-seq-3);
  color: var(--viz-seq-ink-3);
}

.viz-heat-cell.is-absent {
  background: var(--viz-chart-surface, var(--viz-surface));
  box-shadow: inset 0 0 0 1px var(--viz-axis);
  color: var(--viz-ink-2);
}

.viz-heat-cell.is-nodata {
  background: var(--viz-nodata);
  color: var(--viz-ink-2);
  font-weight: 400;
}

.viz-heat-cell:focus-visible,
.viz-heat-row-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
</style>
