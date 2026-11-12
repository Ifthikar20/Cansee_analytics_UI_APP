<script setup>
// The sheet's close button: an X by default, with a label for screen readers.
import { X } from '@lucide/vue'
import { DialogClose } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  label: { type: String, default: 'Close' },
  class: { type: null, default: '' },
})
</script>

<template>
  <DialogClose
    :aria-label="label"
    :class="
      cn(
        'grid size-8 shrink-0 place-items-center border-0 bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        props.class,
      )
    "
  >
    <slot><X class="size-4" aria-hidden="true" /></slot>
  </DialogClose>
</template>
