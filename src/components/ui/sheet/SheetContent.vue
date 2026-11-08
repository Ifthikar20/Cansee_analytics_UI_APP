<script setup>
// The sheet's panel and overlay, teleported to <body>. side: 'right' (the
// default) or 'left'. Full height; min(420px, 100vw - 48px) wide, the full
// width at 640px and below. It sits over the board panel and the agent
// drawer (z 90/91) and under toasts and the feedback dialog.
import { computed } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  side: { type: String, default: 'right', validator: (v) => v === 'right' || v === 'left' },
  class: { type: null, default: '' },
  forceMount: { type: Boolean, default: undefined },
  trapFocus: { type: Boolean, default: undefined },
  disableOutsidePointerEvents: { type: Boolean, default: undefined },
})
const emits = defineEmits([
  'escapeKeyDown',
  'pointerDownOutside',
  'focusOutside',
  'interactOutside',
  'openAutoFocus',
  'closeAutoFocus',
])

const contentProps = computed(() => {
  // eslint-disable-next-line no-unused-vars
  const { side, class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(contentProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="sheet-overlay fixed inset-0 z-[95] bg-black/40" />
    <DialogContent
      v-bind="forwarded"
      :data-side="side"
      :class="
        cn(
          'sheet-content fixed top-0 bottom-0 z-[96] flex h-dvh flex-col border-border bg-card text-card-foreground shadow-2xl outline-none',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          props.class,
        )
      "
    >
      <slot />
    </DialogContent>
  </DialogPortal>
</template>

<style>
/* Unscoped: the panel is teleported, and these are its only rules. */
.sheet-content {
  width: min(420px, calc(100vw - 48px));
}

@media (max-width: 640px) {
  .sheet-content {
    width: 100vw;
  }
}

.sheet-content[data-state='open'][data-side='right'] {
  animation: sheet-in-right 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-content[data-state='open'][data-side='left'] {
  animation: sheet-in-left 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-overlay[data-state='open'] {
  animation: sheet-fade 180ms ease-out;
}

@keyframes sheet-in-right {
  from {
    transform: translateX(100%);
  }
}

@keyframes sheet-in-left {
  from {
    transform: translateX(-100%);
  }
}

@keyframes sheet-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet-content[data-state='open'],
  .sheet-overlay[data-state='open'] {
    animation: none;
  }
}
</style>
