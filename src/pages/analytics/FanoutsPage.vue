<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Answer engines"
      title="Query fan-outs"
      subtitle="The web searches the engines ran while answering your prompts, and where you rank on Google for them."
    />

    <FilterRow>
      <PeriodSelect v-model="period" />
      <EngineSelect v-model="engine" :engines="engineOptions" />
      <PromptSelect v-model="prompt" :prompts="promptOptions" />
    </FilterRow>

    <InsightRunProgress
      v-if="googleCheck.run.value"
      :run="googleCheck.run.value"
      :stopping="googleCheck.stopping.value"
      :stop-error="googleCheck.stopError.value"
      @stop="googleCheck.stop"
      @dismiss="googleCheck.dismiss"
    />

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading query fan-outs">
      <div class="an-kpis">
        <Skeleton v-for="n in 4" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-72 rounded-2xl" />
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load query fan-outs."
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

      <VizState v-if="pageEmpty" v-bind="pageEmpty" />

      <template v-else>
        <Alert v-if="data.web_search && data.web_search.enabled === false" class="an-alert">
          <Info />
          <AlertTitle>Web search is off on this server now; these searches were recorded while it was on.</AlertTitle>
        </Alert>

        <section class="an-kpis" aria-label="Key numbers">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :kind="tile.kind || 'number'"
            :state-text="tile.stateText"
          />
        </section>

        <VizChart :spec="enginesSpec" :loading="loading" :heading-level="2" />

        <p v-if="!singlePrompt && unreported > 0" class="an-note">
          {{ integer.format(unreported) }} searches didn't report their text.
        </p>

        <FanoutPromptCard
          v-for="p in data.prompts || []"
          :key="p.prompt_id"
          :website-id="websiteId"
          :prompt="p"
          :unreported="singlePrompt ? unreported : 0"
          :max-queries="maxQueries"
          :check-blocked="checkBlocked"
          @check="openCheck"
        />
      </template>
    </template>

    <InsightRunDialog kind="fanout_google" />
  </div>
</template>

<script setup>
// Query fan-outs (contract 8): the web searches ChatGPT and Claude ran while
// answering your prompts, recorded from their web search, and where you
// rank on Google for each one. Searches picked on a prompt's card go to
// the Google check dialog, which shows the cost before anything runs.
import { computed, ref, watch } from 'vue'
import { CircleX, Info } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { isActiveInsightRun, useInsightRun } from '@/composables/analytics/useInsightRun'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { ENGINES, engineMeta } from '@/lib/engines'
import { fanoutEngines, fanoutsEmpty, fanoutTiles, unreportedSearches } from '@/lib/analytics/researchSpecs'
import { periodDays } from '@/lib/analytics/visibilitySpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import EngineSelect from '@/components/analytics/EngineSelect.vue'
import FanoutPromptCard from '@/components/analytics/FanoutPromptCard.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import PromptSelect from '@/components/analytics/PromptSelect.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const integer = new Intl.NumberFormat('en-US')

const { period, engine, prompt } = useQueryState(
  { period: '30d', engine: '', prompt: '' },
  { allowed: { period: ['7d', '30d', '90d'], engine: ENGINES.map((e) => e.key) } },
)

const params = computed(() => {
  const p = { period: period.value }
  if (engine.value) p.engine = engine.value
  if (prompt.value) p.prompt_id = prompt.value
  return p
})

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.fanOuts(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

// A prompt in the URL that is no longer tracked here: drop the filter.
watch(failure, (f) => {
  if (f?.status === 404 && prompt.value) prompt.value = ''
})

const disabled = computed(() => failure.value?.code === 'insights_disabled')

// ── Filters: the engines that report their searches; the prompts of an
// unfiltered load, so choosing one never hides the others ──
const engineOptions = computed(() =>
  (data.value?.web_search?.engines || [])
    .filter((e) => e.reports_queries)
    .map((e) => ({ key: e.key, label: engineMeta(e.key).label, configured: true })),
)

const knownPrompts = ref([])
watch(data, (d) => {
  if (d && !d.filters?.prompt_id) {
    knownPrompts.value = (d.prompts || []).map((p) => ({ prompt_id: p.prompt_id, text: p.text }))
  }
})
watch(
  () => props.websiteId,
  () => {
    knownPrompts.value = []
  },
)
const promptOptions = computed(() => {
  const list = [...knownPrompts.value]
  for (const p of data.value?.prompts || []) {
    if (!list.some((k) => String(k.prompt_id) === String(p.prompt_id))) list.push({ prompt_id: p.prompt_id, text: p.text })
  }
  return list
})

// ── What is on screen ──
const days = computed(() => periodDays(data.value?.window?.period || period.value))
const pageEmpty = computed(() => fanoutsEmpty(data.value, { days: days.value, websiteId: props.websiteId }))

const tiles = computed(() => fanoutTiles(data.value))
const enginesSpec = computed(() => fanoutEngines(data.value))

// The totals cover every prompt shown, so with one prompt they are its own.
const singlePrompt = computed(() => (data.value?.prompts || []).length === 1)
const unreported = computed(() => unreportedSearches(data.value?.totals))

// ── The Google check of picked searches ──
const googleCheck = useInsightRun('fanout_google', { websiteId: () => props.websiteId, onFinished: () => reload() })

const maxQueries = computed(() => Number(googleCheck.options.value?.limits?.max_units) || 10)
const checkBlocked = computed(() => {
  const o = googleCheck.options.value
  if (o?.configured && o.configured.google === false) return "Google results aren't configured on this server."
  if (isActiveInsightRun(googleCheck.run.value)) return 'Fan-out Google check is already running for this project.'
  return ''
})

function openCheck(queries) {
  googleCheck.open({ queries })
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.an-note {
  color: var(--muted-foreground);
  font-size: 13px;
}

@container bd-panel (max-width: 760px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
