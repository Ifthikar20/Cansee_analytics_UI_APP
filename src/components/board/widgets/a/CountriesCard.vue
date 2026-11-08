<template>
  <CardShell
    widget="countries"
    :phase="phase"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :notes="notes"
    :skeleton="size === 'full' ? 260 : 300"
    @retry="reloadAll"
    @action="checkCountries"
  >
    <div class="cc-body">
      <div class="cc-map">
        <VizChart
          :spec="spec"
          compact
          hide-switcher
          :height="size === 'full' ? 160 : 120"
          @select="openMeasure"
        >
          <template v-if="measures.length > 1" #actions>
            <VizSwitcher v-model="measure" :options="measures" aria-label="Measure" />
          </template>
        </VizChart>
      </div>
      <BarList
        class="cc-list"
        :items="bars"
        :max="measure === 'ai' ? 100 : null"
        :label="listLabel"
        @select="openMeasure"
      />
    </div>
  </CardShell>
</template>

<script setup>
// Countries (board_contract.md 3): one measure at a time on the world map
// (AI visibility and Google position from the latest country checks, and
// the traffic source's own measure, "Requests" for Cloudflare), with the
// top five beside it. While one source loads the other's measures show;
// "No country data yet." only once both answered with nothing. A country
// opens Countries for rankings and Traffic for traffic.
import { computed, ref, toValue, watch } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import BarList from '@/components/board/BarList.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizSwitcher from '@/components/charts/VizSwitcher.vue'
import CardShell from './CardShell.vue'
import {
  countriesCardSpec,
  countriesFoot,
  countriesState,
  countryBars,
  countryMeasures,
  NO_COUNTRY_DATA,
} from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const CONNECTIONS = { name: 'settings-connections' }

const board = useBoard()
const matrixSource = useBoardSource('countryMatrix')
const trafficSource = useBoardSource('traffic')

const matrix = computed(() => matrixSource.data.value)
const traffic = computed(() => trafficSource.data.value)

const state = computed(() =>
  countriesState({
    matrix: matrix.value,
    matrixFailed: !matrix.value && Boolean(matrixSource.failure.value),
    traffic: traffic.value,
    trafficFailed: !traffic.value && Boolean(trafficSource.failure.value),
  }),
)

const phase = computed(() => {
  if (state.value === 'loading') return 'loading'
  if (state.value === 'error') return 'failed'
  return 'ready'
})
const failure = computed(() => matrixSource.failure.value || trafficSource.failure.value)
const stale = computed(() => matrixSource.stale.value || trafficSource.stale.value)

const empty = computed(() =>
  state.value === 'empty' ? { ...NO_COUNTRY_DATA, link: { label: 'Connect traffic', to: CONNECTIONS } } : null,
)

// ── The measure on screen: the first available until the reader picks one ──
const measures = computed(() => countryMeasures(matrix.value, traffic.value))
const picked = ref('')
const measure = computed({
  get: () => (measures.value.some((m) => m.value === picked.value) ? picked.value : measures.value[0]?.value || 'ai'),
  set: (value) => {
    picked.value = value
  },
})

// A project switch starts from the default measure again.
watch(
  () => toValue(board.websiteId),
  () => {
    picked.value = ''
  },
)

const spec = computed(() => countriesCardSpec(measure.value, matrix.value, traffic.value))
const bars = computed(() => countryBars(measure.value, matrix.value, traffic.value))
const notes = computed(() => (state.value === 'ready' ? [countriesFoot(measure.value, traffic.value)] : []))
const listLabel = computed(() => `Top countries, ${measures.value.find((m) => m.value === measure.value)?.label || ''}`.trim())

function openMeasure() {
  board.open(measure.value === 'traffic' ? 'traffic' : 'countries')
}

function checkCountries() {
  board.open('countries', { check: '1' })
}

// Try again: the source that failed, or the traffic source that could not
// reach its upstream.
function reloadAll() {
  if (!matrix.value) matrixSource.reload()
  if (!traffic.value || traffic.value.empty_reason === 'source_error') trafficSource.reload()
}
</script>

<style scoped>
.cc-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.cc-map,
.cc-list {
  min-width: 0;
}

/* A wide card: the map takes 8 of 12 columns, the list sits beside it. */
@container bd-card (min-width: 720px) {
  .cc-body {
    grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
    align-items: start;
    gap: 20px;
  }
}
</style>
