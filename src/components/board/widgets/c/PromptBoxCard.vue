<template>
  <div class="pb">
    <CardSkeleton v-if="phase === 'loading'" :height="size === 'full' ? 176 : 260" />
    <div v-else-if="phase === 'failed'" class="pb-state" role="alert">
      <p class="pb-state-title">We couldn't load Ask AI.</p>
      <AgButton size="sm" @click="loadRuns">Try again</AgButton>
    </div>
    <div v-else class="pb-layout">
      <HintCallout hint="board.ask-ai" :when="!locked">
        <form class="pb-ask" novalidate @submit.prevent="ask">
          <label class="sr-only" :for="inputId">Question</label>
          <textarea
            :id="inputId"
            ref="inputEl"
            class="pb-input"
            rows="1"
            :value="text"
            :placeholder="COPY.placeholder"
            :disabled="locked"
            :aria-describedby="lineId"
            @input="onInput"
            @keydown="onKeydown"
            @compositionstart="ime.onCompositionstart"
            @compositionend="ime.onCompositionend"
          ></textarea>

          <div class="pb-controls">
            <div class="pb-group">
              <label class="pb-times">
                <span>Times per engine</span>
                <select v-model.number="samples" class="pb-select" :disabled="locked">
                  <option v-for="n in SAMPLE_CHOICES" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
              <HelpTip :text="TIPS.askAi.times" label="About Times per engine" />
            </div>
            <div v-if="engineOptions.length" class="pb-group">
              <div class="pb-chips" role="group" aria-label="Engines">
                <button
                  v-for="engine in engineOptions"
                  :key="engine.key"
                  type="button"
                  class="pb-chip"
                  :aria-pressed="isOn(engine.key) ? 'true' : 'false'"
                  :aria-disabled="locked || isLastOn(engine.key) ? 'true' : undefined"
                  @click="toggle(engine.key)"
                >
                  <Check v-if="isOn(engine.key)" class="pb-chip-check" :size="14" aria-hidden="true" />
                  {{ engine.label }}
                </button>
              </div>
              <HelpTip :text="TIPS.askAi.engines" label="About picking engines" />
            </div>
          </div>

          <div class="pb-go">
            <div class="pb-line-wrap">
              <p
                :id="lineId"
                class="pb-line"
                :class="{ 'is-pending': line.pending }"
                aria-live="polite"
                :aria-busy="line.pending ? 'true' : undefined"
              >{{ line.text }}</p>
              <HelpTip v-if="line.estimate" :text="TIPS.askAi.estimate" label="About this estimate" />
              <AgButton v-if="line.retry" size="xs" variant="ghost" @click="requestEstimate(true)">Try again</AgButton>
            </div>
            <AgButton type="submit" variant="primary" size="sm" :disabled="!canAsk" :loading="creating">Ask</AgButton>
          </div>

          <p v-if="costChanged" class="pb-note" role="alert">{{ COPY.costChanged }}</p>

          <section v-if="notice" class="pb-notice" role="alert" :aria-labelledby="noticeId">
            <p :id="noticeId" class="pb-notice-title">{{ COPY.requestTitle }}</p>
            <p class="pb-notice-body">{{ COPY.requestBody }}</p>
            <div class="pb-notice-actions">
              <AgButton size="sm" variant="primary" @click="handToAgent">Ask the agent</AgButton>
              <AgButton size="sm" :disabled="creating" @click="create">Ask the engines anyway</AgButton>
            </div>
          </section>

          <p v-if="askError" class="pb-error" role="alert">{{ askError }}</p>
        </form>
      </HintCallout>

      <section class="pb-result" :aria-labelledby="run ? questionId : undefined">
        <p v-if="!run" class="pb-intro">{{ COPY.intro }}</p>
        <template v-else>
          <h3 :id="questionId" class="pb-question">{{ run.text }}</h3>
          <div v-if="active" class="pb-progress">
            <p class="pb-progress-line" role="status">{{ progress }}</p>
            <AgButton size="sm" :loading="stopping" @click="stopRun">Stop</AgButton>
          </div>
          <p v-else-if="ended" class="pb-note">{{ ended }}</p>
          <p v-if="stopError" class="pb-error" role="alert">{{ stopError }}</p>

          <ul class="pb-engines" role="list">
            <li v-for="row in results" :key="row.key" class="pb-engine">
              <BarList :items="[row.item]" :max="100" :label="row.item.label" />
              <p v-if="row.rank" class="pb-note">{{ row.rank }}</p>
              <p v-if="row.failures" class="pb-note">{{ row.failures }}</p>
            </li>
          </ul>

          <div class="pb-after">
            <AgButton size="sm" variant="ghost" @click="readAnswers">Read the answers</AgButton>
            <TrackPrompt :website-id="websiteId" :run="run" :hint="!active && !viewer" />
          </div>
          <CardFoot>{{ footText }}</CardFoot>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
// Ask AI (autopilot_frontend.md 6c): a buyer's question, asked several
// times per engine, because one answer can misjudge a brand. The estimate
// for what is on screen comes first (400ms after a change); Ask and Enter
// do nothing until it has arrived, so the run sends exactly the `confirm`
// the user read. A question about the user's own data is steered to the
// agent. While a run asks, the card polls it and shows each engine's share
// of answers that name you, with its likely range; the answers open in the
// panel, and Track this prompt hands the question to Autopilot.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check } from '@lucide/vue'
import promptBoxApi from '@/api/promptBox'
import AgButton from '@/components/agent/common/AgButton.vue'
import BarList from '@/components/board/BarList.vue'
import CardFoot from '@/components/board/CardFoot.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import HintCallout from '@/components/ui/help/HintCallout.vue'
import { useImeSafeEnter } from '@/composables/agent/useImeSafeEnter'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { askAgent } from '@/lib/agent/askAgent'
import { isAgentRequest } from '@/lib/analytics/promptIntent'
import { useBoard, useCardStatus } from '@/lib/board/context'
import { engineMeta } from '@/lib/engines'
import { TIPS } from '@/lib/help/tips'
import TrackPrompt from './TrackPrompt.vue'
import {
  COPY,
  DEFAULT_SAMPLES,
  ESTIMATE_DELAY_MS,
  SAMPLE_CHOICES,
  endLine,
  engineResult,
  estimateBlocker,
  estimateLine,
  failureOf,
  normalizeQuestion,
  progressLine,
  questionReady,
  questionTooLong,
  withoutLineBreaks,
} from './specs'
import { noteRunAsked, usePromptBoxRun } from './usePromptBoxRun'

const props = defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'full' },
})

// Three lines of 20px, the padding and the border.
const MAX_INPUT_PX = 78

const board = useBoard()
const router = useRouter()
const overview = useBoardSource('overview')
const runner = usePromptBoxRun(() => props.websiteId)
const { run, active } = runner

const uid = useId()
const inputId = `${uid}-question`
const lineId = `${uid}-line`
const noticeId = `${uid}-notice`
const questionId = `${uid}-asked`
const inputEl = ref(null)

/* ── The latest run ── */

// 'loading' until the project's runs first answer, 'failed', or 'ready'.
const listState = ref('loading')
const phase = computed(() => listState.value)
// The chip in the card's corner. Ask AI is a tool: it is ready, and claims
// no numbers of its own.
useCardStatus(() => (phase.value === 'loading' ? 'loading' : phase.value === 'failed' ? 'error' : 'ready'))

async function loadRuns() {
  const wid = props.websiteId
  listState.value = 'loading'
  try {
    const res = await promptBoxApi.list(wid)
    if (wid !== props.websiteId) return
    const runs = Array.isArray(res?.data) ? res.data : []
    listState.value = 'ready'
    if (runs[0] && !run.value) runner.follow(runs[0].id, { initial: runs[0] })
  } catch {
    if (wid === props.websiteId) listState.value = 'failed'
  }
}

/* ── The question ── */

const text = ref('')
const samples = ref(DEFAULT_SAMPLES)
const question = computed(() => normalizeQuestion(text.value))

// The configured engines, from the board's overview; unknown until it answers.
const engineOptions = computed(() => {
  const list = overview.data.value?.engines
  if (!Array.isArray(list)) return []
  return list
    .filter((e) => e && e.configured)
    .map((e) => ({ key: String(e.key), label: e.label || engineMeta(e.key).label }))
})
const off = ref([])
const selected = computed(() => engineOptions.value.map((e) => e.key).filter((key) => !off.value.includes(key)))
const isOn = (key) => selected.value.includes(key)
const isLastOn = (key) => selected.value.length === 1 && selected.value[0] === key

function toggle(key) {
  if (locked.value) return
  if (off.value.includes(key)) off.value = off.value.filter((k) => k !== key)
  else if (!isLastOn(key)) off.value = [...off.value, key]
}

function requestBody() {
  const body = { text: question.value, samples: samples.value }
  if (engineOptions.value.length) body.engines = selected.value
  return body
}
const keyOf = (body) => JSON.stringify([body.text, body.samples, body.engines || null])
const key = computed(() => keyOf(requestBody()))

/* ── The estimate ── */

// {key, payload}: the last estimate, and what it was for.
const estimate = ref(null)
const estimateError = ref(null)
// The estimate answered 404: this user may read the project, not ask.
const viewer = ref(false)
let estimateTimer = null
let estimateToken = 0

const current = computed(() => (estimate.value && estimate.value.key === key.value ? estimate.value.payload : null))
const noEngines = computed(() => {
  const list = overview.data.value?.engines
  const none = Array.isArray(list) && !list.some((e) => e && e.configured)
  return none || estimateBlocker(current.value)?.code === 'not_configured'
})
const locked = computed(() => noEngines.value || viewer.value)

function eligible() {
  return Boolean(props.websiteId) && questionReady(text.value) && !locked.value
}

function requestEstimate(now = false) {
  clearTimeout(estimateTimer)
  estimateTimer = null
  if (!eligible()) return
  const send = () => {
    estimateTimer = null
    if (!eligible()) return
    const wid = props.websiteId
    const body = requestBody()
    const k = keyOf(body)
    const mine = ++estimateToken
    estimateError.value = null
    promptBoxApi.estimate(wid, body).then(
      (res) => {
        if (mine !== estimateToken || wid !== props.websiteId) return
        estimate.value = { key: k, payload: res?.data ?? null }
      },
      (err) => {
        if (mine !== estimateToken || wid !== props.websiteId) return
        const failure = failureOf(err)
        if (failure.status === 404) viewer.value = true
        else estimateError.value = { key: k, message: failure.message }
      },
    )
  }
  if (now) send()
  else estimateTimer = setTimeout(send, ESTIMATE_DELAY_MS)
}

// What is on screen changed: its estimate comes 400ms later, and an
// answer for what was there before is dropped.
watch(key, () => {
  estimateToken += 1
  estimateError.value = null
  costChanged.value = false
  askError.value = ''
  notice.value = false
  requestEstimate()
})

// The line under the controls: why nothing can be asked, else the cost of
// what is on screen. The last line stays (dimmed) while the next one loads.
const line = computed(() => {
  if (noEngines.value) return { text: COPY.noEngines }
  if (viewer.value) return { text: COPY.viewer }
  if (questionTooLong(text.value)) return { text: COPY.tooLong }
  if (!questionReady(text.value)) return { text: '' }
  if (estimateError.value && estimateError.value.key === key.value) return { text: estimateError.value.message, retry: true }
  const shown = estimate.value?.payload
  if (!shown) return { text: '', pending: true }
  const blocker = estimateBlocker(shown)
  if (blocker) return { text: blocker.message, pending: estimate.value.key !== key.value }
  return { text: estimateLine(shown), pending: estimate.value.key !== key.value, estimate: true }
})

/* ── Asking ── */

const creating = ref(false)
const costChanged = ref(false)
const askError = ref('')
// The request notice: the question reads as one about the user's own data.
const notice = ref(false)

const canAsk = computed(
  () =>
    Boolean(current.value?.can_run) &&
    !estimateBlocker(current.value) &&
    !(estimateError.value && estimateError.value.key === key.value) &&
    !locked.value &&
    questionReady(text.value) &&
    !active.value &&
    !creating.value &&
    !notice.value,
)

function ask() {
  if (!canAsk.value) return
  if (isAgentRequest(question.value)) {
    notice.value = true
    return
  }
  create()
}

async function create() {
  const confirmed = current.value
  if (!confirmed?.can_run || creating.value || active.value) return
  const wid = props.websiteId
  const body = { ...requestBody(), confirm: confirmed.confirm }
  notice.value = false
  askError.value = ''
  costChanged.value = false
  stopError.value = ''
  creating.value = true
  try {
    const res = await promptBoxApi.create(wid, body)
    noteRunAsked(wid)
    if (wid === props.websiteId) runner.show(res?.data ?? null)
  } catch (err) {
    if (wid !== props.websiteId) return
    const failure = failureOf(err)
    if (failure.code === 'estimate_changed' && failure.details?.estimate) {
      estimateToken += 1
      estimate.value = { key: keyOf(body), payload: failure.details.estimate }
      costChanged.value = true
    } else if (failure.status === 404) {
      viewer.value = true
    } else {
      askError.value = failure.message
      // A run already asking: show it. Anything else: the line's blockers again.
      if (failure.code === 'run_in_progress' && failure.details?.run_id) runner.follow(failure.details.run_id)
      else requestEstimate(true)
    }
  } finally {
    creating.value = false
  }
}

function handToAgent() {
  askAgent(router, { websiteId: props.websiteId, from: 'prompt-box', text: question.value })
}

/* ── The box ── */

const ime = useImeSafeEnter()

function onInput(event) {
  const raw = event.target.value
  const clean = withoutLineBreaks(raw)
  if (clean !== raw) event.target.value = clean
  text.value = clean
  fit()
}

// Enter asks; a line break never goes in.
function onKeydown(event) {
  if (event.key !== 'Enter' || ime.isComposing(event)) return
  event.preventDefault()
  ask()
}

// One line that grows to three, measured with the placeholder when empty.
function fit() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  let height = el.scrollHeight
  if (!el.value && el.placeholder) {
    el.value = el.placeholder
    height = el.scrollHeight
    el.value = ''
  }
  if (!height) {
    el.style.height = ''
    return
  }
  const border = el.offsetHeight - el.clientHeight
  const full = height + (border > 0 ? border : 0)
  el.style.height = `${Math.min(full, MAX_INPUT_PX)}px`
  el.style.overflowY = full > MAX_INPUT_PX ? 'auto' : 'hidden'
}

let observer = null
let lastWidth = 0
watch(inputEl, (el) => {
  observer?.disconnect()
  observer = null
  if (!el) return
  nextTick(fit)
  if (typeof ResizeObserver !== 'function') return
  observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width || 0
    if (width === lastWidth) return
    lastWidth = width
    fit()
  })
  observer.observe(el)
})

/* ── The run ── */

const progress = computed(() => progressLine(run.value))
const ended = computed(() => endLine(run.value))
const results = computed(() => (run.value?.engines || []).map((e) => engineResult(e, { active: active.value })))
const footText = computed(() => [COPY.stays, runner.stale.value ? COPY.staleNote : ''].filter(Boolean).join(' '))

const stopping = ref(false)
const stopError = ref('')

async function stopRun() {
  const shown = run.value
  if (!shown || stopping.value) return
  stopping.value = true
  stopError.value = ''
  try {
    const res = await promptBoxApi.cancel(props.websiteId, shown.id)
    if (res?.data && run.value && String(run.value.id) === String(shown.id)) runner.show(res.data)
  } catch (err) {
    stopError.value = failureOf(err).message
  } finally {
    stopping.value = false
  }
}

function readAnswers() {
  if (run.value) board.open('prompt-box', { run: String(run.value.id) })
}

// A run that ended changed what is left: the line is asked again.
watch(active, (now, before) => {
  if (before && !now) requestEstimate(true)
})

/* ── Project ── */

watch(
  () => props.websiteId,
  (wid, before) => {
    if (before === undefined) return
    clearTimeout(estimateTimer)
    estimateToken += 1
    estimate.value = null
    estimateError.value = null
    viewer.value = false
    notice.value = false
    askError.value = ''
    costChanged.value = false
    off.value = []
    runner.reset()
    if (wid) loadRuns()
  },
)

onMounted(loadRuns)

onBeforeUnmount(() => {
  clearTimeout(estimateTimer)
  estimateToken += 1
  observer?.disconnect()
})
</script>

<style scoped>
.pb {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.pb-state {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  min-height: 96px;
}

.pb-state-title {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

/* The card could not load: one sentence in the card's display type. */
.pb-state-title {
  color: var(--ag-fg-1);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -0.01em;
}

.pb-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.pb-ask,
.pb-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.pb-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 38px;
  max-height: 78px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--ag-btn-border);
  border-radius: var(--radius);
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  resize: none;
  overflow-y: hidden;
}

.pb-input::placeholder {
  color: var(--ag-placeholder);
}

.pb-input:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.pb-input:disabled {
  color: var(--ag-fg-disabled);
  cursor: not-allowed;
}

.pb-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.pb-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pb-times {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pb-select {
  box-sizing: border-box;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ag-btn-border);
  border-radius: var(--radius);
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.pb-select:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.pb-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pb-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.pb-chip:hover {
  background: var(--ag-ghost-hover);
}

.pb-chip[aria-pressed='true'] {
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
}

.pb-chip[aria-disabled='true'] {
  cursor: default;
}

.pb-chip:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.pb-chip-check {
  flex-shrink: 0;
  margin-left: -2px;
}

.pb-go {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.pb-line-wrap {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  min-height: 30px;
}

.pb-line {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pb-line.is-pending {
  opacity: 0.6;
}

.pb-note {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.pb-error {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pb-notice {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.pb-notice-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.pb-notice-body {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pb-notice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.pb-intro {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pb-question {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.pb-progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.pb-progress-line {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}

.pb-engines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pb-engine {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pb-after {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* A wide card: the question on the left, the latest result on the right. */
@container bd-card (min-width: 720px) {
  .pb-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 32px;
  }
}
</style>
