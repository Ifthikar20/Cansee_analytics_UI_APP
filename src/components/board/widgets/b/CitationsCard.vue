<template>
  <CardFrame
    widget="citations"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Last 30 days."
    @retry="reload"
  >
    <template v-if="lead" #lead>
      <p class="wb-sentence">{{ lead }}</p>
    </template>
    <BarList :items="domains" label="Most cited domains" />
  </CardFrame>
</template>

<script setup>
// Citations (board_contract.md 3): how many of the sources the last 30
// days' answers cite point to your site, and the five domains they cite
// most (your site is the accent). Expands to the sources and their pages.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import CardFrame from './CardFrame.vue'
import { citationLead, citationsEmpty, domainItems } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('visibility')

const empty = computed(() => (data.value ? citationsEmpty(data.value) : null))
const lead = computed(() => citationLead(data.value))
const domains = computed(() => domainItems(data.value))
</script>

<style scoped>
.wb-sentence {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}
</style>
