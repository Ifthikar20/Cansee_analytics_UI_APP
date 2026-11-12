<script setup>
import { DropdownMenuItem, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  disabled: { type: Boolean, default: undefined },
  textValue: { type: String, default: undefined },
  asChild: { type: Boolean, default: undefined },
  as: { type: null, default: undefined },
  class: { type: null, default: '' },
})
const emits = defineEmits(['select'])

const delegated = useForwardProps(props)
</script>

<template>
  <DropdownMenuItem
    v-bind="delegated"
    @select="emits('select', $event)"
    :class="cn(
      'relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
      props.class,
    )"
  >
    <slot />
  </DropdownMenuItem>
</template>
