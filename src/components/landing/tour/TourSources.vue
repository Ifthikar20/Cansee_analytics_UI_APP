<template>
  <div class="tp tp-sources">
    <div class="tp-col">
      <span class="tp-label">Most-cited domains in these answers</span>
      <ul class="tp-domains">
        <li v-for="(s, i) in prompt.sources" :key="s.domain" class="tp-domain" :class="{ 'is-open': open === s.domain }">
          <button
            type="button"
            class="tp-domain-row"
            :aria-expanded="open === s.domain ? 'true' : 'false'"
            @click="open = open === s.domain ? null : s.domain"
          >
            <span class="tp-domain-rank">{{ i + 1 }}</span>
            <span class="tp-domain-name">{{ s.domain }}</span>
            <span class="tp-pill">{{ s.type }}</span>
            <span class="tp-domain-share">
              <span class="tp-bar"><span :style="{ width: (s.share / maxShare) * 100 + '%' }"></span></span>
              <span class="tp-bar-val">{{ s.share }}%</span>
            </span>
            <span class="tp-sr">Cited by {{ citedBy(s) }}</span>
            <span class="tp-domain-engines" aria-hidden="true">
              <span
                v-for="e in s.citedBy"
                :key="e"
                class="tp-dot"
                :class="'is-' + e"
              ></span>
            </span>
          </button>
          <div v-if="open === s.domain" class="tp-domain-detail">
            <span class="tp-domain-presence">{{ presence(s) }}</span>
            <span class="tp-muted">Cited by {{ citedBy(s) }}.</span>
            <p>{{ s.note }}</p>
          </div>
        </li>
      </ul>
    </div>

    <div class="tp-col">
      <div class="tp-convo">
        <span class="tp-label">The conversation forming · Brand Research</span>
        <div class="tp-convo-where tp-muted">{{ prompt.conversation.domain }}/{{ prompt.conversation.where }} · {{ prompt.conversation.age }}</div>
        <div class="tp-convo-title">{{ prompt.conversation.title }}</div>
        <blockquote class="tp-quote">“{{ prompt.conversation.quote }}”</blockquote>
        <ul class="tp-bars">
          <li v-for="b in prompt.conversation.brands" :key="b.brand" class="tp-bar-row" :class="{ 'is-you': b.you }">
            <span class="tp-bar-label">{{ b.brand }}<template v-if="b.you"> (you)</template></span>
            <span class="tp-bar"><span :style="{ width: (b.mentions / maxMentions) * 100 + '%' }"></span></span>
            <span class="tp-bar-val">{{ b.mentions }} mentions</span>
          </li>
        </ul>
        <p class="tp-convo-note">
          <span class="tp-dot" :class="'is-' + prompt.conversation.engine" aria-hidden="true"></span>
          {{ prompt.conversation.note }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { TOUR_PRESENCE } from '@/data/productTour'

const props = defineProps({
  prompt: { type: Object, required: true },
  summary: { type: Object, required: true },
  engines: { type: Array, required: true },
  motion: { type: Boolean, default: true },
})

const open = ref(props.prompt.sources[0]?.domain ?? null)

const maxShare = computed(() => Math.max(...props.prompt.sources.map((s) => s.share)))
const maxMentions = computed(() => Math.max(...props.prompt.conversation.brands.map((b) => b.mentions)))

const engineLabel = (key) => props.engines.find((e) => e.key === key)?.label ?? key
const citedBy = (s) => s.citedBy.map(engineLabel).join(', ')
const presence = (s) =>
  s.rank != null ? `${TOUR_PRESENCE[s.presence]}, ranked #${s.rank} here` : TOUR_PRESENCE[s.presence]
</script>
