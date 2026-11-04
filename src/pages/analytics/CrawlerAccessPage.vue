<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Your site"
      title="Crawler access"
      subtitle="Whether AI crawlers may read your site and what they find without running JavaScript."
    >
      <template #actions>
        <TooltipProvider :delay-duration="150">
          <Tooltip :disabled="!runBlocker">
            <TooltipTrigger as-child>
              <Button
                class="rounded-full"
                :aria-disabled="runBlocker ? 'true' : undefined"
                :class="{ 'is-blocked': runBlocker }"
                @click="openAudit"
              >Run audit</Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="max-w-72 whitespace-normal leading-relaxed">{{ runBlocker }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </template>
    </AnalyticsHeader>

    <p v-if="lastAudited" class="ca-last">Last audited {{ lastAudited }}</p>

    <InsightRunProgress
      v-if="audit.run.value"
      :run="audit.run.value"
      :stopping="audit.stopping.value"
      :stop-error="audit.stopError.value"
      @stop="audit.stop()"
      @dismiss="audit.dismiss()"
    />

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading crawler access">
      <div class="an-kpis">
        <Skeleton v-for="n in 4" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
    </div>

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load crawler access."
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

      <VizState
        v-if="!you"
        kind="empty"
        title="No audit yet."
        :body="noAuditBody"
        :action="{ label: 'Run audit' }"
        @action="openAudit"
      />

      <template v-else>
        <div class="an-kpis">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :state-text="tile.stateText"
          />
        </div>

        <div v-if="notices.length || llmsText" class="ca-notices">
          <Alert v-for="n in notices" :key="n.key" class="an-alert">
            <component :is="n.tone === 'warning' ? TriangleAlert : Info" />
            <AlertTitle>{{ n.text }}</AlertTitle>
          </Alert>
          <p v-if="llmsText" class="ca-llms">{{ llmsText }}</p>
        </div>

        <BotAccessTable :payload="data" />

        <VizChart :spec="checksChart" :loading="loading" :heading-level="3" />

        <PageAuditTable :website-id="websiteId" :audit="you" :checks="data.checks || []" :bots="data.bots || []" />

        <VizState
          v-if="!competitorsTracked"
          kind="empty"
          title="Track competitors in Project settings to compare their sites."
          :action="{ label: 'Open project settings', to: { name: 'settings-project' } }"
          compact
        />
        <section v-else class="ca-bench" aria-label="Home pages compared">
          <VizChart :spec="benchmarkChart" :loading="loading" :heading-level="3" selected="you" />
          <div class="ca-card">
            <CrawlerBenchmarkTable :brands="brands" :bots="data.bots || []" />
          </div>
        </section>
      </template>
    </template>

    <InsightRunDialog kind="site_audit" />
  </div>
</template>

<script setup>
// Crawler access (p2_contract.md 5): whether the AI crawlers may read the
// project's site (robots.txt, llms.txt) and what they find on its pages
// without running JavaScript, next to the competitors' home pages. The
// audit is a free run (site_audit) with its own cooldown and daily limit;
// "Run audit" is disabled with the server's reason while it cannot run.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CircleX, Info, TriangleAlert } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import {
  benchmarkBrands, benchmarkSpec, checksSpec, crawlerNotices, crawlerTiles, llmsLine,
} from '@/lib/analytics/siteSpecs'
import { timeAgo } from '@/utils/timeAgo'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import BotAccessTable from '@/components/analytics/BotAccessTable.vue'
import CrawlerBenchmarkTable from '@/components/analytics/CrawlerBenchmarkTable.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import PageAuditTable from '@/components/analytics/PageAuditTable.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.crawlerAccess(props.websiteId).then((res) => res.data),
  () => [props.websiteId],
  { resetOn: () => props.websiteId },
)

const audit = useInsightRun('site_audit', {
  websiteId: () => props.websiteId,
  onFinished: () => {
    reload()
    checkBlocker()
  },
})

const you = computed(() => data.value?.you || null)
const tiles = computed(() => crawlerTiles(data.value))
const notices = computed(() => crawlerNotices(you.value))
const llmsText = computed(() => llmsLine(you.value?.llms_txt))
const checksChart = computed(() => checksSpec(you.value, data.value?.checks))
const lastAudited = computed(() => (you.value?.audited_at ? timeAgo(you.value.audited_at) : ''))

// A 503 (insights turned off) says why; other failures only that the page did not load.
const errorBody = computed(() => (failure.value?.code === 'insights_disabled' ? failure.value.message : ''))

const maxPages = computed(() => audit.options.value?.limits?.max_units || 20)
const noAuditBody = computed(
  () =>
    `Cansee reads your robots.txt and llms.txt and fetches up to ${maxPages.value} pages without running JavaScript, the HTML a crawler receives first. Cansee fetches as CanseeAgent, so a site that answers AI crawlers differently can serve them other pages. Nothing is billed.`,
)

// The competitors the project tracks (from the audit's options), else the audited ones.
const tracked = computed(() => audit.options.value?.choices?.competitors || [])
const competitorsTracked = computed(() => tracked.value.length > 0 || (data.value?.competitors || []).length > 0)
const brands = computed(() => benchmarkBrands(data.value, tracked.value))
const benchmarkChart = computed(() => benchmarkSpec(brands.value))

/* ── Run audit: blocked while it cannot run, with the server's reason ── */

const preflightBlocker = ref('')
let blockerTimer = null
let blockerToken = 0

const runBlocker = computed(() => {
  if (audit.active.value) return `${audit.kindLabel.value} is already running for this project.`
  if (audit.optionsFailure.value) return audit.optionsError.value
  return preflightBlocker.value
})

// A free estimate (no side effects) says whether an audit can start now:
// the cooldown after the last audit and the daily limit are the server's.
async function checkBlocker() {
  clearTimeout(blockerTimer)
  const wid = props.websiteId
  const mine = ++blockerToken
  if (!wid || audit.active.value) {
    preflightBlocker.value = ''
    return
  }
  try {
    const res = await insightsApi.estimate(wid, { kind: 'site_audit', params: { competitors: true } })
    if (mine !== blockerToken || wid !== props.websiteId) return
    const estimate = res.data || {}
    preflightBlocker.value = estimate.can_run === false ? estimate.blockers?.[0]?.message || '' : ''
    // Check again once the cooldown has passed.
    const until = Date.parse(audit.options.value?.choices?.cooldown_until || '')
    if (preflightBlocker.value && Number.isFinite(until) && until > Date.now()) {
      blockerTimer = setTimeout(checkBlocker, Math.min(until - Date.now() + 1000, 15 * 60 * 1000))
    }
  } catch {
    // The dialog explains anything the estimate could not.
    if (mine === blockerToken) preflightBlocker.value = ''
  }
}

watch(
  () => [audit.options.value, audit.active.value],
  ([options]) => {
    if (options) checkBlocker()
  },
)

onBeforeUnmount(() => {
  clearTimeout(blockerTimer)
  blockerToken += 1
})

function openAudit() {
  if (runBlocker.value) return
  audit.open({ competitors: true })
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

.ca-last {
  margin-top: -12px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.ca-notices {
  display: grid;
  gap: 10px;
}

.ca-llms {
  color: var(--foreground);
  font-size: 13.5px;
}

.ca-bench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.ca-card {
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.is-blocked {
  cursor: not-allowed;
  opacity: 0.5;
}

@container bd-panel (max-width: 760px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
