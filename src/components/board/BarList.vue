<script setup>
// A short list of labelled bars for a board card (board_ownership.md 2):
// label and value text on one line, a 6px bar under them. The bar is ink
// for you (`emphasis`) and gray for everything else. In a list that mixes
// the two, your row also wears the orange square, the board's one accent,
// so it is found at a glance; a list that is all yours needs no mark. A row
// with no measured value draws no bar and reads its state word in the
// muted ink.
// Rows are buttons only when the parent listens to `select`.
import { computed } from 'vue'

const props = defineProps({
  // [{key, label, value: Number|null, text: String, emphasis?: Boolean, hint?: String}]
  items: { type: Array, default: () => [] },
  // The value of a full bar; null means the largest value in the list.
  max: { type: Number, default: null },
  // The list's accessible name.
  label: { type: String, default: '' },
  // Declared so the component can tell whether a parent listens to `select`.
  onSelect: { type: Function, default: null },
})

defineEmits(['select'])

const measured = (value) => typeof value === 'number' && Number.isFinite(value)

const full = computed(() => {
  if (measured(props.max) && props.max > 0) return props.max
  const values = props.items.map((item) => item?.value).filter(measured)
  return values.length ? Math.max(...values) : 0
})

function width(value) {
  if (!full.value || value <= 0) return '0%'
  return `${Math.min(100, (value / full.value) * 100)}%`
}

// Yours among others: some rows are emphasised and some are not.
const mixed = computed(() => props.items.some((item) => item?.emphasis) && props.items.some((item) => !item?.emphasis))

const rows = computed(() =>
  props.items.map((item) => ({
    ...item,
    you: mixed.value && Boolean(item?.emphasis),
    measured: measured(item?.value),
    width: measured(item?.value) ? width(item.value) : '0%',
  })),
)
</script>

<template>
  <ul class="bd-bars" role="list" :aria-label="label || undefined">
    <li v-for="row in rows" :key="row.key" class="bd-bars-item">
      <component
        :is="onSelect ? 'button' : 'div'"
        :type="onSelect ? 'button' : undefined"
        class="bd-bars-row"
        :class="{ 'is-action': onSelect }"
        @click="onSelect && $emit('select', row.key)"
      >
        <span class="bd-bars-line">
          <span class="bd-bars-text">
            <span class="bd-bars-label">
              <span v-if="row.you" class="bd-bars-mark cs-mark" aria-hidden="true"></span>{{ row.label }}
            </span>
            <span v-if="row.hint" class="bd-bars-hint">{{ row.hint }}</span>
          </span>
          <span class="bd-bars-value" :class="{ 'is-none': !row.measured }">{{ row.text }}</span>
        </span>
        <span v-if="row.measured" class="bd-bars-track" aria-hidden="true">
          <span class="bd-bars-fill viz-fill" :class="{ 'is-you': row.emphasis }" :style="{ width: row.width }" />
        </span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.bd-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bd-bars-item {
  min-width: 0;
}

.bd-bars-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  padding: 6px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.bd-bars-row.is-action {
  margin: 0 -6px;
  width: calc(100% + 12px);
  padding: 6px;
  border-radius: var(--radius);
  cursor: pointer;
}

.bd-bars-row.is-action:hover {
  background: var(--ag-ghost-hover);
}

.bd-bars-row.is-action:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 0;
}

.bd-bars-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.bd-bars-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bd-bars-label {
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bd-bars-mark {
  margin-right: 7px;
  vertical-align: 2px;
}

.bd-bars-hint {
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bd-bars-value {
  flex-shrink: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  white-space: nowrap;
}

.bd-bars-value.is-none {
  color: var(--viz-ink-2);
}

.bd-bars-track {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--viz-nodata);
}

.bd-bars-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius);
  background: var(--viz-other);
}

.bd-bars-fill.is-you {
  background: var(--viz-cat-1);
}
</style>
