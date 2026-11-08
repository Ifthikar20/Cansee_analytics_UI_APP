<template>
  <CardFrame
    widget="who-recommends"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    @retry="reload"
  >
    <BarList :items="items" :max="100" label="Who AI recommends" />
  </CardFrame>
</template>

<script setup>
// Who AI recommends (board_contract.md 3): the five brands the engines name
// most in each prompt's latest answers, and your own row when you rank
// lower. You are the accent; every other brand is gray.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import CardFrame from './CardFrame.vue'
import { NO_PROMPTS, leaderboardItems } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('overview')

const empty = computed(() => {
  const d = data.value
  if (!d) return null
  if (!(d.prompts || []).length) return NO_PROMPTS
  if (!(d.leaderboard || []).length) return { title: 'Brands appear here once the engines have answered your prompts.' }
  return null
})
const items = computed(() => leaderboardItems(data.value?.leaderboard))
</script>
