<script setup>
// What a group B card shows instead of numbers (board_contract.md 4): a
// sentence, an optional line, and the action that would fill it. It never
// shows sample figures. An action opens a widget's panel (`open: [key,
// query]`), the card's own panel (`panel`, with `widget`), follows a route
// (`to`) or asks the card to reload its source (`retry`, emits retry).
import { useBoard } from '@/lib/board/context'
import AgButton from '@/components/agent/common/AgButton.vue'
import SetupPointer from '@/components/board/SetupPointer.vue'

const props = defineProps({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  // 'empty' | 'not_connected' | 'error' | 'disabled'
  kind: { type: String, default: 'empty' },
  // {label, open?: [key, query], panel?: true, to?, retry?: true}
  action: { type: Object, default: null },
  // The card's widget key, for `panel` actions.
  widget: { type: String, default: '' },
  // Inside a card's body, under its numbers: no minimum height.
  inline: { type: Boolean, default: false },
})
const emit = defineEmits(['retry'])

const board = useBoard()

function run() {
  const action = props.action
  if (!action || action.to) return
  if (action.retry) emit('retry')
  else if (Array.isArray(action.open)) board.open(action.open[0], { ...(action.open[1] || {}) })
  else if (action.panel && props.widget) board.open(props.widget)
}
</script>

<template>
  <div class="wb-state" :class="[`is-${kind}`, { 'is-inline': inline }]" :role="kind === 'error' ? 'alert' : undefined">
    <p class="wb-state-title">{{ title }}</p>
    <p v-if="body" class="wb-state-body">{{ body }}</p>
    <AgButton v-if="action && action.label && action.to" size="sm" :to="action.to">{{ action.label }}</AgButton>
    <AgButton v-else-if="action && action.label" size="sm" @click="run">{{ action.label }}</AgButton>
    <SetupPointer v-if="kind === 'empty'" />
  </div>
</template>

<style scoped>
.wb-state {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  min-height: 96px;
}

.wb-state.is-inline {
  flex: 0 0 auto;
  min-height: 0;
}

/* In place of the numbers: one sentence in the card's display type, set
   at the foot of the card. Under a card's numbers it stays small. */
.wb-state-title {
  max-width: 28ch;
  margin: 0;
  color: var(--ag-fg-1);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -0.01em;
}

.wb-state.is-inline .wb-state-title {
  max-width: none;
  color: var(--ag-fg-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  letter-spacing: 0;
}

.wb-state-body {
  margin: 0 0 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}
</style>
