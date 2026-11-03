<template>
  <section
    class="ag-swarm"
    :class="[`is-${statusClass}`, { 'is-reduced': reduced, 'is-live': swarmLive }]"
    aria-label="Research agents"
  >
    <div class="ag-swarm-head" :class="{ 'has-rerun': rerunVisible }">
      <button
        type="button"
        class="ag-swarm-toggle"
        :aria-expanded="bodyOpen ? 'true' : 'false'"
        :aria-controls="bodyId"
        :aria-label="toggleName"
        @click="toggleBody"
      >
        <SwarmStatusMark :status="headMark" />
        <span class="ag-swarm-title ag-tnum" :class="{ 'is-shimmer': planningLive }">{{ header }}</span>
        <span class="ag-swarm-subtitle">{{ part.title || '' }}</span>
        <span class="ag-swarm-count ag-tnum">{{ countText }}</span>
        <span v-if="rerunVisible" class="ag-swarm-head-slot" aria-hidden="true"></span>
        <ChevronRight class="ag-swarm-chev" :size="16" aria-hidden="true" />
      </button>
      <SwarmRerunMenu
        v-if="rerunVisible"
        class="ag-swarm-head-rerun"
        :swarm-id="String(part.swarm_id)"
        :chat-id="chatId"
        :disabled="rerunDisabled"
        :tasks="part.scope === 'all' ? part.tasks : null"
      />
    </div>
    <div
      class="ag-swarm-progress"
      role="progressbar"
      aria-label="Agents finished"
      aria-valuemin="0"
      :aria-valuemax="counts.total"
      :aria-valuenow="counts.settled"
    >
      <span class="ag-swarm-progress-fill" :style="{ width: `${progress * 100}%` }"></span>
    </div>
    <div v-show="bodyOpen" :id="bodyId" class="ag-swarm-main">
      <p v-if="errorLine" class="ag-swarm-error">{{ errorLine }}</p>
      <p v-if="finished" class="ag-swarm-summary">
        <span class="ag-tnum">{{ summary }}</span>
        <button v-if="newer" type="button" class="ag-swarm-newer" @click="scrollToNewer">
          <ArrowDown :size="12" aria-hidden="true" />
          <span>Newer results below</span>
        </button>
        <AgButton
          v-if="offerRerunAll"
          class="ag-swarm-rerun-all"
          size="xs"
          :icon="RotateCw"
          :loading="rerunning"
          :disabled="rerunDisabled"
          :title="rerunDisabled ? BUSY_REASON : undefined"
          @click="rerunAll"
        >
          Re-run all agents
        </AgButton>
      </p>
      <div v-if="groups.length && (part.status !== 'error' || hasTasks)" class="ag-swarm-body">
        <SwarmCategory
          v-for="group in groups"
          :key="group.key"
          :group="group"
          :open="isCatOpen(group.key)"
          :id-base="idBase"
          :index-by-id="indexById"
          :waiting-by-id="waitingById"
          @toggle="toggleCat"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
// The research agents of one execution (a `swarm` part): a header with the
// run's state, a progress bar, and the agents grouped by category and prompt,
// each row with its live line, time and detail. Open while the agents work;
// the categories fold to one line each once they finish.
import { computed, onBeforeUnmount, provide, reactive, ref, watch } from 'vue'
import { ArrowDown, ChevronRight, RotateCw } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import SwarmCategory from './SwarmCategory.vue'
import SwarmRerunMenu from './SwarmRerunMenu.vue'
import SwarmStatusMark from './SwarmStatusMark.vue'
import { tableDomId } from './tableModel'
import {
  SWARM_TREE,
  groupTasks,
  headerText,
  isSwarmLive,
  progressRatio,
  rerunErrorText,
  summaryText,
  swarmCounts,
  waitingText,
} from './swarmView'
import { taskError } from '@/lib/agent/normalize'
import { LIVE_SWARM_STATUSES } from '@/lib/agent/types'
import { useToast } from '@/composables/useToast'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'

const BUSY_REASON = 'Wait for the current reply to finish.'
const COLLAPSE_DELAY_MS = 600

const props = defineProps({
  part: { type: Object, required: true },
  message: { type: Object, required: true },
  // The reply is streaming or its run is active.
  live: { type: Boolean, default: false },
  websiteId: { type: [String, Number], default: null },
  // The chat has an active run (any message).
  busy: { type: Boolean, default: false },
})

const agent = useAgentStore()
const pane = useAgentPaneStore()
const ui = useAgentUiStore()
const toast = useToast()

const idBase = computed(() => `ag-swarm-${props.message.id}-${props.part.id}`)
const bodyId = computed(() => `${idBase.value}-body`)

const tasks = computed(() => (Array.isArray(props.part.tasks) ? props.part.tasks.filter((t) => t && t.id) : []))
const tasksById = computed(() => new Map(tasks.value.map((t) => [t.id, t])))
const indexById = computed(() => Object.fromEntries(tasks.value.map((t, i) => [t.id, i])))
const groups = computed(() => groupTasks(props.part))
const counts = computed(() => swarmCounts(tasks.value))

const swarmLive = computed(() => isSwarmLive(props.part, props.live))
const hasTasks = computed(() => counts.value.total > 0)
// A swarm still marked planning or running in a reply that ended did not finish.
const settledOpen = computed(() => LIVE_SWARM_STATUSES.has(props.part.status) && !swarmLive.value)
const statusClass = computed(() => (settledOpen.value ? 'interrupted' : props.part.status || 'planning'))
const planningLive = computed(() => swarmLive.value && props.part.status === 'planning')
const finished = computed(() => !swarmLive.value && hasTasks.value)

const header = computed(() => headerText(props.part, counts.value, { live: props.live }))
const countText = computed(() => (counts.value.total ? `${counts.value.settled}/${counts.value.total}` : ''))
const toggleName = computed(() =>
  counts.value.total ? `${header.value}, ${counts.value.settled} of ${counts.value.total} finished` : header.value
)
const progress = computed(() => (props.part.status === 'planning' ? 0 : progressRatio(counts.value)))

const headMark = computed(() => {
  if (swarmLive.value) return 'running'
  if (props.part.status === 'done' || props.part.status === 'partial') return 'done'
  if (props.part.status === 'error') return 'failed'
  return 'stopped'
})

// Counts as shown: once the swarm stopped, its open agents count as stopped.
const summary = computed(() => {
  const c = { ...counts.value }
  if (!swarmLive.value) {
    c.stopped += c.queued + c.running
    c.queued = 0
    c.running = 0
  }
  return summaryText(c)
})

// The reason a plan was refused, or a run failed after the agents started
// (that part may carry no message: the reply's own error then explains).
const errorLine = computed(() => {
  if (props.part.status !== 'error') return ''
  const error = taskError(props.part.error)
  if (error && error.message) return error.message
  return hasTasks.value ? '' : 'The research agents could not start.'
})

const waitingById = computed(() => {
  const out = {}
  for (const task of tasks.value) {
    if (task.status === 'queued') out[task.id] = waitingText(task, tasksById.value)
  }
  return out
})

// ── Re-run ──

const chatId = computed(() => props.message.chat_id ?? null)
const swarmEnabled = computed(() => !(agent.status && agent.status.swarm && agent.status.swarm.enabled === false))
const rerunVisible = computed(() => swarmEnabled.value && Boolean(props.part.swarm_id) && chatId.value !== null)
const rerunDisabled = computed(() => {
  if (props.busy) return true
  try {
    return Boolean(chatId.value !== null && agent.isChatBusy(chatId.value))
  } catch {
    return false
  }
})
const rerunning = ref(false)
// A research that stopped before every agent ran can be run again in full.
const offerRerunAll = computed(
  () =>
    rerunVisible.value &&
    (props.part.status === 'interrupted' || settledOpen.value || (props.part.status === 'error' && hasTasks.value))
)

async function startRerun(scope, extra = {}) {
  if (rerunDisabled.value || rerunning.value || !rerunVisible.value) return
  rerunning.value = true
  try {
    await agent.rerunSwarm({ chatId: String(chatId.value), swarmId: String(props.part.swarm_id), scope, ...extra })
  } catch (error) {
    const text = rerunErrorText(error)
    toast.error(text)
    ui.announce(text, 'assertive')
  } finally {
    rerunning.value = false
  }
}

function rerunAll() {
  return startRerun('all')
}

function rerunTask(taskId) {
  return startRerun('task', { taskId })
}

// ── Newer versions ──

function visibleMessages() {
  try {
    return agent.visiblePath(chatId.value) || []
  } catch {
    return []
  }
}

// The newest results table of this swarm further down the visible thread.
const newer = computed(() => {
  const swarmId = props.part.swarm_id
  const version = Number(props.part.version) || 0
  if (!swarmId || chatId.value === null) return null
  let best = null
  for (const message of visibleMessages()) {
    for (const part of (message && message.parts) || []) {
      if (!part || part.type !== 'swarm_table' || part.swarm_id !== swarmId) continue
      const v = Number(part.version) || 0
      if (v > version && (!best || v > best.version)) best = { version: v, messageId: message.id, partId: part.id }
    }
  }
  return best
})

function scrollToNewer() {
  const target = newer.value
  if (!target) return
  const el = document.getElementById(tableDomId(target.messageId, target.partId))
  if (!el) return
  el.scrollIntoView({ behavior: reduced.value ? 'auto' : 'smooth', block: 'start' })
  if (typeof el.focus === 'function') el.focus({ preventScroll: true })
}

// ── Open state ──

const bodyOpen = ref(true)
// While the agents work every category is open; a finished swarm, and one
// reloaded after it finished, shows one line per category.
const catDefault = ref(swarmLive.value)
const catOpen = ref({})
let userToggled = false
let collapseTimer = 0

function isCatOpen(key) {
  return Object.prototype.hasOwnProperty.call(catOpen.value, key) ? catOpen.value[key] : catDefault.value
}

function toggleCat(key) {
  userToggled = true
  catOpen.value = { ...catOpen.value, [key]: !isCatOpen(key) }
}

function toggleBody() {
  userToggled = true
  bodyOpen.value = !bodyOpen.value
}

watch(swarmLive, (isLive, wasLive) => {
  clearTimeout(collapseTimer)
  if (!wasLive || isLive || userToggled) return
  collapseTimer = setTimeout(() => {
    if (userToggled) return
    catOpen.value = {}
    catDefault.value = false
  }, COLLAPSE_DELAY_MS)
})

// ── Reduced motion ──

const reduced = ref(false)
let motionQuery = null

function onMotionChange(event) {
  reduced.value = Boolean(event && event.matches)
}

try {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced.value = Boolean(motionQuery && motionQuery.matches)
  if (motionQuery && typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', onMotionChange)
} catch {
  motionQuery = null
}

onBeforeUnmount(() => {
  clearTimeout(collapseTimer)
  try {
    if (motionQuery && typeof motionQuery.removeEventListener === 'function') {
      motionQuery.removeEventListener('change', onMotionChange)
    }
  } catch {}
})

// ── Announcements (the tree itself is not a live region) ──

let announcedStart = false
watch(
  () => props.part.status,
  (next, previous) => {
    // The start is news when the part turns running here, or arrives running
    // with no agent finished yet (a re-run turn). A block mounted again
    // mid-run (another chat, then back) does not announce it a second time.
    const starting = previous !== undefined || counts.value.settled === 0
    if (next === 'running' && props.live && !announcedStart && starting) {
      announcedStart = true
      const n = counts.value.total
      ui.announce(`Research started: ${n} ${n === 1 ? 'agent' : 'agents'}`)
    }
    if (!LIVE_SWARM_STATUSES.has(previous) || LIVE_SWARM_STATUSES.has(next)) return
    if (next === 'done' || next === 'partial') ui.announce(`Research finished: ${summary.value}`)
    else if (next === 'cancelled') ui.announce('Research stopped')
    else if (next === 'interrupted') ui.announce('Research interrupted')
    else if (next === 'error') ui.announce(errorLine.value ? `${header.value}: ${errorLine.value}` : header.value, 'assertive')
  },
  { immediate: true }
)

// ── Tree context for rows and details ──

function openCapture(tabId, el) {
  if (!tabId) return
  pane.setReturnFocus(el || null)
  pane.openCapture(tabId, { activate: true })
}

function openUrl(url, el) {
  pane.setReturnFocus(el || null)
  pane.openUrl(url, { activate: true })
}

provide(
  SWARM_TREE,
  reactive({
    swarmLive,
    rerun: computed(() => ({ visible: rerunVisible.value, disabled: rerunDisabled.value, reason: BUSY_REASON })),
    findTask: (id) => tasksById.value.get(id) || null,
    openCapture,
    openUrl,
    rerunTask,
    // A row opened or closed counts as the user arranging the tree.
    noteToggle: () => {
      userToggled = true
    },
  })
)
</script>

<style scoped>
.ag-swarm {
  container-name: ag-swarm;
  container-type: inline-size;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: transparent;
  color: var(--ag-fg-1);
}

.ag-swarm-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
}

.ag-swarm-toggle {
  display: grid;
  grid-area: 1 / 1;
  grid-template-columns: 16px minmax(0, max-content) minmax(0, 1fr) auto 16px;
  column-gap: 10px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 44px;
  padding: 0 8px 0 14px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ag-swarm-head.has-rerun .ag-swarm-toggle {
  grid-template-columns: 16px minmax(0, max-content) minmax(0, 1fr) auto 28px 16px;
}

.ag-swarm-toggle:hover {
  background: var(--ag-row-hover);
}

.ag-swarm-toggle:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

/* The re-run button sits over the toggle's reserved slot. */
.ag-swarm-head-rerun {
  position: relative;
  z-index: 1;
  grid-area: 1 / 1;
  justify-self: end;
  margin-right: 34px;
}

.ag-swarm-title {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-swarm-title.is-shimmer {
  background: linear-gradient(90deg, var(--ag-fg-3) 0%, var(--ag-fg-1) 50%, var(--ag-fg-3) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ag-swarm-head-shimmer 1.8s linear infinite;
}

.ag-swarm-subtitle {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-swarm-count {
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
}

.ag-swarm-chev {
  color: var(--ag-fg-chevron);
  transition: transform 180ms var(--ag-ease);
}

.ag-swarm-toggle[aria-expanded='true'] .ag-swarm-chev {
  transform: rotate(90deg);
}

.ag-swarm-progress {
  height: 2px;
  overflow: hidden;
  background: var(--ag-divider);
}

.ag-swarm-progress-fill {
  display: block;
  height: 100%;
  background: var(--ag-fg-3);
  transition: width 300ms var(--ag-ease);
}

.ag-swarm.is-done .ag-swarm-progress-fill {
  background: var(--ag-accent);
}

.ag-swarm.is-partial .ag-swarm-progress-fill {
  background: var(--ag-warning);
}

.ag-swarm.is-error .ag-swarm-progress-fill {
  background: var(--ag-danger);
}

.ag-swarm.is-cancelled .ag-swarm-progress-fill,
.ag-swarm.is-interrupted .ag-swarm-progress-fill {
  background: var(--ag-fg-4);
}

.ag-swarm-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 0;
  padding: 8px 14px 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ag-swarm-newer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}

.ag-swarm-newer:hover {
  color: var(--ag-fg-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-swarm-newer:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-swarm-error {
  margin: 0;
  padding: 10px 14px 12px;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.ag-swarm-body {
  display: grid;
  gap: 2px;
  padding: 6px 6px 8px;
}

.ag-swarm.is-reduced .ag-swarm-progress-fill,
.ag-swarm.is-reduced .ag-swarm-chev {
  transition: none;
}

.ag-swarm.is-reduced .ag-swarm-title.is-shimmer {
  background: none;
  color: var(--ag-fg-1);
  animation: none;
}

@keyframes ag-swarm-head-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@container ag-swarm (max-width: 519px) {
  .ag-swarm-toggle {
    column-gap: 8px;
  }
}
</style>
