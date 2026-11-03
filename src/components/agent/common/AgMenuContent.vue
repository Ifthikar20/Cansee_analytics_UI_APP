<script setup>
// Dropdown menu surface in the agent look. Use inside a reka DropdownMenuRoot
// (or the app's ui/dropdown-menu DropdownMenu). Any menu item placed inside,
// AgMenuItem or the app's DropdownMenuItem, is styled by role in portal.css.
import { computed } from 'vue'
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  side: { type: String, default: 'bottom' },
  align: { type: String, default: 'start' },
  sideOffset: { type: Number, default: 6 },
  alignOffset: { type: Number, default: 0 },
  collisionPadding: { type: [Number, Object], default: 8 },
  avoidCollisions: { type: Boolean, default: true },
  loop: { type: Boolean, default: true },
  forceMount: { type: Boolean, default: undefined },
  width: { type: [Number, String], default: undefined },
  class: { type: null, default: '' },
})

const emits = defineEmits(['escapeKeyDown', 'pointerDownOutside', 'focusOutside', 'interactOutside', 'closeAutoFocus'])

const delegated = computed(() => {
  const { class: _class, width: _width, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)

const widthStyle = computed(() => {
  if (props.width === undefined || props.width === null || props.width === '') return undefined
  const value = typeof props.width === 'number' ? `${props.width}px` : String(props.width)
  return { width: value, minWidth: value }
})
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="['ag-portal', 'ag-menu', props.class]"
      :style="widthStyle"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
