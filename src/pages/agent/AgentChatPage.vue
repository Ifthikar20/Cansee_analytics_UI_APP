<template>
  <AgentWorkspaceSplit class="ag-chat-page">
    <template #chat>
      <ChatPane
        ref="chatPane"
        :key="chatPaneKey"
        :website-id="websiteId"
        :chat-id="chatId || null"
        :project-name="projectName"
        :initial-agent="initialAgent"
        :pane-dom-id="PANE_PANEL_ID"
        @created="onCreated"
      />
      <!-- "Drafted from {tab}": shown above the composer, placed inside the
           chat column's composer dock once it is there. -->
      <Teleport v-if="draftNotice" :to="noticeTarget" :disabled="!noticeTarget">
        <div class="ag-drafted" :class="{ 'is-docked': noticeTarget }" role="status">
          <p class="ag-drafted-line">{{ draftNotice.line }}</p>
          <p v-if="draftNotice.limits" class="ag-drafted-limits">{{ draftNotice.limits }}</p>
        </div>
      </Teleport>
      <AgConfirmDialog
        v-model:open="firstResearchOpen"
        title="Run your first research?"
        :description="firstResearchIntro"
        confirm-label="Start research"
        busy-label="Starting"
        cancel-label="Not now"
        :busy="firstResearchBusy"
        @confirm="confirmFirstResearch"
        @cancel="declineFirstResearch"
      >
        <ol v-if="firstResearchPrompts.length" class="ag-first-research-prompts">
          <li v-for="(prompt, i) in firstResearchPrompts" :key="i">{{ prompt }}</li>
        </ol>
      </AgConfirmDialog>
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
// ?artifact=<id> opens that artifact in the pane; ?tab=<serp:…|page:…>
// opens one of the chat's captures once the chat has loaded.
//
// The first research from onboarding waits in useFirstResearch. A new chat
// opened with ?start=first-research sends it at once with the research
// agent; without the query (after the paywall, say) the page offers it.
//
// Ask the agent (lib/agent/askAgent.js) saves a drafted message as the new
// chat's draft and opens it with ?from=<tab>: the chat column mounts again
// so its composer reads the draft, the composer gets focus, and a status
// line says where the draft came from and what a reply may spend, until
// the user sends or leaves. Nothing is sent by itself.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgentWorkspaceSplit from '@/components/agent/workspace/AgentWorkspaceSplit.vue'
import BrowserPane from '@/components/agent/browser/BrowserPane.vue'
import ChatPane from '@/components/agent/chat/ChatPane.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import { PANE_PANEL_ID } from '@/components/agent/browser/ids'
import { pathMessages } from '@/components/agent/chat/thread'
import { errorInfo } from '@/components/agent/message/parts'
import { useFirstResearch } from '@/composables/agent/useFirstResearch'
import { useToast } from '@/composables/useToast'
import { ASK_FROM_LABELS } from '@/lib/agent/askAgent'
import { writerUnavailable } from '@/lib/agent/agentsMeta'
import { saveDraft } from '@/lib/agent/storage'
import { hidesUsd, meteredRuns, runsLeftText } from '@/lib/promptRuns'
import { AGENT_KEY_LIST, NEW_CHAT_KEY } from '@/lib/agent/types'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

// The agent that runs the research agents.
const FIRST_RESEARCH_AGENT = 'gap_analyst'
const START_FIRST_RESEARCH = 'first-research'
const CAPTURE_TAB = /^(serp|page):\S+$/

const props = defineProps({
  websiteId: { type: String, required: true },
  chatId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const store = useAgentStore()
const pane = useAgentPaneStore()
const ui = useAgentUiStore()
const app = useAppStore()
const auth = useAuthStore()
const toast = useToast()
const firstResearch = useFirstResearch()

const chatKey = computed(() => props.chatId || 'new')
// Bumped to mount the chat column again: its composer reads the saved
// draft when it mounts, which is how a failed first research lands there.
const chatPaneKey = ref(0)

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

/** Replace the route without these query keys. */
function dropQuery(...keys) {
  const query = { ...route.query }
  const present = keys.filter((key) => key in query)
  if (!present.length) return
  present.forEach((key) => delete query[key])
  router.replace({ query, hash: route.hash })
}

watch(
  () => route.query.artifact,
  (id) => {
    if (typeof id !== 'string' || !id) return
    pane.openArtifact(id, { activate: true })
    dropQuery('artifact')
  },
  { immediate: true }
)

// A capture lives in the chat's research, so it opens once the chat has
// loaded (the Findings page links here with ?tab=). A chat that failed to
// load, or no chat at all, just drops the query.
watch(
  () => {
    const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
    const st = props.chatId ? store.chatState?.[props.chatId] : null
    return [tab, props.chatId || '', Boolean(st?.loaded), Boolean(st?.error)]
  },
  ([tab, cid, loaded, failed]) => {
    if (!tab) return
    if (cid && !loaded && !failed) return
    if (cid && loaded && CAPTURE_TAB.test(tab) && typeof pane.openCapture === 'function') {
      pane.openCapture(tab, { activate: true })
    }
    dropQuery('tab')
  },
  { immediate: true }
)

function onCreated(chatId) {
  router.replace({ name: 'agent-chat', params: { websiteId: String(props.websiteId), chatId: String(chatId) } })
}

/* ── A draft handed over by Ask the agent (?from=<tab>) ── */

// The tab the shown draft came from, or '' when there is no notice.
const draftFrom = ref('')
const chatPane = ref(null)
const noticeTarget = ref(null)

function usd(value) {
  const n = Number(value)
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return ''
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// "Drafted from Pages. Review it, then send." and, muted, what one reply may
// spend (GET status/ limits and allowance; cap 0 = unlimited), plus why the
// preselected writer cannot start when the allowance does not cover it.
const draftNotice = computed(() => {
  if (!draftFrom.value) return null
  const status = store.status || null
  const parts = []
  const cap = usd(status?.limits?.run_cost_usd)
  if (hidesUsd(status)) {
    // Free accounts see their prompt runs, never dollars.
    const left = runsLeftText(meteredRuns(status?.prompt_runs))
    if (left) parts.push(`${left} this month.`)
  } else if (cap) {
    parts.push(`A reply stops once it has used ${cap} of AI allowance; the request already running finishes.`)
    const capUsd = Number(status?.allowance?.cap_usd)
    const spent = Number(status?.allowance?.spent_usd)
    if (capUsd > 0 && Number.isFinite(spent)) parts.push(`${usd(Math.max(0, capUsd - spent))} left this month.`)
  }
  const unavailable = initialAgent.value ? writerUnavailable(initialAgent.value, status) : ''
  if (unavailable) parts.push(unavailable)
  return {
    line: `Drafted from ${ASK_FROM_LABELS[draftFrom.value]}. Review it, then send.`,
    limits: parts.join(' '),
  }
})

// Place the notice in the chat column's composer dock, right above the
// composer; until the dock is there it renders after the chat column.
async function placeNotice() {
  await nextTick()
  const root = chatPane.value?.$el
  noticeTarget.value = (root && typeof root.querySelector === 'function' && root.querySelector('.ag-dock-inner')) || null
}

function clearDraftNotice() {
  draftFrom.value = ''
  noticeTarget.value = null
}

watch(
  () => route.query.from,
  (from) => {
    if (typeof from !== 'string' || !from) return
    if (!props.chatId && Object.prototype.hasOwnProperty.call(ASK_FROM_LABELS, from)) {
      draftFrom.value = from
      // Mount the chat column again: its composer reads the saved draft on mount.
      chatPaneKey.value += 1
      ui.focusComposer()
      placeNotice()
    }
    dropQuery('from')
  },
  { immediate: true }
)

// The notice stays for this visit of the new chat: sending (the first
// message shows in the thread), a chat id or another project ends it.
watch(
  () => [props.chatId || '', props.websiteId, pathMessages(store, 'new').length > 0],
  ([cid, , sent], before) => {
    if (!draftFrom.value) return
    if (cid || sent || (before && before[1] !== props.websiteId)) clearDraftNotice()
  }
)

watch(chatPaneKey, () => {
  if (draftFrom.value) placeNotice()
})

/* ── First research (from onboarding) ── */

const firstResearchOpen = ref(false)
const firstResearchEntry = ref(null)
const firstResearchBusy = ref(false)
let firstResearchSending = false

const firstResearchLines = computed(() => String(firstResearchEntry.value?.text || '').split('\n'))
// The message's own first line ("Research {brand} ({host}) on Google and
// the AI engines for these prompts:") introduces its numbered prompts.
const firstResearchIntro = computed(() => firstResearchLines.value[0] || '')
const firstResearchPrompts = computed(() =>
  firstResearchLines.value.map((line) => /^\d+\.\s+(.+)$/.exec(line)?.[1]?.trim()).filter(Boolean)
)

/** Send the stashed message as a new chat with the research agent. */
async function sendFirstResearch(entry) {
  if (!entry || firstResearchSending) return false
  firstResearchSending = true
  const wid = String(props.websiteId)
  try {
    // The engines chosen at onboarding limit this first research only.
    const cid = await store.send({
      chatId: null,
      text: entry.text,
      agent: FIRST_RESEARCH_AGENT,
      ...(entry.engines ? { engines: entry.engines } : {}),
    })
    if (String(props.websiteId) === wid && cid) {
      router.replace({ name: 'agent-chat', params: { websiteId: wid, chatId: String(cid) } })
    }
    return true
  } catch (error) {
    const message = errorInfo(error).message || 'The research could not be started. Try again.'
    toast.error(message)
    ui.announce(message, 'assertive')
    // Keep the message: it goes to the new chat's composer with the research
    // agent picked, so Send starts it again.
    const uid = auth.user?.id
    if (uid !== undefined && uid !== null) saveDraft(String(uid), wid, NEW_CHAT_KEY, entry.text)
    if (String(props.websiteId) === wid && !props.chatId) {
      router.replace({ name: 'agent-home', params: { websiteId: wid }, query: { agent: FIRST_RESEARCH_AGENT } })
      chatPaneKey.value += 1
    }
    return false
  } finally {
    firstResearchSending = false
  }
}

watch(
  () => [props.websiteId, props.chatId || '', String(store.websiteId ?? ''), route.query.start],
  ([wid, cid, storeWid, start]) => {
    if (cid || !wid || storeWid !== String(wid)) {
      firstResearchOpen.value = false
      return
    }
    if (firstResearchSending) return
    const wantsStart = start === START_FIRST_RESEARCH
    const entry = firstResearch.peek(wid)
    if (!entry) {
      if (wantsStart) dropQuery('start')
      return
    }
    if (wantsStart) {
      sendFirstResearch(firstResearch.take(wid))
    } else if (!firstResearchOpen.value) {
      firstResearchEntry.value = entry
      firstResearchOpen.value = true
    }
  },
  { immediate: true }
)

async function confirmFirstResearch() {
  if (firstResearchBusy.value) return
  const entry = firstResearch.take(props.websiteId)
  if (!entry) {
    firstResearchOpen.value = false
    return
  }
  firstResearchBusy.value = true
  try {
    await sendFirstResearch(entry)
  } finally {
    firstResearchBusy.value = false
    firstResearchOpen.value = false
  }
}

function declineFirstResearch() {
  firstResearch.discard()
  firstResearchEntry.value = null
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

/* The drafted-from notice sits in the composer dock, before the banner and
   the composer. Browsers without :has() show it under the composer. */
.ag-chat-page :deep(.ag-dock-inner:has(> .ag-drafted)) {
  display: flex;
  flex-direction: column;
}

.ag-drafted {
  margin: 0 16px 8px;
  padding: 10px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: var(--ag-composer-bg);
  font-size: 13px;
  line-height: 18px;
}

.ag-drafted.is-docked {
  order: -1;
  margin: 0 0 8px;
}

.ag-drafted-line {
  margin: 0;
  color: var(--ag-fg-1);
  font-weight: 500;
}

.ag-drafted-limits {
  margin: 2px 0 0;
  color: var(--ag-fg-3);
}

.ag-first-research-prompts {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 21px;
}

.ag-first-research-prompts li + li {
  margin-top: 4px;
}
</style>
