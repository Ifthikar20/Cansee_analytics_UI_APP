<template>
  <div class="pbp">
    <CardSkeleton v-if="listState === 'loading'" :height="240" />
    <div v-else-if="listState === 'failed'" class="pbp-state" role="alert">
      <p class="pbp-state-title">We couldn't load Ask AI.</p>
      <AgButton size="sm" @click="loadList()">Try again</AgButton>
    </div>
    <template v-else>
      <p v-if="!runId" class="pbp-intro">{{ COPY.intro }}</p>

      <article v-else-if="run" class="pbp-run" :aria-labelledby="questionId">
        <header class="pbp-head">
          <h3 :id="questionId" ref="questionEl" class="pbp-question" tabindex="-1">{{ run.text }}</h3>
          <p class="pbp-meta">{{ asked }}</p>
          <div v-if="active" class="pbp-progress">
            <p class="pbp-progress-line" role="status">{{ progress }}</p>
            <AgButton size="sm" :loading="stopping" @click="stopRun">Stop</AgButton>
          </div>
          <p v-else-if="ended" class="pbp-note">{{ ended }}</p>
          <p v-if="stopError" class="pbp-error" role="alert">{{ stopError }}</p>
          <p v-if="stale" class="pbp-note">{{ COPY.staleNote }}</p>
          <TrackPrompt :website-id="websiteId" :run="run" />
        </header>

        <section
          v-for="engine in engines"
          :key="engine.key"
          class="pbp-engine"
          :aria-labelledby="`${uid}-engine-${engine.key}`"
        >
          <h3 :id="`${uid}-engine-${engine.key}`" class="pbp-engine-title">{{ engine.label }}</h3>
          <p class="pbp-engine-line">{{ engine.named }}</p>
          <p v-if="engine.range" class="pbp-note">{{ engine.range }}</p>
          <p v-if="engine.rank" class="pbp-note">{{ engine.rank }}</p>

          <ol class="pbp-answers">
            <li v-for="answer in engine.answers" :key="answer.id" class="pbp-answer">
              <p class="pbp-answer-head">
                <span class="pbp-answer-k">Answer {{ answer.sample }}</span>
                <span>{{ answer.status }}</span>
                <span v-if="answer.tone">{{ answer.tone }}</span>
              </p>
              <p v-if="answer.also" class="pbp-note">{{ answer.also }}</p>
              <p v-if="answer.sources" class="pbp-note">{{ answer.sources }}</p>

              <div v-if="shownFull(answer.id)" class="pbp-full">
                <p class="pbp-full-text">{{ shownFull(answer.id).text }}</p>
                <ul v-if="shownFull(answer.id).links.length" class="pbp-links">
                  <li v-for="link in shownFull(answer.id).links" :key="link.href">
                    <a class="pbp-link" :href="link.href" target="_blank" rel="noopener">{{ link.text }}</a>
                  </li>
                </ul>
              </div>
              <template v-else>
                <p v-if="answer.excerpt" class="pbp-excerpt">{{ answer.excerpt }}</p>
                <AgButton
                  v-if="answer.canReadFull"
                  size="xs"
                  variant="ghost"
                  :loading="fullLoading === answer.id"
                  @click="readFull(answer.id)"
                >
                  Read full answer
                </AgButton>
                <p v-if="fullError.id === answer.id" class="pbp-error" role="alert">{{ fullError.message }}</p>
              </template>
            </li>
          </ol>
        </section>
      </article>

      <p v-else-if="failure" class="pbp-state-title" role="alert">{{ failure.message }}</p>
      <CardSkeleton v-else :height="200" />

      <section v-if="recent.length" class="pbp-recent" :aria-labelledby="recentId">
        <h3 :id="recentId" class="pbp-recent-title">Recent questions</h3>
        <ul class="pbp-recent-list">
          <li v-for="row in recent" :key="row.id">
            <button
              type="button"
              class="pbp-recent-row"
              :aria-current="row.id === runId ? 'true' : undefined"
              @click="board.open('prompt-box', { run: row.id })"
            >
              <span class="pbp-recent-text">{{ row.text }}</span>
              <span class="pbp-recent-meta">
                <span>{{ row.date }}</span>
                <span v-for="cell in row.engines" :key="cell.key">{{ cell.text }}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
// Ask AI's expanded view (autopilot_frontend.md 6d): the run named in the
// panel key `run`, else the latest. Each engine's share of answers that name
// you with its likely range, then every answer: whether it named you and at
// what rank, its tone, the other brands it named and how many sources it
// cited. Read full answer loads the run's full text once (?full=1). Recent
// questions switch the run; Track this prompt works as on the card.
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import promptBoxApi from '@/api/promptBox'
import AgButton from '@/components/agent/common/AgButton.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import { useBoard } from '@/lib/board/context'
import { engineMeta } from '@/lib/engines'
import { safeHref } from '@/utils/safeHref'
import { useHideUsd } from '@/composables/useHideUsd'
import TrackPrompt from './TrackPrompt.vue'
import {
  COPY,
  alsoNamed,
  answerStatus,
  askedLine,
  endLine,
  failureOf,
  namedLine,
  progressLine,
  rangeText,
  rankText,
  recentRow,
  sourcesText,
  toneWord,
} from './specs'
import { runsVersion, usePromptBoxRun } from './usePromptBoxRun'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const board = useBoard()
const runner = usePromptBoxRun(() => props.websiteId)
const { run, active, stale, failure } = runner

const uid = useId()
const questionId = `${uid}-question`
const recentId = `${uid}-recent`
const questionEl = ref(null)

/* ── Recent questions ── */

const runs = ref([])
// 'loading' until the runs first answer, 'failed', or 'ready'.
const listState = ref('loading')

async function loadList({ quiet = false } = {}) {
  const wid = props.websiteId
  if (!quiet) listState.value = 'loading'
  try {
    const res = await promptBoxApi.list(wid)
    if (wid !== props.websiteId) return
    runs.value = Array.isArray(res?.data) ? res.data : []
    listState.value = 'ready'
  } catch {
    if (wid !== props.websiteId) return
    // A quiet refresh that fails keeps the list on screen.
    if (!quiet || listState.value !== 'ready') listState.value = 'failed'
  }
}

const recent = computed(() => runs.value.map(recentRow))

/* ── The run shown ── */

const param = computed(() => {
  const raw = route.query.run
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value ? value : null
})
const runId = computed(() => param.value || (runs.value[0] ? String(runs.value[0].id) : null))

watch(
  runId,
  (id) => {
    if (!id) {
      runner.reset()
      return
    }
    const summary = runs.value.find((r) => String(r.id) === id) || null
    runner.follow(id, { initial: summary })
  },
  { immediate: true },
)

// A run picked in Recent questions (or by Read the answers on the card):
// its question takes focus, at the top, once it shows. A new latest run
// asked from the card never pulls focus out of the card.
let focusFor = null

function focusQuestion() {
  nextTick(() => {
    const el = questionEl.value
    if (!el) return
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
    el.focus({ preventScroll: true })
  })
}

watch(param, (now, before) => {
  if (!now || now === before) return
  focusFor = null
  if (run.value && String(run.value.id) === now) focusQuestion()
  else focusFor = now
})
watch(
  () => (run.value ? String(run.value.id) : null),
  (id) => {
    if (!id || id !== focusFor) return
    focusFor = null
    focusQuestion()
  },
)

// Free accounts never see dollars.
const hideUsd = useHideUsd()
const asked = computed(() => askedLine(run.value, { hideUsd: hideUsd.value }))
const progress = computed(() => progressLine(run.value))
const ended = computed(() => endLine(run.value))

const engines = computed(() =>
  (run.value?.engines || []).map((engine) => {
    const measured = (engine.answered || 0) > 0
    return {
      key: String(engine.key),
      label: engine.label || engineMeta(engine.key).label,
      named: namedLine(engine, { active: active.value }),
      range: measured ? rangeText(engine.share_low_pct, engine.share_high_pct) : '',
      rank: measured && rankText(engine.avg_rank) ? `Average rank ${rankText(engine.avg_rank)} when named` : '',
      answers: (engine.answers || []).map((answer) => {
        const done = answer.status === 'done'
        return {
          id: String(answer.id),
          sample: answer.sample,
          status: answerStatus(answer),
          tone: done && answer.mentioned ? toneWord(answer.sentiment) : '',
          also: done ? alsoNamed(answer.brands) : '',
          sources: done ? sourcesText(answer.citations) : '',
          excerpt: done ? answer.excerpt || '' : '',
          canReadFull: done,
        }
      }),
    }
  }),
)

/* ── Full answers: ?full=1, loaded once per run ── */

const fullRuns = reactive({})
const expanded = reactive({})
const fullLoading = ref('')
const fullError = ref({ id: '', message: '' })

function linkText(url) {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.host}${path}`
  } catch {
    return url
  }
}

function fullAnswer(answerId) {
  const payload = fullRuns[String(run.value?.id)]
  for (const engine of payload?.engines || []) {
    for (const answer of engine.answers || []) {
      if (String(answer.id) !== answerId || typeof answer.answer_text !== 'string') continue
      const links = (answer.citation_urls || [])
        .map((url) => ({ href: safeHref(url), text: linkText(url) }))
        .filter((link) => link.href)
      return { text: answer.answer_text, links }
    }
  }
  return null
}

function shownFull(answerId) {
  return expanded[answerId] ? fullAnswer(answerId) : null
}

async function readFull(answerId) {
  const id = run.value?.id
  if (!id || fullLoading.value) return
  fullError.value = { id: '', message: '' }
  // An answer that came back after the last full load needs one more.
  if (!fullAnswer(answerId)) {
    fullLoading.value = answerId
    try {
      const res = await promptBoxApi.get(props.websiteId, id, { full: true })
      fullRuns[String(id)] = res?.data ?? null
    } catch (err) {
      fullError.value = { id: answerId, message: failureOf(err).message }
      return
    } finally {
      fullLoading.value = ''
    }
  }
  expanded[answerId] = true
}

/* ── Stop ── */

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

/* ── Keeping the list fresh ── */

// A question asked from the card, or a run that just ended: the list again.
watch(
  () => runsVersion(props.websiteId),
  () => loadList({ quiet: true }),
)
watch(active, (now, before) => {
  if (before && !now) loadList({ quiet: true })
})

watch(
  () => props.websiteId,
  () => {
    runs.value = []
    for (const key of Object.keys(fullRuns)) delete fullRuns[key]
    for (const key of Object.keys(expanded)) delete expanded[key]
    loadList()
  },
  { immediate: true },
)
</script>

<style scoped>
.pbp {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.pbp-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.pbp-state-title,
.pbp-intro {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pbp-run {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.pbp-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pbp-question {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.pbp-question:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.pbp-meta,
.pbp-note {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.pbp-error {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pbp-progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.pbp-progress-line {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}

.pbp-engine {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--ag-divider);
}

.pbp-engine-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.pbp-engine-line {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
}

.pbp-answers {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.pbp-answer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.pbp-answer-head {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pbp-answer-k {
  color: var(--ag-fg-1);
  font-weight: 500;
}

.pbp-excerpt,
.pbp-full-text {
  margin: 0;
  padding-left: 10px;
  border-left: 2px solid var(--ag-divider);
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
  overflow-wrap: anywhere;
}

.pbp-full {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.pbp-full-text {
  white-space: pre-wrap;
}

.pbp-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pbp-link {
  display: block;
  overflow: hidden;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
  text-decoration: underline;
  text-overflow: ellipsis;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.pbp-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.pbp-recent {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--ag-divider);
}

.pbp-recent-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.pbp-recent-list {
  display: flex;
  flex-direction: column;
  margin: 0 -6px;
  padding: 0;
  list-style: none;
}

.pbp-recent-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pbp-recent-row:hover {
  background: var(--ag-ghost-hover);
}

.pbp-recent-row[aria-current='true'] {
  background: var(--ag-row-active);
}

.pbp-recent-row:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.pbp-recent-text {
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pbp-recent-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}
</style>
