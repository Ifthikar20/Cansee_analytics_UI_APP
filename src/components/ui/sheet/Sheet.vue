<script setup>
// A side sheet: a modal reka Dialog that slides in from an edge. Focus is
// trapped while it is open and returns to the opener on close; Escape and a
// click on the overlay close it. Styled with the app's tokens only, so it
// themes on public pages too (no agent CSS needed).
import { DialogRoot, useForwardPropsEmits } from 'reka-ui'

const props = defineProps({
  open: { type: Boolean, default: undefined },
  defaultOpen: { type: Boolean, default: undefined },
  modal: { type: Boolean, default: undefined },
})
const emits = defineEmits(['update:open'])
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DialogRoot v-bind="forwarded">
    <slot />
  </DialogRoot>
</template>
