<script setup>
// A draft's review state: an icon and its word (never colour alone), with
// the approved version. In the pane header it opens the review panel (a
// popover, a drawer on phones); in lists it is plain text. The panel loads
// on first open, so the header never pulls in the review requests.
import { computed, defineAsyncComponent, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ChevronDown } from '@lucide/vue'
import AgDrawer from '@/components/agent/common/AgDrawer.vue'
import { chipText, effectiveState, stateMeta } from '@/lib/agent/review'

const ReviewPanel = defineAsyncComponent(() => import('./ReviewPanel.vue').then((m) => m.default))

const NARROW = '(max-width: 767px)'

const props = defineProps({
  // the artifact payload's review summary {state, effective_state, version, reviewer_name}
  review: { type: Object, default: null },
  websiteId: { type: String, default: null },
  artifactId: { type: String, default: null },
  // plain text and icon, no panel (lists)
  plain: { type: Boolean, default: false },
})

const emit = defineEmits(['changed'])

const open = ref(false)
const narrow = useMediaQuery(NARROW)

const state = computed(() => effectiveState(props.review))
const meta = computed(() => stateMeta(state.value))
const text = computed(() => chipText(props.review))
const interactive = computed(() => !props.plain && Boolean(props.websiteId && props.artifactId))

</script>

<template>
  <span v-if="!interactive" class="ag-rchip is-plain" :class="`is-${state}`">
    <component :is="meta.icon" :size="13" aria-hidden="true" />
    <span>{{ text }}</span>
  </span>

  <template v-else-if="narrow">
    <button
      type="button"
      class="ag-rchip"
      :class="`is-${state}`"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      @click="open = !open"
    >
      <component :is="meta.icon" :size="13" aria-hidden="true" />
      <span>{{ text }}</span>
      <ChevronDown :size="12" aria-hidden="true" />
    </button>
    <AgDrawer v-model:open="open" title="Review">
      <ReviewPanel v-if="open" :website-id="websiteId" :artifact-id="artifactId" fluid @changed="emit('changed', $event)" />
    </AgDrawer>
  </template>

  <PopoverRoot v-else v-model:open="open">
    <PopoverTrigger as-child>
      <button type="button" class="ag-rchip" :class="`is-${state}`" aria-haspopup="dialog">
        <component :is="meta.icon" :size="13" aria-hidden="true" />
        <span>{{ text }}</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="ag-portal ag-popover ag-rchip-pop" side="bottom" align="end" :side-offset="6" :collision-padding="8">
        <ReviewPanel v-if="open" :website-id="websiteId" :artifact-id="artifactId" @changed="emit('changed', $event)" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.ag-rchip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
  box-sizing: border-box;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--ag-card-border);
  border-radius: 999px;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

button.ag-rchip {
  cursor: pointer;
  transition: background-color 120ms ease;
}

button.ag-rchip:hover,
button.ag-rchip[data-state='open'] {
  background: var(--ag-ghost-hover);
}

button.ag-rchip:focus-visible {
  border-radius: 999px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-rchip.is-plain {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  font-weight: 400;
}

.ag-rchip.is-approved {
  color: var(--ag-you);
}

.ag-rchip.is-changes_requested {
  color: var(--ag-warning);
}

.ag-rchip.is-in_review {
  color: var(--ag-fg-1);
}

.ag-rchip-pop {
  width: auto;
  max-height: none;
  overflow: visible;
}
</style>
