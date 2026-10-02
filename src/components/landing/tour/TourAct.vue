<template>
  <div class="tp tp-act">
    <div class="tp-col">
      <span class="tp-label">What to do next</span>
      <ul class="tp-actions">
        <li v-for="a in prompt.actions" :key="a.kind + a.page" class="tp-action">
          <span class="tp-action-kind">{{ kinds[a.kind] }}</span>
          <span class="tp-action-page">{{ a.page }}</span>
          <p class="tp-muted">{{ a.detail }}</p>
        </li>
      </ul>
    </div>

    <div class="tp-col">
      <span class="tp-label">Where your team already works</span>
      <div class="tp-chat">
        <div class="tp-chat-bar"># {{ channel }}</div>
        <div class="tp-chat-msg">
          <img class="tp-chat-avatar" src="/images/cansee-mark.png" alt="" width="36" height="36" />
          <div class="tp-chat-body">
            <div class="tp-chat-meta">
              <span class="tp-chat-name">Cansee</span>
              <span class="tp-chat-app">App</span>
              <span class="tp-muted">Mon 9:00</span>
            </div>
            <p class="tp-chat-title">Weekly AI visibility digest</p>
            <ul class="tp-chat-lines">
              <li>{{ scoreLine }}</li>
              <li v-for="line in prompt.digest.lines" :key="line">{{ line }}</li>
            </ul>
          </div>
        </div>
      </div>
      <p class="tp-muted">The same digest can go to Discord or Microsoft Teams, daily or weekly.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TOUR_ACTION_KINDS } from '@/data/productTour'

const props = defineProps({
  prompt: { type: Object, required: true },
  summary: { type: Object, required: true },
  engines: { type: Array, required: true },
  motion: { type: Boolean, default: true },
})

const kinds = TOUR_ACTION_KINDS
const channel = computed(() => props.prompt.digest.channel.replace(/^#/, ''))

const scoreLine = computed(() => {
  const d = props.prompt.digest.delta
  const change = d === 0 ? 'no change' : `${d > 0 ? 'up' : 'down'} ${Math.abs(d)}`
  return `“${props.prompt.text}”: visibility ${props.summary.score.total}/100, ${change} on last week.`
})
</script>
