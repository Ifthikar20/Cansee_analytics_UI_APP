<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Your site"
      title="Pages"
      subtitle="Each page of your site with what Google, the AI engines, AI visitors and AI crawlers do with it."
    />

    <FilterRow>
      <PeriodSelect v-model="period" />
      <AnSelect v-model="filter" label="Show" :options="PAGE_FILTERS" />
    </FilterRow>

    <InsightRunProgress
      v-if="audit.run.value"
      :run="audit.run.value"
      :stopping="audit.stopping.value"
      :stop-error="audit.stopError.value"
      @stop="audit.stop()"
      @dismiss="audit.dismiss()"
    />

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading your pages">
      <div class="an-kpis">
        <Skeleton v-for="n in 5" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
    </div>

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load your pages."
      :body="errorBody"
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

      <SourceStates :items="sourceItems" />

      <div class="an-kpis">
        <VizStatTile
          v-for="tile in tiles"
          :key="tile.key"
          :label="tile.label"
          :value="tile.value"
          :kind="tile.kind"
          :state-text="tile.stateText"
        />
      </div>

      <VizState v-if="empty" v-bind="empty" @action="onEmptyAction" />

      <template v-else>
        <VizChart :spec="topChart" :loading="loading" :heading-level="3" />
        <SitePagesTable :website-id="websiteId" :payload="data" :days="days" />
        <footer class="an-foot">
          <p>{{ PAGES_FOOTNOTE }}</p>
        </footer>
      </template>
    </template>

    <InsightRunDialog kind="site_audit" />
  </div>
</template>

<script setup>
// Pages (p2_contract.md 6): the project's own URLs joined across Google
// rankings, AI citations, AI visits, AI crawler requests and the crawler
// audit. Each source says in words when it is not on; a page's signal from
// such a source is that word, never 0. Each page offers Ask the agent.
import { computed } from 'vue'
import { CircleX } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import { useQueryState } from '@/composables/analytics/useQueryState'
import {
  PAGE_FILTERS, PAGES_FOOTNOTE, pagesEmpty, pagesSourceStates, pagesTiles, pagesTopSpec,
} from '@/lib/analytics/siteSpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import AnSelect from '@/components/analytics/AnSelect.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import SitePagesTable from '@/components/analytics/SitePagesTable.vue'
import SourceStates from '@/components/analytics/SourceStates.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 }

const { period, filter } = useQueryState(
  { period: '30d', filter: 'all' },
  { allowed: { period: ['7d', '30d', '90d'], filter: PAGE_FILTERS.map((f) => f.value) } },
)

const params = computed(() => ({ period: period.value, filter: filter.value }))
const days = computed(() => PERIOD_DAYS[period.value] || 30)

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.pages(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

// "Run audit" from the empty state; a finished audit adds its pages.
const audit = useInsightRun('site_audit', { websiteId: () => props.websiteId, onFinished: () => reload() })

const errorBody = computed(() => (failure.value?.code === 'insights_disabled' ? failure.value.message : ''))
const sourceItems = computed(() => pagesSourceStates(data.value))
const tiles = computed(() => pagesTiles(data.value))
const topChart = computed(() => pagesTopSpec(data.value))
const empty = computed(() => {
  const state = pagesEmpty(data.value, filter.value)
  if (!state) return null
  const { kind, title, body, action } = state
  return { kind, title, body: body || '', action }
})

function onEmptyAction() {
  if (filter.value !== 'all') filter.value = 'all'
  else audit.open({ competitors: true })
}
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

.an-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
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

.an-foot {
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.5;
}

@container bd-panel (max-width: 760px) {
  .an-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container bd-panel (max-width: 560px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
