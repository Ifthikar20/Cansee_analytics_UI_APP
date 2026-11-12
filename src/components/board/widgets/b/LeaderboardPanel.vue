<template>
  <div class="lbp">
    <VizChart
      :spec="spec"
      :loading="!data && !error"
      :error="data || !error ? '' : `We couldn't load Who AI recommends.`"
      :empty="empty"
      :selected="you"
      aria-label="Who AI recommends"
      @retry="reload"
    >
      <template #custom>
        <Leaderboard :brands="brands" />
      </template>
    </VizChart>
    <RouterLink v-slot="{ href }" :to="competitorsLink" custom>
      <a :href="href" class="lbp-link" @click="openCompetitors">Compare with your competitors</a>
    </RouterLink>
  </div>
</template>

<script setup>
// Who AI recommends, expanded (board_frontend.md 11b): the overview's
// leaderboard of the brands the engines name in each prompt's latest
// answers, as a list, bars or a table, and a way to the competitors you
// track. The panel's own title names it, so the chart repeats only its
// subtitle.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import { boardLocation } from '@/lib/board/links'
import { leaderboardSpec, yourBrand } from '@/lib/analytics/polishSpecs'
import VizChart from '@/components/charts/VizChart.vue'
import Leaderboard from '@/components/gap/Leaderboard.vue'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const board = useBoard()
const { data, error, reload } = useBoardSource('overview')

const brands = computed(() => (Array.isArray(data.value?.leaderboard) ? data.value.leaderboard : []))
const spec = computed(() => ({ ...leaderboardSpec(brands.value), title: '' }))
const you = computed(() => yourBrand(brands.value))

const empty = computed(() => {
  const d = data.value
  if (!d) return null
  return brands.value.length ? null : { title: 'Brands appear here once the engines have answered your prompts.' }
})

const competitorsLink = computed(() => boardLocation(props.websiteId, 'competitors'))

// A plain click opens the panel in place; a modified click (new tab) keeps the link.
function openCompetitors(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return
  event.preventDefault()
  board.open('competitors')
}
</script>

<style scoped>
.lbp {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.lbp-link {
  justify-self: start;
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.lbp-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
</style>
