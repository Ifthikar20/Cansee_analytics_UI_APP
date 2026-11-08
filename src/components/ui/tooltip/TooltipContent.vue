<script setup>
// The app's tooltip surface: the agent tooltip tokens, dark in both themes,
// stacked above the onboarding flow and dialogs (components/ui/help/help.css).
// It never uses bg-primary, which turns white in the dark theme.
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import '@/components/ui/help/help.css'

const props = defineProps({
  sideOffset: { type: Number, default: 4 },
  side: { type: String, default: undefined },
  align: { type: String, default: undefined },
  class: { type: null, default: '' },
})
const emits = defineEmits(['escapeKeyDown', 'pointerDownOutside'])

const delegated = useForwardPropsEmits(props, emits)
</script>

<template>
  <TooltipPortal>
    <TooltipContent v-bind="delegated" :collision-padding="8" :class="cn('cs-tooltip', props.class)">
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
