<template>
  <div ref="scroller" class="ag-thread" tabindex="0" :aria-busy="loading ? 'true' : 'false'">
    <div ref="column" class="ag-thread-col">
      <ChatEmptyState
        v-if="!messages.length && !loading && !loadError"
        :project-name="projectName"
        :agents="agents"
        :agent="agent"
        :suggestions="suggestions"
        :catalog="catalog"
        @pick-agent="emit('pick-agent', $event)"
        @use-suggestion="emit('use-suggestion', $event)"
      />

      <div v-else-if="!messages.length && loading" class="ag-thread-state" role="status">
        <AgSpinner :size="16" />
        <span>Loading the chat</span>
      </div>

      <div v-else-if="!messages.length && loadError" class="ag-thread-state is-error" role="alert">
        <p class="ag-thread-state-title">{{ loadError.title }}</p>
        <p v-if="loadError.body" class="ag-thread-state-body">{{ loadError.body }}</p>
        <div class="ag-thread-state-actions">
          <AgButton v-if="loadError.retry" size="xs" @click="emit('reload')">Try again</AgButton>
          <AgButton size="xs" variant="ghost" :to="{ name: 'agent-home', params: { websiteId: String(websiteId) } }">
            New chat
          </AgButton>
        </div>
      </div>

      <div v-else class="ag-log" role="log" aria-live="off" aria-label="Conversation">
        <div v-for="(m, i) in messages" :id="`m-${m.id}`" :key="m.id" class="ag-turn" :class="`is-${m.role}`">
          <template v-if="m.role === 'user'">
            <UserMessageEditor
              v-if="editingId === m.id"
              :text="userText(m)"
              :saving="editSaving"
              @save="emit('save-edit', { id: m.id, text: $event })"
              @cancel="emit('cancel-edit')"
            />
            <UserMessage
              v-else
              :message="m"
              :busy="busy"
              :can-edit="m.id === lastUserId && !busy"
              :siblings="siblings(m)"
              @edit="emit('edit', m.id)"
              @retry="emit('retry-send', m)"
              @branch="emit('branch', { id: m.id, dir: $event })"
            />
          </template>
          <AssistantMessage
            v-else
            :message="m"
            :run="runFor(m)"
            :website-id="websiteId"
            :project-name="projectName"
            :catalog="catalog"
            :busy="busy"
            :is-last="i === messages.length - 1"
            :siblings="siblings(m)"
            :pane-dom-id="paneDomId"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// The conversation scroller (role=log, not live: an announcer elsewhere
// speaks run updates). It stays pinned to the newest text while the user is
// at the bottom and lets go as soon as they scroll up.
import { computed, nextTick, ref, watch } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import AssistantMessage from '@/components/agent/message/AssistantMessage.vue'
import UserMessage from '@/components/agent/message/UserMessage.vue'
import UserMessageEditor from '@/components/agent/message/UserMessageEditor.vue'
import ChatEmptyState from './ChatEmptyState.vue'
import { runOf, siblingsOf } from './thread'
import { useStickToBottom } from '@/composables/agent/useStickToBottom'
import { useAgentStore } from '@/stores/agent'

const props = defineProps({
  chatKey: { type: String, required: true },
  websiteId: { type: [String, Number], required: true },
  messages: { type: Array, default: () => [] },
  projectName: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  // {title, body, retry} when the chat could not be loaded
  loadError: { type: Object, default: null },
  catalog: { type: Array, default: null },
  agents: { type: Array, default: () => [] },
  agent: { type: String, default: null },
  suggestions: { type: Array, default: () => [] },
  editingId: { type: String, default: null },
  editSaving: { type: Boolean, default: false },
  paneDomId: { type: String, default: '' },
})

const emit = defineEmits([
  'pick-agent',
  'use-suggestion',
  'edit',
  'save-edit',
  'cancel-edit',
  'retry-send',
  'branch',
  'reload',
])

const store = useAgentStore()
const scroller = ref(null)
const column = ref(null)
const stick = useStickToBottom(scroller, column)

const lastUserId = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    if (props.messages[i].role === 'user') return props.messages[i].id
  }
  return null
})

function runFor(message) {
  return runOf(store, message)
}

function siblings(message) {
  return siblingsOf(store, message)
}

function userText(message) {
  const part = (message.parts || []).find((p) => p && p.type === 'text')
  return part?.text || ''
}

// A new chat, or a message the user just sent, brings the view to the end.
watch(
  () => props.chatKey,
  () => nextTick(() => stick.scrollToBottom())
)

watch(
  () => {
    const last = props.messages[props.messages.length - 1]
    return last ? `${last.id}:${last.role}` : ''
  },
  (now, before) => {
    if (!now || now === before) return
    const last = props.messages[props.messages.length - 1]
    const prev = props.messages[props.messages.length - 2]
    if (last.role === 'user' || prev?.role === 'user') nextTick(() => stick.scrollToBottom())
  }
)

defineExpose({
  isAtBottom: stick.isAtBottom,
  scrollToBottom: (options) => stick.scrollToBottom(options),
  scrollToMessage(id) {
    const el = scroller.value?.querySelector(`#m-${CSS.escape(String(id))}`)
    el?.scrollIntoView({ block: 'start' })
  },
})
</script>

<style scoped>
.ag-thread {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--ag-scroll-thumb) transparent;
}

.ag-thread:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
  border-radius: 0;
}

.ag-thread-col {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  max-width: calc(var(--ag-col-max) + 56px);
  margin: 0 auto;
  padding: 24px 28px 28px;
}

.ag-log {
  display: flex;
  flex-direction: column;
}

.ag-turn {
  min-width: 0;
  scroll-margin-top: 16px;
}

.ag-turn + .ag-turn {
  margin-top: 28px;
}

.ag-thread-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1;
  min-height: 240px;
  color: var(--ag-fg-3);
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

.ag-thread-state-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 15px;
  font-weight: 500;
}

.ag-thread-state-body {
  max-width: 360px;
  margin: 0;
}

.ag-thread-state-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 640px) {
  .ag-thread-col {
    padding: 20px 16px 24px;
  }
}
</style>
