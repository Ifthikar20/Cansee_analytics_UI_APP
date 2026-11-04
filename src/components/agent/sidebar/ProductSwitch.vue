<script setup>
// "Agent | Analytics": two links drawn as the segmented control; they change
// the main area only (the sidebar is the same on both tabs). Agent returns
// to the project's last chat, else a new chat; Analytics returns to the
// project's board with no panel open. Agent is current on agent routes,
// Analytics on the board and its /dashboard entry, neither on Settings.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getLastChat } from '@/lib/agent/storage'
import { boardLocation } from '@/lib/board/links'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const auth = useAuthStore()

// The last chat lives in localStorage, which is not reactive, so the link
// is read again on every navigation.
const agentTo = computed(() => {
  void route.fullPath
  if (!props.websiteId) return { name: 'agent' }
  const params = { websiteId: props.websiteId }
  const uid = auth.user?.id
  const chatId = uid === undefined || uid === null || uid === '' ? null : getLastChat(String(uid), props.websiteId)
  return chatId ? { name: 'agent-chat', params: { ...params, chatId } } : { name: 'agent-home', params }
})
const analyticsTo = computed(() => (props.websiteId ? boardLocation(props.websiteId) : { name: 'dashboard' }))

const agent = computed(() => String(route.name || '').startsWith('agent'))
const analytics = computed(() => Boolean(route.meta?.board) || route.name === 'dashboard')
</script>

<template>
  <div class="ag-ps" role="group" aria-label="Product">
    <router-link
      :to="agentTo"
      class="ag-ps-item"
      :class="{ 'is-active': agent }"
      :aria-current="agent ? 'true' : undefined"
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
