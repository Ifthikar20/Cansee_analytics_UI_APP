<template>
  <CardFrame
    widget="crawler-access"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :foot="foot"
    @retry="reload"
  >
    <LineList :items="lines" label="Crawler access" />
  </CardFrame>
</template>

<script setup>
// Crawler access (board_contract.md 3): from the latest audit, how many of
// the three AI search bots may read your home page, and whether robots.txt
// and llms.txt were found. Before the first audit the card offers one in
// the panel, where it runs (free) with its own limits.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { timeAgo } from '@/utils/timeAgo'
import CardFrame from './CardFrame.vue'
import LineList from './LineList.vue'
import { crawlerLines } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('crawlerAccess')

const NO_AUDIT = Object.freeze({ title: 'No audit yet.', action: Object.freeze({ label: 'Run an audit', panel: true }) })

const empty = computed(() => (data.value && !data.value.you ? NO_AUDIT : null))
const lines = computed(() => crawlerLines(data.value))
const foot = computed(() => {
  const when = timeAgo(data.value?.you?.audited_at)
  return when ? `Last audited ${when}.` : ''
})
</script>
