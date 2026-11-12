<template>
  <button v-if="host" type="button" class="ag-open-chip" :title="url" @click="open">
    <Globe class="ag-open-chip-icon" aria-hidden="true" />
    <span class="ag-open-chip-title">{{ title || host }}</span>
    <span v-if="title" class="ag-open-chip-host">{{ host }}</span>
    <ArrowUpRight class="ag-open-chip-go" aria-hidden="true" />
  </button>
</template>

<script setup>
// A `browser_open` part: the agent suggests a page. Nothing opens until the
// user clicks; then it opens as a tab in the browser pane.
import { computed } from 'vue'
import { ArrowUpRight, Globe } from '@lucide/vue'
import { hostOf } from '@/lib/agent/url'
import { useAgentPaneStore } from '@/stores/agentPane'

const props = defineProps({
  url: { type: String, default: '' },
  title: { type: String, default: '' },
})

const pane = useAgentPaneStore()
const host = computed(() => hostOf(props.url))

function open(event) {
  pane.setReturnFocus(event.currentTarget)
  pane.openUrl(props.url, { activate: true })
}
</script>

<style scoped>
.ag-open-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-open-chip:hover {
  background: var(--ag-ghost-hover);
}

.ag-open-chip:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: var(--radius);
}

.ag-open-chip-icon,
.ag-open-chip-go {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ag-fg-3);
}

.ag-open-chip-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-open-chip-host {
  flex-shrink: 0;
  color: var(--ag-fg-3);
  font-weight: 400;
}
</style>
