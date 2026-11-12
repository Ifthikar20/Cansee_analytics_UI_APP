<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Search vs AI by country"
      title="Countries"
      subtitle="Where Google ranks you and whether the AI engines name you, country by country."
    >
      <template #actions>
        <!-- Blocked: still focusable, so the reason can be read. -->
        <Tooltip v-if="blockedReason">
          <TooltipTrigger as-child>
            <Button class="cp-blocked" aria-disabled="true" @click.prevent>
              <Globe class="size-4" aria-hidden="true" />
              Check countries
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-72 whitespace-normal leading-relaxed">{{ blockedReason }}</TooltipContent>
        </Tooltip>
        <Button v-else :disabled="!options" @click="openDialog">
          <Globe class="size-4" aria-hidden="true" />
          Check countries
        </Button>
      </template>
    </AnalyticsHeader>

    <CountryRunProgress
      v-if="run"
      :run="run"
      :stopping="stopping"
      :cancel-error="cancelError"
      @stop="cancel"
      @dismiss="dismiss"
    />

    <FilterRow v-if="showFilters">
      <PromptSelect v-model="prompt" :prompts="promptOptions" />
      <EngineSelect v-model="engine" :engines="engineOptions" include-google />
    </FilterRow>

    <!-- Results: the map, the table and prompts by country. -->
    <div v-if="resultsState === 'loading'" class="an-skeleton" aria-busy="true" aria-label="Loading country results">
      <Skeleton class="h-80 rounded-2xl" />
      <Skeleton class="h-56 rounded-2xl" />
    </div>

    <VizState
      v-else-if="resultsState === 'error'"
      kind="error"
      title="We couldn't load country results."
      :action="{ label: 'Try again' }"
      @action="reloadAll"
    />

    <VizState v-else-if="resultsState === 'disabled'" kind="disabled" title="Country checks are turned off on this server." />

    <VizState
      v-else-if="resultsState === 'no_prompts'"
      kind="empty"
      title="Track a prompt first."
      body="Country checks run your tracked prompts. Add prompts in Prompts."
      :action="{ label: 'Add prompts', to: addPrompts }"
    />

    <VizState
      v-else-if="resultsState === 'unavailable'"
      kind="not_available"
      title="Country checks aren't available yet."
      body="Google results and the AI engines both need API keys on this server."
    />

    <VizState
      v-else-if="resultsState === 'empty'"
      kind="empty"
      title="No country checks yet."
      :body="`Check how Google and the AI engines rank you in up to ${maxCountries} countries at a time. You see the cost before anything runs.`"
      :action="blockedReason ? null : { label: 'Check countries' }"
      @action="openDialog"
    />

    <VizState
      v-else-if="resultsState === 'running'"
      kind="empty"
      compact
      title="Results appear here as each country finishes."
    />

    <VizState
      v-else-if="resultsState === 'filtered'"
      kind="empty"
      title="No country results match these filters."
      :action="{ label: 'Clear filters' }"
      @action="clearFilters"
    />

    <template v-else>
      <Alert v-if="matrixStale" variant="destructive" class="an-alert">
        <CircleX />
        <AlertTitle>We couldn't refresh this page. Showing the last loaded numbers.</AlertTitle>
        <AlertDescription>
          <button type="button" class="an-retry" @click="reloadAll">Try again</button>
        </AlertDescription>
      </Alert>

      <p v-if="options && !options.enabled" class="an-note">
        Country checks are turned off on this server. These are the latest results.
      </p>

      <VizChart
        :spec="mapSpec"
        :loading="matrixLoading"
        :selected="highlight.toUpperCase()"
        :height="300"
        :heading-level="2"
        @select="onTile"
      />

      <section class="an-section" aria-labelledby="cp-table-title">
        <header>
          <h2 id="cp-table-title" class="an-section-title">Every country</h2>
          <p class="an-section-sub">The latest check in each country. Open a row to see each prompt.</p>
        </header>
        <CountryTable :website-id="websiteId" :matrix="matrix" :engine="engine" :highlight="highlight" />
      </section>

      <VizChart :spec="promptsSpec" :loading="matrixLoading" :heading-level="2" @select="openPrompt" />
    </template>

    <!-- How each result was localized: the method behind every number. -->
    <section v-if="localization.length" class="an-section" aria-labelledby="cp-methods-title">
      <header>
        <h2 id="cp-methods-title" class="an-section-title">How each result was localized</h2>
      </header>
      <div class="an-table-wrap">
        <table class="an-table">
          <caption class="sr-only">How each result was localized</caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Method</th>
              <th scope="col">What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in localization" :key="row.key">
              <th scope="row">{{ row.name }}</th>
              <td><MethodChip :method="row.method" :label="row.label" /></td>
              <td class="an-table-note">{{ row.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="an-section-foot">
        Plain chat engines answer from training data. Asking them to answer for a country steers the answer; it does not move them there.
      </p>
    </section>

    <!-- Visitors by country, from the connected traffic source. -->
    <VizChart
      :spec="visitorsSpec"
      :loading="trafficLoading && !traffic"
      :error="!traffic && trafficError ? `We couldn't load visitors by country.` : ''"
      :empty="visitorsEmpty"
      :heading-level="2"
      @retry="reloadTraffic"
    >
      <template #empty>
        <VizState v-bind="visitorsEmpty || NO_VISITOR_COUNTRIES" compact @action="reloadTraffic" />
      </template>
    </VizChart>

    <!-- Recent checks -->
    <section class="an-card" aria-labelledby="cp-runs-title">
      <h2 id="cp-runs-title" class="an-section-title">Recent checks</h2>
      <div v-if="!runs && !runsError" class="an-skeleton">
        <Skeleton v-for="n in 2" :key="n" class="h-16 rounded-xl" />
      </div>
      <VizState
        v-else-if="!runs"
        kind="error"
        compact
        title="We couldn't load recent checks."
        :action="{ label: 'Try again' }"
        @action="reloadRuns"
      />
      <RecentRuns v-else :runs="runsShown" />
    </section>

    <CountryRunDialog
      v-if="options"
      v-model:open="dialogOpen"
      :website-id="websiteId"
      :options="options"
      :preset-prompt-id="prompt"
      :traffic-countries="traffic?.countries || []"
      @started="onStarted"
    />
  </div>
</template>

<script setup>
// Rankings by country (contract 2): Google and the AI engines asked the
// tracked prompts as if from other countries, on the world map and in a
// table, with the dialog that estimates and starts a check and the panel
// that follows it. ?prompt=<id> preselects a prompt; ?check=1 opens the
// dialog once. The board's Countries widget opens it in its side panel.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleX, Globe } from '@lucide/vue'
import countriesApi from '@/api/countries'
import trafficApi from '@/api/traffic'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { useCountryRun } from '@/composables/analytics/useCountryRun'
import { useBoard } from '@/lib/board/context'
import { boardLocation } from '@/lib/board/links'
import { ENGINES } from '@/lib/engines'
import {
  countriesMap as countriesMapSpec, isActiveRun, localizationRows, promptsByCountry,
} from '@/lib/analytics/countrySpecs'
import { countriesMap as visitorsMapSpec, countriesTitle, trafficEmpty } from '@/lib/analytics/trafficSpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import PromptSelect from '@/components/analytics/PromptSelect.vue'
import EngineSelect from '@/components/analytics/EngineSelect.vue'
import MethodChip from '@/components/analytics/MethodChip.vue'
import CountryRunDialog from '@/components/analytics/CountryRunDialog.vue'
import CountryRunProgress from '@/components/analytics/CountryRunProgress.vue'
import CountryTable from '@/components/analytics/CountryTable.vue'
import RecentRuns from '@/components/analytics/RecentRuns.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const board = useBoard()

// No prompt yet: Add prompts opens the Prompts panel with its dialog.
const addPrompts = computed(() => boardLocation(props.websiteId, 'prompts', { add: '1' }))

const { prompt, engine } = useQueryState(
  { prompt: '', engine: '' },
  { allowed: { engine: ['google', ...ENGINES.map((e) => e.key)] } },
)

const wid = computed(() => props.websiteId)
const payload = (promise) => promise.then((res) => res.data)

// ── Data ──
const optionsQuery = useAnalyticsQuery(() => payload(countriesApi.options(wid.value)), () => [wid.value])
const matrixParams = computed(() => {
  const p = {}
  if (prompt.value) p.prompt_id = prompt.value
  if (engine.value) p.engine = engine.value
  return p
})
const matrixQuery = useAnalyticsQuery(
  () => payload(countriesApi.matrix(wid.value, matrixParams.value)),
  () => [wid.value, matrixParams.value],
)
const trafficQuery = useAnalyticsQuery(
  () => payload(trafficApi.countries(wid.value, { period: '30d', source: 'auto' })),
  () => [wid.value],
)
const runsQuery = useAnalyticsQuery(() => payload(countriesApi.listRuns(wid.value)), () => [wid.value])

const options = optionsQuery.data
const matrix = matrixQuery.data
const matrixLoading = matrixQuery.loading
const matrixStale = matrixQuery.stale
const traffic = trafficQuery.data
const trafficLoading = trafficQuery.loading
const trafficError = trafficQuery.error
const runs = runsQuery.data
const runsError = runsQuery.error

const reloadTraffic = () => trafficQuery.reload()
const reloadRuns = () => runsQuery.reload()

function reloadAll() {
  optionsQuery.reload()
  matrixQuery.reload()
}

// ── The run this view follows ──
const { run, stopping, cancelError, track, cancel, dismiss } = useCountryRun(wid, {
  onFinish: () => {
    optionsQuery.reload()
    matrixQuery.reload()
    runsQuery.reload()
  },
})

// A run already going when the page opens (or after a reload).
watch(
  () => options.value?.active_run?.id || matrix.value?.active_run?.id || '',
  (id) => {
    if (!id || run.value?.id === id) return
    track(options.value?.active_run || matrix.value?.active_run)
  },
  { immediate: true },
)

// Countries finish one at a time; show each one's results as it lands.
watch(
  () => (run.value?.countries || []).filter((c) => c.status === 'done').length,
  (done, before) => {
    if (done > (before || 0) && isActiveRun(run.value)) matrixQuery.reload()
  },
)

// The list was read when the page opened; the run this view polls is
// fresher, so its entry shows the live progress and cost.
const runsShown = computed(() => {
  const list = runs.value
  const live = run.value
  if (!Array.isArray(list) || !live?.id) return list
  return list.map((r) => (r.id === live.id ? { ...r, ...live } : r))
})

function onStarted(started) {
  track(started)
  runsQuery.reload()
  // A check that ran before the server answered (inline mode) is already over.
  if (!isActiveRun(started)) {
    optionsQuery.reload()
    matrixQuery.reload()
  }
}

// ── Header action ──
const anyEngineConfigured = computed(() => (options.value?.engines || []).some((e) => e.configured))
const googleConfigured = computed(() => Boolean(options.value?.google?.configured))
const running = computed(() => isActiveRun(run.value))

const blockedReason = computed(() => {
  const o = options.value
  if (!o) return ''
  if (!o.enabled) return 'Country checks are turned off on this server.'
  if (!(o.prompts || []).length) return 'Track a prompt first.'
  if (!googleConfigured.value && !anyEngineConfigured.value) return "Country checks aren't available yet."
  if (running.value) return 'A country check is running for this project.'
  return ''
})

const dialogOpen = ref(false)

function openDialog() {
  if (!options.value || blockedReason.value) return
  dialogOpen.value = true
}

// ?check=1 opens the dialog once, then leaves the URL.
let checkHandled = false
watch(
  () => [options.value, route.query.check],
  ([o, check]) => {
    if (checkHandled || !o || check !== '1') return
    checkHandled = true
    openDialog()
    const query = { ...route.query }
    delete query.check
    router.replace({ query })
  },
  { immediate: true },
)

// ── Results ──
const cells = computed(() => matrix.value?.cells || [])
const filtersActive = computed(() => Boolean(prompt.value || engine.value))
const maxCountries = computed(() => options.value?.limits?.max_countries || 5)

const resultsState = computed(() => {
  if (!matrix.value) return matrixQuery.error.value ? 'error' : 'loading'
  if (cells.value.length) return 'ready'
  const o = options.value
  if (!o) return optionsQuery.error.value ? 'error' : 'loading'
  if (!o.enabled) return 'disabled'
  if (!(o.prompts || []).length) return 'no_prompts'
  if (!googleConfigured.value && !anyEngineConfigured.value) return 'unavailable'
  if (running.value) return 'running'
  if (filtersActive.value) {
    // Whether anything was ever checked decides between the two empties.
    if (!runs.value) return runsError.value ? 'filtered' : 'loading'
    if (runs.value.length) return 'filtered'
  }
  return 'empty'
})

const showFilters = computed(() => resultsState.value === 'ready' || resultsState.value === 'filtered')
const promptOptions = computed(() => matrix.value?.prompts || options.value?.prompts || [])
const engineOptions = computed(() => matrix.value?.engines || options.value?.engines || [])

const mapSpec = computed(() => countriesMapSpec(matrix.value, { engine: engine.value }))
const promptsSpec = computed(() => promptsByCountry(matrix.value, { engine: engine.value }))
const localization = computed(() =>
  localizationRows(options.value, { countries: (matrix.value?.countries || []).map((c) => c.country) }),
)

// A tile picked on the map: its row in the table comes into view.
const highlight = ref('')

function onTile(event) {
  if (event?.label) highlight.value = String(event.label).toLowerCase()
}

// A prompt opens in the Prompts panel.
function openPrompt(event) {
  const promptId = event?.label
  if (!promptId) return
  board.open('prompts', { prompt: String(promptId) })
}

function clearFilters() {
  const query = { ...route.query }
  delete query.prompt
  delete query.engine
  router.replace({ query })
}

// ── Visitors by country ──
const NO_VISITOR_COUNTRIES = {
  kind: 'empty',
  title: 'No visitor countries recorded in the last 30 days.',
  body: '',
  action: null,
}

const visitorsEmpty = computed(() => {
  const t = traffic.value
  if (!t) return null
  const empty = trafficEmpty(t)
  if (empty) return empty
  if (!(t.countries || []).some((c) => typeof c.value === 'number')) return NO_VISITOR_COUNTRIES
  return null
})

// The title follows the metric: Cloudflare's requests are never visitors.
const visitorsSpec = computed(() => {
  const t = traffic.value
  const notes = (t?.notes || []).filter((n) => typeof n === 'string' && n).join(' ')
  return visitorsMapSpec(t, {
    id: 'countries.visitors',
    title: countriesTitle(t),
    subtitle: t?.source_label ? `${t.source_label} · last 30 days` : 'Last 30 days',
    footnote: notes,
  })
})
</script>

<style scoped>
.an-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.an-skeleton {
  display: grid;
  gap: 16px;
}

/* Non-chart sections share the chart frame's look (VizChart's .viz). Their
   one column may shrink below its content's width, so a wide table scrolls
   inside its own frame instead of widening the page on phones. */
.an-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.an-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
}

.an-section-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.an-section-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.an-section-foot {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

.an-note {
  color: var(--muted-foreground);
  font-size: 13px;
}

.an-alert {
  border-radius: var(--radius);
}

.an-retry {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.cp-blocked {
  cursor: not-allowed;
  opacity: 0.5;
}

.an-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.an-table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.an-table th,
.an-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.an-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.an-table tbody th {
  font-weight: 600;
  white-space: nowrap;
}

.an-table tbody tr:last-child > * {
  border-bottom: 0;
}

.an-table-note {
  color: var(--muted-foreground) !important;
  line-height: 1.5;
}

/* The page renders in the board's side panel: its width decides. */
@container bd-panel (max-width: 480px) {
  .an-card {
    padding: 16px;
  }
}
</style>
