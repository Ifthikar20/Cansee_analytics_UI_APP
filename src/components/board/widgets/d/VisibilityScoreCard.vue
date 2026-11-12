<script setup>
// Visibility score (board key "visibility-score"): the share of the last
// 30 days' AI answers that name you, as one very large number, over a
// thin line of the same share day by day that ends in the accent dot. It
// is the AI visibility card's number (the dashboard's headline), a
// percent; a day without answers is a gap in the line, never a zero.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { scoreChange, scoreFigure, scoreLine, scoreSentence, scoreWindow } from '@/lib/board/d/visibilityScore'
import BlockFrame from './BlockFrame.vue'
import { visibilityEmpty } from '../b/specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('visibility')

const figure = computed(() => scoreFigure(data.value))
const change = computed(() => scoreChange(data.value))
const line = computed(() => scoreLine(data.value))
const period = computed(() => scoreWindow(data.value))
const sentence = computed(() => scoreSentence(data.value))
const empty = computed(() => {
  if (!data.value) return null
  return visibilityEmpty(data.value) || (figure.value ? null : { title: 'No AI answers in the last 30 days.' })
})
const at = (point) => ({ left: `${point.x}%`, top: `${point.y}%` })
</script>

<template>
  <BlockFrame
    widget="visibility-score"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :skeleton="280"
    @retry="reload"
  >
    <div v-if="figure" class="wd-score">
      <p class="sr-only">{{ sentence }}</p>
      <div class="wd-score-figure" aria-hidden="true">
        <p class="wd-score-number">
          <span class="wd-score-num cs-numeral" :class="{ 'is-wide': figure.figure.length > 2 }">{{ figure.figure }}</span>
          <span class="wd-score-unit cs-numeral__unit">{{ figure.unit }} of answers</span>
        </p>
        <p v-if="change" class="wd-score-change cs-label">
          <span class="cs-label--ink">{{ change.text }}</span> {{ change.label }}
        </p>
      </div>

      <div class="wd-score-chart" aria-hidden="true">
        <div v-if="line" class="wd-score-plot">
          <svg class="wd-score-svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <path v-for="(d, i) in line.lines" :key="i" class="wd-score-line" :d="d" />
          </svg>
          <span v-for="(point, i) in line.singles" :key="i" class="wd-score-single" :style="at(point)"></span>
          <span class="wd-score-end" :style="at(line.end)"></span>
        </div>
        <p class="wd-score-axis cs-label">
          <span>{{ line ? line.from : '' }}</span>
          <span>{{ period }}</span>
          <span>{{ line ? line.to : '' }}</span>
        </p>
      </div>
    </div>
  </BlockFrame>
</template>

<style scoped>
.wd-score {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.wd-score-figure {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* The number at the left margin, its unit on the same baseline at the
   right one. */
.wd-score-number {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 12px;
  margin: 0;
}

/* The board's text asks for the disambiguated digits (a slashed zero, a
   footed one); a display numeral this size reads better without them. */
.wd-score-num {
  margin-left: -0.05em;
  font-feature-settings: normal;
  font-size: clamp(88px, 44cqi, 184px);
  line-height: 0.8;
}

/* Three characters ("100", "6.5") are set smaller, so the unit keeps its
   place on the baseline beside them. */
.wd-score-num.is-wide {
  font-size: clamp(72px, 34cqi, 144px);
}

.wd-score-unit {
  flex: 0 0 auto;
  font-size: 11px;
  text-transform: uppercase;
  white-space: nowrap;
}

.wd-score-change {
  margin: 0;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.wd-score-chart {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

/* The plot: its bottom edge is 0%, drawn as a hairline. The line is
   stretched to the box, so its stroke is kept at one weight; the dots are
   elements, so they stay round. */
.wd-score-plot {
  position: relative;
  flex: 1 1 auto;
  min-height: 56px;
  max-height: 160px;
  margin-top: 6px;
  border-bottom: 1px solid var(--rule);
}

.wd-score-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.wd-score-line {
  fill: none;
  stroke: var(--foreground);
  stroke-width: 1.5px;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.wd-score-single,
.wd-score-end {
  position: absolute;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.wd-score-single {
  width: 3px;
  height: 3px;
  background: var(--foreground);
}

.wd-score-end {
  width: 8px;
  height: 8px;
  background: var(--signal);
}

.wd-score-axis {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  margin: 0;
  font-size: 11px;
  white-space: nowrap;
}

.wd-score-axis > :last-child {
  text-align: right;
}

/* A wide card sets the number beside its line. */
@container wd-block (min-width: 560px) {
  .wd-score {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
    align-items: stretch;
    gap: 48px;
  }

  .wd-score-num {
    font-size: clamp(120px, 22cqi, 200px);
  }

  .wd-score-num.is-wide {
    font-size: clamp(96px, 17cqi, 160px);
  }

  .wd-score-plot {
    max-height: none;
    min-height: 120px;
  }
}
</style>
