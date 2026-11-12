<script setup>
import { DialogTitle } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({ class: { type: null, default: '' } })
</script>

<template>
  <DialogTitle :class="cn('font-display text-lg font-medium tracking-tight text-foreground', props.class)">
    <slot />
  </DialogTitle>
</template>
