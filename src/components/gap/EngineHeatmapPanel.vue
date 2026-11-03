<template>
  <VizChart :spec="spec" :heading-level="2" @select="open" />
</template>

<script setup>
// Engines by prompt on the Overview: the prompts with the biggest gap, and
// how often each engine's recent answers name you for them. Picking a row
// opens that prompt.
import { computed } from 'vue'
import VizChart from '@/components/charts/VizChart.vue'
import { engineHeatmapSpec } from '@/lib/analytics/polishSpecs'

const props = defineProps({
  // Overview rows (GET /search-gap/websites/<id>/overview/ `prompts`).
  prompts: { type: Array, required: true },
  // Overview `engines`: [{key, label, configured}].
  engines: { type: Array, required: true },
})
const emit = defineEmits(['open'])

const spec = computed(() => engineHeatmapSpec(props.prompts, props.engines))

function open({ label } = {}) {
  const row = props.prompts.find((p) => String(p.prompt_id) === String(label))
  if (row) emit('open', row)
}
</script>
