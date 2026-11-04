<template>
  <CardShell
    widget="traffic"
    :phase="phase"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :notes="notes"
    :skeleton="size === 'full' ? 300 : 340"
    @retry="reload"
    @action="reload"
  >
    <VizStatTile v-bind="lead" />
    <VizChart :spec="series" compact hide-switcher :height="size === 'full' ? 160 : 120" />

    <section class="tc-paths" :aria-labelledby="pathsTitleId">
      <p class="tc-head">
        <span :id="pathsTitleId">Top paths</span>
        <span>{{ measureLabel }}</span>
      </p>
      <p v-if="paths === null" class="tc-note">Couldn't load top paths just now.</p>
      <p v-else-if="!paths.length" class="tc-note">No pages recorded in the last 30 days.</p>
      <BarList v-else :items="paths" :label="`Top paths by ${measureLabel.toLowerCase()}`" />
    </section>

    <p v-if="countriesLine" class="tc-countries">{{ countriesLine }}</p>
  </CardShell>
</template>

<script setup>
// Traffic (board_contract.md 3 and 7): the last 30 days from the source
// `auto` resolves to. The metric with its change, one line per day, the
// top five paths and the top three countries. Cloudflare counts requests,
// bots included, and samples its paths (maybe over a shorter window, which
// the foot names); when its breakdown failed the paths say so instead of
// "none recorded".
import { computed, useId } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardShell from './CardShell.vue'
import {
  pathBars,
  pathsMeasure,
  topCountriesLine,
  trafficCardEmpty,
  trafficCardSeries,
  trafficFoot,
  trafficLead,
} from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, failure, stale, reload } = useBoardSource('traffic')
const pathsTitleId = `tc-paths-${useId()}`

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const empty = computed(() => (data.value ? trafficCardEmpty(data.value) : null))

const lead = computed(() => {
  const { key: _key, ...tile } = trafficLead(data.value)
  return tile
})
const series = computed(() => trafficCardSeries(data.value))
const measureLabel = computed(() => pathsMeasure(data.value))
const paths = computed(() => pathBars(data.value))
const countriesLine = computed(() => topCountriesLine(data.value))
const notes = computed(() => (empty.value ? [] : [trafficFoot(data.value)].filter(Boolean)))
</script>

<style scoped>
.tc-paths {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tc-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.tc-note {
  margin: 4px 0 0;
  color: var(--viz-ink-2);
  font-size: 13px;
  line-height: 18px;
}

.tc-countries {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}
</style>
