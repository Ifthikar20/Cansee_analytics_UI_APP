<template>
  <div v-if="srOnly" class="viz-sr-only">
    <!-- A table box ignores width and overflow, so the clipping sits on this wrapper. -->
    <table>
      <caption>{{ model.caption || 'Chart data' }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ model.labelHeader }}</th>
          <th v-for="col in model.columns" :key="col.key" scope="col">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in model.rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td v-for="(cell, i) in row.cells" :key="i">{{ cell.text }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div
    v-else
    ref="wrapEl"
    class="viz-table-wrap"
    :class="{ 'is-compact': compact }"
    :tabindex="scrollable ? 0 : undefined"
    :role="scrollable ? 'region' : undefined"
    :aria-label="scrollable ? `${model.caption || 'Chart data'}, table` : undefined"
  >
    <table class="viz-table">
      <caption class="viz-sr-only">{{ model.caption || 'Chart data' }}</caption>
      <thead>
        <tr>
          <th scope="col" class="is-label" :aria-sort="ariaSort(LABEL)">
            <button type="button" class="viz-th-btn" @click="sortBy(LABEL)">
              <span>{{ model.labelHeader }}</span>
              <component :is="sortIcon(LABEL)" v-if="sortKey === LABEL" :size="12" aria-hidden="true" />
            </button>
          </th>
          <th
            v-for="col in model.columns"
            :key="col.key"
            scope="col"
            :class="col.text ? 'is-text' : 'is-num'"
            :aria-sort="ariaSort(col.key)"
          >
            <button type="button" class="viz-th-btn" @click="sortBy(col.key)">
              <span>{{ col.label }}</span>
              <component :is="sortIcon(col.key)" v-if="sortKey === col.key" :size="12" aria-hidden="true" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" :class="{ 'is-selected': isSelected(row) }">
          <th scope="row" class="is-label">{{ row.label }}</th>
          <td
            v-for="(cell, i) in row.cells"
            :key="i"
            :class="[model.columns[i].text ? 'is-text' : 'is-num', { 'is-word': cell.kind === 'state' || cell.kind === 'missing' }]"
          >
            {{ cell.text }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
// Every chart's table view, and the screen-reader copy beside every other
// representation (`srOnly`). Rows are the labels, columns the datasets,
// each value formatted with its own kind; a point that was not measured
// prints its state word; text columns read as written. Headers sort
// (aria-sort); the first click puts the largest value first (the best
// rank for ranks), names and text A to Z.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp } from '@lucide/vue'
import { kindOf, normalizeVizSpec, tableModel } from '@/lib/charts/spec'

const props = defineProps({
  spec: { type: Object, required: true },
  srOnly: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  // A label to highlight.
  selected: { type: String, default: '' },
})

const LABEL = '__label'

const norm = computed(() => normalizeVizSpec(props.spec))
const model = computed(() => tableModel(norm.value))

const sortKey = ref('')
const sortDir = ref('ascending')

function firstDirection(key) {
  if (key === LABEL || model.value.columns.find((c) => c.key === key)?.text) return 'ascending'
  const dataset = norm.value?.datasets.find((d) => d.key === key)
  return kindOf(norm.value, dataset) === 'rank' ? 'ascending' : 'descending'
}

function sortBy(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'ascending' ? 'descending' : 'ascending'
    return
  }
  sortKey.value = key
  sortDir.value = firstDirection(key)
}

function ariaSort(key) {
  return sortKey.value === key ? sortDir.value : undefined
}

function sortIcon(key) {
  return sortKey.value === key && sortDir.value === 'descending' ? ArrowDown : ArrowUp
}

const rows = computed(() => {
  const list = model.value.rows
  if (!sortKey.value) return list
  const dir = sortDir.value === 'ascending' ? 1 : -1
  if (sortKey.value === LABEL) {
    return [...list].sort((a, b) => dir * String(a.sortValue).localeCompare(String(b.sortValue), 'en', { numeric: true }))
  }
  const col = model.value.columns.findIndex((c) => c.key === sortKey.value)
  if (col < 0) return list
  if (model.value.columns[col].text) {
    return [...list].sort((a, b) => dir * a.cells[col].text.localeCompare(b.cells[col].text, 'en', { numeric: true }))
  }
  // Rows without a value (states, missing) stay last in both directions.
  return [...list].sort((a, b) => {
    const x = a.cells[col]?.value
    const y = b.cells[col]?.value
    const xm = x === null || x === undefined
    const ym = y === null || y === undefined
    if (xm || ym) return xm === ym ? 0 : xm ? 1 : -1
    return dir * (x - y)
  })
})

watch(
  () => model.value.columns.map((c) => c.key).join('|'),
  () => {
    if (sortKey.value && sortKey.value !== LABEL && !model.value.columns.some((c) => c.key === sortKey.value)) {
      sortKey.value = ''
    }
  },
)

function isSelected(row) {
  if (!props.selected) return false
  const wanted = props.selected.toLowerCase()
  const label = row.key.slice(row.key.indexOf(':') + 1).toLowerCase()
  return label === wanted || row.label.toLowerCase() === wanted
}

// The wrapper is a focusable scroll region only when it actually scrolls.
const wrapEl = ref(null)
const scrollable = ref(false)
let observer = null

function measure() {
  const el = wrapEl.value
  if (!el) return
  scrollable.value = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'function' && wrapEl.value) {
    observer = new ResizeObserver(measure)
    observer.observe(wrapEl.value)
  }
})

watch(rows, () => requestAnimationFrame(measure))

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.viz-table-wrap {
  overflow: auto;
  max-height: 360px;
  border-radius: 10px;
}

.viz-table-wrap.is-compact {
  max-height: 260px;
}

.viz-table-wrap:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.viz-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--viz-ink-1);
  font-size: 13px;
  line-height: 1.4;
}

.viz-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--viz-chart-surface, var(--viz-surface));
  box-shadow: inset 0 -1px 0 var(--viz-grid);
  color: var(--viz-ink-2);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.viz-table th,
.viz-table td {
  padding: 7px 10px;
  text-align: left;
  vertical-align: top;
}

.viz-table tbody tr + tr > * {
  border-top: 1px solid var(--viz-grid);
}

.viz-table tbody th {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.viz-table .is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.viz-table .is-text {
  text-align: left;
}

.viz-table td.is-word {
  color: var(--viz-ink-2);
}

.viz-table tr.is-selected > * {
  background: var(--viz-nodata);
}

.viz-th-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.viz-th-btn:hover {
  color: var(--viz-ink-1);
}

.viz-th-btn:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
</style>
