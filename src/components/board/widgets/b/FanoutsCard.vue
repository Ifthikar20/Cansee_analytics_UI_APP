<template>
  <CardFrame
    widget="fan-outs"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Last 30 days."
    @retry="reload"
  >
    <template #lead>
      <VizStatTile v-bind="tile" />
    </template>
    <LineList
      v-if="lines.length"
      :items="lines"
      :head="{ label: 'Search', text: 'Google' }"
      label="Searches the engines ran most, with their Google place"
    />
  </CardFrame>
</template>

<script setup>
// Query fan-outs (board_contract.md 3): the web searches the engines ran
// while answering in the last 30 days, and the three they ran in the most
// answers with where you rank on Google for each (or its state word).
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { fanoutsEmpty } from '@/lib/analytics/researchSpecs'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import LineList from './LineList.vue'
import { fanoutLines, fanoutTile } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('fanOuts')

// The page's own states, without their action: the card only says why.
const empty = computed(() => {
  const state = fanoutsEmpty(data.value, { days: 30 })
  return state ? { kind: state.kind, title: state.title, body: state.body || '' } : null
})
const tile = computed(() => fanoutTile(data.value))
const lines = computed(() => fanoutLines(data.value))
</script>
