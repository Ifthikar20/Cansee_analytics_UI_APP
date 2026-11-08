<template>
  <CardFrame
    widget="products"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :foot="foot"
    @retry="reload"
  >
    <template #lead>
      <VizStatTile v-bind="tile" />
    </template>
    <LineList :items="lines" :head="{ label: 'Product', text: 'Google Shopping' }" label="Tracked products in Google Shopping" />
  </CardFrame>
</template>

<script setup>
// Products (board_contract.md 3): the products you track and where each one
// stands in Google Shopping from its latest check (or its state word).
// Add a product opens the panel; adding one never runs a check.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import CardFrame from './CardFrame.vue'
import LineList from './LineList.vue'
import { productLines, productsTile } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const { data, error, failure, stale, reload } = useBoardSource('products')

const NO_PRODUCTS = Object.freeze({
  title: 'No products tracked yet.',
  action: Object.freeze({ label: 'Add a product', panel: true }),
})

const empty = computed(() => (data.value && !(data.value.products || []).length ? NO_PRODUCTS : null))
const tile = computed(() => productsTile(data.value))
const lines = computed(() => productLines(data.value))
const foot = computed(() =>
  data.value?.shopping?.configured === false
    ? 'Google Shopping results need ScraperAPI on this server. Engine answers still work.'
    : '',
)
</script>
