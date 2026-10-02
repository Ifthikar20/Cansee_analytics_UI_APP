<template>
  <div class="tp tp-score">
    <div class="tp-col">
      <div class="tp-score-top">
        <div class="tp-score-num">
          <span class="tp-big">{{ Math.round(count) }}</span><span class="tp-big-of">/100</span>
        </div>
        <div class="tp-score-meta">
          <span>AI visibility score</span>
          <span class="tp-muted">
            Mentioned in {{ summary.mentioned }} of {{ summary.answers }} answers ({{ pct(summary.rate) }})
          </span>
        </div>
      </div>

      <div class="tp-block">
        <span class="tp-label">Mention rate, 95% confidence range</span>
        <div
          class="tp-range"
          role="img"
          :aria-label="`Mention rate ${pct(summary.rate)}, 95% range ${pct(summary.low)} to ${pct(summary.high)}`"
        >
          <span
            class="tp-range-band"
            :style="{ left: pct(summary.low), width: pct(summary.high - summary.low) }"
          ></span>
          <span class="tp-range-mark" :style="{ left: pct(summary.rate) }"></span>
        </div>
        <div class="tp-range-scale tp-muted">
          <span>0%</span>
          <span>{{ pct(summary.low) }} – {{ pct(summary.high) }}</span>
          <span>100%</span>
        </div>
      </div>

      <div class="tp-block">
        <span class="tp-label">How the score is built</span>
        <ul class="tp-bars">
          <li v-for="p in parts" :key="p.key" class="tp-bar-row">
            <span class="tp-bar-label">{{ p.label }}</span>
            <span class="tp-bar"><span :style="{ width: (p.value / p.max) * 100 + '%' }"></span></span>
            <span class="tp-bar-val">{{ fmt(p.value) }} / {{ p.max }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="tp-col">
      <div class="tp-block">
        <span class="tp-label">By engine</span>
        <ul class="tp-bars">
          <li v-for="e in engines" :key="e.key" class="tp-bar-row">
            <span class="tp-bar-label">
              <span class="tp-dot" :class="'is-' + e.key" aria-hidden="true"></span>{{ e.label }}
            </span>
            <span class="tp-bar"><span :style="{ width: pct(summary.perEngine[e.key].rate) }"></span></span>
            <span class="tp-bar-val">
              {{ summary.perEngine[e.key].mentioned }}/{{ summary.perEngine[e.key].answers }}
              · avg #{{ fmt(summary.perEngine[e.key].avgRank) }}
            </span>
          </li>
        </ul>
      </div>

      <div class="tp-block">
        <span class="tp-label">Share of voice</span>
        <div class="tp-sov" role="img" :aria-label="sovLabel">
          <span
            v-for="(b, i) in prompt.shareOfVoice"
            :key="b.brand"
            class="tp-sov-seg"
            :class="{ 'is-you': b.you }"
            :style="{ width: b.pct + '%', opacity: sovOpacity(b, i) }"
          ></span>
        </div>
        <ul class="tp-sov-legend">
          <li v-for="(b, i) in prompt.shareOfVoice" :key="b.brand" :class="{ 'is-you': b.you }">
            <span class="tp-swatch" :style="{ opacity: sovOpacity(b, i) }" aria-hidden="true"></span>
            <span>{{ b.brand }}<template v-if="b.you"> (you)</template></span>
            <span class="tp-muted">{{ b.pct }}%</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCountUp } from './useTourMotion'

const props = defineProps({
  prompt: { type: Object, required: true },
  summary: { type: Object, required: true },
  engines: { type: Array, required: true },
  motion: { type: Boolean, default: true },
})

const count = useCountUp(() => props.summary.score.total, () => props.motion)

const pct = (x) => Math.round(x * 100) + '%'
const fmt = (n) => {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

const parts = computed(() => {
  const p = props.summary.score.parts
  return [
    { key: 'mention', label: 'Mentions', value: p.mention, max: 40 },
    { key: 'rank', label: 'Position', value: p.rank, max: 30 },
    { key: 'sentiment', label: 'Sentiment', value: p.sentiment, max: 20 },
    { key: 'coverage', label: 'Engine coverage', value: p.coverage, max: 10 },
  ]
})

// Monochrome: your brand is solid ink, everyone else steps back in turn.
const sovOpacity = (b, i) => (b.you ? 1 : Math.max(0.15, 0.7 - i * 0.13))

const sovLabel = computed(() =>
  'Share of voice: ' + props.prompt.shareOfVoice.map((b) => `${b.brand} ${b.pct}%`).join(', '),
)
</script>
