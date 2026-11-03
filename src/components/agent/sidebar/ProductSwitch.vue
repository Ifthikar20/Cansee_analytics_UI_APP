<script setup>
// "Agent | Analytics": two links drawn as the segmented control; the side
// the sidebar shows is the current one. Analytics returns to the tab last
// used for this project (lib/analyticsNav.js), else the Overview.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { analyticsHomeRoute } from '@/lib/analyticsNav'

const props = defineProps({
  websiteId: { type: String, default: null },
  // 'agent' | 'analytics'
  side: { type: String, default: 'agent' },
})

const route = useRoute()

const agentTo = computed(() =>
  props.websiteId ? { name: 'agent-home', params: { websiteId: props.websiteId } } : { name: 'agent' },
)
// The tab memory lives in sessionStorage and changes only on analytics
// routes, so the link is read again on every navigation.
const analyticsTo = computed(() => {
  void route.fullPath
  return analyticsHomeRoute(props.websiteId)
})
const analytics = computed(() => props.side === 'analytics')
</script>

<template>
  <div class="ag-ps" role="group" aria-label="Product">
    <router-link
      :to="agentTo"
      class="ag-ps-item"
      :class="{ 'is-active': !analytics }"
      :aria-current="analytics ? undefined : 'true'"
    >Agent</router-link>
    <router-link
      :to="analyticsTo"
      class="ag-ps-item"
      :class="{ 'is-active': analytics }"
      :aria-current="analytics ? 'true' : undefined"
    >Analytics</router-link>
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
