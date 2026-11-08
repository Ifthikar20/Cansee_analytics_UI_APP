<script setup>
import { DialogDescription } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({ class: { type: null, default: '' } })
</script>

<template>
  <DialogDescription :class="cn('mt-0.5 text-sm text-muted-foreground', props.class)">
    <slot />
  </DialogDescription>
</template>
