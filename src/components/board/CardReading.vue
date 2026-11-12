<script setup>
// The reading at the top of a board card: one sentence that says what the
// numbers below it mean, and under it the step that follows. The sentence
// is the card's own (lib/board/meaning/); this only draws it. The step
// opens a block's side panel or follows a link.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useBoard } from '@/lib/board/context'
import { normalizeReading } from '@/lib/board/reading'

const props = defineProps({
  // {line, next?} (lib/board/reading.js), or null for no reading.
  reading: { type: Object, default: null },
})

const board = useBoard()
const model = computed(() => normalizeReading(props.reading))
const next = computed(() => model.value?.next || null)

function open() {
  if (next.value?.widget) board.open(next.value.widget, next.value.query)
}
</script>

<template>
  <div v-if="model" class="bd-reading" data-testid="card-reading">
    <p class="bd-reading-line">{{ model.line }}</p>
    <component
      :is="next.to ? RouterLink : 'button'"
      v-if="next"
      class="bd-reading-next"
      v-bind="next.to ? { to: next.to } : { type: 'button' }"
      data-testid="card-reading-next"
      @click="next.to ? undefined : open()"
    >
      <span class="bd-reading-tag" aria-hidden="true">Next</span>
      <span class="bd-reading-label">{{ next.label }}</span>
      <svg class="bd-reading-arrow" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </component>
  </div>
</template>

<style scoped>
.bd-reading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.bd-reading-line {
  max-width: 34em;
  margin: 0;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -0.01em;
  text-wrap: pretty;
}

.bd-reading-next {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  margin: 0;
  padding: 0 0 2px;
  border: 0;
  border-bottom: 1px solid var(--rule-strong);
  background: none;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-align: left;
  text-decoration: none;
  text-transform: uppercase;
  cursor: pointer;
}

.bd-reading-next:hover {
  border-bottom-color: var(--foreground);
}

.bd-reading-tag {
  flex: none;
  color: var(--signal-text);
}

.bd-reading-label {
  min-width: 0;
}

.bd-reading-arrow {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  transition: transform 120ms ease;
}

.bd-reading-next:hover .bd-reading-arrow {
  transform: translateX(2px);
}

@media (prefers-reduced-motion: reduce) {
  .bd-reading-arrow {
    transition: none;
  }
}
</style>
