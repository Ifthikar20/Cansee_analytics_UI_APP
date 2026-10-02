<template>
  <div class="tp tp-ask">
    <div class="tp-search" aria-hidden="true">
      <span class="tp-search-icon"></span>
      <span class="tp-search-text">{{ prompt.text.slice(0, shown) }}</span>
      <span v-if="!done" class="tp-caret">|</span>
    </div>
    <p class="tp-sr">{{ prompt.text }}</p>

    <dl class="tp-facts">
      <div class="tp-fact">
        <dt>Intent</dt>
        <dd>{{ prompt.intent }}</dd>
      </div>
      <div class="tp-fact">
        <dt>Group</dt>
        <dd>{{ prompt.group }}</dd>
      </div>
      <div class="tp-fact">
        <dt>Engines</dt>
        <dd>{{ engines.map((e) => e.label).join(', ') }}</dd>
      </div>
      <div class="tp-fact">
        <dt>Answers per run</dt>
        <dd>{{ summary.answers }} across {{ engines.length }} engines</dd>
      </div>
    </dl>

    <div class="tp-block">
      <span class="tp-label">Why this prompt is tracked</span>
      <ul class="tp-found">
        <li v-for="f in prompt.foundOn" :key="f" class="tp-found-item">
          <span class="tp-dot is-hit" aria-hidden="true"></span>{{ f }}
        </li>
      </ul>
      <p class="tp-muted">
        Prompts are mined from the places buyers already ask. You approve the set you want to
        be measured on, and each one keeps its own schedule.
      </p>
    </div>
  </div>
</template>

<script setup>
import { useTypewriter } from './useTourMotion'

const props = defineProps({
  prompt: { type: Object, required: true },
  summary: { type: Object, required: true },
  engines: { type: Array, required: true },
  motion: { type: Boolean, default: true },
})

const { shown, done } = useTypewriter(
  () => props.prompt.text,
  () => props.motion,
  { interval: 40, step: 1 },
)
</script>
