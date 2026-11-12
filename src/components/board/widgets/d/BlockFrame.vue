<script setup>
// The frame the group D cards share: a skeleton until the source first
// answers, the load failure while there is no data, the card's own state
// (nothing tracked, nothing answered), else its body and a foot line. A
// refetch that failed keeps the last body and says so in the foot. It
// tells the board's frame which of these shows (the chip), and it is the
// container its body's layout queries (wd-block), so a card lays out the
// same on the board and in the side panel.
import { computed } from 'vue'
import { useCardStatus } from '@/lib/board/context'
import { cardStatus } from '@/lib/board/frame'
import { widgetMeta } from '@/lib/board/widgets'
import CardFoot from '@/components/board/CardFoot.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import CardState from '../b/CardState.vue'
import { loadFailure } from '../b/specs'

const props = defineProps({
  // The card's widget key (its title names the load failure).
  widget: { type: String, required: true },
  // useBoardSource's data, error, failure and stale.
  data: { type: null, default: null },
  error: { type: String, default: '' },
  failure: { type: Object, default: null },
  stale: { type: Boolean, default: false },
  // The card's own state in place of its body (CardState props), or null.
  empty: { type: Object, default: null },
  // A body that shows but holds no measurement yet: the CardState kind it
  // stands for ('empty', 'not_connected'), so the chip never reads "Live".
  gap: { type: String, default: '' },
  // The foot's line when the body shows.
  foot: { type: String, default: '' },
  // The skeleton's height in px.
  skeleton: { type: Number, default: 240 },
})
const emit = defineEmits(['retry'])

const title = computed(() => widgetMeta(props.widget)?.title || '')
const failed = computed(() => loadFailure(props.failure, title.value))
useCardStatus(() =>
  cardStatus({
    loading: !props.data && !props.error,
    failed: !props.data,
    failedKind: failed.value?.kind || 'error',
    emptyKind: props.empty ? props.empty.kind || 'empty' : props.gap,
    stale: props.stale,
  }),
)
const footText = computed(() => [props.foot, props.stale ? "Couldn't refresh." : ''].filter(Boolean).join(' '))
</script>

<template>
  <div class="wd-frame">
    <CardSkeleton v-if="!data && !error" :height="skeleton" />
    <CardState v-else-if="!data" v-bind="failed" :widget="widget" @retry="emit('retry')" />
    <CardState v-else-if="empty" v-bind="empty" :widget="widget" @retry="emit('retry')" />
    <template v-else>
      <slot />
      <CardFoot v-if="footText || $slots.aside">
        <template v-if="footText">{{ footText }}</template>
        <template v-if="$slots.aside" #link><slot name="aside" /></template>
      </CardFoot>
    </template>
  </div>
</template>

<style scoped>
.wd-frame {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  container: wd-block / inline-size;
}
</style>
