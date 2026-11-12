<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="AI traffic"
      title="AI traffic"
      subtitle="Visits that came from AI assistants, and AI crawlers reading your site."
    />

    <FilterRow>
      <SourceSelect
        v-model="source"
        label="Source for AI visits"
        :sources="sourceList"
        :auto-source="autoSource"
        :keys="['pixel', 'ga4']"
      />
      <PeriodSelect v-model="period" />
    </FilterRow>

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading AI traffic">
      <div class="an-kpis">
        <Skeleton v-for="n in 3" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
    </div>

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load AI traffic."
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

      <!-- The focused section first, in DOM order as on screen. -->
      <template v-for="key in sectionOrder" :key="key">
        <!-- Visits from AI assistants (pixel or GA4) -->
        <section v-if="key === 'visits'" class="an-section" aria-labelledby="ai-visits-title">
          <header class="an-section-head">
            <h2 id="ai-visits-title" class="an-section-title">Visits from AI assistants</h2>
            <p v-if="referralsLine" class="an-section-sub">{{ referralsLine }}</p>
          </header>

          <VizState v-if="referralsUnavailable" v-bind="referralsUnavailable" @action="reload" />

          <template v-else>
            <div class="an-kpis">
              <VizStatTile
                v-for="tile in referralTileList"
                :key="tile.key"
                :label="tile.label"
                :value="tile.value"
                :kind="tile.kind"
                :state-text="tile.stateText"
                :hint="tile.hint"
              />
            </div>

            <VizState v-if="referralsZero" v-bind="referralsZero" />

            <template v-else>
              <VizChart :spec="visitsSpec" :loading="loading" :height="260" :heading-level="3" />
              <div class="an-two">
                <VizChart :spec="assistantsSpec" :loading="loading" :heading-level="3" />
                <VizChart
                  :spec="countriesSpec"
                  :loading="loading"
                  :empty="(referrals.countries || []).length ? null : { title: 'No countries recorded for these visits.' }"
                  :heading-level="3"
                />
              </div>
              <VizChart
                :spec="landingSpec"
                :loading="loading"
                :empty="(referrals.landing_pages || []).length ? null : { title: 'No landing pages recorded for these visits.' }"
                :heading-level="3"
              />
            </template>
          </template>
        </section>

        <!-- AI crawlers (Cloudflare only) -->
        <section v-else-if="key === 'crawlers'" class="an-section" aria-labelledby="ai-crawlers-title">
          <header class="an-section-head">
            <h2 id="ai-crawlers-title" class="an-section-title">AI crawlers</h2>
            <p class="an-section-sub">{{ crawlerLine }}</p>
          </header>

          <VizState v-if="crawlersUnavailable" v-bind="crawlersUnavailable" @action="reload" />

          <template v-else>
            <div class="an-kpis">
              <VizStatTile
                v-for="tile in crawlerTileList"
                :key="tile.key"
                :label="tile.label"
                :value="tile.value"
                :kind="tile.kind"
                :state-text="tile.stateText"
                :hint="tile.hint"
              />
            </div>

            <VizState v-if="crawlersZero" v-bind="crawlersZero" />

            <template v-else>
              <VizChart :spec="botsSpec" :loading="loading" :heading-level="3">
                <template #custom>
                  <div class="an-scroll">
                    <table class="an-table">
                      <caption class="sr-only">Requests by crawler, with operator and purpose</caption>
                      <thead>
                        <tr>
                          <th scope="col">Crawler</th>
                          <th scope="col">Operator</th>
                          <th scope="col">Purpose</th>
                          <th scope="col" class="is-num">Requests</th>
                          <th scope="col" class="is-num">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in botRows" :key="row.key">
                          <th scope="row">{{ row.name }}</th>
                          <td>{{ row.operator || 'Unknown' }}</td>
                          <td>{{ row.purpose }}</td>
                          <td class="is-num">{{ countText(row.requests) }}</td>
                          <td class="is-num">{{ shareText(row.share) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
              </VizChart>
              <VizChart :spec="crawlerDaysSpec" :loading="loading" :heading-level="3" />
              <VizChart :spec="purposesChart" :loading="loading" :heading-level="3" />
              <CrawlerPathsTable :paths="topPaths" :bots="crawlers.bots || []" />
            </template>

            <footer class="an-foot">
              <p v-for="line in crawlerNotes" :key="line">{{ line }}</p>
            </footer>
          </template>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
// AI traffic (contract 4e): visits referred by AI assistants (pixel or
// GA4) and AI crawler requests (Cloudflare only, when its plan allows the
// query). Each half says in words when its source cannot show it. The
// board opens it for two widgets: `focus` puts that half first.
import { computed } from 'vue'
import { CircleX } from '@lucide/vue'
import trafficApi from '@/api/traffic'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useQueryState } from '@/composables/analytics/useQueryState'
import {
  aiCountries, aiVisitsSeries, byAssistant, crawlerBots, crawlerFootnotes, crawlerRows, crawlerSeries,
  crawlerSourceLine, crawlersEmpty, crawlerTiles, landingPages, purposesSpec, referralTiles, referralsEmpty,
} from '@/lib/analytics/trafficSpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import SourceSelect from '@/components/analytics/SourceSelect.vue'
import CrawlerPathsTable from '@/components/analytics/CrawlerPathsTable.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
  // 'visits' | 'crawlers': the section shown first (the AI traffic and AI
  // crawlers widgets).
  focus: { type: String, default: '' },
})

const SECTIONS = ['visits', 'crawlers']
const sectionOrder = computed(() =>
  SECTIONS.includes(props.focus) ? [props.focus, ...SECTIONS.filter((key) => key !== props.focus)] : SECTIONS,
)

const PERIOD_LABELS = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }

const { source, period } = useQueryState(
  { source: 'auto', period: '30d' },
  { allowed: { source: ['auto', 'pixel', 'ga4'], period: ['7d', '30d', '90d'] } },
)

const params = computed(() => ({ period: period.value, source: source.value }))

const sourcesQuery = useAnalyticsQuery(
  () => trafficApi.sources(props.websiteId).then((res) => res.data),
  () => [props.websiteId],
)
const { data, loading, error, stale, reload } = useAnalyticsQuery(
  () => trafficApi.aiTraffic(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

const sourceList = computed(() => sourcesQuery.data.value?.sources || [])

// Auto for AI visits: the pixel when it has events, else Google Analytics.
const autoSource = computed(() => {
  const resolved = data.value?.referrals?.source
  if (source.value === 'auto' && resolved) return resolved
  const pixel = sourceList.value.find((s) => s.key === 'pixel')
  const ga4 = sourceList.value.find((s) => s.key === 'ga4')
  if (pixel?.has_data) return 'pixel'
  if (ga4?.connected && ga4.status === 'ok') return 'ga4'
  return ''
})

const referrals = computed(() => data.value?.referrals || {})
const crawlers = computed(() => data.value?.crawlers || {})

const referralsLine = computed(() => {
  const label = referrals.value.source_label
  const when = PERIOD_LABELS[data.value?.period || period.value] || ''
  return label ? `${label} · ${when}` : when
})

// Not available at all, versus measured with no AI visit.
const referralsUnavailable = computed(() =>
  referrals.value.available === false ? referralsEmpty(referrals.value) : null,
)
const referralsZero = computed(() =>
  referrals.value.available === false ? null : referralsEmpty(referrals.value),
)
const referralTileList = computed(() => referralTiles(referrals.value))
const visitsSpec = computed(() => aiVisitsSeries(referrals.value))
const assistantsSpec = computed(() => byAssistant(referrals.value))
const countriesSpec = computed(() => aiCountries(referrals.value))
const landingSpec = computed(() => landingPages(referrals.value))

const crawlerLine = computed(() => crawlerSourceLine(crawlers.value))
const crawlersUnavailable = computed(() =>
  crawlers.value.available === false ? crawlersEmpty(crawlers.value) : null,
)
const crawlersZero = computed(() => (crawlers.value.available === false ? null : crawlersEmpty(crawlers.value)))
const crawlerTileList = computed(() => crawlerTiles(crawlers.value))
const botsSpec = computed(() => crawlerBots(crawlers.value))
const botRows = computed(() => crawlerRows(crawlers.value))
const crawlerDaysSpec = computed(() => crawlerSeries(crawlers.value))
const purposesChart = computed(() => purposesSpec(crawlers.value))
const crawlerNotes = computed(() => crawlerFootnotes(crawlers.value))
// The report keeps the 50 most crawled paths (the Pages tab joins them all);
// this page lists the first 10.
const topPaths = computed(() => (crawlers.value.paths || []).slice(0, 10))

const integer = new Intl.NumberFormat('en-US')

function countText(value) {
  return typeof value === 'number' ? integer.format(value) : 'Not measured'
}

function shareText(value) {
  if (typeof value !== 'number') return 'Not measured'
  return `${value < 10 && !Number.isInteger(value) ? value.toFixed(1) : Math.round(value)}%`
}
</script>

<style scoped>
.an-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 28px;
}

.an-skeleton {
  display: grid;
  gap: 16px;
}

.an-section {
  display: grid;
  /* One column that may shrink below its content, so the crawled-pages
     table scrolls inside its frame on phones. */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.an-section-title {
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.an-section-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 13px;
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

.an-foot {
  display: grid;
  gap: 2px;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.5;
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

.an-scroll {
  overflow-x: auto;
}

.an-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 13px;
}

.an-table th,
.an-table td {
  padding: 9px 10px;
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

.an-table tbody tr:last-child > * {
  border-bottom: 0;
}

.an-table .is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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
}
</style>
