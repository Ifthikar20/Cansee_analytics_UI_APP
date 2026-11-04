<template>
  <CardFrame
    widget="fact-check"
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
    <BarList :items="verdicts" label="Claims by verdict" />
    <p v-if="contradicted" class="wb-line" :title="contradicted">
      <span class="wb-line-label">Contradicted:</span> "{{ contradicted }}"
    </p>
  </CardFrame>
</template>

<script setup>
// Fact check (board_contract.md 3): the claims the analyzed answers of the
// last 30 days make about you, counted by verdict (gray bars: the verdict
// words carry the meaning), and the contradicted claim the engines repeat
// most. Before any analysis the card says so and opens the panel.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import { factCheckEmpty, factCheckTile, topContradicted, verdictItems } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('factCheck')

const empty = computed(() => factCheckEmpty(data.value))
const tile = computed(() => factCheckTile(data.value))
const verdicts = computed(() => verdictItems(data.value))
const contradicted = computed(() => topContradicted(data.value))
</script>

<style scoped>
.wb-line {
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-line-label {
  color: var(--ag-fg-3);
}
</style>
