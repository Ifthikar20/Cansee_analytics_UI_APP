<script setup>
// What a group A card shows instead of numbers (board_contract.md 4): a
// sentence, an optional line, the action that would fill it and, at most,
// one more link. It never shows sample figures. An action with `to` is a
// link; any other emits `action` for the card to run.
import AgButton from '@/components/agent/common/AgButton.vue'

defineProps({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  // 'empty' | 'not_connected' | 'not_available' | 'error' | 'disabled'
  kind: { type: String, default: 'empty' },
  // {label, to?}
  action: { type: Object, default: null },
  // A second way forward, always a link: {label, to}.
  link: { type: Object, default: null },
  // Under a card's numbers rather than in their place: no minimum height.
  inline: { type: Boolean, default: false },
})
const emit = defineEmits(['action'])
</script>

<template>
  <div class="wa-state" :class="[`is-${kind}`, { 'is-inline': inline }]" :role="kind === 'error' ? 'alert' : undefined">
    <p class="wa-state-title">{{ title }}</p>
    <p v-if="body" class="wa-state-body">{{ body }}</p>
    <div v-if="(action && action.label) || (link && link.label)" class="wa-state-actions">
      <AgButton v-if="action && action.label && action.to" size="sm" :to="action.to">{{ action.label }}</AgButton>
      <AgButton v-else-if="action && action.label" size="sm" @click="emit('action')">{{ action.label }}</AgButton>
      <AgButton v-if="link && link.label" size="sm" variant="ghost" :to="link.to">{{ link.label }}</AgButton>
    </div>
  </div>
</template>

<style scoped>
.wa-state {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  min-height: 96px;
}

.wa-state.is-inline {
  flex: 0 0 auto;
  min-height: 0;
}

.wa-state-title {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.wa-state-body {
  max-width: 60ch;
  margin: 0 0 2px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.wa-state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
