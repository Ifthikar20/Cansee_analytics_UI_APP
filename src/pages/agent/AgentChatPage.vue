<template>
  <AgentWorkspaceSplit class="ag-chat-page">
    <template #chat>
      <ChatPane
        :website-id="websiteId"
        :chat-id="chatId || null"
        :project-name="projectName"
        :initial-agent="initialAgent"
        :pane-dom-id="PANE_PANEL_ID"
        @created="onCreated"
      />
    </template>
    <template #pane="{ layout }">
      <BrowserPane :layout="layout" />
    </template>
  </AgentWorkspaceSplit>
</template>

<script setup>
// New chat (/projects/:websiteId/agent) and chat (/c/:chatId) share this
// instance: moving to the chat URL after the first message keeps the page,
// its composer and the pane. ?agent=<key> preselects an agent on a new chat;
// ?artifact=<id> opens that artifact in the pane.
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgentWorkspaceSplit from '@/components/agent/workspace/AgentWorkspaceSplit.vue'
import BrowserPane from '@/components/agent/browser/BrowserPane.vue'
import ChatPane from '@/components/agent/chat/ChatPane.vue'
import { PANE_PANEL_ID } from '@/components/agent/browser/ids'
import { AGENT_KEY_LIST } from '@/lib/agent/types'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAppStore } from '@/stores/app'

const props = defineProps({
  websiteId: { type: String, required: true },
  chatId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const store = useAgentStore()
const pane = useAgentPaneStore()
const app = useAppStore()

const chatKey = computed(() => props.chatId || 'new')

const projectName = computed(() => {
  const active = app.activeWebsite
  if (active && String(active.id) === String(props.websiteId)) return active.name || ''
  const found = (app.websites || []).find((w) => String(w.id) === String(props.websiteId))
  return found?.name || ''
})

const initialAgent = computed(() => {
  if (props.chatId) return null
  const key = typeof route.query.agent === 'string' ? route.query.agent : ''
  return AGENT_KEY_LIST.includes(key) ? key : null
})

const title = computed(() => {
  const chatTitle = props.chatId ? store.chats?.byId?.[props.chatId]?.title : ''
  return [chatTitle || 'New chat', projectName.value, 'Cansee'].filter(Boolean).join(' — ')
})

watch(title, (value) => {
  document.title = value
}, { immediate: true })

watch(
  () => props.websiteId,
  (wid) => {
    if (wid && store.websiteId !== String(wid)) Promise.resolve(store.init(wid)).catch(() => {})
  },
  { immediate: true }
)

// Bind the pane first: a chat created from this page was already rekeyed by
// the store, so binding its id keeps the tabs.
watch(
  [() => props.websiteId, chatKey],
  ([, key]) => {
    pane.bindChat(key)
    Promise.resolve(store.openChat(props.chatId || null)).catch(() => {})
  },
  { immediate: true }
)

// Suggestions only exist for a new chat's empty state; failures leave [].
watch(
  () => [props.websiteId, chatKey.value, store.websiteId],
  ([wid, key, storeWid]) => {
    if (key === 'new' && wid && storeWid === String(wid)) Promise.resolve(store.loadSuggestions()).catch(() => {})
  },
  { immediate: true }
)

watch(
  () => route.query.artifact,
  (id) => {
    if (typeof id !== 'string' || !id) return
    pane.openArtifact(id, { activate: true })
    const query = { ...route.query }
    delete query.artifact
    router.replace({ query, hash: route.hash })
  },
  { immediate: true }
)

function onCreated(chatId) {
  router.replace({ name: 'agent-chat', params: { websiteId: String(props.websiteId), chatId: String(chatId) } })
}

onBeforeUnmount(() => {
  if (typeof store.setViewingChat === 'function') store.setViewingChat(null)
})
</script>

<style scoped>
.ag-chat-page {
  height: 100%;
  min-height: 0;
}
</style>
