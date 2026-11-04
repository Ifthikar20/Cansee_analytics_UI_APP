<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Answer engines"
      title="Prompt research"
      subtitle="Questions people and engines ask around your prompts, with where each one came from."
    >
      <template #actions>
        <Button class="rounded-full" @click="openResearch">
          <Lightbulb class="size-4" aria-hidden="true" />
          Find prompt ideas
        </Button>
      </template>
    </AnalyticsHeader>

    <InsightRunProgress
      v-if="research.run.value"
      :run="research.run.value"
      :stopping="research.stopping.value"
      :stop-error="research.stopError.value"
      @stop="research.stop"
      @dismiss="research.dismiss"
    />

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading prompt ideas">
      <div class="an-kpis">
        <Skeleton v-for="n in 6" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-64 rounded-2xl" />
      <Skeleton class="h-96 rounded-2xl" />
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load prompt ideas."
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

      <SourceStates :items="sourceItems" label="Idea sources" />

      <VizState
        v-if="noIdeas"
        kind="empty"
        title="No ideas yet."
        body="Ideas come from Google's People also ask and related searches on your Google checks, from the searches engines run while answering, and from AI suggestions based on your brand context."
        :action="{ label: 'Find prompt ideas' }"
        @action="openResearch"
      />

      <template v-else>
        <section class="an-kpis" aria-label="Key numbers">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :kind="tile.kind"
            :state-text="tile.stateText || 'Not measured'"
          />
        </section>

        <VizChart :spec="sourcesSpec" :loading="loading" :heading-level="2" />

        <IdeasTable
          v-model:source="source"
          v-model:status="status"
          :website-id="websiteId"
          :ideas="data.ideas || []"
          :busy="busy"
          @track="openTrack"
          @dismiss="(idea) => setStatus(idea, 'dismissed')"
          @restore="(idea) => setStatus(idea, 'new')"
          @open-answer="openAnswer"
        >
          <template #empty>
            <VizState
              kind="empty"
              compact
              title="No ideas match these filters."
              :action="filtersChanged ? { label: 'Clear filters' } : null"
              @action="clearFilters"
            />
          </template>
        </IdeasTable>
      </template>
    </template>

    <InsightRunDialog kind="prompt_research" />
    <TrackIdeaDialog
      v-model:open="trackOpen"
      :website-id="websiteId"
      :idea="trackIdea"
      :track="data?.track || null"
      @tracked="reload"
    />
    <ChatDetailModal :website-id="websiteId" :result-id="answerId" :open="!!answerId" @close="answerId = ''" />
  </div>
</template>

<script setup>
// Prompt research (contract 7): questions around your prompts, from
// Google's People also ask and related searches, the searches the engines
// ran while answering, AI suggestions from your brand context and the
// sub-queries Claude predicts. Each idea shows where it came from instead
// of a volume. Track adds an idea to the tracked prompts after the cost is
// confirmed; filters live in the URL query.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleX, Lightbulb } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import { useQueryState } from '@/composables/analytics/useQueryState'
import { useToast } from '@/composables/useToast'
import { IDEA_SOURCE_KEYS, ideaSourceStates, ideaTiles, ideasBySource } from '@/lib/analytics/researchSpecs'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import IdeasTable from '@/components/analytics/IdeasTable.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import SourceStates from '@/components/analytics/SourceStates.vue'
import TrackIdeaDialog from '@/components/analytics/TrackIdeaDialog.vue'
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
const toast = useToast()

const { source, status } = useQueryState(
  { source: '', status: 'new' },
  { allowed: { source: IDEA_SOURCE_KEYS, status: ['new', 'tracked', 'dismissed'] } },
)

const params = computed(() => {
  const p = { status: status.value }
  if (source.value) p.source = source.value
  return p
})

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.promptIdeas(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

const disabled = computed(() => failure.value?.code === 'insights_disabled')

// ── Find prompt ideas: the research run ──
const research = useInsightRun('prompt_research', { websiteId: () => props.websiteId, onFinished: () => reload() })

function openResearch() {
  research.open({ suggest: true, google_prompt_ids: [] })
}

// ── What is on screen ──
const sourceItems = computed(() => ideaSourceStates(data.value))
const tiles = computed(() => ideaTiles(data.value))
const sourcesSpec = computed(() => ideasBySource(data.value))

// No idea in any status: nothing was found yet, whatever the filters.
const noIdeas = computed(() => {
  const c = data.value?.counts || {}
  return !((Number(c.new) || 0) + (Number(c.tracked) || 0) + (Number(c.dismissed) || 0))
})

const filtersChanged = computed(() => Boolean(source.value) || status.value !== 'new')

function clearFilters() {
  const query = { ...route.query }
  delete query.source
  delete query.status
  router.replace({ query })
}

// ── Row actions ──
const busy = ref([])

async function setStatus(idea, next) {
  if (!idea?.id || busy.value.includes(idea.id)) return
  busy.value = [...busy.value, idea.id]
  try {
    await insightsApi.updateIdea(props.websiteId, idea.id, { status: next })
    await reload()
  } catch (err) {
    const body = err?.response?.data?.error
    toast.error((body && typeof body === 'object' && body.message) || "We couldn't update this idea. Try again.")
  } finally {
    busy.value = busy.value.filter((id) => id !== idea.id)
  }
}

const trackOpen = ref(false)
const trackIdea = ref(null)

function openTrack(idea) {
  trackIdea.value = idea
  trackOpen.value = true
}

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
  grid-template-columns: repeat(6, minmax(0, 1fr));
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
