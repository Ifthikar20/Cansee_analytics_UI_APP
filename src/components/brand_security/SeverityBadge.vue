<script setup>
/**
 * Severity badge: colored dot + text label, never color alone. The one
 * severity rendering for every brand-security surface — colors flow
 * through the --severity-* tokens via constants/severity.js.
 */
import { computed } from 'vue'

import { severityMeta } from '@/constants/severity'

const props = defineProps({
  severity: { type: String, default: 'low' },
  size: { type: String, default: 'md' }, // 'sm' | 'md'
})

const meta = computed(() => severityMeta(props.severity))
</script>

<template>
  <span
    class="inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border font-medium font-mono uppercase tracking-wide"
    :class="[
      meta.badgeClass,
      size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs',
    ]"
  >
    <span class="size-1.5 shrink-0 rounded-full" :class="meta.dotClass" aria-hidden="true"></span>
    {{ meta.label }}
  </span>
</template>
