<template>
  <div class="gap-map">
    <div class="gap-map-canvas">
      <Scatter :data="chartData" :options="chartOptions" :plugins="[quadrants]" />
    </div>
    <p v-if="unplotted" class="gap-map-note">
      {{ unplotted }} {{ unplotted === 1 ? 'prompt is' : 'prompts are' }} not on the map yet:
      Google hasn't been checked or no engine has answered.
    </p>
  </div>
</template>

<script setup>
// Every checked prompt as a dot: Google position across (best on the
// left, log scale so page one gets room), AI score up. The dashed guides
// split page one from the rest and a strong AI score from a weak one, so
// each corner reads as one gap class.
import { computed } from 'vue'
import { Scatter } from 'vue-chartjs'
import { Chart as ChartJS, LinearScale, LogarithmicScale, PointElement, Tooltip } from 'chart.js'
import { baseOptions } from '@/lib/chartTheme'
import { cssVar } from '@/lib/theme'
import { gapMeta, googleLabel } from '@/lib/gap'

ChartJS.register(LinearScale, LogarithmicScale, PointElement, Tooltip)

const props = defineProps({
  prompts: { type: Array, required: true },
})
const emit = defineEmits(['open'])

// "Not in the top 100" gets its own column past the last real position,
// far enough out on the log scale that its label clears "#100".
const NOT_RANKED_X = 320
const X_MAX = 460
const LAST_RANK = 100
const PAGE_ONE_EDGE = 10.5
const AI_MIDLINE = 50

const plotted = computed(() =>
  props.prompts.filter((p) => p.google.status === 'ok' && p.gap.ai_score !== null),
)
const unplotted = computed(() => props.prompts.length - plotted.value.length)

function tokenColor(cls, fallback = '#888888') {
  const token = gapMeta(cls).color.match(/var\((--[^)]+)\)/)?.[1]
  return token ? cssVar(token, fallback) : fallback
}

const chartData = computed(() => ({
  datasets: [{
    data: plotted.value.map((p) => ({ x: p.google.position || NOT_RANKED_X, y: p.gap.ai_score, prompt: p })),
    pointBackgroundColor: plotted.value.map((p) => tokenColor(p.gap.class)),
    pointBorderColor: cssVar('--card', '#ffffff'),
    pointBorderWidth: 2,
    pointRadius: 7,
    pointHoverRadius: 9,
    // Google #1 and an AI score of 100 sit on the axes; don't cut them.
    clip: false,
  }],
}))

const quadrants = {
  id: 'gapQuadrants',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: area, scales: { x, y } } = chart
    if (!area) return
    const xMid = x.getPixelForValue(PAGE_ONE_EDGE)
    const yMid = y.getPixelForValue(AI_MIDLINE)
    // Right-hand labels end at #100 so the not-ranked column stays clear.
    const xRight = x.getPixelForValue(LAST_RANK)
    const yTop = y.getPixelForValue(100)
    const yBottom = y.getPixelForValue(0)
    ctx.save()
    ctx.setLineDash([4, 5])
    ctx.lineWidth = 1
    ctx.strokeStyle = cssVar('--input', 'rgba(0,0,0,0.15)')
    ctx.beginPath()
    ctx.moveTo(xMid, area.top)
    ctx.lineTo(xMid, area.bottom)
    ctx.moveTo(area.left, yMid)
    ctx.lineTo(area.right, yMid)
    ctx.stroke()
    ctx.setLineDash([])
    // Phones: the corners are too tight for labels; the dot colours and
    // the table below still carry the class.
    if (area.right - area.left < 480) {
      ctx.restore()
      return
    }
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    const pad = 8
    const labels = [
      ['strong_both', area.left + pad, yTop + pad, 'left', 'top'],
      ['ai_ahead', xRight - pad, yTop + pad, 'right', 'top'],
      ['google_ahead', area.left + pad, yBottom - pad, 'left', 'bottom'],
      ['invisible_both', xRight - pad, yBottom - pad, 'right', 'bottom'],
    ]
    for (const [cls, lx, ly, align, baseline] of labels) {
      ctx.fillStyle = tokenColor(cls)
      ctx.textAlign = align
      ctx.textBaseline = baseline
      ctx.fillText(gapMeta(cls).label, lx, ly)
    }
    ctx.restore()
  },
}

const chartOptions = computed(() => {
  const base = baseOptions()
  const muted = cssVar('--muted-foreground', '#71717a')
  const grid = cssVar('--border', 'rgba(0,0,0,0.08)')
  return {
    ...base,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: { top: 12, right: 12, left: 4 } },
    onClick: (_evt, elements) => {
      if (elements.length) emit('open', plotted.value[elements[0].index])
    },
    onHover: (evt, elements) => {
      if (evt.native?.target) evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    scales: {
      x: {
        type: 'logarithmic',
        min: 0.8,
        max: X_MAX,
        afterBuildTicks: (axis) => {
          axis.ticks = [1, 3, 10, 30, LAST_RANK, NOT_RANKED_X].map((value) => ({ value }))
        },
        ticks: {
          color: muted,
          callback: (value) => (value === NOT_RANKED_X ? 'Not in top 100' : `#${value}`),
        },
        grid: { color: grid, drawTicks: false },
        border: { display: false },
        title: { display: true, text: 'Google position', color: muted, font: { size: 12 } },
      },
      // A little room past 0 and 100 so dots on the extremes stay whole.
      y: {
        min: -8,
        max: 108,
        afterBuildTicks: (axis) => {
          axis.ticks = [0, 25, 50, 75, 100].map((value) => ({ value }))
        },
        ticks: { color: muted },
        grid: { color: grid, drawTicks: false },
        border: { display: false },
        title: { display: true, text: 'AI score', color: muted, font: { size: 12 } },
      },
    },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...(base.plugins?.tooltip || {}),
        displayColors: false,
        callbacks: {
          title: (items) => items[0]?.raw?.prompt?.text || '',
          label: (item) => {
            const p = item.raw.prompt
            return [
              `Google: ${googleLabel(p.google)}`,
              `AI score: ${item.raw.y}`,
              gapMeta(p.gap.class).label,
            ]
          },
        },
      },
    },
  }
})
</script>

<style scoped>
.gap-map-canvas {
  position: relative;
  height: 300px;
}

.gap-map-note {
  margin-top: 10px;
  color: var(--muted-foreground);
  font-size: 12px;
}
</style>
