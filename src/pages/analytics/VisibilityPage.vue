<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="AI visibility"
      :title="projectName"
      subtitle="How often the AI engines name you, next to whom, in what tone, and which sources they rely on."
    />

    <FilterRow>
      <PeriodSelect v-model="period" />
      <EngineSelect v-model="engine" :engines="engineOptions" />
      <PromptSelect v-model="prompt" :prompts="promptOptions" />
    </FilterRow>

    <!-- First load: the header and filters are already up. -->
    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading visibility">
      <div class="an-kpis">
        <Skeleton v-for="n in 5" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
      <div class="an-two">
        <Skeleton class="h-72 rounded-2xl" />
        <Skeleton class="h-72 rounded-2xl" />
      </div>
    </div>

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load visibility."
      :action="{ label: 'Try again' }"
      @action="reload"
    />

    <template v-else>
      <!-- A refresh failed: the numbers below are from the last good load. -->
      <Alert v-if="stale" variant="destructive" class="an-alert">
        <CircleX />
        <AlertTitle>We couldn't refresh this page. Showing the last loaded numbers.</AlertTitle>
        <AlertDescription>
          <button type="button" class="an-retry" @click="reload">Try again</button>
        </AlertDescription>
      </Alert>

      <VizState v-if="pageEmpty" v-bind="pageEmpty" />

      <template v-else>
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

        <VizChart :spec="specs.overTime" :loading="loading" :height="260" :heading-level="2" />

        <div class="an-two">
          <VizChart :spec="specs.sov" :loading="loading" :empty="sovEmpty" :heading-level="2" />
          <VizChart :spec="specs.sovTotal" :loading="loading" :empty="sovEmpty" selected="you" :heading-level="2" />
        </div>
        <router-link :to="{ name: 'competitors', params: { websiteId } }" class="an-compare">
          Compare with your competitors on Google and in AI answers
        </router-link>

        <VizChart :spec="specs.sentiment" :loading="loading" :empty="sentimentEmpty" :heading-level="2" />

        <div class="an-two">
          <VizChart :spec="specs.citations" :loading="loading" :empty="citationsEmpty" :heading-level="2" />
          <VizChart :spec="specs.domains" :loading="loading" :empty="domainsEmpty" :heading-level="2" />
        </div>

        <VizChart :spec="specs.byEngine" :loading="loading" :heading-level="2" />

        <VizChart
          :spec="specs.byPrompt"
          :loading="loading"
          :empty="byPromptEmpty"
          :heading-level="2"
          @select="openPrompt"
        />
      </template>
    </template>
  </div>
</template>

<script setup>
// AI visibility over time (contract 5): how often the engines name the
// project, its share of voice, the tone and the sources behind the
// answers, by engine and by prompt. Filters live in the URL query.
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CircleX } from '@lucide/vue'
import visibilityApi from '@/api/visibility'
import { useAppStore } from '@/stores/app'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { ENGINES } from '@/lib/engines'
import {
  byEngine, byPromptHeatmap, citationsOverTime, hasBrandMentions, hasSentiment, headlineTiles,
  periodDays, sentimentOverTime, shareOfVoiceOverTime, shareOfVoiceTotal, topDomains, visibilityOverTime,
} from '@/lib/analytics/visibilitySpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import EngineSelect from '@/components/analytics/EngineSelect.vue'
import PromptSelect from '@/components/analytics/PromptSelect.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const router = useRouter()
const appStore = useAppStore()

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
  () => visibilityApi.dashboard(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

// A prompt in the URL that is no longer tracked here: drop the filter.
watch(failure, (f) => {
  if (f?.status === 404 && prompt.value) prompt.value = ''
})

const projectName = computed(
  () => data.value?.website?.name || appStore.activeWebsite?.name || 'AI visibility',
)
const engineOptions = computed(() => data.value?.engines || [])
const promptOptions = computed(() => data.value?.prompts || [])
const days = computed(() => periodDays(data.value?.window?.period || period.value))

const OVERVIEW = { name: 'dashboard' }

const pageEmpty = computed(() => {
  const d = data.value
  if (!d) return null
  const reason = d.empty_reason || (d.has_data === false ? 'no_answers' : null)
  if (reason === 'no_prompts') {
    return {
      kind: 'empty',
      title: 'No prompts tracked yet.',
      body: 'Add the questions your buyers ask on the Overview. Cansee asks each AI engine and tracks the answers here.',
      action: { label: 'Go to Overview', to: OVERVIEW },
    }
  }
  if (reason === 'no_engines') {
    return {
      kind: 'not_connected',
      title: 'No AI engine is connected yet.',
      body: 'Visibility needs at least one AI engine. An administrator adds the engine keys on the server.',
    }
  }
  if (reason === 'no_answers') {
    return {
      kind: 'empty',
      title: `No AI answers in the last ${days.value} days.`,
      body: 'Answers appear after the engines are asked your prompts. Use Check now on a prompt, or start research in the Agent.',
      action: { label: 'Go to Overview', to: OVERVIEW },
    }
  }
  return null
})

const tiles = computed(() => headlineTiles(data.value, { period: data.value?.window?.period || period.value }))

const specs = computed(() => {
  const d = data.value
  return {
    overTime: visibilityOverTime(d),
    sov: shareOfVoiceOverTime(d),
    sovTotal: shareOfVoiceTotal(d),
    sentiment: sentimentOverTime(d),
    citations: citationsOverTime(d),
    domains: topDomains(d),
    byEngine: byEngine(d),
    byPrompt: byPromptHeatmap(d),
  }
})

const sovEmpty = computed(() =>
  hasBrandMentions(data.value) ? null : { title: 'No brand was named in these answers.' },
)
const sentimentEmpty = computed(() =>
  hasSentiment(data.value) ? null : { title: "You weren't named in this period, so there is no tone to show." },
)
const NO_CITATIONS = {
  title: 'No cited sources were recorded for these answers.',
  body: 'Sources are read from each answer after it arrives. Engines that answer without sources leave this empty.',
}
const citationsEmpty = computed(() => (data.value?.citations?.has_data === false ? NO_CITATIONS : null))
const domainsEmpty = computed(() =>
  citationsEmpty.value || ((data.value?.citations?.top_domains || []).length ? null : NO_CITATIONS),
)
const byPromptEmpty = computed(() =>
  (data.value?.by_prompt || []).length ? null : { title: 'No prompt has answers in this period.' },
)

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
  border-radius: 14px;
}

/* Sits under the share-of-voice row, as part of it. */
.an-compare {
  justify-self: start;
  margin-top: -12px;
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
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

@media (max-width: 1100px) {
  .an-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .an-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
