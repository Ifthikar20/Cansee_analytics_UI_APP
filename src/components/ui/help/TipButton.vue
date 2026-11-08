<script setup>
// A plain <button> with an agent tooltip, for use as an as-child trigger of
// a reka menu or popover:
//   <DropdownMenuTrigger as-child><TipButton tip="...">...</TipButton></DropdownMenuTrigger>
// The menu's attributes and listeners land on the button. Keep the menu's
// trigger outside the tooltip: reka contexts are not scoped by component,
// so a TooltipRoot between DropdownMenuRoot and DropdownMenuTrigger takes
// the menu's anchor and the menu opens unpositioned.
// The button carries no styles of its own; style it from the caller (with
// :deep() from a scoped parent, since it is not this component's root).
import AgTooltip from '@/components/agent/common/AgTooltip.vue'

defineOptions({ inheritAttrs: false })

defineProps({
  tip: { type: String, default: '' },
  side: { type: String, default: 'bottom' },
  align: { type: String, default: 'center' },
})
</script>

<template>
  <AgTooltip :text="tip" :side="side" :align="align" :disabled="!tip">
    <button v-bind="$attrs" type="button">
      <slot />
    </button>
  </AgTooltip>
</template>
