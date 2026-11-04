<template>
  <CardFrame
    widget="prompt-research"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    @retry="reload"
  >
    <template #lead>
      <VizStatTile v-bind="tile" />
    </template>
    <LineList v-if="lines.length" :items="lines" label="New ideas and where they came from" />
  </CardFrame>
</template>

<script setup>
// Prompt research (board_contract.md 3): how many new prompt ideas wait for
// a look, and the first three with where each came from. Cansee has no
// data on how often people ask, so an idea shows its source, never a
// volume. Find ideas opens the panel, whose dialog shows the cost.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import LineList from './LineList.vue'
import { ideaLines, ideaTile, noIdeas } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('promptIdeas')

const NO_IDEAS = Object.freeze({ title: 'No ideas yet.', action: Object.freeze({ label: 'Find ideas', panel: true }) })

const empty = computed(() => (data.value && noIdeas(data.value) ? NO_IDEAS : null))
const tile = computed(() => ideaTile(data.value))
const lines = computed(() => ideaLines(data.value))
</script>
