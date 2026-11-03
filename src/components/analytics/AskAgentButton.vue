<script setup>
// "Ask the agent" on an analytics row: drafts the template's message for
// these values and opens a new chat with it (lib/agent/askAgent.js). It
// never sends anything; the user reviews the draft in the chat first.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquarePlus } from '@lucide/vue'
import { askAgent } from '@/lib/agent/askAgent'
import { ASK_TEMPLATES, askAgentKey, askText } from '@/lib/analytics/askTemplates'
import { analyticsSectionOf } from '@/lib/analyticsNav'

const props = defineProps({
  websiteId: { type: [String, Number], required: true },
  // A template id of ASK_TEMPLATES ('page_optimize', 'fact_contradicted'...).
  template: { type: String, required: true },
  values: { type: Object, default: () => ({}) },
  label: { type: String, default: 'Ask the agent' },
})

const route = useRoute()
const router = useRouter()
const busy = ref(false)

// The tab the draft comes from: the current section, else the template's own.
const from = computed(
  () => route.meta?.analytics || analyticsSectionOf(route.name) || ASK_TEMPLATES[props.template]?.from || '',
)

async function ask() {
  if (busy.value) return
  busy.value = true
  try {
    await askAgent(router, {
      websiteId: props.websiteId,
      agent: askAgentKey(props.template, props.values),
      from: from.value,
      text: askText(props.template, props.values),
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button type="button" class="ask-btn" :disabled="busy" @click="ask">
    <MessageSquarePlus class="ask-btn-icon" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.ask-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ask-btn:hover {
  background: var(--accent);
}

.ask-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}

.ask-btn:focus-visible {
  border-radius: 8px;
}

.ask-btn-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  color: var(--muted-foreground);
}
</style>
