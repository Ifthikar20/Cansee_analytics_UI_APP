<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({ class: { type: null, default: '' } })
</script>

<template>
  <div :class="cn('flex items-start gap-3 border-b border-border px-5 pt-5 pb-4', props.class)">
    <slot />
  </div>
</template>
