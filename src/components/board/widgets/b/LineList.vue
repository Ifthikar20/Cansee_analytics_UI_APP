<script setup>
// A short list of text rows for a board card: the label on the left (one
// line, the full text on hover), its value or state word on the right. A
// measured value reads in the main ink, a state word in the muted one.
// Used where a bar would mean nothing (a Google place, a source, a file).
defineProps({
  // [{key, label, text, measured?: Boolean}]
  items: { type: Array, default: () => [] },
  // The list's accessible name.
  label: { type: String, default: '' },
  // Optional column words over the rows: {label, text}.
  head: { type: Object, default: null },
})
</script>

<template>
  <div class="wb-lines">
    <p v-if="head" class="wb-lines-head">
      <span>{{ head.label }}</span>
      <span>{{ head.text }}</span>
    </p>
    <ul class="wb-lines-list" role="list" :aria-label="label || undefined">
      <li v-for="row in items" :key="row.key" class="wb-lines-row">
        <span class="wb-lines-label" :title="row.label">{{ row.label }}</span>
        <span class="wb-lines-text" :class="{ 'is-none': !row.measured }">{{ row.text }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wb-lines {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wb-lines-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 2px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.wb-lines-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wb-lines-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 7px 0;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

.wb-lines-row:last-child {
  border-bottom: 0;
}

.wb-lines-label {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-lines-text {
  flex-shrink: 0;
  max-width: 55%;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-lines-text.is-none {
  color: var(--viz-ink-2);
}
</style>
