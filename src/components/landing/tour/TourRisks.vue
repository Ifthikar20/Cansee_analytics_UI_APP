<template>
  <div class="tp tp-risks">
    <div class="tp-col">
      <div class="tp-col-head">
        <span class="tp-label">Brand Security findings</span>
        <span class="tp-muted">{{ prompt.risks.length }} open</span>
      </div>
      <ul class="tp-findings">
        <li v-for="r in prompt.risks" :key="r.code + r.engine" class="tp-finding">
          <div class="tp-finding-head">
            <span>{{ detectors[r.code] }}</span>
            <span class="tp-pill" :class="{ 'is-solid': r.severity === 'high' }">{{ severityLabel(r.severity) }}</span>
          </div>
          <div class="tp-muted">{{ engineLabel(r.engine) }} · {{ r.code }}</div>
          <!-- The flagged span is the point: the product stores character
               offsets per finding, so it quotes the exact words rather than
               summarising them. -->
          <blockquote class="tp-quote">
            {{ r.before }}<mark class="tp-flag">{{ r.flagged }}</mark>{{ r.after }}
          </blockquote>
        </li>
      </ul>
    </div>

    <div class="tp-col">
      <div class="tp-col-head">
        <span class="tp-label">Your brand facts vs. the answers</span>
        <span class="tp-muted">Alignment {{ prompt.alignment.score }}/100</span>
      </div>
      <ul class="tp-facts-list">
        <li v-for="f in prompt.alignment.facts" :key="f.fact" class="tp-fact-row" :class="'is-' + f.status">
          <span class="tp-fact-icon" aria-hidden="true">{{ icons[f.status] }}</span>
          <div class="tp-fact-body">
            <span>{{ f.fact }}</span>
            <span class="tp-muted">{{ factLine(f) }}</span>
            <span v-if="f.note" class="tp-fact-note">{{ f.note }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { TOUR_DETECTORS, TOUR_FACT_STATUSES } from '@/data/productTour'

const props = defineProps({
  prompt: { type: Object, required: true },
  summary: { type: Object, required: true },
  engines: { type: Array, required: true },
  motion: { type: Boolean, default: true },
})

const detectors = TOUR_DETECTORS
const icons = { reflected: '✓', missed: '–', contradicted: '✕' }

const engineLabel = (key) => props.engines.find((e) => e.key === key)?.label ?? key
const severityLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function factLine(f) {
  const label = TOUR_FACT_STATUSES[f.status]
  if (!f.engines.length) return `${label} by every engine`
  return `${label} by ${f.engines.map(engineLabel).join(', ')}`
}
</script>
