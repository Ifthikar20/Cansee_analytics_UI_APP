<template>
  <div class="ag-chat">
    <ChatHeader
      :chat-id="chatId"
      :website-id="websiteId"
      :title="title"
      :project-name="projectName"
      :messages="messages"
    />
    <ChatThread
      ref="thread"
      :chat-key="chatKey"
      :website-id="websiteId"
      :messages="messages"
      :project-name="projectName"
      :busy="busy"
      :loading="loading"
      :load-error="loadError"
      :catalog="store.catalog"
      :agents="agents"
      :agent="agent"
      :suggestions="store.suggestions"
      :editing-id="editingId"
      :edit-saving="editSaving"
      :pane-dom-id="paneDomId"
      @pick-agent="setAgent"
      @use-suggestion="useSuggestion"
      @edit="startEdit"
      @save-edit="saveEdit"
      @cancel-edit="cancelEdit"
      @retry-send="retrySend"
      @branch="switchBranch"
      @reload="reload"
    />
    <ComposerDock
      ref="dock"
      :chat-id="chatId"
      :website-id="websiteId"
      :agent="agent"
      :busy="busy"
      :stopping="stopping"
      :can-edit-last="canEditLast"
      :show-jump="Boolean(messages.length) && !atBottom"
      @update:agent="setAgent"
      @sent="onSent"
      @edit-last="editLast"
      @jump="thread?.scrollToBottom({ behavior: 'smooth' })"
    />
  </div>
</template>

<script setup>
// The chat column: header, conversation and composer for one chat (or the
// new-chat state), all read from the agent store. The workspace split wraps
// it in the labelled chat section.
import { computed, ref, watch } from 'vue'
import ChatHeader from './ChatHeader.vue'
import ChatThread from './ChatThread.vue'
import ComposerDock from '@/components/agent/composer/ComposerDock.vue'
import { activeRunOf, chatStateOf, isBusy, pathMessages } from './thread'
import { errorInfo } from '@/components/agent/message/parts'
import { agentList } from '@/lib/agent/agentsMeta'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  websiteId: { type: String, required: true },
  chatId: { type: String, default: null },
  projectName: { type: String, default: '' },
  // Agent to preselect (from ?agent= on a new chat).
  initialAgent: { type: String, default: null },
  paneDomId: { type: String, default: '' },
})

const emit = defineEmits(['created'])

const store = useAgentStore()
const ui = useAgentUiStore()
const toast = useToast()

const thread = ref(null)
const dock = ref(null)
const agent = ref(props.initialAgent || null)
const editingId = ref(null)
const editSaving = ref(false)

const chatKey = computed(() => props.chatId || 'new')
const messages = computed(() => pathMessages(store, chatKey.value))
const state = computed(() => chatStateOf(store, chatKey.value))
const busy = computed(() => isBusy(store, chatKey.value))
const run = computed(() => activeRunOf(store, chatKey.value))
const stopping = computed(() => Boolean(run.value && (run.value.phase === 'cancelling' || run.value.cancelRequested)))
const loading = computed(() => Boolean(props.chatId && (!state.value || state.value.loading) && !state.value?.loaded))
const agents = computed(() => agentList(store.catalog))
const atBottom = computed(() => thread.value?.isAtBottom ?? true)

const title = computed(() => {
  if (!props.chatId) return ''
  return store.chats?.byId?.[props.chatId]?.title || ''
})

const loadError = computed(() => {
  const error = state.value?.error
  if (!error || state.value?.loaded) return null
  if (error.status === 404) {
    return { title: "This chat doesn't exist or was deleted.", body: '', retry: false }
  }
  return { title: 'This chat could not be loaded.', body: error.message || '', retry: true }
})

const lastUser = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') return messages.value[i]
  }
  return null
})

const canEditLast = computed(() => Boolean(lastUser.value) && !busy.value && lastUser.value.status !== 'sending')

watch(
  () => props.initialAgent,
  (key) => {
    if (key) agent.value = key
  }
)

watch(chatKey, () => {
  editingId.value = null
})

function setAgent(key) {
  agent.value = key || null
  if (key) dock.value?.focus()
}

function useSuggestion(suggestion) {
  dock.value?.fill(suggestion.prompt, suggestion.agent || null)
}

function startEdit(id) {
  if (busy.value) return
  editingId.value = id
}

function editLast() {
  if (lastUser.value) startEdit(lastUser.value.id)
}

function cancelEdit() {
  editingId.value = null
  ui.focusComposer()
}

async function saveEdit({ id, text }) {
  if (editSaving.value) return
  editSaving.value = true
  try {
    await store.editMessage(id, text)
    editingId.value = null
    ui.focusComposer()
  } catch (error) {
    const info = errorInfo(error)
    toast.error(info.message || 'The message could not be edited.')
    ui.announce(info.message || 'The message could not be edited.', 'assertive')
  } finally {
    editSaving.value = false
  }
}

function retrySend(message) {
  Promise.resolve(store.retrySend(message.id)).catch(() => {})
}

async function switchBranch({ id, dir }) {
  try {
    await store.switchBranch(id, dir)
  } catch (error) {
    toast.error(errorInfo(error).message || 'That version could not be loaded.')
  }
}

function reload() {
  if (props.chatId) store.openChat(props.chatId, { force: true })
}

function onSent({ chatId, created }) {
  if (created && chatId) emit('created', chatId)
}
</script>

<style scoped>
.ag-chat {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--ag-pane-bg);
}
</style>
