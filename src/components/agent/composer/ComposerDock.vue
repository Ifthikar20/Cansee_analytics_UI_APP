<template>
  <div class="ag-dock">
    <div class="ag-dock-inner">
      <div class="ag-dock-jump">
        <JumpToLatest :visible="showJump" @jump="emit('jump')" />
      </div>
      <StatusBanner
        :code="bannerCode"
        :allowance="store.status?.allowance || null"
        :detail="store.statusError?.message || ''"
        :checking="store.statusLoading"
        :status="store.status"
        @recheck="recheck"
      />
      <Composer
        ref="composer"
        v-model="text"
        :agent="agent"
        :agents="agents"
        :catalog="store.catalog"
        :busy="busy"
        :stopping="stopping"
        :blocked="blocked"
        :can-edit-last="canEditLast"
        @update:agent="emit('update:agent', $event)"
        @submit="submit"
        @stop="stop"
        @open-page="openPage"
        @edit-last="emit('edit-last')"
      />
    </div>
  </div>
</template>

<script setup>
// The composer and the banner above it, wired to the store: drafts per chat,
// send (creating the chat on the first message), stop, and the honest
// reason when the agent cannot answer.
import { computed, ref, watch } from 'vue'
import Composer from './Composer.vue'
import StatusBanner from './StatusBanner.vue'
import JumpToLatest from '@/components/agent/chat/JumpToLatest.vue'
import { errorInfo } from '@/components/agent/message/parts'
import { agentList } from '@/lib/agent/agentsMeta'
import { useComposerDraft } from '@/composables/agent/useComposerDraft'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  chatId: { type: String, default: null },
  websiteId: { type: [String, Number], required: true },
  agent: { type: String, default: null },
  busy: { type: Boolean, default: false },
  stopping: { type: Boolean, default: false },
  canEditLast: { type: Boolean, default: false },
  showJump: { type: Boolean, default: false },
})

const emit = defineEmits(['update:agent', 'sent', 'edit-last', 'jump'])

const BLOCKING = new Set(['agent_disabled', 'agent_not_configured', 'allowance_exceeded'])
const KNOWN = new Set([...BLOCKING, 'agent_unavailable', 'maintenance'])

const store = useAgentStore()
const pane = useAgentPaneStore()
const ui = useAgentUiStore()
const auth = useAuthStore()
const toast = useToast()

const composer = ref(null)
const text = ref('')
// The last refusal from a send, until the status says otherwise.
const sendError = ref('')

const draft = useComposerDraft(
  () => (auth.user?.id ? { uid: String(auth.user.id), wid: String(props.websiteId), cid: props.chatId || null } : null),
  text
)

const agents = computed(() => agentList(store.catalog, store.status))

const bannerCode = computed(() => {
  const s = store.status
  if (s) {
    if (s.enabled === false) return 'agent_disabled'
    if (s.configured === false) return 'agent_not_configured'
    if (s.allowance?.exceeded) return 'allowance_exceeded'
  }
  if (KNOWN.has(sendError.value)) return sendError.value
  if (s) {
    if (s.live_available === false) return 'agent_unavailable'
    if (s.allowance?.warning) return 'allowance_warning'
  } else if (store.statusError) {
    const code = store.statusError.code
    if (KNOWN.has(code)) return code
    // Nothing is known about the agent: say so, without blocking a send.
    return 'status_unknown'
  }
  return ''
})

const blocked = computed(() => BLOCKING.has(bannerCode.value))

// A refused send is cleared when the server's status no longer agrees.
watch(
  () => store.status,
  (s) => {
    if (!s || !sendError.value) return
    const still =
      (sendError.value === 'agent_disabled' && s.enabled === false) ||
      (sendError.value === 'agent_not_configured' && s.configured === false) ||
      (sendError.value === 'allowance_exceeded' && s.allowance?.exceeded) ||
      (sendError.value === 'agent_unavailable' && s.live_available === false)
    if (!still) sendError.value = ''
  }
)

// A failed POST leaves the optimistic message as send_failed with a code.
watch(
  () => {
    const st = store.chatState?.[props.chatId || 'new']
    const leaf = st?.leafId ? store.messages?.[st.leafId] : null
    return leaf && leaf.status === 'send_failed' ? leaf.error_code || leaf.send?.error?.code || '' : ''
  },
  (code) => {
    if (KNOWN.has(code)) sendError.value = code
  }
)

async function submit(value) {
  const body = String(value || '').trim()
  if (!body || props.busy || blocked.value) return
  const agent = props.agent || null
  text.value = ''
  draft.clear()
  emit('update:agent', null)
  try {
    const chatId = await store.send({ chatId: props.chatId || null, text: body, agent })
    emit('sent', { chatId, created: !props.chatId })
  } catch (error) {
    const info = errorInfo(error)
    if (!text.value) text.value = body
    if (agent) emit('update:agent', agent)
    if (KNOWN.has(info.code)) {
      sendError.value = info.code
      store.loadStatus()
    } else {
      toast.error(info.message || 'The message could not be sent. Try again.')
    }
    ui.announce(info.message || 'The message could not be sent.', 'assertive')
  }
}

function stop() {
  const key = props.chatId || 'new'
  Promise.resolve(store.stop(key)).catch(() => {})
  ui.announce('Stopping the agent')
}

function openPage() {
  pane.openNewTab()
}

function recheck() {
  sendError.value = ''
  store.loadStatus()
}

/** Put a prompt (and its agent) in the composer, e.g. from a suggestion. */
function fill(prompt, agent = undefined) {
  text.value = String(prompt || '')
  if (agent !== undefined) emit('update:agent', agent || null)
  focus()
}

function focus() {
  return composer.value?.focus()
}

defineExpose({ fill, focus })
</script>

<style scoped>
.ag-dock {
  flex-shrink: 0;
  padding: 0 16px 20px;
  background: var(--ag-pane-bg);
}

.ag-dock-inner {
  position: relative;
  width: 100%;
  max-width: calc(var(--ag-col-max) + 24px);
  margin: 0 auto;
}

.ag-dock-jump {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
}

@media (max-width: 640px) {
  .ag-dock {
    padding: 0 12px calc(12px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
