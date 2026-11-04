<template>
  <CardFrame
    widget="visibility"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Last 30 days."
    :skeleton="size === 'full' ? 200 : 160"
    @retry="reload"
  >
    <template #lead>
      <VizStatTile v-bind="tile" />
    </template>
    <VizChart
      :spec="spec"
      compact
      hide-switcher
      :height="size === 'full' ? 160 : 120"
      aria-label="AI visibility over time"
    />
  </CardFrame>
</template>

<script setup>
// AI visibility over time (board_contract.md 3): the share of the last 30
// days' answers that name you, with its change against the 30 days before,
// and one line for every engine together. Expands to Visibility.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import { visibilityAll, visibilityEmpty, visibilityTile } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('visibility')

const empty = computed(() => visibilityEmpty(data.value))
const tile = computed(() => visibilityTile(data.value))
const spec = computed(() => visibilityAll(data.value))
</script>
