<template>
  <div class="viz-stat">
    <span class="viz-stat-label">
      <span v-if="tone" class="viz-stat-dot" :style="{ background: tone }" aria-hidden="true"></span>
      {{ label }}
    </span>
    <span class="viz-stat-row">
      <span v-if="valueText !== null" class="viz-stat-value">{{ valueText }}</span>
      <span v-else class="viz-stat-state">{{ stateText }}</span>
      <svg
        v-if="sparkPaths"
        class="viz-stat-spark"
        width="64"
        height="20"
        viewBox="0 0 64 20"
        aria-hidden="true"
        focusable="false"
      >
        <path v-for="(d, i) in sparkPaths.lines" :key="i" :d="d" />
        <circle v-if="sparkPaths.last" :cx="sparkPaths.last.x" :cy="sparkPaths.last.y" r="2.5" />
      </svg>
    </span>
    <span v-if="deltaView" class="viz-stat-delta" :class="`is-${deltaView.tone}`">
      <component :is="deltaView.icon" :size="14" class="viz-stat-delta-icon" aria-hidden="true" />
      <!-- One line, so the text reads "+4.1 pts vs previous 30 days" with its space. -->
      <span class="viz-stat-delta-value">{{ deltaView.value }}</span> <span v-if="deltaView.label" class="viz-stat-delta-label">{{ deltaView.label }}</span>
    </span>
    <span v-if="hint" class="viz-stat-hint">{{ hint }}</span>
  </div>
</template>

<script setup>
// A headline number: label, value (or the state word when nothing was
// measured), an optional change against the previous period and an
// optional sparkline. The change wears the good or critical colour only
// together with its arrow and its signed text, never colour alone.
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Minus } from '@lucide/vue'
import { formatDelta, formatValue, toNumber } from '@/lib/charts/format'

const props = defineProps({
  label: { type: String, required: true },
  // A number (formatted by `kind`), text shown as is, or null (not measured).
  value: { type: [String, Number], default: null },
  // 'number' | 'percent' | 'count' | 'rank' | 'usd'
  kind: { type: String, default: 'number' },
  unit: { type: String, default: '' },
  stateText: { type: String, default: 'Not measured' },
  // { value, unit: 'pct' | 'pts' | 'rank', label, goodWhen: 'up' | 'down' }
  delta: { type: Object, default: null },
  hint: { type: String, default: '' },
  // A 7px identity dot before the label (a CSS colour, e.g. a gap class).
  tone: { type: String, default: '' },
  spark: { type: Array, default: null },
})

const valueText = computed(() => {
  const v = props.value
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string') return v
  const n = toNumber(v)
  if (n === null) return null
  return formatValue(n, { value: props.kind, unit: props.unit, compact: Math.abs(n) >= 10000 })
})

const deltaView = computed(() => {
  if (valueText.value === null || !props.delta) return null
  const n = toNumber(props.delta.value)
  const text = formatDelta(n, props.delta.unit || 'pct')
  if (text === null) return null
  const rounded = Math.round(n * 10) / 10
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat'
  const goodWhen = props.delta.goodWhen === 'down' ? 'down' : 'up'
  return {
    value: text,
    label: props.delta.label || '',
    icon: direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus,
    tone: direction === 'flat' ? 'flat' : direction === goodWhen ? 'good' : 'bad',
  }
})

const sparkPaths = computed(() => {
  const raw = Array.isArray(props.spark) ? props.spark.map(toNumber) : []
  const known = raw.filter((v) => v !== null)
  if (raw.length < 2 || !known.length) return null
  const min = Math.min(...known)
  const max = Math.max(...known)
  const span = max - min || 1
  // Ranks read better upward: #1 is the top of the line.
  const flip = props.kind === 'rank'
  const point = (v, i) => {
    const t = (v - min) / span
    return { x: 2 + (i * 60) / (raw.length - 1), y: 18 - (flip ? 1 - t : t) * 16 }
  }
  const lines = []
  let run = []
  let last = null
  raw.forEach((v, i) => {
    if (v === null) {
      if (run.length > 1) lines.push(run)
      run = []
      return
    }
    last = point(v, i)
    run.push(last)
  })
  if (run.length > 1) lines.push(run)
  const fmt = (n) => Math.round(n * 10) / 10
  return {
    lines: lines.map((pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`).join(' ')),
    last: last && { x: fmt(last.x), y: fmt(last.y) },
  }
})
</script>

<style scoped>
.viz-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--viz-surface);
}

.viz-stat-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--viz-ink-2);
  font-size: 13px;
  font-weight: 500;
}

.viz-stat-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.viz-stat-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
}

/* Large standalone figures keep proportional digits. */
.viz-stat-value {
  min-width: 0;
  color: var(--viz-ink-1);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.viz-stat-state {
  color: var(--viz-ink-2);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.5;
}

.viz-stat-spark {
  flex-shrink: 0;
  margin-bottom: 6px;
  overflow: visible;
}

.viz-stat-spark path {
  fill: none;
  stroke: var(--viz-other);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.viz-stat-spark circle {
  fill: var(--viz-cat-1);
  stroke: var(--viz-surface);
  stroke-width: 1.5;
}

.viz-stat-delta {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  line-height: 1.4;
}

.viz-stat-delta-icon {
  flex-shrink: 0;
}

.viz-stat-delta-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.viz-stat-delta-label {
  color: var(--viz-ink-2);
}

.viz-stat-delta.is-good {
  color: var(--viz-good);
}

.viz-stat-delta.is-bad {
  color: var(--viz-critical);
}

.viz-stat-delta.is-flat {
  color: var(--viz-ink-2);
}

.viz-stat-hint {
  color: var(--viz-ink-2);
  font-size: 12px;
}
</style>
