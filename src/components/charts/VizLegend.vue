<template>
  <ul class="viz-legend" :class="{ 'is-interactive': interactive }">
    <li v-for="item in items" :key="item.key" class="viz-legend-item">
      <button
        v-if="interactive"
        type="button"
        class="viz-legend-btn"
        :class="{ 'is-off': hidden.includes(item.key) }"
        :aria-pressed="hidden.includes(item.key) ? 'false' : 'true'"
        @click="emit('toggle', item.key)"
      >
        <span class="viz-legend-key viz-fill" :class="`is-${item.shape || 'dot'}`" :style="{ '--key': item.color }" aria-hidden="true"></span>
        <span class="viz-legend-label" :title="item.label">{{ item.label }}</span> <span v-if="hasValue(item)" class="viz-legend-value">{{ item.value }}</span>
      </button>
      <template v-else>
        <span class="viz-legend-key viz-fill" :class="`is-${item.shape || 'dot'}`" :style="{ '--key': item.color }" aria-hidden="true"></span>
        <span class="viz-legend-label" :title="item.label">{{ item.label }}</span> <span v-if="hasValue(item)" class="viz-legend-value">{{ item.value }}</span>
      </template>
    </li>
  </ul>
</template>

<script setup>
// The names beside the colours. Present for every chart with two or more
// series, so identity never rests on colour alone. The key mirrors the
// mark (a stroke for lines, a square for bars and areas, a dot for
// points); the text stays in ink, never in the series colour. Interactive
// items toggle a series off and on; the other series keep their colours.
defineProps({
  // [{ key, label, color, shape: 'dot' | 'line' | 'rect', value? }]
  items: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: false },
  hidden: { type: Array, default: () => [] },
})
const emit = defineEmits(['toggle'])

function hasValue(item) {
  return item.value !== undefined && item.value !== null && item.value !== ''
}
</script>

<style scoped>
.viz-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.viz-legend.is-interactive {
  gap: 2px 4px;
}

.viz-legend-item,
.viz-legend-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--viz-ink-1);
  font-size: 12px;
  line-height: 18px;
}

.viz-legend-btn {
  padding: 3px 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.viz-legend-btn:hover {
  background: var(--viz-nodata);
}

.viz-legend-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.viz-legend-btn.is-off .viz-legend-label,
.viz-legend-btn.is-off .viz-legend-value {
  color: var(--viz-ink-2);
  text-decoration: line-through;
}

.viz-legend-btn.is-off .viz-legend-key {
  opacity: 0.35;
}

.viz-legend-key {
  flex-shrink: 0;
  background: var(--key);
}

.viz-legend-key.is-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.viz-legend-key.is-rect {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.viz-legend-key.is-line {
  width: 14px;
  height: 2px;
  border-radius: 1px;
}

.viz-legend-label {
  overflow: hidden;
  max-width: 22ch;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viz-legend-value {
  color: var(--viz-ink-2);
  font-variant-numeric: tabular-nums;
}
</style>
