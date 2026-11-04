<template>
  <SourcesUrlDetailPage v-if="url" />
  <SourcesUrlsPage v-else />
</template>

<script setup>
// Citations, expanded (board_frontend.md 11b): the AI answer sources page,
// or one source's detail when the panel's query names it (`url`, with the
// list's `topic` and `provider`). Both pages read the project from the
// route, which the board's route has; in the panel they open each other
// through the board, so the board keeps its own history entry.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SourcesUrlDetailPage from '@/pages/SourcesUrlDetailPage.vue'
import SourcesUrlsPage from '@/pages/SourcesUrlsPage.vue'

defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()

const url = computed(() => {
  const raw = route.query.url
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value : ''
})
</script>
