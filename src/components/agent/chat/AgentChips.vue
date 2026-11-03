<template>
  <div class="ag-chips" role="group" aria-label="Agents">
    <button
      v-for="a in agents"
      :key="a.key"
      type="button"
      class="ag-chip"
      :aria-pressed="a.key === agent ? 'true' : 'false'"
      :title="a.description || undefined"
      @click="emit('pick', a.key === agent ? null : a.key)"
    >
      <component :is="a.icon" class="ag-chip-icon" aria-hidden="true" />
      <span class="ag-chip-name">{{ a.name }}</span>
    </button>
  </div>
</template>

<script setup>
// The four agents as chips; picking one sets the composer's agent.
defineProps({
  agents: { type: Array, default: () => [] },
  agent: { type: String, default: null },
})

const emit = defineEmits(['pick'])
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

@media (max-width: 400px) {
  .ag-chips {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
