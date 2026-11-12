<template>
  <div v-if="vizSpec" class="ag-chart">
    <VizChart
      v-model:representation="representation"
      :spec="vizSpec"
      compact
      :height="220"
      surface="var(--ag-pane-bg)"
      :heading-level="4"
    />
  </div>
</template>

<script setup>
// A `chart` part: the spec is validated again at the render boundary,
// converted to a ChartSpec and drawn with the shared VizChart, so it
// switches between its representations and the table like every chart in
// the app, coloured from the chart tokens in light and dark. A spec with
// nothing to plot renders nothing.
import { computed, ref } from 'vue'
import VizChart from '@/components/charts/VizChart.vue'
import { toVizSpec } from '@/lib/agent/chartSpec'

const props = defineProps({
  spec: { type: Object, default: null },
})

const vizSpec = computed(() => toVizSpec(props.spec))

// The reader's choice lives with this message only; agent charts carry no
// id, so nothing is persisted.
const representation = ref('')
</script>

<style scoped>
.ag-chart {
  margin: 0;
  padding: 14px 16px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}
</style>
