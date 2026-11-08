<template>
  <CardFrame
    widget="share-of-voice"
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
    <BarList v-if="named" :items="items" :max="100" label="Share of voice by brand" />
    <p v-else class="wb-note">No brand was named in these answers.</p>
  </CardFrame>
</template>

<script setup>
// Share of voice (board_contract.md 3): your share of every brand mention
// in the last 30 days' answers, with its change, and the four brands with
// the largest share (you included, as the accent).
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import BarList from '@/components/board/BarList.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import { anyBrandNamed, visibilityEmpty, voiceItems, voiceTile } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('visibility')

const empty = computed(() => visibilityEmpty(data.value))
const tile = computed(() => voiceTile(data.value))
const named = computed(() => anyBrandNamed(data.value))
const items = computed(() => voiceItems(data.value))
</script>

<style scoped>
.wb-note {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}
</style>
