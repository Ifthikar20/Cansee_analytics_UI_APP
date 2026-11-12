<script setup>
import { DropdownMenuLabel } from 'reka-ui'
import { cn } from '@/lib/utils'
const props = defineProps({ class: { type: null, default: '' } })
</script>

<template>
  <DropdownMenuLabel :class="cn('px-2 py-1.5 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground', props.class)">
    <slot />
  </DropdownMenuLabel>
</template>
