<script setup>
// The frame every group B card shares (board_contract.md 4): a skeleton
// until the source first answers, the load failure (or Insights off) while
// there is no data, the card's own state, else its lead and body; then the
// foot, where a refetch that failed adds "Couldn't refresh." to the last
// numbers. The lead sits beside the body once the card is wide enough. It
// tells the board's frame which of these the body shows (the chip).
import { computed } from 'vue'
import { useCardStatus } from '@/lib/board/context'
import { cardStatus } from '@/lib/board/frame'
import { widgetMeta } from '@/lib/board/widgets'
import CardFoot from '@/components/board/CardFoot.vue'
import CardReading from '@/components/board/CardReading.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import CardState from './CardState.vue'
import { loadFailure } from './specs'

const props = defineProps({
  // The card's widget key (its title names the load failure).
  widget: { type: String, required: true },
  // useBoardSource's data, error, failure and stale.
  data: { type: null, default: null },
  error: { type: String, default: '' },
  failure: { type: Object, default: null },
  stale: { type: Boolean, default: false },
  // The card's own state (CardState props), or null when it has numbers.
  empty: { type: Object, default: null },
  // The foot's line (the window the card reads) when it has numbers.
  foot: { type: String, default: '' },
  // The skeleton's height in px.
  skeleton: { type: Number, default: 132 },
  // What the numbers mean and the step that follows (lib/board/reading.js).
  reading: { type: Object, default: null },
})
const emit = defineEmits(['retry'])

const title = computed(() => widgetMeta(props.widget)?.title || '')
const failed = computed(() => loadFailure(props.failure, title.value))
useCardStatus(() =>
  cardStatus({
    loading: !props.data && !props.error,
    failed: !props.data,
    failedKind: failed.value?.kind || 'error',
    emptyKind: props.empty ? props.empty.kind || 'empty' : '',
    stale: props.stale,
  }),
)
const footText = computed(() =>
  [props.empty ? '' : props.foot, props.stale ? "Couldn't refresh." : ''].filter(Boolean).join(' '),
)
</script>

<template>
  <div class="wb-frame">
    <CardSkeleton v-if="!data && !error" :height="skeleton" />
    <CardState v-else-if="!data" v-bind="failed" :widget="widget" @retry="emit('retry')" />
    <template v-else>
      <CardState v-if="empty" v-bind="empty" :widget="widget" @retry="emit('retry')" />
      <template v-else>
        <CardReading :reading="reading" />
        <div class="wb-body" :class="{ 'has-lead': $slots.lead }">
          <div v-if="$slots.lead" class="wb-lead"><slot name="lead" /></div>
          <div class="wb-main"><slot /></div>
        </div>
      </template>
      <CardFoot v-if="footText">{{ footText }}</CardFoot>
    </template>
  </div>
</template>

<style scoped>
.wb-frame {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.wb-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.wb-lead,
.wb-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

/* A wide card (half or full width on a wide board) puts the lead beside
   the body; the card's own width decides, not its size. */
@container bd-card (min-width: 600px) {
  .wb-body.has-lead {
    display: grid;
    grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
    align-items: start;
    gap: 24px;
  }
}
</style>
