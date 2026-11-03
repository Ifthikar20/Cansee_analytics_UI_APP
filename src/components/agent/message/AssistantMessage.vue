<template>
  <article class="ag-assistant" :aria-busy="live ? 'true' : 'false'" :aria-label="live ? 'Agent reply, in progress' : 'Agent reply'">
    <WorkedLabel
      :running="live"
      :status="message.status"
      :phase="run?.phase || ''"
      :transport="run?.transport?.state || ''"
      :retrying="Boolean(run?.retrying)"
      :started-at="startedAt"
      :ended-at="message.finished_at || null"
      :duration-ms="durationMs"
      :expandable="hasSteps"
      :expanded="stepsOpen"
      :controls="stepsId"
      @toggle="toggleSteps"
    />
    <StepTimeline
      v-if="hasSteps"
      v-show="stepsOpen"
      :id="stepsId"
      :steps="groups.steps"
      :checks="groups.checks"
      :live="live"
    />

    <div v-if="groups.body.length" class="ag-assistant-body">
      <template v-for="part in groups.body" :key="part.id">
        <MarkdownBlock v-if="part.type === 'text'" :text="part.text || ''" :streaming="live" />
        <ChartBlock v-else-if="part.type === 'chart'" :spec="part.spec" />
        <BrowserOpenChip v-else-if="part.type === 'browser_open'" :url="part.url || ''" :title="part.title || ''" />
        <NoticePart v-else-if="part.type === 'notice'" :level="part.level" :code="part.code || ''" :message="part.message || ''" />
      </template>
    </div>

    <SourceList v-if="!live && citations.length" class="ag-assistant-sources" :sources="citations" />

    <div v-if="groups.calls.length" class="ag-deliverables">
      <div v-for="call in groups.calls" :key="call.id" class="ag-deliverable">
        <AgentExecutedLine
          :agent="call.agent || ''"
          :agent-name="call.agent_name || ''"
          :status="call.status || ''"
          :catalog="catalog"
          :live="live"
        />
        <ArtifactCard
          v-if="call.artifact_id || call.status === 'error' || call.status === 'cancelled' || live"
          :artifact-id="call.artifact_id || null"
          :title="artifactTitle(call)"
          :kind="callKind(call)"
          :version="Number(call.version) || null"
          :base-version="Number(call.base_version) || null"
          :project-name="projectName"
          :status="call.status || ''"
          :progress="typeof call.progress === 'string' ? call.progress : ''"
          :error="call.error || null"
          :live="live"
          :expanded="isOpenInPane(call.artifact_id)"
          :controls="paneDomId"
          @open="openArtifact(call, $event)"
        />
      </div>
    </div>

    <MessageError
      v-if="failed"
      class="ag-assistant-error"
      :code="errorCode"
      :message="errorMessage"
      :status="message.status"
      :can-retry="canRetry"
      :retryable="serverRetryable"
      :website-id="websiteId"
      :busy="busy"
      @retry="retry"
    />

    <div v-if="message.status === 'truncated' && !live" class="ag-truncated">
      <p class="ag-truncated-text">The reply hit its length limit.</p>
      <AgButton size="xs" :icon="ArrowDownToLine" :disabled="busy" @click="continueReply">Continue</AgButton>
    </div>

    <MessageActions
      v-if="!live && !isTemp"
      class="ag-assistant-actions"
      :message="message"
      :website-id="websiteId"
      :busy="busy"
      :pinned="isLast"
      :can-regenerate="canRetry && !failed"
      :can-save="canSave"
      :siblings="siblings"
      @regenerate="retry"
      @branch="switchBranch"
    />
  </article>
</template>

<script setup>
// One assistant turn: "Working"/"Worked for Ns" with the step list, the reply
// (text, charts, suggested pages, notices) in arrival order, sub-agent
// deliverables, errors, and the actions row.
import { computed, ref, watch } from 'vue'
import { ArrowDownToLine } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgentExecutedLine from './AgentExecutedLine.vue'
import ArtifactCard from './ArtifactCard.vue'
import BrowserOpenChip from './BrowserOpenChip.vue'
import ChartBlock from './ChartBlock.vue'
import MarkdownBlock from './MarkdownBlock.vue'
import MessageActions from './MessageActions.vue'
import MessageError from './MessageError.vue'
import NoticePart from './NoticePart.vue'
import SourceList from './SourceList.vue'
import StepTimeline from './StepTimeline.vue'
import WorkedLabel from './WorkedLabel.vue'
import { errorInfo, messageCitations, messageText, splitParts } from './parts'
import { agentMeta } from '@/lib/agent/agentsMeta'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  message: { type: Object, required: true },
  run: { type: Object, default: null },
  websiteId: { type: [String, Number], required: true },
  projectName: { type: String, default: '' },
  catalog: { type: Array, default: null },
  // The chat has an active run (any message).
  busy: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  siblings: { type: Object, default: () => ({ index: 1, count: 1 }) },
  paneDomId: { type: String, default: '' },
})

const store = useAgentStore()
const pane = useAgentPaneStore()
const ui = useAgentUiStore()
const toast = useToast()

const LIVE_PHASES = new Set(['queued', 'running', 'cancelling'])

const live = computed(() => {
  if (props.message.status === 'streaming') return true
  return Boolean(props.run && LIVE_PHASES.has(props.run.phase))
})

const groups = computed(() => splitParts(props.message.parts))
const hasSteps = computed(() => groups.value.steps.length > 0 || groups.value.checks.length > 0)
const citations = computed(() => messageCitations(props.message))
const stepsId = computed(() => `ag-steps-${props.message.id}`)
const isTemp = computed(() => String(props.message.id).startsWith('temp'))

const startedAt = computed(() => props.run?.startedAt ?? props.message.started_at ?? props.message.created_at ?? null)
const durationMs = computed(() => {
  const d = props.message.duration_ms ?? props.run?.durationMs
  return Number.isFinite(Number(d)) && d !== null ? Number(d) : null
})

// Open while working; collapses when the reply finishes unless the user chose.
const userToggled = ref(false)
const stepsOpen = ref(live.value)
watch(live, (isLive) => {
  if (userToggled.value) return
  stepsOpen.value = isLive
})

function toggleSteps() {
  userToggled.value = true
  stepsOpen.value = !stepsOpen.value
}

const failed = computed(() => ['failed', 'interrupted'].includes(props.message.status) && !live.value)
const errorCode = computed(() => props.message.error_code || props.run?.error?.code || '')
const errorMessage = computed(() => props.message.error_message || props.run?.error?.message || '')
const canRetry = computed(() => !isTemp.value && props.message.status !== 'streaming')
// run.failed says whether trying again can help. A run settled on this side
// (the stream was lost) leaves the reply interrupted, and its flag is about
// the connection, not the reply, so it is not used.
const serverRetryable = computed(() => {
  const flag = props.run?.error?.retryable
  return props.message.status === 'failed' && typeof flag === 'boolean' ? flag : null
})
const canSave = computed(
  () => ['complete', 'truncated'].includes(props.message.status) && Boolean(messageText(props.message))
)

// What the call's agent writes. Empty while the orchestrator is still
// writing the call (no agent yet), so the card does not guess a kind.
function callKind(call) {
  return call.kind || agentMeta(call.agent, props.catalog).outputKind || ''
}

function artifactTitle(call) {
  const artifact = call.artifact_id ? store.artifact?.(call.artifact_id) : null
  return call.title || artifact?.draft?.title || artifact?.title || ''
}

function isOpenInPane(id) {
  if (!id) return false
  return pane.open && pane.activeId === `artifact:${id}`
}

function openArtifact(call, event) {
  if (!call.artifact_id) return
  pane.setReturnFocus(event?.currentTarget || null)
  pane.openArtifact(call.artifact_id, { activate: true, version: Number(call.version) || null })
}

async function runAction(action, failure) {
  try {
    await action()
  } catch (error) {
    const info = errorInfo(error)
    toast.error(info.message || failure)
    ui.announce(info.message || failure, 'assertive')
  }
}

function retry() {
  if (props.busy) return
  runAction(() => store.regenerate(props.message.id), 'The reply could not be regenerated.')
}

function continueReply() {
  if (props.busy) return
  runAction(() => store.continueMessage(props.message.id), 'The reply could not be continued.')
}

function switchBranch(dir) {
  runAction(() => store.switchBranch(props.message.id, dir), 'That version could not be loaded.')
}
</script>

<style scoped>
.ag-assistant {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ag-assistant-body {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.ag-assistant-body:first-child {
  margin-top: 0;
}

.ag-assistant-sources {
  margin-top: 16px;
}

.ag-deliverables {
  display: grid;
  gap: 20px;
  margin-top: 20px;
}

.ag-deliverable {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.ag-assistant-error {
  margin-top: 16px;
}

.ag-truncated {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.ag-truncated-text {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-assistant-actions {
  margin-top: 12px;
}
</style>
