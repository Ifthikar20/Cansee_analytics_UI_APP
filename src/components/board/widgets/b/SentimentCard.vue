<template>
  <CardFrame
    widget="sentiment"
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
    <BarList :items="tones" label="Tone of the answers that name you" />
    <CardState v-if="!analyzed" v-bind="NOT_ANALYZED" widget="sentiment" inline />
    <p v-else class="wb-line">{{ theme || "The analyzed answers don't describe you in a way that repeats." }}</p>
  </CardFrame>
</template>

<script setup>
// Sentiment (board_contract.md 3): the answers that name you in the last 30
// days, their tone (stored with every answer, so no analysis is needed; the
// words carry the meaning, so the bars are gray) and the theme the analyzed
// answers repeat most. Analyze answers opens the panel, whose dialog shows
// the cost before anything runs.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import CardState from './CardState.vue'
import { NOT_ANALYZED, NOT_NAMED, anyAnalyzed, sentimentTile, themeLine, toneItems } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('sentiment')

const empty = computed(() => (data.value?.empty_reason === 'no_answers' ? NOT_NAMED : null))
const tile = computed(() => sentimentTile(data.value))
const tones = computed(() => toneItems(data.value))
const analyzed = computed(() => anyAnalyzed(data.value))
const theme = computed(() => themeLine(data.value))
</script>

<style scoped>
.wb-line {
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
