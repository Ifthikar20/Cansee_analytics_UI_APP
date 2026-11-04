<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Benchmark"
      title="Competitors"
      subtitle="How you compare with the competitors you track, on Google and in AI answers."
    />

    <FilterRow>
      <PeriodSelect v-model="period" />
      <EngineSelect v-model="engine" :engines="engineOptions" />
    </FilterRow>

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading the comparison">
      <div class="an-kpis">
        <Skeleton v-for="n in 3" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
      <Skeleton class="h-72 rounded-2xl" />
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load the comparison."
      :action="{ label: 'Try again' }"
      @action="reload"
    />

    <template v-else>
      <Alert v-if="stale" variant="destructive" class="an-alert">
        <CircleX />
        <AlertTitle>We couldn't refresh this page. Showing the last loaded numbers.</AlertTitle>
        <AlertDescription>
          <button type="button" class="an-retry" @click="reload">Try again</button>
        </AlertDescription>
      </Alert>

      <VizState
        v-if="data.empty_reason === 'no_competitors'"
        kind="empty"
        title="You aren't tracking any competitors yet."
        body="Add the competitors you want to compare with in Project settings."
        :action="{ label: 'Open project settings', to: { name: 'settings-project' } }"
      />

      <template v-else>
        <section class="an-kpis" aria-label="AI visibility by brand">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :kind="tile.kind"
            :state-text="tile.stateText"
            :hint="tile.hint"
            :tone="tile.tone"
          />
        </section>

        <VizChart :spec="specs.visibility" :loading="loading" :empty="aiEmpty" :height="260" :heading-level="2" />

        <VizChart :spec="specs.compare" :loading="loading" :empty="compareEmpty" selected="you" :heading-level="2">
          <template v-if="citationsMissing" #footnote>
            <p>No cited sources were recorded for these answers. Engines list sources when they search the web: Perplexity always, ChatGPT and Claude when web search is on.</p>
          </template>
        </VizChart>

        <VizChart
          :spec="specs.aiByPrompt"
          :loading="loading"
          :empty="aiEmpty"
          :heading-level="2"
          @select="openPrompt"
        />

        <VizChart
          :spec="specs.googleByPrompt"
          :loading="loading"
          :empty="googleEmpty"
          :heading-level="2"
          @select="openPrompt"
        />

        <section v-if="gaps.length" class="an-card" aria-labelledby="cmp-gaps-title">
          <h2 id="cmp-gaps-title" class="an-section-title">Biggest gaps</h2>
          <ul class="cmp-gaps">
            <li v-for="gap in gaps" :key="gap.key" class="cmp-gap">
              <router-link :to="promptRoute(gap.promptId)" class="cmp-gap-text">{{ gap.text }}</router-link>
              <AskAgentButton :website-id="websiteId" template="competitor_prompt" :values="gap.values" />
            </li>
          </ul>
        </section>

        <section v-if="hasAnswersInWindow && headToHead.length" class="an-card" aria-labelledby="cmp-h2h-title">
          <h2 id="cmp-h2h-title" class="an-section-title">Head to head</h2>
          <div class="an-table-wrap" role="region" aria-label="Head to head, scrolls sideways" tabindex="0">
            <table class="an-table">
              <caption class="sr-only">Head to head</caption>
              <thead>
                <tr>
                  <th scope="col">Competitor</th>
                  <th scope="col" class="is-num">Both named</th>
                  <th scope="col" class="is-num">You ranked higher</th>
                  <th scope="col" class="is-num">They ranked higher</th>
                  <th scope="col" class="is-num">No order</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in headToHead" :key="row.key">
                  <th scope="row">
                    <span class="cmp-dot" :style="{ background: row.color }" aria-hidden="true"></span>
                    {{ row.name }}
                  </th>
                  <td class="is-num">{{ count(row.both) }}</td>
                  <td class="is-num">{{ count(row.youAhead) }}</td>
                  <td class="is-num">{{ count(row.theyAhead) }}</td>
                  <td class="is-num">{{ count(row.noOrder) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="an-card" aria-labelledby="cmp-site-title">
          <header class="an-card-head">
            <h2 id="cmp-site-title" class="an-section-title">Site readiness</h2>
            <router-link :to="{ name: 'crawler-access', params: { websiteId } }" class="an-link">Open Crawler access</router-link>
          </header>
          <div class="an-table-wrap" role="region" aria-label="Site readiness, scrolls sideways" tabindex="0">
            <table class="an-table">
              <caption class="sr-only">Site readiness</caption>
              <thead>
                <tr>
                  <th scope="col">Brand</th>
                  <th scope="col">Home page checks</th>
                  <th scope="col">Open to AI search bots</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in site" :key="row.key">
                  <th scope="row">
                    <span class="cmp-dot" :style="{ background: row.color }" aria-hidden="true"></span>
                    {{ row.name }}
                  </th>
                  <td :class="{ 'is-word': !row.audited }">{{ row.checks }}</td>
                  <td :class="{ 'is-word': !row.audited }">{{ row.aiSearch }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
// Competitors (contract 4a): you next to the competitors you track, in AI
// answers (how often each is named, ranked first, head to head), in the
// sources the answers cite, on Google page one for your prompts, and in
// how ready each home page is for AI crawlers. Filters live in the URL.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CircleX } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { boardLocation } from '@/lib/board/links'
import { ENGINES } from '@/lib/engines'
import {
  aiByPrompt, biggestGaps, brandTiles, compareBrands, googleByPrompt, googleState, hasAnswers, headToHeadRows,
  siteRows, visibilityByBrand,
} from '@/lib/analytics/benchmarkSpecs'
import { normalizeVizSpec } from '@/lib/charts/spec'
import { periodDays } from '@/lib/analytics/visibilitySpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import AskAgentButton from '@/components/analytics/AskAgentButton.vue'
import EngineSelect from '@/components/analytics/EngineSelect.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const router = useRouter()

const { period, engine } = useQueryState(
  { period: '30d', engine: '' },
  { allowed: { period: ['7d', '30d', '90d'], engine: ENGINES.map((e) => e.key) } },
)

const params = computed(() => {
  const p = { period: period.value }
  if (engine.value) p.engine = engine.value
  return p
})

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.competitors(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

const disabled = computed(() => failure.value?.code === 'insights_disabled')

// The payload lists its engines when it has them; else every engine is
// offered and the server answers for the one chosen.
const engineOptions = computed(
  () => data.value?.engines || ENGINES.map((e) => ({ key: e.key, label: e.label, configured: true })),
)

const days = computed(() => periodDays(data.value?.window?.period || period.value))
const integer = new Intl.NumberFormat('en-US')

// Prompts (and their Google checks) live in the board's Prompts widget.
const promptsLink = computed(() => boardLocation(props.websiteId, 'prompts'))

function count(value) {
  return typeof value === 'number' ? integer.format(value) : 'Not measured'
}

const tiles = computed(() => brandTiles(data.value))
const specs = computed(() => {
  const d = data.value
  return {
    visibility: visibilityByBrand(d),
    compare: compareBrands(d),
    aiByPrompt: aiByPrompt(d),
    googleByPrompt: googleByPrompt(d),
  }
})

const hasAnswersInWindow = computed(() => hasAnswers(data.value))

const aiEmpty = computed(() =>
  hasAnswersInWindow.value
    ? null
    : {
        title: `No AI answers in the last ${days.value} days.`,
        body: 'Answers appear after the engines are asked your prompts.',
        action: { label: 'Open prompts', to: promptsLink.value },
      },
)

// The comparison has Google and citations too; it is empty only when no
// measure has anything to show.
const compareEmpty = computed(() => (normalizeVizSpec(specs.value.compare) ? null : aiEmpty.value))

const citationsMissing = computed(() => data.value?.citations?.has_data === false)

const googleEmpty = computed(() => {
  const state = googleState(data.value)
  if (state === 'not_configured') return { kind: 'not_connected', title: "Google results aren't configured on this server." }
  if (state === 'not_checked') {
    return {
      title: 'No Google checks yet.',
      body: 'Check Google for a prompt in Prompts to compare positions.',
      action: { label: 'Open prompts', to: promptsLink.value },
    }
  }
  return null
})

const gaps = computed(() => (hasAnswersInWindow.value ? biggestGaps(data.value) : []))
const headToHead = computed(() => headToHeadRows(data.value))
const site = computed(() => siteRows(data.value))

function promptRoute(promptId) {
  return { name: 'prompt', params: { websiteId: props.websiteId, promptId } }
}

function openPrompt(event) {
  const promptId = event?.label
  if (!promptId) return
  router.push(promptRoute(promptId))
}
</script>

<style scoped>
/* minmax(0, 1fr): a wide chart or table never sets the page width. */
.an-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.an-skeleton {
  display: grid;
  gap: 16px;
}

.an-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.an-alert {
  border-radius: 14px;
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

/* Non-chart sections share the chart frame's look (VizChart's .viz). */
.an-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.an-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
}

.an-section-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.an-link {
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cmp-gaps {
  display: grid;
  gap: 4px;
  list-style: none;
}

.cmp-gap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.cmp-gap:last-child {
  border-bottom: 0;
}

.cmp-gap-text {
  min-width: 0;
  color: var(--foreground);
  overflow-wrap: anywhere;
}

.cmp-gap-text:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cmp-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: middle;
}

.an-table-wrap {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.an-table-wrap:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.an-table {
  width: 100%;
  min-width: 560px;
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
  white-space: nowrap;
}

.an-table tbody th {
  font-weight: 600;
  white-space: nowrap;
}

.an-table tbody tr:last-child > * {
  border-bottom: 0;
}

.an-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.an-table .is-word {
  color: var(--muted-foreground);
}

@container bd-panel (max-width: 560px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .an-card {
    padding: 16px;
  }
}
</style>
