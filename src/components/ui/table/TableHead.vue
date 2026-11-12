<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({ class: { type: null, default: '' } })
</script>

<template>
  <th :class="cn('h-10 px-4 text-left align-middle font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground', props.class)">
    <slot />
  </th>
</template>
