<script setup>
// The frame of a group A card (board_contract.md 4): a skeleton until its
// source first answers, the load failure (or Insights off) while there is
// nothing to show, the card's own state, else its content; then the foot,
// where a refetch that failed adds "Couldn't refresh." to the last numbers.
// It tells the board's frame which of these the body shows (the chip).
import { computed } from 'vue'
import { useCardStatus } from '@/lib/board/context'
import { cardStatus } from '@/lib/board/frame'
import CardFoot from '@/components/board/CardFoot.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import CardState from './CardState.vue'
import { failureState, STALE_NOTE } from './specs'

const props = defineProps({
  // The card's widget key: its title names the load failure.
  widget: { type: String, required: true },
  // 'loading' | 'failed' | 'ready'
  phase: { type: String, default: 'loading' },
  // useBoardSource's failure, shown while the phase is 'failed'.
  failure: { type: Object, default: null },
  stale: { type: Boolean, default: false },
  // The card's own state (CardState props), or null when it has numbers.
  empty: { type: Object, default: null },
  // Foot lines (source, window, notes) shown with the numbers.
  notes: { type: Array, default: () => [] },
  skeleton: { type: Number, default: 132 },
})
const emit = defineEmits(['retry', 'action'])

const failed = computed(() => failureState(props.widget, props.failure))
useCardStatus(() =>
  cardStatus({
    loading: props.phase === 'loading',
    failed: props.phase === 'failed',
    failedKind: failed.value?.kind || 'error',
    emptyKind: props.empty ? props.empty.kind || 'empty' : '',
    stale: props.stale,
  }),
)
const footText = computed(() => [...props.notes, props.stale ? STALE_NOTE : ''].filter(Boolean).join(' '))
</script>

<template>
  <div class="wa-card">
    <CardSkeleton v-if="phase === 'loading'" :height="skeleton" />
    <CardState v-else-if="phase === 'failed'" v-bind="failed" @action="emit('retry')" />
    <template v-else>
      <CardState v-if="empty" v-bind="empty" @action="emit('action')" />
      <slot v-else />
      <CardFoot v-if="footText || $slots.link">
        <template v-if="footText">{{ footText }}</template>
        <template v-if="$slots.link" #link><slot name="link" /></template>
      </CardFoot>
    </template>
  </div>
</template>

<style scoped>
.wa-card {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
</style>
