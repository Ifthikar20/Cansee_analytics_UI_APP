<script setup>
// "Agent | Analytics": two links drawn as the segmented control. The agent
// workspace is always the current product here.
import { computed } from 'vue'

const props = defineProps({
  websiteId: { type: String, default: null },
})

const agentTo = computed(() =>
  props.websiteId ? { name: 'agent-home', params: { websiteId: props.websiteId } } : { name: 'agent' },
)
</script>

<template>
  <div class="ag-ps" role="group" aria-label="Product">
    <router-link :to="agentTo" class="ag-ps-item is-active" aria-current="true">Agent</router-link>
    <router-link :to="{ name: 'dashboard' }" class="ag-ps-item">Analytics</router-link>
  </div>
</template>

<style scoped>
.ag-ps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  box-sizing: border-box;
  height: 34px;
  margin-top: 12px;
  padding: 1px;
  border: 1px solid var(--ag-seg-border);
  border-radius: 8px;
  background: var(--ag-seg-track);
}

.ag-ps-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 30px;
  border-radius: 7px;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  text-decoration: none;
  white-space: nowrap;
  transition: color 120ms ease, background-color 120ms ease;
}

.ag-ps-item:hover {
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-ps-item.is-active {
  background: var(--ag-seg-thumb);
  box-shadow: var(--ag-seg-thumb-shadow);
  color: var(--ag-fg-1);
}

.ag-ps-item:focus-visible {
  border-radius: 7px;
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}
</style>
