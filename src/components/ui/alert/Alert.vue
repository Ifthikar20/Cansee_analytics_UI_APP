<script setup>
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, default: '' },
  variant: { type: String, default: 'default' }, // 'default' | 'destructive'
})

const variantClasses = computed(() =>
  props.variant === 'destructive'
    ? 'border-destructive bg-card text-destructive [&>svg]:text-current'
    : 'border-border bg-card text-card-foreground'
)
</script>

<template>
  <div
    role="alert"
    :class="cn(
      'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-[var(--radius)] border px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
      variantClasses,
      props.class,
    )"
  >
    <slot />
  </div>
</template>
