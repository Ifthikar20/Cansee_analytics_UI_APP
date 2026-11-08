<template>
  <ul class="viz-scale" aria-label="Colour scale">
    <li v-for="bin in bins" :key="bin.label" class="viz-scale-item">
      <span class="viz-scale-swatch viz-fill" :style="{ background: `var(--viz-seq-${bin.level})` }" aria-hidden="true"></span>
      {{ bin.label }}
    </li>
    <li v-for="item in stateItems" :key="item.key" class="viz-scale-item">
      <span class="viz-scale-swatch viz-fill" :class="`is-${item.look}`" aria-hidden="true"></span>
      {{ item.label }}
    </li>
  </ul>
</template>

<script setup>
// The key under a heatmap or tile map: each bin as a swatch and its range
// (0-19%, #1-3), then a swatch and word for every state present and for
// cells with no data. "Not found" (measured, absent) wears a ring on the
// surface and "Not checked" the no-data fill, so the two never look alike
// without a word.
import { computed } from 'vue'
import { STATE_LABELS } from '@/lib/charts/spec'

const props = defineProps({
  // From binsFor(): [{ label, level }]
  bins: { type: Array, default: () => [] },
  // State keys present in what is drawn.
  states: { type: Array, default: () => [] },
  stateLabels: { type: Object, default: () => ({}) },
  // Whether some cell or tile has no value and no state.
  missing: { type: Boolean, default: false },
  missingLabel: { type: String, default: 'No data' },
})

const ORDER = ['named', 'not_found', 'not_checked', 'not_measured', 'not_configured', 'not_connected', 'failed', 'skipped']

const stateItems = computed(() => {
  const present = new Set(props.states)
  const items = ORDER.filter((state) => present.has(state)).map((state) => ({
    key: state,
    label: props.stateLabels[state] || STATE_LABELS[state],
    look: state === 'named' ? 'named' : state === 'not_found' ? 'absent' : 'nodata',
  }))
  if (props.missing) items.push({ key: '__missing', label: props.missingLabel, look: 'nodata' })
  return items
})
</script>

<style scoped>
.viz-scale {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  color: var(--viz-ink-2);
  font-size: 12px;
  line-height: 16px;
  list-style: none;
}

.viz-scale-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.viz-scale-swatch {
  flex-shrink: 0;
  width: 14px;
  height: 10px;
  border-radius: 2px;
}

.viz-scale-swatch.is-named {
  background: var(--viz-seq-3);
}

.viz-scale-swatch.is-absent {
  background: var(--viz-chart-surface, var(--viz-surface));
  box-shadow: inset 0 0 0 1px var(--viz-axis);
}

.viz-scale-swatch.is-nodata {
  background: var(--viz-nodata);
  box-shadow: inset 0 0 0 1px var(--viz-nodata-ring);
}
</style>
