<template>
  <CardShell
    widget="ai-crawlers"
    :phase="phase"
    :failure="failure"
    :stale="stale"
    :empty="unavailable"
    :notes="notes"
    :skeleton="200"
    @retry="reload"
    @action="reload"
  >
    <VizStatTile v-bind="lead" />
    <CardState v-if="zero" v-bind="zero" inline />
    <BarList v-else-if="bars.length" :items="bars" label="AI crawler requests by crawler" />
  </CardShell>
</template>

<script setup>
// AI crawlers (board_contract.md 3): AI bots reading your site in
// Cloudflare's last 7 days, counted by user agent, and the top three with
// their operator. Without Cloudflare, or on a plan that refuses the
// query, it says so in words. Expands to AI traffic, crawlers first.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { crawlerSourceLine } from '@/lib/analytics/trafficSpecs'
import BarList from '@/components/board/BarList.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardShell from './CardShell.vue'
import CardState from './CardState.vue'
import { aiCrawlersState, crawlerBars, crawlerLead } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, failure, stale, reload } = useBoardSource('aiTraffic')

const crawlers = computed(() => data.value?.crawlers || null)
const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const view = computed(() => aiCrawlersState(crawlers.value))
const unavailable = computed(() => (data.value && !view.value.tiles ? view.value.empty : null))
const zero = computed(() => (view.value.tiles ? view.value.empty : null))

const lead = computed(() => {
  const { key: _key, ...tile } = crawlerLead(crawlers.value)
  return tile
})
const bars = computed(() => crawlerBars(crawlers.value))
// Where the numbers come from, only when there are numbers.
const notes = computed(() => (crawlers.value && view.value.tiles ? [crawlerSourceLine(crawlers.value)] : []))
</script>
