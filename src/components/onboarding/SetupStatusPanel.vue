<script setup>
// The first page after setup (gaps.json, "First page after setup"): a panel
// at the top of the analytics board that says what is happening.
//   1. The first research while it runs: its step, how many research agents
//      finished, which engine is asking which prompt, a waiting line while
//      it waits for a free slot, and a link to it in the Agent.
//   2. What is not set up and why, in the server's words; a setting name
//      only when the server sent one (staff and DEBUG servers).
//   3. Next steps once the research is over: view it, turn on Autopilot,
//      add prompts.
// It shows on the first landings after onboarding and whenever setup is
// missing. Close it once everything is set up and the research finished;
// fold it to one line at any time. Both are remembered per project.
//
// `setup` is reactive(useSetupStatus(...)) from the board page, which also
// points empty cards here (SetupPointer). The panel fetches nothing itself
// apart from Check again, which reloads the agent store's status.
import { computed, nextTick, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertCircle, ArrowRight, Check, CircleDashed, Info, X } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { TIPS } from '@/lib/help/tips'
import { STAGES } from '@/lib/setup/status'

const props = defineProps({
  setup: { type: Object, required: true },
})
const emit = defineEmits(['add-prompts'])

const uid = useId()
const titleId = `ss-title-${uid}`
const bodyId = `ss-body-${uid}`
const rootEl = ref(null)
const headingEl = ref(null)

const research = computed(() => props.setup.research)
const panel = computed(() => props.setup.panel)
const issues = computed(() => props.setup.issues || [])
const missing = computed(() => issues.value.filter((i) => i.severity !== 'info'))
const collapsed = computed(() => Boolean(props.setup.collapsed))

const showResearch = computed(() => research.value.state !== 'none')
const live = computed(() => research.value.live)
const stageIndex = computed(() => STAGES.findIndex((s) => s.key === research.value.stage))
const showStages = computed(() => ['queued', 'running', 'done'].includes(research.value.state) && stageIndex.value >= 0)

function stageState(index) {
  if (research.value.state === 'done') return 'done'
  if (index < stageIndex.value) return 'done'
  if (index === stageIndex.value) return 'current'
  return 'pending'
}

const STAGE_WORDS = { done: 'done', current: 'in progress', pending: 'not started' }

const showBar = computed(() => live.value || research.value.state === 'done')
const determinate = computed(() => typeof research.value.progress === 'number')
const percent = computed(() => (determinate.value ? Math.round(Math.max(0, Math.min(1, research.value.progress)) * 100) : null))

const chatLink = computed(() => {
  const cid = props.setup.chatId
  const wid = props.setup.websiteId
  return cid && wid ? { name: 'agent-chat', params: { websiteId: String(wid), chatId: String(cid) } } : null
})

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// The one line the header shows, folded or not.
const summary = computed(() => {
  const r = research.value
  if (r.live) return r.title
  if (missing.value.length) return `${plural(missing.value.length, 'thing', 'things')} not set up on this workspace.`
  if (r.state !== 'none' && r.state !== 'loading') return r.title
  if (props.setup.statusKnown) return 'Everything is set up.'
  if (props.setup.statusFailed) return "We couldn't check your setup."
  return 'Checking your setup'
})

const tone = computed(() => {
  const r = research.value
  if (r.live) return 'live'
  if (missing.value.some((i) => i.severity === 'blocking') || r.state === 'failed') return 'bad'
  if (missing.value.length || r.state === 'stopped' || r.state === 'unknown' || r.state === 'missing') return 'warn'
  if (props.setup.statusKnown) return 'good'
  return 'muted'
})

function issueIcon(severity) {
  if (severity === 'blocking') return AlertCircle
  if (severity === 'limited') return CircleDashed
  return Info
}

function toggle() {
  props.setup.setCollapsed(!collapsed.value)
}

function dismiss() {
  props.setup.dismiss()
}

function runStep(step) {
  if (step.action === 'add-prompts') emit('add-prompts')
}

/** Unfold the panel, bring it into view and give its heading focus (empty cards' Show setup). */
async function show() {
  if (collapsed.value) props.setup.setCollapsed(false)
  await nextTick()
  const root = rootEl.value
  if (!root) return
  if (typeof root.scrollIntoView === 'function') root.scrollIntoView({ block: 'nearest' })
  headingEl.value?.focus({ preventScroll: true })
}

defineExpose({ show })
</script>

<template>
  <section
    v-if="panel.visible"
    ref="rootEl"
    class="ss"
    :class="[`is-${tone}`, { 'is-collapsed': collapsed }]"
    :aria-labelledby="titleId"
    data-setup-panel
  >
    <header class="ss-head">
      <span class="ss-mark" aria-hidden="true"></span>
      <div class="ss-heading">
        <h2 :id="titleId" ref="headingEl" class="ss-title" tabindex="-1">Setup</h2>
        <HelpTip :text="TIPS.setup.panel" label="About Setup" />
        <p class="ss-summary">{{ summary }}</p>
      </div>
      <div class="ss-head-actions">
        <AgButton
          size="xs"
          variant="ghost"
          :aria-expanded="collapsed ? 'false' : 'true'"
          :aria-controls="bodyId"
          @click="toggle"
        >
          {{ collapsed ? 'Show details' : 'Hide details' }}
        </AgButton>
        <AgIconButton
          v-if="panel.dismissible"
          label="Close setup"
          tooltip="Close. It stays closed for this project."
          :size="28"
          data-ss-dismiss
          @click="dismiss"
        >
          <X :size="14" aria-hidden="true" />
        </AgIconButton>
      </div>
    </header>

    <!-- Read out when the research moves to another step, never for each count. -->
    <p class="ss-sr" aria-live="polite">{{ showResearch ? research.title : '' }}</p>

    <div v-show="!collapsed" :id="bodyId" class="ss-body">
      <div v-if="showResearch" class="ss-block ss-research" :class="`is-${research.state}`">
        <h3 class="ss-block-title">First research</h3>
        <p class="ss-state" :class="{ 'is-shimmer': live }">{{ research.title }}</p>
        <p v-if="research.line" class="ss-line ag-tnum">{{ research.line }}</p>

        <ol v-if="showStages" class="ss-stages" aria-label="Research steps">
          <li v-for="(stage, i) in STAGES" :key="stage.key" class="ss-stage" :class="`is-${stageState(i)}`">
            <span class="ss-dot" aria-hidden="true"></span>
            <span class="ss-stage-label">{{ stage.label }}</span>{{ ' ' }}<span class="ss-sr">({{ STAGE_WORDS[stageState(i)] }})</span>
          </li>
        </ol>

        <div
          v-if="showBar"
          class="ss-bar"
          :class="{ 'is-indeterminate': !determinate }"
          role="progressbar"
          aria-label="Research progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="determinate ? percent : undefined"
          :aria-valuetext="determinate ? `${percent}%` : 'Working'"
        >
          <span class="ss-bar-fill" :style="determinate ? { width: `${percent}%` } : undefined"></span>
        </div>

        <ul v-if="research.asking.length" class="ss-asking" aria-label="Being asked now">
          <li v-for="ask in research.asking" :key="ask.id" class="ss-ask">
            <span class="ss-ask-who">{{ ask.prompt ? `${ask.who}:` : ask.who }}</span>{{ ' ' }}<span
              v-if="ask.prompt"
              class="ss-ask-prompt"
            >{{ ask.prompt }}</span>
          </li>
        </ul>

        <RouterLink v-if="chatLink && live" class="ss-link" :to="chatLink">
          Open in the Agent
          <ArrowRight :size="12" aria-hidden="true" />
        </RouterLink>
      </div>

      <div class="ss-block ss-config">
        <h3 class="ss-block-title">{{ missing.length ? 'Not set up yet' : 'Workspace' }}</h3>
        <p v-if="setup.statusFailed" class="ss-line" role="alert">We couldn't check your setup. Try again in a moment.</p>
        <p v-else-if="!setup.statusKnown" class="ss-line">Checking your setup</p>
        <p v-else-if="!issues.length" class="ss-line ss-ok">
          <Check :size="14" aria-hidden="true" />
          Google results, the AI engines and the research agents are set up.
        </p>
        <ul v-if="issues.length" class="ss-issues">
          <li v-for="issue in issues" :key="issue.key" class="ss-issue" :class="`is-${issue.severity}`">
            <component :is="issueIcon(issue.severity)" class="ss-issue-icon" :size="14" aria-hidden="true" />
            <div class="ss-issue-text">
              <p class="ss-issue-title">{{ issue.title }}</p>
              <p v-if="issue.action" class="ss-issue-action">{{ issue.action }}</p>
              <p v-if="issue.setting" class="ss-issue-setting">
                Setting: <code>{{ issue.setting }}</code>
              </p>
            </div>
          </li>
        </ul>
        <p v-if="setup.runsLine" class="ss-runs" :class="{ 'is-exhausted': setup.runsLine.exhausted }">
          <span class="ag-tnum">{{ setup.runsLine.text }}</span>
          <span v-if="setup.runsLine.renews" class="ss-runs-renews">{{ setup.runsLine.renews }}</span>
          <HelpTip :text="TIPS.setup.runs" label="About prompt runs" />
        </p>
        <div class="ss-actions">
          <AgButton size="xs" :loading="setup.checking" @click="setup.checkAgain()">Check again</AgButton>
        </div>
      </div>

      <div v-if="setup.steps.length" class="ss-block ss-next">
        <h3 class="ss-block-title">Next steps</h3>
        <ul class="ss-steps">
          <li v-for="step in setup.steps" :key="step.key" class="ss-step" :data-step="step.key">
            <div class="ss-step-text">
              <AgTooltip v-if="step.disabled" :text="step.reason">
                <AgButton size="sm" aria-disabled="true" :aria-describedby="`${bodyId}-${step.key}-why`">
                  {{ step.label }}
                </AgButton>
              </AgTooltip>
              <AgButton v-else-if="step.to" size="sm" :to="step.to">{{ step.label }}</AgButton>
              <AgButton v-else size="sm" @click="runStep(step)">{{ step.label }}</AgButton>
              <p class="ss-step-body">{{ step.body }}</p>
              <p v-if="step.disabled && step.reason" :id="`${bodyId}-${step.key}-why`" class="ss-step-why">
                Not available: {{ step.reason }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ss {
  --ss-tone: var(--ag-fg-4);
  box-sizing: border-box;
  margin: 0 0 16px;
  padding: 12px 16px 14px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.ss.is-live {
  --ss-tone: var(--ag-fg-2);
}

.ss.is-good {
  --ss-tone: var(--ag-accent);
}

.ss.is-warn {
  --ss-tone: var(--ag-warning);
}

.ss.is-bad {
  --ss-tone: var(--ag-danger);
}

.ss-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ss-mark {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 8px;
  border-radius: 50%;
  background: var(--ss-tone);
}

.ss.is-live .ss-mark {
  animation: ag-pulse 1.6s ease-in-out infinite;
}

.ss-heading {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 0;
}

.ss-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 24px;
}

.ss-title:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ss-summary {
  flex: 1 0 100%;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.ss-head-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.ss-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 16px 24px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ag-divider-subtle);
}

.ss-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.ss-block-title {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ss-state {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ss-state.is-shimmer {
  background: linear-gradient(90deg, var(--ag-fg-1) 0%, var(--ag-fg-1) 40%, var(--ag-fg-3) 50%, var(--ag-fg-1) 60%, var(--ag-fg-1) 100%);
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: ss-shimmer 2.4s linear infinite;
}

.ss-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 16px;
}

.ss-ok {
  color: var(--ag-fg-2);
}

.ss-ok svg {
  color: var(--ag-accent);
}

.ss-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.ss-stage {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ss-stage.is-current {
  color: var(--ag-fg-1);
}

.ss-dot {
  width: 6px;
  height: 6px;
  border: 1px solid var(--ag-fg-4);
  border-radius: 50%;
}

.ss-stage.is-done .ss-dot {
  border-color: var(--ag-accent);
  background: var(--ag-accent);
}

.ss-stage.is-current .ss-dot {
  border-color: var(--ag-fg-1);
  background: var(--ag-fg-1);
  animation: ag-pulse 1.2s ease-in-out infinite;
}

.ss-research.is-done .ss-stage.is-current .ss-dot {
  animation: none;
}

.ss-bar {
  position: relative;
  width: 100%;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--ag-divider);
}

.ss-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ag-fg-2);
  transition: width 300ms var(--ag-ease);
}

.ss-research.is-done .ss-bar-fill {
  background: var(--ag-accent);
}

.ss-bar.is-indeterminate .ss-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 35%;
  animation: ss-slide 1.4s var(--ag-ease) infinite;
}

.ss-asking {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ss-ask {
  display: flex;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
}

.ss-ask-who {
  flex: 0 0 auto;
  color: var(--ag-fg-1);
  font-weight: 500;
}

.ss-ask-prompt {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  color: var(--ag-fg-1);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ss-link:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ss-issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ss-issue {
  display: flex;
  gap: 8px;
}

.ss-issue-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--ag-fg-3);
}

.ss-issue.is-blocking .ss-issue-icon {
  color: var(--ag-danger);
}

.ss-issue.is-limited .ss-issue-icon {
  color: var(--ag-warning);
}

.ss-issue-text {
  min-width: 0;
}

.ss-issue-title,
.ss-issue-action,
.ss-issue-setting {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
}

.ss-issue-title {
  color: var(--ag-fg-1);
}

.ss-issue-action,
.ss-issue-setting {
  color: var(--ag-fg-3);
}

.ss-issue-setting code {
  padding: 0 4px;
  border: 1px solid var(--ag-code-border);
  border-radius: 4px;
  background: var(--ag-inline-code-bg);
  font-family: var(--ag-font-mono);
  font-size: 11px;
}

.ss-runs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  margin: 2px 0 0;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 16px;
}

.ss-runs.is-exhausted {
  color: var(--ag-warning);
}

.ss-runs-renews {
  color: var(--ag-fg-3);
}

.ss-actions {
  margin-top: 2px;
}

.ss-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ss-step-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.ss-step-body,
.ss-step-why {
  max-width: 48ch;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ss-step-why {
  color: var(--ag-fg-2);
}

.ss-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@keyframes ss-slide {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(300%);
  }
}

@keyframes ss-shimmer {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: -100% 0;
  }
}

/* No motion: the bar and the dots stay still, the text stays plain. */
@media (prefers-reduced-motion: reduce) {
  .ss.is-live .ss-mark,
  .ss-stage.is-current .ss-dot,
  .ss-bar.is-indeterminate .ss-bar-fill {
    animation: none;
  }

  .ss-bar.is-indeterminate .ss-bar-fill {
    width: 100%;
    opacity: 0.5;
  }

  .ss-state.is-shimmer {
    background: none;
    color: var(--ag-fg-1);
    animation: none;
  }

  .ss-bar-fill {
    transition: none;
  }
}
</style>
