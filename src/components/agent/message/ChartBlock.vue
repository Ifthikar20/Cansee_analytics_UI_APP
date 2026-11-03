<template>
  <figure v-if="chart" class="ag-chart">
    <figcaption v-if="chart.title" class="ag-chart-title">{{ chart.title }}</figcaption>
    <div ref="boxEl" class="ag-chart-canvas" aria-hidden="true">
      <!-- chart.js caches its first measurement; mount only at a real width. -->
      <component :is="chartComponent" v-if="boxWidth > 0" :key="boxWidth" :data="chartData" :options="chartOptions" />
    </div>
    <table class="ag-sr-only">
      <caption>{{ chart.title || 'Chart data' }}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th v-for="(d, i) in chart.datasets" :key="i" scope="col">{{ d.label || `Series ${i + 1}` }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(label, row) in chart.labels" :key="row">
          <th scope="row">{{ label }}</th>
          <td v-for="(d, i) in chart.datasets" :key="i">{{ formatChartValue(d.data[row], chart.unit) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<script setup>
// A `chart` part: the spec is validated again at the render boundary and
// drawn with the app's chart.js stack, coloured from the chart tokens so it
// follows light and dark. A visually hidden table carries the same numbers.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { cssVar } from '@/lib/theme'
import { formatChartValue, normalizeChartSpec } from '@/lib/agent/chartSpec'

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

const props = defineProps({
  spec: { type: Object, default: null },
})

const chart = computed(() => normalizeChartSpec(props.spec))

const boxEl = ref(null)
const boxWidth = ref(0)
let observer = null

function setWidth(raw) {
  const w = Math.round(raw || 0)
  const bucket = w > 0 ? Math.max(24, Math.round(w / 24) * 24) : 0
  if (bucket !== boxWidth.value) boxWidth.value = bucket
}

onMounted(() => {
  setWidth(boxEl.value?.getBoundingClientRect().width)
  if (typeof ResizeObserver !== 'function' || !boxEl.value) {
    if (!boxWidth.value) boxWidth.value = 24
    return
  }
  observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect?.width))
  observer.observe(boxEl.value)
})

onBeforeUnmount(() => observer?.disconnect())

const COMPONENTS = { bar: Bar, line: Line, doughnut: Doughnut }
const chartComponent = computed(() => COMPONENTS[chart.value?.type] || Bar)
const isDoughnut = computed(() => chart.value?.type === 'doughnut')

const palette = computed(() => [
  cssVar('--chart-1', '#7232e0'),
  cssVar('--chart-4', '#3f8f5f'),
  cssVar('--chart-5', '#b07d28'),
  cssVar('--chart-3', '#a5a5a0'),
  cssVar('--chart-2', '#1e1e1e'),
])

const chartData = computed(() => {
  const spec = chart.value
  if (!spec) return { labels: [], datasets: [] }
  const colors = palette.value
  return {
    labels: spec.labels,
    datasets: spec.datasets.map((d, i) => {
      const color = isDoughnut.value ? spec.labels.map((_, n) => colors[n % colors.length]) : colors[i % colors.length]
      return {
        label: d.label,
        data: d.data,
        backgroundColor: color,
        borderColor: isDoughnut.value ? cssVar('--ag-pane-bg', '#ffffff') : color,
        borderWidth: spec.type === 'line' ? 2 : isDoughnut.value ? 2 : 0,
        borderRadius: spec.type === 'bar' ? 4 : 0,
        pointRadius: spec.type === 'line' ? 3 : 0,
        tension: 0.3,
        fill: false,
        spanGaps: true,
      }
    }),
  }
})

const chartOptions = computed(() => {
  const spec = chart.value
  const grid = cssVar('--ag-divider', '#e6e6e1')
  const text = cssVar('--ag-fg-3', '#74746f')
  const family = cssVar('--ag-font', 'system-ui, sans-serif')
  const font = { family, size: 12 }
  const single = (spec?.datasets.length || 0) === 1
  const unit = spec?.unit || ''
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        display: isDoughnut.value || !single,
        position: isDoughnut.value ? 'right' : 'top',
        align: 'start',
        labels: { color: text, boxWidth: 10, boxHeight: 10, font },
      },
      tooltip: {
        titleFont: { family, size: 12, weight: '600' },
        bodyFont: font,
        callbacks: {
          label: (ctx) => {
            const name = isDoughnut.value ? ctx.label : ctx.dataset.label
            const raw = isDoughnut.value ? ctx.parsed : ctx.parsed.y
            const value = formatChartValue(raw, unit)
            return name ? `${name}: ${value}` : value
          },
        },
      },
    },
    scales: isDoughnut.value
      ? {}
      : {
          x: { grid: { display: false }, ticks: { color: text, font }, border: { color: grid } },
          y: {
            beginAtZero: true,
            grid: { color: grid },
            ticks: { color: text, font, callback: (v) => formatChartValue(v, unit) },
            border: { display: false },
          },
        },
  }
})
</script>

<style scoped>
.ag-chart {
  margin: 0;
  padding: 14px 16px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-chart-title {
  margin-bottom: 10px;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-chart-canvas {
  position: relative;
  height: 220px;
}

/* Canvas text picks up the element's font features; the agent's ss02 turns
   the chart.js labels into mixed glyphs, so reset them here. */
.ag-chart-canvas :deep(canvas) {
  font-feature-settings: normal;
}

</style>
