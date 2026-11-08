<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Website traffic"
      title="Traffic"
      subtitle="Real visits to your site, from the source you connect."
    />

    <FilterRow>
      <SourceSelect v-model="source" :sources="sourceList" :auto-source="autoSource" />
      <PeriodSelect v-model="period" />
    </FilterRow>

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading traffic">
      <Skeleton class="h-16 rounded-2xl" />
      <div class="an-kpis">
        <Skeleton v-for="n in 3" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
    </div>

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load traffic."
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

      <VizState v-if="pageEmpty" v-bind="pageEmpty" @action="reload" />

      <template v-else>
        <SourceBanner
          :source-label="data.source_label || ''"
          :metric-label="data.metric_label || ''"
          :notes="data.notes || []"
          :stale="Boolean(data.stale)"
        />

        <section class="an-kpis" aria-label="Key numbers">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :kind="tile.kind"
            :state-text="tile.stateText"
            :delta="tile.delta"
          />
        </section>

        <VizChart :spec="seriesSpec" :loading="loading" :height="260" :heading-level="2" />

        <VizChart :spec="countriesSpec" :loading="loading" :empty="countriesEmpty" :height="300" :heading-level="2" />

        <div class="an-two">
          <VizChart :spec="referrersChart" :loading="loading" :empty="referrersEmpty" :heading-level="2" />
          <VizChart :spec="pagesChart" :loading="loading" :empty="pagesEmpty" :heading-level="2" @retry="reload" />
        </div>

        <VizChart :spec="devicesChart" :loading="loading" :empty="devicesEmpty" :heading-level="2" @retry="reload" />
      </template>
    </template>

    <!-- What each source can measure: stays whatever the state above. -->
    <section v-if="sourceList.length" class="an-card" aria-labelledby="tp-sources-title">
      <header>
        <h2 id="tp-sources-title" class="an-card-title">What each source can measure</h2>
        <p class="an-card-sub">Each source counts something different, so its numbers only mean what it counts.</p>
      </header>
      <SourceCapabilities :sources="sourceList" />
    </section>
  </div>
</template>

<script setup>
// Website traffic (contract 4c) from the Cansee pixel, Google Analytics 4
// or Cloudflare, with each source's own caveats. A source that is not
// connected, or a field it cannot measure, says so in words.
import { computed } from 'vue'
import { CircleX } from '@lucide/vue'
import trafficApi from '@/api/traffic'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useQueryState } from '@/composables/analytics/useQueryState'
import {
  countriesMap, devicesSpec, pagesSpec, referrersSpec, trafficEmpty, trafficSeries, trafficTiles,
} from '@/lib/analytics/trafficSpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import SourceSelect from '@/components/analytics/SourceSelect.vue'
import SourceBanner from '@/components/analytics/SourceBanner.vue'
import SourceCapabilities from '@/components/analytics/SourceCapabilities.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const { source, period } = useQueryState(
  { source: 'auto', period: '30d' },
  { allowed: { source: ['auto', 'pixel', 'ga4', 'cloudflare'], period: ['7d', '30d', '90d'] } },
)

const params = computed(() => ({ period: period.value, source: source.value }))

const sourcesQuery = useAnalyticsQuery(
  () => trafficApi.sources(props.websiteId).then((res) => res.data),
  () => [props.websiteId],
)
const { data, loading, error, stale, reload } = useAnalyticsQuery(
  () => trafficApi.traffic(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

const sourceList = computed(() => sourcesQuery.data.value?.sources || [])
const autoSource = computed(() => sourcesQuery.data.value?.default_source || '')

const pageEmpty = computed(() => trafficEmpty(data.value))
const tiles = computed(() => trafficTiles(data.value, { period: data.value?.period || period.value }))

const label = computed(() => data.value?.source_label || 'this source')
function notMeasured(note) {
  return { title: `Not measured by ${label.value}.`, body: note || '' }
}

// Pages and devices are null only when Cloudflare's breakdown query failed
// (the requests by day and country still came): a failure, not a gap.
function breakdownFailed() {
  const source = data.value?.source_label || 'This source'
  return { kind: 'error', title: `${source}'s breakdown couldn't be loaded just now.`, action: { label: 'Try again' } }
}

const seriesSpec = computed(() => trafficSeries(data.value))

const countriesSpec = computed(() => countriesMap(data.value))
const countriesEmpty = computed(() => {
  const rows = data.value?.countries
  if (rows === null || rows === undefined) return notMeasured()
  return rows.length ? null : { title: 'No visitor countries recorded in this period.' }
})

const REFERRERS_NOTE = 'Cloudflare does not report referrers on this plan.'
const referrersChart = computed(() => referrersSpec(data.value))
const referrersEmpty = computed(() => {
  const rows = data.value?.referrers
  if (rows === null || rows === undefined) {
    const note = (data.value?.notes || []).find((n) => n === REFERRERS_NOTE)
    return notMeasured(note)
  }
  return rows.length ? null : { title: 'No referrers recorded in this period.' }
})

const pagesChart = computed(() => pagesSpec(data.value))
const pagesEmpty = computed(() => {
  const rows = data.value?.pages
  if (rows === null || rows === undefined) return breakdownFailed()
  return rows.length ? null : { title: 'No pages recorded in this period.' }
})

const devicesChart = computed(() => devicesSpec(data.value))
const devicesEmpty = computed(() => {
  const rows = data.value?.devices
  if (rows === null || rows === undefined) return breakdownFailed()
  return rows.length ? null : { title: 'No devices recorded in this period.' }
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

.an-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.an-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

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

.an-card-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.an-card-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 13px;
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

/* The page renders in the board's side panel: its width decides. */
@container bd-panel (max-width: 760px) {
  .an-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container bd-panel (max-width: 480px) {
  .an-kpis {
    grid-template-columns: minmax(0, 1fr);
  }
  .an-card {
    padding: 16px;
  }
}
</style>
