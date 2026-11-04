<template>
  <CardShell
    widget="ai-traffic"
    :phase="phase"
    :failure="failure"
    :stale="stale"
    :empty="unavailable"
    :notes="notes"
    :skeleton="200"
    @retry="reload"
    @action="reload"
  >
    <div class="at-tiles">
      <VizStatTile v-for="tile in tiles" :key="tile.key" v-bind="tile.props" />
    </div>
    <CardState v-if="zero" v-bind="zero" inline />
    <BarList v-else-if="bars.length" :items="bars" label="AI-referred sessions by assistant" />
  </CardShell>
</template>

<script setup>
// AI traffic (board_contract.md 3): visits that arrived from AI
// assistants in the last 30 days, counted by the Cansee pixel or Google
// Analytics 4, their share of all sessions and the top three assistants.
// A measured zero keeps its tiles and says no assistant sent a visit.
// Expands to AI traffic, visits first.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardShell from './CardShell.vue'
import CardState from './CardState.vue'
import { aiTrafficFoot, aiTrafficState, aiTrafficTiles, assistantBars } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, failure, stale, reload } = useBoardSource('aiTraffic')

const referrals = computed(() => data.value?.referrals || null)
const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const view = computed(() => aiTrafficState(referrals.value))
const unavailable = computed(() => (data.value && !view.value.tiles ? view.value.empty : null))
const zero = computed(() => (view.value.tiles ? view.value.empty : null))

const tiles = computed(() => aiTrafficTiles(referrals.value).map(({ key, ...props }) => ({ key, props })))
const bars = computed(() => assistantBars(referrals.value))
// Where the numbers come from, only when there are numbers.
const notes = computed(() => (view.value.tiles ? [aiTrafficFoot(referrals.value)].filter(Boolean) : []))
</script>

<style scoped>
.at-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
</style>
