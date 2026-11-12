<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({ class: { type: null, default: '' } })
</script>

<template>
  <div :class="cn('animate-pulse bg-muted motion-reduce:animate-none', props.class)" />
</template>
