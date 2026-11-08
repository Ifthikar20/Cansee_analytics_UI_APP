<template>
  <CardFrame
    widget="by-engine"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Last 30 days."
    @retry="reload"
  >
    <BarList :items="items" :max="100" label="AI visibility by engine" />
  </CardFrame>
</template>

<script setup>
// AI visibility by engine (board_contract.md 3): each engine's share of the
// last 30 days' answers that name you. Every bar is you, so every bar is
// the accent; an engine without answers reads its state word.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import CardFrame from './CardFrame.vue'
import { engineItems, visibilityEmpty } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('visibility')

const empty = computed(() => visibilityEmpty(data.value))
const items = computed(() => engineItems(data.value))
</script>
