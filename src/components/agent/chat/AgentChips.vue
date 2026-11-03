<template>
  <div class="ag-chips" role="group" aria-label="Agents">
    <button
      v-for="a in agents"
      :key="a.key"
      type="button"
      class="ag-chip"
      :class="{ 'is-unavailable': a.unavailable }"
      :aria-pressed="a.key === agent ? 'true' : 'false'"
      :aria-disabled="a.unavailable ? 'true' : undefined"
      :title="a.unavailable || a.description || undefined"
      @click="pick(a)"
    >
      <component :is="a.icon" class="ag-chip-icon" aria-hidden="true" />
      <span class="ag-chip-name">{{ a.name }}</span>
      <span v-if="a.unavailable" class="ag-sr-only">: {{ a.unavailable }}</span>
    </button>
    <p v-if="note" class="ag-chips-note" aria-hidden="true">{{ note }}</p>
  </div>
</template>

<script setup>
// The four agents as chips; picking one sets the composer's agent. A writing
// agent the AI allowance cannot start is shown disabled, with the reason.
import { computed } from 'vue'

const props = defineProps({
  agents: { type: Array, default: () => [] },
  agent: { type: String, default: null },
})

const emit = defineEmits(['pick'])

function pick(a) {
  if (a.key === props.agent) emit('pick', null)
  else if (!a.unavailable) emit('pick', a.key)
}

function names(list) {
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]
}

// One line per reason ("A and B: Needs at least ..."); each chip also
// carries its own for screen readers.
const note = computed(() => {
  const byReason = new Map()
  for (const a of props.agents) {
    if (!a || !a.unavailable) continue
    if (!byReason.has(a.unavailable)) byReason.set(a.unavailable, [])
    byReason.get(a.unavailable).push(a.name)
  }
  return [...byReason].map(([reason, list]) => `${names(list)}: ${reason}`).join(' ')
})
</script>

<style scoped>
/* Two by two: four names never fit one row of the 520-640px column. */
.ag-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  max-width: 420px;
}

.ag-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 34px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 10px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ag-chip:hover {
  background: var(--ag-btn-hover);
}

.ag-chip[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--ag-accent) 55%, var(--ag-btn-border));
  background: var(--ag-you-bg);
}

.ag-chip:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 10px;
}

.ag-chip-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--ag-accent);
}

.ag-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-chip.is-unavailable {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-chip.is-unavailable:hover {
  background: var(--ag-btn-bg);
}

.ag-chip.is-unavailable .ag-chip-icon {
  color: var(--ag-fg-disabled);
}

.ag-chips-note {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}

@media (max-width: 400px) {
  .ag-chips {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
