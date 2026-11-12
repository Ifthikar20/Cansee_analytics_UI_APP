<template>
  <div class="smp">
    <CardSkeleton v-if="phase === 'loading'" :height="360" />
    <CardState v-else-if="phase === 'failed'" v-bind="failed" @action="reload" />
    <CardState
      v-else-if="!prompts.length"
      title="No prompts tracked yet."
      :action="{ label: 'Add prompts' }"
      @action="addPrompts"
    />

    <template v-else>
      <p v-if="stale" class="smp-stale" role="alert">
        We couldn't refresh this page. Showing the last loaded numbers.
        <button type="button" class="smp-retry" @click="reload">Try again</button>
      </p>

      <section class="smp-lead" aria-label="Where you stand">
        <p class="smp-headline">{{ headline }}</p>
        <p v-if="subline" class="smp-subline">{{ subline }}</p>
        <div v-if="canCheck" class="smp-actions">
          <AgButton size="sm" :icon="RefreshCw" :loading="checking" @click="run(prompts)">
            {{ label(unchecked.length) }}
          </AgButton>
        </div>
      </section>

      <div class="smp-tiles" role="group" aria-label="Key numbers">
        <VizStatTile v-for="tile in tiles" :key="tile.key" v-bind="tile.props" />
      </div>

      <VizChart :spec="gapSpec" :heading-level="3">
        <template #custom>
          <GapMap :prompts="prompts" @open="openPrompt" />
        </template>
      </VizChart>
    </template>
  </div>
</template>

<script setup>
// Summary, expanded: the headline and the line under it, all five numbers,
// the gap map (one dot per prompt, gray, the hovered one in the accent; a
// dot opens its prompt) and Check Google for the prompts that have no
// check yet. Reads the board's overview and visibility sources.
import { computed } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import { gapMapSpec, overviewTiles } from '@/lib/analytics/polishSpecs'
import AgButton from '@/components/agent/common/AgButton.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import GapMap from '@/components/gap/GapMap.vue'
import CardState from './CardState.vue'
import { failureState, summaryHeadline, summarySubline } from './specs'
import { uncheckedPrompts, useCheckGoogle } from './useCheckGoogle'

defineProps({
  websiteId: { type: String, required: true },
})

const board = useBoard()
const { data, failure, stale, reload } = useBoardSource('overview')
const visibility = useBoardSource('visibility')
const { checking, label, run } = useCheckGoogle()

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const failed = computed(() => failureState('summary', failure.value))
const prompts = computed(() => data.value?.prompts || [])
const kpis = computed(() => data.value?.kpis || {})

const headline = computed(() => summaryHeadline(kpis.value))
const subline = computed(() => summarySubline(kpis.value, prompts.value))
const tiles = computed(() =>
  overviewTiles(kpis.value, visibility.data.value?.headline, prompts.value).map(({ key, ...props }) => ({ key, props })),
)
const gapSpec = computed(() => gapMapSpec(prompts.value))

const unchecked = computed(() => uncheckedPrompts(prompts.value))
const canCheck = computed(() => unchecked.value.length > 0 && Boolean(data.value?.serp_configured))

function openPrompt(row) {
  if (row?.prompt_id !== undefined && row?.prompt_id !== null) board.open('prompts', { prompt: String(row.prompt_id) })
}

function addPrompts() {
  board.open('prompts', { add: '1' })
}
</script>

<style scoped>
.smp {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}

.smp-lead {
  display: grid;
  gap: 6px;
}

.smp-headline {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.35;
  text-wrap: pretty;
}

.smp-subline {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 1.5;
}

.smp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.smp-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.smp-stale {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 1.5;
}

.smp-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.smp-retry:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
