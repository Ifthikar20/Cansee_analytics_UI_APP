<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Answer engines"
      title="Sentiment"
      subtitle="How the AI engines describe you when they name you, and the themes they repeat."
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

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading sentiment">
      <div class="an-kpis">
        <Skeleton v-for="n in 5" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
      <div class="an-two">
        <Skeleton class="h-72 rounded-2xl" />
        <Skeleton class="h-72 rounded-2xl" />
      </div>
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load sentiment."
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
        body="Sentiment needs answers that name you. Visibility shows how often each engine names you."
        :action="{ label: 'Open Visibility', to: visibilityRoute }"
      />

      <template v-else>
        <CoverageLine :coverage="data.coverage" label="Themes" :params="analysisParams" />

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

        <VizChart :spec="specs.tone" :loading="loading" :height="260" :heading-level="2" />

        <VizState
          v-if="themesState === 'not_analyzed'"
          kind="empty"
          title="No answers analyzed yet."
          body="Cansee reads each answer that names you and lists how it describes you. You see the cost before anything runs."
          :action="{ label: analyzeLabel }"
          @action="openAnalysis"
        />
        <VizState
          v-else-if="themesState === 'none'"
          kind="empty"
          title="The analyzed answers don't describe you in a way that repeats."
        />
        <template v-else>
          <div class="an-two">
            <VizChart :spec="specs.positive" :loading="loading" :empty="themeEmpty('positive')" :heading-level="2" />
            <VizChart :spec="specs.negative" :loading="loading" :empty="themeEmpty('negative')" :heading-level="2" />
          </div>
          <ThemesTable :website-id="websiteId" :themes="data.themes || []" :days="days" @open-answer="openAnswer" />
        </template>

        <VizChart :spec="specs.byEngine" :loading="loading" :heading-level="2" />
        <VizChart :spec="specs.byPrompt" :loading="loading" :heading-level="2" @select="openPrompt" />

        <p class="an-foot">
          Tone is the label recorded with each answer that names you when it was collected. Themes are read from each answer by Claude Haiku 5.5; every quote appears word for word in the answer.
        </p>
      </template>
    </template>

    <InsightRunDialog kind="answer_analysis" />
    <ChatDetailModal :website-id="websiteId" :result-id="answerId" :open="!!answerId" @close="answerId = ''" />
  </div>
</template>

<script setup>
// Sentiment (contract 3c): the tone stored with every answer that names you
// (no analysis needed), and the themes Claude Haiku reads from analyzed
// answers, each with a quote that appears word for word in the answer.
// Filters live in the URL query; "Analyze answers" opens the analysis run
// dialog, which shows the cost before anything runs.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CircleX, Sparkles } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { ENGINES } from '@/lib/engines'
import {
  sentimentByEngine, sentimentByPrompt, sentimentTiles, themesChart, themesOfTone, toneOverTime,
} from '@/lib/analytics/answerSpecs'
import { periodDays } from '@/lib/analytics/visibilitySpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import CoverageLine from '@/components/analytics/CoverageLine.vue'
import EngineSelect from '@/components/analytics/EngineSelect.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import PromptSelect from '@/components/analytics/PromptSelect.vue'
import ThemesTable from '@/components/analytics/ThemesTable.vue'
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

const router = useRouter()

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
  () => insightsApi.sentiment(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

// A prompt in the URL that is no longer tracked here: drop the filter.
watch(failure, (f) => {
  if (f?.status === 404 && prompt.value) prompt.value = ''
})

const disabled = computed(() => failure.value?.code === 'insights_disabled')

// ── The analysis run: started from the header, the coverage line or the themes ──
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
const analyzeLabel = computed(() => {
  const n = Number(data.value?.coverage?.not_analyzed) || 0
  return `Analyze ${integer.format(n)} ${n === 1 ? 'answer' : 'answers'}`
})

// ── What is on screen ──
const engineOptions = computed(() => data.value?.engines || [])
const promptOptions = computed(() => data.value?.prompts || [])
const days = computed(() => periodDays(data.value?.window?.period || period.value))
const visibilityRoute = computed(() => ({ name: 'visibility', params: { websiteId: props.websiteId } }))

const tiles = computed(() => sentimentTiles(data.value))

const specs = computed(() => {
  const d = data.value
  return {
    tone: toneOverTime(d),
    positive: themesChart(d, 'positive'),
    negative: themesChart(d, 'negative'),
    byEngine: sentimentByEngine(d),
    byPrompt: sentimentByPrompt(d),
  }
})

// Themes exist only for analyzed answers.
const themesState = computed(() => {
  const d = data.value
  if (!(Number(d?.coverage?.analyzed) > 0)) return 'not_analyzed'
  return (d?.themes || []).length ? 'ready' : 'none'
})

// One tone has themes and the other none (both empty is the section state above).
const NO_THEMES = { title: 'None of the analyzed answers describe you this way.' }

function themeEmpty(tone) {
  return themesOfTone(data.value, tone).length ? null : NO_THEMES
}

// ── Answers and prompts ──
const answerId = ref('')

function openAnswer(resultId) {
  answerId.value = resultId || ''
}

function openPrompt(event) {
  const promptId = event?.label
  if (!promptId) return
  router.push({ name: 'prompt', params: { websiteId: props.websiteId, promptId } })
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
