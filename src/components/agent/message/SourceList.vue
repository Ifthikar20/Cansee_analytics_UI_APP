<template>
  <div v-if="sources.length" class="ag-sources">
    <p class="ag-sources-label">Sources</p>
    <ul class="ag-sources-list">
      <li v-for="(s, i) in sources" :key="s.url">
        <a
          class="ag-source"
          :href="s.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          :title="s.title || s.url"
          @click="open(s.url, $event)"
        >
          <span class="ag-source-n ag-tnum">{{ i + 1 }}</span>
          <span class="ag-source-host">{{ s.host }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup>
// Web citations attached to the reply's text parts. A plain click opens the
// page in the browser pane; a modified click keeps the browser's behaviour.
import { useAgentPaneStore } from '@/stores/agentPane'

defineProps({
  sources: { type: Array, default: () => [] },
})

const pane = useAgentPaneStore()

function open(url, event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  pane.setReturnFocus(event.currentTarget)
  if (!pane.openUrl(url, { activate: true })) window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.ag-sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ag-sources-label {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 24px;
}

.ag-sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  height: 24px;
  padding: 0 8px 0 4px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  color: var(--ag-fg-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
}

.ag-source:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-source:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: var(--radius);
}

.ag-source-n {
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius);
  background: var(--ag-inline-code-bg);
  color: var(--ag-fg-3);
  font-size: 11px;
}

.ag-source-host {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-tnum {
  font-variant-numeric: tabular-nums;
}
</style>
