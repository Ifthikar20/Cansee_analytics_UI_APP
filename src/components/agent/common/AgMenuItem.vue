<script setup>
// Menu row for AgMenuContent. `danger` colours destructive actions; the
// `trail` slot holds right-aligned content (a check, a shortcut).
import { DropdownMenuItem, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: undefined },
  textValue: { type: String, default: undefined },
  asChild: { type: Boolean, default: undefined },
  as: { type: null, default: undefined },
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const delegated = computed(() => {
  const { danger: _danger, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    class="ag-menu-item"
    :class="{ 'is-danger': danger }"
    @select="emit('select', $event)"
  >
    <slot />
    <span v-if="$slots.trail" class="ag-menu-trail"><slot name="trail" /></span>
  </DropdownMenuItem>
</template>
