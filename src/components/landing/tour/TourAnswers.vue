<template>
  <div class="tp tp-answers">
    <div class="tp-engines" role="group" aria-label="Engine">
      <button
        v-for="e in engines"
        :key="e.key"
        type="button"
        class="tp-engine"
        :aria-pressed="e.key === active ? 'true' : 'false'"
        @click="active = e.key"
      >
        <span class="tp-dot" :class="'is-' + e.key" aria-hidden="true"></span>
        <span class="tp-engine-name">{{ e.label }}</span>
        <span class="tp-engine-pos">#{{ prompt.answers[e.key].position }}</span>
      </button>
    </div>

    <div class="tp-answer">
      <div class="tp-answer-head">
        <span>{{ engineLabel }} · latest answer</span>
        <span class="tp-muted">Captured {{ answer.capturedAt }}</span>
      </div>

      <!-- Click anywhere in the answer to skip the typing. The full text is
           always available to assistive tech via the hidden copy below. -->
      <p class="tp-answer-body" aria-hidden="true" @click="finish">
        <template v-for="(seg, i) in visible" :key="i">
          <mark v-if="seg.kind === 'you'" class="tp-you">{{ seg.text }}</mark>
          <span v-else-if="seg.kind === 'rival'" class="tp-rival">{{ seg.text }}</span>
          <template v-else>{{ seg.text }}</template>
        </template>
        <span v-if="!done" class="tp-caret">|</span>
      </p>
      <p class="tp-sr">{{ plainText }}</p>

      <div class="tp-answer-foot">
        <span class="tp-pill is-solid">Position #{{ answer.position }}</span>
        <span class="tp-pill">{{ sentimentLabel }}</span>
        <span class="tp-muted">Cites {{ answer.cited.join(', ') }}</span>
        <button v-if="!done" type="button" class="tp-link" @click="finish">Show full answer</button>
      </div>
    </div>

    <div class="tp-legend">
      <span><mark class="tp-you">{{ brandName }}</mark> your brand</span>
      <span><span class="tp-rival">Competitor</span> other brands named</span>
      <span class="tp-muted">{{ summary.answers }} answers stored, word for word</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { parseSegments, TOUR_BRAND } from '@/data/productTour'
import { useTypewriter } from './useTourMotion'

const props = defineProps({
  prompt: { type: Object, required: true },
  summary: { type: Object, required: true },
  engines: { type: Array, required: true },
  motion: { type: Boolean, default: true },
})

const brandName = TOUR_BRAND.name
const active = ref(props.engines[0].key)

const answer = computed(() => props.prompt.answers[active.value])
const engineLabel = computed(() => props.engines.find((e) => e.key === active.value)?.label)
const segments = computed(() => parseSegments(answer.value.text))
const plainText = computed(() => segments.value.map((s) => s.text).join(''))
const sentimentLabel = computed(() => {
  const s = answer.value.sentiment
  return s.charAt(0).toUpperCase() + s.slice(1)
})

const { shown, done, finish } = useTypewriter(
  () => plainText.value,
  () => props.motion,
  { interval: 16, step: 3 },
)

// Slices the segment list down to the first `shown` characters.
const visible = computed(() => {
  const out = []
  let left = shown.value
  for (const seg of segments.value) {
    if (left <= 0) break
    out.push(seg.text.length <= left ? seg : { ...seg, text: seg.text.slice(0, left) })
    left -= seg.text.length
  }
  return out
})
</script>
