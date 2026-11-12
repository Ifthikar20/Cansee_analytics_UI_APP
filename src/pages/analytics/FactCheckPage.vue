<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Answer engines"
      title="Fact check"
      subtitle="What the AI engines state about you, checked against your brand facts and your own pages."
    >
      <template #actions>
        <Button @click="openAnalysis">
          <Sparkles class="size-4" aria-hidden="true" />
          Analyze answers
        </Button>
      </template>
    </AnalyticsHeader>

    <FilterRow>
      <PeriodSelect v-model="period" />
      <EngineSelect v-model="engine" :engines="engineOptions" />
      <PromptSelect v-model="prompt" :prompts="promptOptions" />
    </FilterRow>

    <InsightRunProgress
      v-if="analysis.run.value"
      :run="analysis.run.value"
      :stopping="analysis.stopping.value"
      :stop-error="analysis.stopError.value"
      @stop="analysis.stop"
      @dismiss="analysis.dismiss"
    />

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading the fact check">
      <div class="an-kpis">
        <Skeleton v-for="n in 5" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
      <Skeleton class="h-96 rounded-2xl" />
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load the fact check."
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
        v-if="data.empty_reason === 'no_answers'"
        kind="empty"
        :title="`The engines didn't name you in the last ${days} days.`"
        body="Fact check needs answers that name you."
        :action="{ label: 'Open Visibility', to: visibilityRoute }"
      />

      <template v-else>
        <CoverageLine v-if="data.empty_reason !== 'not_analyzed'" :coverage="data.coverage" label="Claims" :params="analysisParams" />

        <p v-if="evidenceLine" class="an-evidence">
          <span>{{ evidenceLine }}</span>
          <router-link :to="{ name: 'settings-brand-facts' }" class="an-link">Add brand facts</router-link>
        </p>

        <Alert v-if="noEvidence" class="an-alert">
          <CircleAlert />
          <AlertTitle>You have no approved brand facts and none of your pages could be read, so every claim is Not verifiable.</AlertTitle>
          <AlertDescription>
            <router-link :to="{ name: 'settings-brand-facts' }" class="an-retry">Add brand facts</router-link>
          </AlertDescription>
        </Alert>

        <VizState
          v-if="data.empty_reason === 'not_analyzed'"
          kind="empty"
          title="No answers analyzed yet."
          body="Cansee lists the factual claims each answer makes about you and checks them against your brand facts and your own pages. You see the cost before anything runs."
          :action="{ label: analyzeLabel }"
          @action="openAnalysis"
        />

        <VizState
          v-else-if="data.empty_reason === 'no_claims'"
          kind="empty"
          title="The analyzed answers make no checkable claims about you."
        />

        <template v-else>
          <section class="an-kpis" aria-label="Key numbers">
            <VizStatTile
              v-for="tile in tiles"
              :key="tile.key"
              :label="tile.label"
              :value="tile.value"
              :kind="tile.kind || 'number'"
              :state-text="tile.stateText || 'Not measured'"
              :hint="tile.hint || ''"
            />
          </section>

          <VizChart :spec="specs.verdicts" :loading="loading" :height="260" :heading-level="2" />

          <div class="an-two">
            <VizChart :spec="specs.topics" :loading="loading" :heading-level="2" />
            <VizChart :spec="specs.engines" :loading="loading" :heading-level="2" />
          </div>

          <ClaimsTable
            v-model:verdict="verdict"
            v-model:topic="topic"
            :website-id="websiteId"
            :claims="data.claims || []"
            :analyzed="analyzedCount"
            @open-answer="openAnswer"
            @clear-filters="clearClaimFilters"
          />
        </template>

        <p class="an-foot">
          Claims and verdicts are read by Claude Haiku 5.5. Each claim quotes the answer word for word and each verdict quotes your evidence word for word; the verdict is the model's reading of the two.
        </p>
      </template>
    </template>

    <InsightRunDialog kind="answer_analysis" />
    <ChatDetailModal :website-id="websiteId" :result-id="answerId" :open="!!answerId" @close="answerId = ''" />
  </div>
</template>

<script setup>
// Fact check (contract 3d): the factual claims the analyzed answers make
// about you, each checked against your approved brand facts and your own
// pages, with the quotes behind both sides. Filters (period, engine,
// prompt, verdict, topic) live in the URL query. Before any analysis the
// claim numbers read "Not analyzed", never 0.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleAlert, CircleX, Sparkles } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { ENGINES } from '@/lib/engines'
import { TOPICS, VERDICTS } from '@/lib/analytics/insightWords'
import { factCheckTiles, verdictsByEngine, verdictsByTopic, verdictsOverTime } from '@/lib/analytics/answerSpecs'
import { periodDays } from '@/lib/analytics/visibilitySpecs'
import { useAppStore } from '@/stores/app'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import ClaimsTable from '@/components/analytics/ClaimsTable.vue'
import CoverageLine from '@/components/analytics/CoverageLine.vue'
import EngineSelect from '@/components/analytics/EngineSelect.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import PromptSelect from '@/components/analytics/PromptSelect.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import ChatDetailModal from '@/components/ChatDetailModal.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const { period, engine, prompt, verdict, topic } = useQueryState(
  { period: '30d', engine: '', prompt: '', verdict: '', topic: '' },
  {
    allowed: {
      period: ['7d', '30d', '90d'],
      engine: ENGINES.map((e) => e.key),
      verdict: Object.keys(VERDICTS),
      topic: Object.keys(TOPICS),
    },
  },
)

const params = computed(() => {
  const p = { period: period.value }
  if (engine.value) p.engine = engine.value
  if (prompt.value) p.prompt_id = prompt.value
  if (verdict.value) p.verdict = verdict.value
  if (topic.value) p.topic = topic.value
  return p
})

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.factCheck(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

// A prompt in the URL that is no longer tracked here: drop the filter.
watch(failure, (f) => {
  if (f?.status === 404 && prompt.value) prompt.value = ''
})

const disabled = computed(() => failure.value?.code === 'insights_disabled')

// ── The analysis run ──
const analysis = useInsightRun('answer_analysis', { websiteId: () => props.websiteId, onFinished: () => reload() })

const analysisParams = computed(() => ({
  period: period.value,
  engines: engine.value ? [engine.value] : null,
  prompt_ids: prompt.value ? [prompt.value] : null,
  reanalyze: false,
}))

function openAnalysis() {
  analysis.open(analysisParams.value)
}

const integer = new Intl.NumberFormat('en-US')

function plural(n, one, many) {
  return `${integer.format(n)} ${n === 1 ? one : many}`
}

const analyzeLabel = computed(() => {
  const n = Number(data.value?.coverage?.not_analyzed) || 0
  return `Analyze ${plural(n, 'answer', 'answers')}`
})

// ── What is on screen ──
const engineOptions = computed(() => data.value?.engines || [])
const promptOptions = computed(() => data.value?.prompts || [])
const days = computed(() => periodDays(data.value?.window?.period || period.value))
const visibilityRoute = computed(() => ({ name: 'visibility', params: { websiteId: props.websiteId } }))
const analyzedCount = computed(() => {
  const n = data.value?.coverage?.analyzed
  return typeof n === 'number' ? n : null
})

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const domain = computed(() => {
  const own = hostOf(appStore.activeWebsite?.url || '')
  if (own) return own
  const page = (data.value?.evidence?.pages || [])[0]
  return page ? hostOf(page.url) : ''
})

const pagesRead = computed(() => (data.value?.evidence?.pages || []).filter((p) => p.state === 'ok').length)

// "Checked against 14 approved brand facts and 2 pages of notion.so."
// Only once something was checked: before any analysis no page was read.
const evidenceLine = computed(() => {
  const e = data.value?.evidence
  if (!e || !(Number(data.value?.coverage?.analyzed) > 0)) return ''
  const facts = Number(e.facts) || 0
  let line = `Checked against ${plural(facts, 'approved brand fact', 'approved brand facts')} and ${plural(pagesRead.value, 'page', 'pages')}`
  line += domain.value ? ` of ${domain.value}.` : '.'
  const pending = Number(e.facts_pending) || 0
  if (pending > 0) {
    line += pending === 1
      ? ' 1 fact waiting for review is not used.'
      : ` ${integer.format(pending)} facts waiting for review are not used.`
  }
  return line
})

// Claims were checked with nothing to check them against.
const noEvidence = computed(() => {
  const d = data.value
  if (!d?.evidence || !(Number(d.coverage?.analyzed) > 0)) return false
  return !(Number(d.evidence.facts) > 0) && pagesRead.value === 0
})

const tiles = computed(() => factCheckTiles(data.value))

const specs = computed(() => {
  const d = data.value
  return {
    verdicts: verdictsOverTime(d),
    topics: verdictsByTopic(d),
    engines: verdictsByEngine(d),
  }
})

function clearClaimFilters() {
  const query = { ...route.query }
  delete query.verdict
  delete query.topic
  router.replace({ query })
}

// ── Answers ──
const answerId = ref('')

function openAnswer(resultId) {
  answerId.value = resultId || ''
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.an-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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

.an-evidence {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  color: var(--muted-foreground);
  font-size: 13.5px;
  line-height: 1.5;
}

.an-link {
  color: var(--foreground);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.an-foot {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

@container bd-panel (max-width: 760px) {
  .an-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .an-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container bd-panel (max-width: 560px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
