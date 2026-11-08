<template>
  <CardShell
    widget="summary"
    :phase="phase"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :skeleton="size === 'full' ? 148 : 236"
    @retry="reload"
    @action="addPrompts"
  >
    <p class="sm-headline">{{ headline }}</p>
    <div class="sm-tiles" role="group" aria-label="Key numbers">
      <VizStatTile v-for="tile in tiles" :key="tile.key" v-bind="tile.props" />
    </div>
  </CardShell>
</template>

<script setup>
// Summary (board_contract.md 3): the Overview's headline sentence and four
// numbers, AI visibility with its change against the previous 30 days,
// Google position, and the prompts where AI or Google is ahead. Before any
// Google check the two gap counts read "Not checked", never 0. Expands to
// SummaryPanel.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardShell from './CardShell.vue'
import { summaryHeadline, summaryTiles } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'full' },
})

const board = useBoard()
const { data, failure, stale, reload } = useBoardSource('overview')
// Only the change on AI visibility comes from here; without it the tile
// shows no change.
const visibility = useBoardSource('visibility')

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const prompts = computed(() => data.value?.prompts || [])

const empty = computed(() =>
  data.value && !prompts.value.length ? { title: 'No prompts tracked yet.', action: { label: 'Add prompts' } } : null,
)

const headline = computed(() => summaryHeadline(data.value?.kpis))
const tiles = computed(() =>
  summaryTiles(data.value?.kpis, visibility.data.value?.headline, prompts.value).map(({ key, ...props }) => ({ key, props })),
)

function addPrompts() {
  board.open('prompts', { add: '1' })
}
</script>

<style scoped>
.sm-headline {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
  text-wrap: pretty;
}

.sm-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

/* The card's own width decides, not its size. */
@container bd-card (min-width: 720px) {
  .sm-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
