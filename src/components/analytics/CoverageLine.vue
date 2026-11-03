<script setup>
// How much of the page rests on analyzed answers (p2_contract.md 3c):
// "Themes come from 40 of 52 answers that name you." and the button that
// analyzes the rest. Shown only while some answers are not analyzed.
// The button opens the page's answer-analysis dialog (the
// useInsightRun('answer_analysis') the page created) with `params`, and
// emits `analyze` for pages that open it themselves.
import { computed } from 'vue'
import { injectInsightRun } from '@/composables/analytics/useInsightRun'

const props = defineProps({
  // {named_answers, analyzed, not_analyzed, failed}
  coverage: { type: Object, default: null },
  // What comes from the analyzed answers: 'Themes' (Sentiment), 'Claims' (Fact check).
  label: { type: String, default: 'Themes' },
  // The run params the dialog opens with (the page's period, engine and prompt).
  params: { type: Object, default: null },
})
const emit = defineEmits(['analyze'])

const runner = injectInsightRun('answer_analysis')
const integer = new Intl.NumberFormat('en-US')

const notAnalyzed = computed(() => Number(props.coverage?.not_analyzed) || 0)
const sentence = computed(() => {
  const c = props.coverage || {}
  return `${props.label} come from ${integer.format(c.analyzed || 0)} of ${integer.format(c.named_answers || 0)} answers that name you.`
})
const buttonText = computed(
  () => `Analyze ${integer.format(notAnalyzed.value)} ${notAnalyzed.value === 1 ? 'answer' : 'answers'}`,
)

function analyze() {
  if (runner && props.params) runner.open(props.params)
  emit('analyze')
}
</script>

<template>
  <p v-if="notAnalyzed > 0" class="cov">
    <span class="cov-text">{{ sentence }}</span>
    <button type="button" class="cov-btn" @click="analyze">{{ buttonText }}</button>
  </p>
</template>

<style scoped>
.cov {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  color: var(--muted-foreground);
  font-size: 13.5px;
  line-height: 1.5;
}

.cov-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.cov-btn:hover {
  border-color: var(--input);
  background: var(--accent);
}

.cov-btn:focus-visible {
  border-radius: 999px;
}
</style>
