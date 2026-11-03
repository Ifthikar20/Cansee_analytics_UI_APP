<template>
  <div class="viz-tip" :style="{ left: `${x}px`, top: `${y}px`, transform }" aria-hidden="true">
    <p v-if="title" class="viz-tip-title">{{ title }}</p>
    <ul v-if="rows.length" class="viz-tip-rows">
      <li v-for="row in rows" :key="row.key" class="viz-tip-row">
        <span v-if="row.color" class="viz-tip-key viz-fill" :class="`is-${row.shape || 'line'}`" :style="{ background: row.color }"></span>
        <strong class="viz-tip-value">{{ row.text }}</strong> <span v-if="row.label" class="viz-tip-label">{{ row.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
// The hover and focus readout of a chart: one per position, every visible
// series listed, the value first in bold and the series name second, keyed
// by a short stroke (lines) or a square (bars). It only repeats what the
// table view and the live region already carry, so it is hidden from
// assistive tech. Positioned by the caller inside a relative container.
import { computed } from 'vue'

const props = defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  title: { type: String, default: '' },
  // [{ key, label, text, color, shape: 'line' | 'rect' }]
  rows: { type: Array, default: () => [] },
  // 'side': beside the point (flip puts it on the left); 'top' / 'bottom':
  // above or below it, aligned 'start' | 'center' | 'end' on the point.
  placement: { type: String, default: 'side' },
  flip: { type: Boolean, default: false },
  align: { type: String, default: 'center' },
})

const transform = computed(() => {
  if (props.placement === 'side') return props.flip ? 'translate(calc(-100% - 12px), -50%)' : 'translate(12px, -50%)'
  const tx = props.align === 'start' ? '-12px' : props.align === 'end' ? 'calc(-100% + 12px)' : '-50%'
  const ty = props.placement === 'bottom' ? '8px' : 'calc(-100% - 8px)'
  return `translate(${tx}, ${ty})`
})
</script>

<style scoped>
.viz-tip {
  position: absolute;
  z-index: 20;
  max-width: 260px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--popover);
  box-shadow: 0 4px 16px rgba(20, 20, 18, 0.08);
  color: var(--popover-foreground);
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
}

.viz-tip-title {
  color: var(--viz-ink-2);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.viz-tip-title + .viz-tip-rows {
  margin-top: 4px;
}

.viz-tip-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.viz-tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.viz-tip-key {
  flex-shrink: 0;
}

.viz-tip-key.is-line {
  width: 12px;
  height: 2px;
  border-radius: 1px;
}

.viz-tip-key.is-rect {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.viz-tip-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.viz-tip-label {
  overflow: hidden;
  color: var(--viz-ink-2);
  text-overflow: ellipsis;
}
</style>
