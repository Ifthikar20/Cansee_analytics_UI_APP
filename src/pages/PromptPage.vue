<template>
  <div class="pp">
    <router-link :to="allPrompts" replace class="pp-back">
      <ArrowLeft class="size-4" aria-hidden="true" />
      All prompts
    </router-link>

    <div v-if="loading && !detail" class="pp-skeleton">
      <Skeleton class="h-10 w-2/3 rounded-xl" />
      <Skeleton class="h-36 rounded-3xl" />
      <Skeleton class="h-72 rounded-2xl" />
    </div>

    <p v-else-if="notFound" class="pp-missing">
      This prompt isn't tracked in this project any more.
      <router-link :to="allPrompts" replace>All prompts</router-link>
    </p>

    <section v-else-if="loadFailed && !detail" class="pp-state">
      <p class="pp-state-title">We couldn't load this prompt.</p>
      <Button variant="outline" class="rounded-full" @click="load">Try again</Button>
    </section>

    <template v-else-if="detail">
      <p v-if="loadFailed" class="pp-refresh-error">
        We couldn't refresh this prompt.
        <button type="button" class="pp-retry" @click="load">Try again</button>
      </p>

      <header class="pp-head">
        <div class="pp-head-text">
          <h2 class="pp-title">{{ detail.prompt.text }}</h2>
          <p class="pp-meta">
            <MethodChip v-if="googleMethod" :method="googleMethod.method" :label="googleMethod.label" />
            <span v-else-if="detail.prompt.location">Searched from {{ detail.prompt.location.toUpperCase() }}</span>
            <span v-else>Global</span>
            <span v-if="detail.google.checked_at">· Google checked {{ timeAgo(detail.google.checked_at) }}</span>
          </p>
        </div>
        <div class="pp-actions">
          <Button class="rounded-full" :disabled="checking" @click="checkNow">
            <RefreshCw class="size-4" :class="{ 'animate-spin': checking }" />
            {{ checking ? 'Checking...' : 'Check now' }}
          </Button>
          <Button variant="outline" class="rounded-full" @click="showSchedule = true">
            <CalendarClock class="size-4" />
            Schedule
          </Button>
          <Button variant="ghost" class="rounded-full" :disabled="archiving" @click="archive">
            <Archive class="size-4" />
            Archive
          </Button>
        </div>
      </header>

      <section class="pp-verdict" aria-label="The gap">
        <p class="pp-verdict-badge"><GapBadge :cls="detail.gap.class" :value="detail.gap.value" show-value /></p>
        <p class="pp-verdict-text">{{ detail.verdict }}</p>
        <p v-if="detail.gap.ai_score !== null && detail.gap.search_score !== null" class="pp-verdict-scores">
          AI score {{ detail.gap.ai_score }} against a Google score of {{ detail.gap.search_score }}.
          {{ gapMeta(detail.gap.class).blurb }}
        </p>
      </section>

      <section class="pp-section" aria-labelledby="pp-actions-title">
        <header class="pp-section-head">
          <h2 id="pp-actions-title" class="pp-section-title">Where to change</h2>
          <p class="pp-section-sub">Ranked by how big the gap is and how many engines it affects.</p>
        </header>
        <ActionList :actions="detail.actions" />
      </section>

      <section class="pp-section" aria-labelledby="pp-compare-title">
        <header class="pp-section-head">
          <h2 id="pp-compare-title" class="pp-section-title">Google next to every engine</h2>
          <p class="pp-section-sub">Same question, same day. The badge on each engine is its gap against Google.</p>
        </header>
        <div class="pp-compare">
          <GoogleCard :google="detail.google" :available="detail.serp_configured" />
          <p v-if="!anyEngineConfigured" class="pp-engines-empty">AI engines aren't available yet.</p>
          <p v-else-if="!anyEngineAnswered" class="pp-engines-empty">No engine results yet. Use Check now.</p>
          <div v-else class="pp-engines">
            <EngineCard v-for="e in detail.engines" :key="e.key" :engine="e" @read="openAnswer" />
          </div>
        </div>
      </section>

      <section class="pp-section" aria-labelledby="pp-history-title">
        <header class="pp-section-head is-row">
          <div>
            <h2 id="pp-history-title" class="pp-section-title">History</h2>
            <p class="pp-section-sub">How this prompt has moved.</p>
          </div>
          <PeriodSelect v-model="historyPeriod" :periods="['30d', '90d']" />
        </header>
        <div class="pp-history">
          <VizChart
            :spec="googleHistory"
            :loading="historyPending"
            :error="historyFailed ? HISTORY_ERROR : ''"
            :empty="googleEmpty"
            @retry="loadHistory"
          />
          <VizChart
            :spec="engineHistory"
            :loading="historyPending"
            :error="historyFailed ? HISTORY_ERROR : ''"
            :empty="enginesEmpty"
            @retry="loadHistory"
          />
        </div>
      </section>

      <section class="pp-section" aria-labelledby="pp-fanouts-title">
        <header class="pp-section-head">
          <h2 id="pp-fanouts-title" class="pp-section-title">What the engines searched</h2>
          <p class="pp-section-sub">The web searches the engines ran while answering this prompt.</p>
        </header>
        <div class="pp-fanouts">
          <InsightRunProgress
            v-if="googleCheck.run.value"
            :run="googleCheck.run.value"
            :stopping="googleCheck.stopping.value"
            :stop-error="googleCheck.stopError.value"
            @stop="googleCheck.stop"
            @dismiss="googleCheck.dismiss"
          />
          <Skeleton v-if="!fanouts && !fanoutsFailed" class="h-32 rounded-2xl" />
          <VizState
            v-else-if="!fanouts && fanoutsDisabled"
            kind="disabled"
            title="Insights are turned off on this server."
          />
          <VizState
            v-else-if="!fanouts"
            kind="error"
            title="We couldn't load query fan-outs."
            :action="{ label: 'Try again' }"
            @action="loadFanouts"
          />
          <VizState v-else-if="fanoutsEmptyState" v-bind="fanoutsEmptyState" />
          <FanoutPromptCard
            v-else
            :website-id="websiteId"
            :prompt="fanoutPrompt"
            :link-prompt="false"
            :unreported="fanoutsUnreported"
            :max-queries="fanoutMaxQueries"
            :check-blocked="fanoutCheckBlocked"
            @check="openFanoutCheck"
          />
        </div>
      </section>

      <section class="pp-section" aria-labelledby="pp-countries-title">
        <header class="pp-section-head is-row">
          <div>
            <h2 id="pp-countries-title" class="pp-section-title">By country</h2>
            <p class="pp-section-sub">The latest check of this prompt in each country.</p>
          </div>
          <Button v-if="countryRows.length" as-child variant="outline" class="rounded-full">
            <router-link :to="checkCountries">Check countries</router-link>
          </Button>
        </header>
        <Skeleton v-if="!matrix && !countriesFailed" class="h-32 rounded-2xl" />
        <VizState
          v-else-if="countriesFailed && !matrix"
          kind="error"
          title="We couldn't load country results."
          :action="{ label: 'Try again' }"
          @action="loadCountries"
        />
        <VizState
          v-else-if="!countryRows.length"
          title="This prompt hasn't been checked in other countries."
          :action="{ label: 'Check countries', to: checkCountries }"
        />
        <div v-else class="pp-ct-scroll">
          <table class="pp-ct">
            <caption class="sr-only">This prompt by country</caption>
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">Google</th>
                <th v-for="e in countryEngines" :key="e.key" scope="col">{{ e.label }}</th>
                <th scope="col">Gap</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in countryRows" :key="row.country">
                <th scope="row" class="pp-ct-country">{{ row.name }}</th>
                <td>
                  <span class="pp-ct-value" :class="{ 'is-word': !row.google || !row.google.position }">{{ googleText(row) }}</span>
                  <span v-if="row.google?.method_label" class="pp-ct-note">{{ row.google.method_label }}</span>
                </td>
                <td v-for="e in countryEngines" :key="e.key">
                  <span class="pp-ct-value" :class="{ 'is-word': !row.engines[e.key]?.mentioned }">
                    {{ cellText(row.engines[e.key]) }}
                  </span>
                </td>
                <td>
                  <span v-if="row.gap && row.gap.definite === false" class="pp-ct-value is-word">Not definite</span>
                  <GapBadge v-else :cls="row.gap?.class || 'no_data'" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="pp-section" aria-labelledby="pp-findings-title">
        <header class="pp-section-head">
          <h2 id="pp-findings-title" class="pp-section-title">What AI gets wrong</h2>
          <p class="pp-section-sub">Claims in these answers that conflict with your brand facts.</p>
        </header>
        <PromptSecurityFindings :website-id="websiteId" :prompt-id="promptId" />
      </section>
    </template>

    <PromptScheduleModal
      v-if="detail"
      v-model="showSchedule"
      :website-id="websiteId"
      :prompt-id="promptId"
      @run-now="rerunEngines"
    />
    <ChatDetailModal
      :website-id="websiteId"
      :result-id="answerId"
      :open="!!answerId"
      @close="answerId = ''"
    />
    <InsightRunDialog kind="fanout_google" />
  </div>
</template>

<script setup>
// One tracked prompt (the Prompts panel's detail): the gap, where to
// change, Google next to every engine, history, the engines' searches,
// countries and what AI gets wrong. "All prompts" goes back to the list;
// archiving returns there too and refetches the board's overview.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Archive, CalendarClock, RefreshCw } from '@lucide/vue'
import api from '@/api/client'
import countriesApi from '@/api/countries'
import insightsApi from '@/api/insights'
import searchGapApi from '@/api/searchGap'
import promptLibrary from '@/api/promptLibrary'
import visibilityApi from '@/api/visibility'
import { useToast } from '@/composables/useToast'
import { isActiveInsightRun, useInsightRun } from '@/composables/analytics/useInsightRun'
import { useBoard } from '@/lib/board/context'
import { boardLocation } from '@/lib/board/links'
import { gapMeta } from '@/lib/gap'
import { cellText, matrixEngines, promptCountryRows } from '@/lib/analytics/countrySpecs'
import { googleHistorySpec } from '@/lib/analytics/polishSpecs'
import { visibilityOverTime } from '@/lib/analytics/visibilitySpecs'
import { fanoutsEmpty, unreportedSearches } from '@/lib/analytics/researchSpecs'
import { timeAgo } from '@/utils/timeAgo'
import GapBadge from '@/components/gap/GapBadge.vue'
import ActionList from '@/components/gap/ActionList.vue'
import GoogleCard from '@/components/gap/GoogleCard.vue'
import EngineCard from '@/components/gap/EngineCard.vue'
import MethodChip from '@/components/analytics/MethodChip.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import FanoutPromptCard from '@/components/analytics/FanoutPromptCard.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizState from '@/components/charts/VizState.vue'
import ChatDetailModal from '@/components/ChatDetailModal.vue'
import PromptScheduleModal from '@/components/prompt_library/PromptScheduleModal.vue'
import PromptSecurityFindings from '@/components/prompt_library/PromptSecurityFindings.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
  promptId: { type: String, required: true },
})

const router = useRouter()
const toast = useToast()
const board = useBoard()

const allPrompts = computed(() => boardLocation(props.websiteId, 'prompts'))

const detail = ref(null)
const loading = ref(false)
const loadFailed = ref(false)
const notFound = ref(false)
const checking = ref(false)
const archiving = ref(false)
const showSchedule = ref(false)
const answerId = ref('')
let refreshTimer = null

// Each engine says whether the server holds its API key.
const anyEngineConfigured = computed(() => (detail.value?.engines || []).some((e) => e.configured))
const anyEngineAnswered = computed(() => (detail.value?.engines || []).some((e) => e.answers))

// How a Google check for this prompt's location runs with the configured
// provider (null without Google). A Global prompt on Google's default
// keeps reading "Global".
const googleMethod = computed(() => {
  const method = detail.value?.google?.method
  if (!method || !method.label) return null
  if (!detail.value.prompt.location && method.method === 'default') return null
  return method
})

// ── History: the visibility dashboard filtered to this prompt ──
const HISTORY_ERROR = "We couldn't load the history."
const historyPeriod = ref('30d')
const history = ref(null)
const historyLoading = ref(false)
const historyFailed = ref(false)

const historyPending = computed(() => historyLoading.value || (!history.value && !historyFailed.value))
const googleHistory = computed(() =>
  googleHistorySpec(history.value?.google_history, { location: detail.value?.prompt.location }),
)
const engineHistory = computed(() => visibilityOverTime(history.value, { id: 'prompt.engines', title: 'AI visibility' }))

const googleEmpty = computed(() => {
  if (!history.value || googleHistory.value.labels.length) return null
  if (detail.value && !detail.value.serp_configured) return { title: "Google rank checks aren't available yet." }
  return { title: 'No Google checks in this period.', body: 'Use Check now to record one.' }
})
const enginesEmpty = computed(() =>
  history.value && history.value.has_data === false ? { title: 'No AI answers for this prompt in this period.' } : null,
)

// A late answer for another prompt or period is dropped.
function historyKey() {
  return `${props.websiteId}|${props.promptId}|${historyPeriod.value}`
}

async function loadHistory() {
  const key = historyKey()
  historyLoading.value = true
  historyFailed.value = false
  try {
    const res = await visibilityApi.dashboard(props.websiteId, { period: historyPeriod.value, prompt_id: props.promptId })
    if (key !== historyKey()) return
    history.value = res.data
  } catch {
    if (key === historyKey()) historyFailed.value = true
  } finally {
    if (key === historyKey()) historyLoading.value = false
  }
}

watch(historyPeriod, () => loadHistory())

// ── What the engines searched: this prompt's query fan-outs (contract 8) ──
const fanouts = ref(null)
const fanoutsFailed = ref(false)
const fanoutsDisabled = ref(false)

async function loadFanouts() {
  const key = `${props.websiteId}|${props.promptId}`
  fanoutsFailed.value = false
  try {
    const res = await insightsApi.fanOuts(props.websiteId, { period: '30d', prompt_id: props.promptId })
    if (key !== `${props.websiteId}|${props.promptId}`) return
    fanouts.value = res.data
  } catch (err) {
    if (key !== `${props.websiteId}|${props.promptId}`) return
    fanoutsFailed.value = true
    fanoutsDisabled.value = errorCode(err) === 'insights_disabled'
  }
}

const fanoutPrompt = computed(() => {
  const listed = (fanouts.value?.prompts || []).find((p) => String(p.prompt_id) === String(props.promptId))
  return listed || { prompt_id: props.promptId, text: detail.value?.prompt.text || '', answers: 0, searched: 0, queries: [] }
})
// The payload is this prompt's alone, so its totals are the prompt's.
const fanoutsUnreported = computed(() => unreportedSearches(fanouts.value?.totals))

const fanoutsEmptyState = computed(() => fanoutsEmpty(fanouts.value, { days: 30 }))

// Searches picked on the card are checked on Google after the cost is confirmed.
const googleCheck = useInsightRun('fanout_google', { websiteId: () => props.websiteId, onFinished: () => loadFanouts() })
const fanoutMaxQueries = computed(() => Number(googleCheck.options.value?.limits?.max_units) || 10)
const fanoutCheckBlocked = computed(() => {
  const o = googleCheck.options.value
  if (o?.configured && o.configured.google === false) return "Google results aren't configured on this server."
  if (isActiveInsightRun(googleCheck.run.value)) return 'Fan-out Google check is already running for this project.'
  return ''
})

function openFanoutCheck(queries) {
  googleCheck.open({ queries })
}

// ── By country: the latest country check of this prompt ──
const matrix = ref(null)
const countriesFailed = ref(false)

const countryRows = computed(() => (matrix.value ? promptCountryRows(matrix.value, props.promptId) : []))
const countryEngines = computed(() => (matrix.value ? matrixEngines(matrix.value) : []))
const checkCountries = computed(() => boardLocation(props.websiteId, 'countries', { prompt: props.promptId, check: '1' }))

function googleText(row) {
  if (!row.google && matrix.value?.google?.configured === false) return 'Not configured'
  return cellText(row.google)
}

async function loadCountries() {
  const key = `${props.websiteId}|${props.promptId}`
  countriesFailed.value = false
  try {
    const res = await countriesApi.matrix(props.websiteId, { prompt_id: props.promptId })
    if (key !== `${props.websiteId}|${props.promptId}`) return
    matrix.value = res.data
  } catch {
    if (key === `${props.websiteId}|${props.promptId}`) countriesFailed.value = true
  }
}

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    // Silent: the page shows the failure inline.
    const res = await api.get(
      `/search-gap/websites/${props.websiteId}/prompts/${props.promptId}/`,
      { _silentError: true },
    )
    detail.value = res.data
    notFound.value = false
  } catch (err) {
    if (err.response?.status === 404) notFound.value = true
    else loadFailed.value = true
  } finally {
    loading.value = false
  }
}

// Checks run in the background; look again once they have had time to land.
function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    load()
    loadHistory()
    loadFanouts()
  }, 8000)
}

// The API answers some failures with a bare code ({"error": "code"}) and
// others with {"error": {"code", "message"}}.
function errorCode(err) {
  const e = err?.response?.data?.error
  return typeof e === 'string' ? e : e?.code || ''
}

// Queue AI engine answers for this prompt. Silent: callers report the
// outcome in a single toast.
function askEngines(payload = {}) {
  return api.post(
    `/prompt-library/websites/${props.websiteId}/prompts/${props.promptId}/crawl/`,
    payload,
    { _silentError: true },
  )
}

const CHECK_NOTES = {
  engines: { off: "AI engines aren't available yet.", failed: "We couldn't ask the AI engines." },
  google: { off: "Google rank checks aren't available yet.", failed: "We couldn't start the Google check." },
}

function outcome(result, offCode) {
  if (result.status === 'fulfilled') return 'queued'
  return errorCode(result.reason) === offCode ? 'off' : 'failed'
}

// Google (forced fresh) plus any engine that has not answered yet. A full
// re-run of every engine is the schedule dialog's "Run now".
async function checkNow() {
  checking.value = true
  const googleOn = Boolean(detail.value?.serp_configured)
  const [enginesResult, googleResult] = await Promise.allSettled([
    askEngines({ mode: 'missing' }),
    googleOn ? searchGapApi.checkGoogle(props.websiteId, props.promptId, { force: true }) : Promise.resolve(),
  ])
  checking.value = false

  const engines = outcome(enginesResult, 'no_llm_provider_configured')
  const google = googleOn ? outcome(googleResult, 'serpapi_not_configured') : 'off'
  const started = []
  if (google === 'queued') started.push('Google')
  if (engines === 'queued') started.push('any engine without an answer')
  const notes = [CHECK_NOTES.engines[engines], CHECK_NOTES.google[google]].filter(Boolean)

  if (!started.length) {
    toast.error(notes.join(' '))
    return
  }
  toast.success([`Checking ${started.join(' and ')}.`, ...notes].join(' '))
  await load()
  refreshSoon()
}

async function rerunEngines() {
  try {
    await askEngines()
    toast.success('Asking the AI engines again.')
    refreshSoon()
  } catch (err) {
    toast.error(
      errorCode(err) === 'no_llm_provider_configured'
        ? "AI engines aren't available yet."
        : "We couldn't start the run. Please try again.",
    )
  }
}

async function archive() {
  archiving.value = true
  try {
    await promptLibrary.setArchived(detail.value.prompt.brand_prompt_id, true)
    toast.success('Prompt archived. It no longer runs or counts on the board.')
    board.invalidate('overview')
    router.replace(boardLocation(props.websiteId, 'prompts'))
  } catch {
    archiving.value = false
  }
}

function openAnswer(engine) {
  answerId.value = engine.latest_result_public_id
}

// A different prompt starts from a clean slate, so a failed load never
// shows the previous prompt's data.
watch(() => [props.websiteId, props.promptId], () => {
  clearTimeout(refreshTimer)
  detail.value = null
  notFound.value = false
  history.value = null
  historyFailed.value = false
  matrix.value = null
  countriesFailed.value = false
  fanouts.value = null
  fanoutsFailed.value = false
  load()
  loadHistory()
  loadCountries()
  loadFanouts()
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(refreshTimer))
</script>

<style scoped>
.pp {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.pp-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  color: var(--muted-foreground);
  font-size: 13.5px;
  font-weight: 500;
}

.pp-back:hover {
  color: var(--foreground);
  opacity: 1;
}

.pp-skeleton {
  display: grid;
  gap: 16px;
}

.pp-missing {
  color: var(--muted-foreground);
}

.pp-missing a {
  text-decoration: underline;
}

.pp-state {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 28px 30px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--card);
}

.pp-state-title {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
}

.pp-refresh-error {
  color: var(--destructive);
  font-size: 13.5px;
}

.pp-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--foreground);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.pp-engines-empty {
  align-self: start;
  padding: 18px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.pp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.pp-head-text {
  min-width: 0;
  max-width: 820px;
}

.pp-title {
  color: var(--foreground);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-wrap: balance;
}

.pp-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.pp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* The gap in a plain bordered block: the words carry the class. */
.pp-verdict {
  display: grid;
  gap: 6px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}

.pp-verdict-badge {
  color: var(--muted-foreground);
  font-size: 13px;
}

.pp-verdict-text {
  color: var(--foreground);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.35;
  text-wrap: pretty;
}

.pp-verdict-scores {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

.pp-section-head {
  margin-bottom: 12px;
}

.pp-section-head.is-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.pp-history {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.pp-fanouts {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.pp-ct-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}

.pp-ct {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.pp-ct th,
.pp-ct td {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.pp-ct thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.pp-ct tbody tr:last-child > * {
  border-bottom: 0;
}

.pp-ct-country {
  color: var(--foreground);
  font-weight: 600;
  white-space: nowrap;
}

.pp-ct-value {
  display: block;
  color: var(--foreground);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pp-ct-value.is-word {
  color: var(--muted-foreground);
  font-weight: 400;
}

.pp-ct-note {
  display: block;
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 12px;
}

.pp-section-title {
  color: var(--foreground);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.pp-section-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.pp-compare {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(0, 2fr);
  align-items: start;
  gap: 16px;
}

.pp-engines {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

/* The page renders in the board's side panel: its width decides. */
@container bd-panel (max-width: 760px) {
  .pp-compare,
  .pp-history {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container bd-panel (max-width: 480px) {
  .pp-verdict {
    padding: 16px;
  }
}
</style>
