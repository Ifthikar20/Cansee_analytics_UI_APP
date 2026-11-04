<template>
  <CardFrame
    widget="pages"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Last 30 days."
    @retry="reload"
  >
    <BarList :items="items" label="Your pages by AI citations" />
  </CardFrame>
</template>

<script setup>
// Pages (board_contract.md 3): the five pages of your site the last 30
// days' answers cite most. They are all yours, so every bar is the accent;
// while the citations source is off each page reads its state word.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import CardFrame from './CardFrame.vue'
import { pageItems } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('pages')

const empty = computed(() => (data.value && !(data.value.pages || []).length ? { title: 'No pages measured yet.' } : null))
const items = computed(() => pageItems(data.value))
</script>
