<template>
  <span class="ag-agent-chip">
    <component :is="meta.icon" class="ag-agent-chip-icon" aria-hidden="true" />
    <span class="ag-agent-chip-name">{{ meta.name }}</span>
    <button
      v-if="removable"
      type="button"
      class="ag-agent-chip-remove"
      :aria-label="`Stop using ${meta.name}`"
      @click="emit('remove')"
    >
      <X aria-hidden="true" />
    </button>
  </span>
</template>

<script setup>
// The agent picked for the next message, shown inside the composer.
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { agentMeta } from '@/lib/agent/agentsMeta'

const props = defineProps({
  agent: { type: String, required: true },
  catalog: { type: Array, default: null },
  removable: { type: Boolean, default: true },
})

const emit = defineEmits(['remove'])

const meta = computed(() => agentMeta(props.agent, props.catalog))
</script>

<style scoped>
.ag-agent-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 26px;
  padding: 0 4px 0 8px;
  border: 1px solid var(--ag-tab-border);
  border-radius: var(--radius);
  background: var(--ag-tab-bg);
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.ag-agent-chip-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ag-accent);
}

.ag-agent-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-agent-chip-remove {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-3);
  cursor: pointer;
}

.ag-agent-chip-remove:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-agent-chip-remove:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 0;
  border-radius: var(--radius);
}

.ag-agent-chip-remove svg {
  width: 12px;
  height: 12px;
}
</style>
