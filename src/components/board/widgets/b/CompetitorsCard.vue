<template>
  <CardFrame
    widget="competitors"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Last 30 days."
    @retry="reload"
  >
    <BarList :items="items" :max="100" label="AI visibility by brand" />
  </CardFrame>
</template>

<script setup>
// Competitors (board_contract.md 3): the share of the last 30 days' answers
// that name you and each competitor you track. You are the accent; a brand
// with no answers to count reads its state word.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import CardFrame from './CardFrame.vue'
import { brandItems } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('competitors')

const NO_COMPETITORS = Object.freeze({
  title: "You aren't tracking any competitors yet.",
  action: Object.freeze({ label: 'Open project settings', to: Object.freeze({ name: 'settings-project' }) }),
})

const empty = computed(() => (data.value?.empty_reason === 'no_competitors' ? NO_COMPETITORS : null))
const items = computed(() => brandItems(data.value))
</script>
