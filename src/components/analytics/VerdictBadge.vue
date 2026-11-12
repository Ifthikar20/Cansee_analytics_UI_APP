<script setup>
// A claim's verdict (contract 3a) as its icon and its word, never colour
// alone. With `help`, the badge is focusable and shows the verdict's
// one-line help as a tooltip.
import { computed } from 'vue'
import { VERDICTS } from '@/lib/analytics/insightWords'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps({
  // 'supported' | 'contradicted' | 'not_verifiable' | 'unchecked'
  verdict: { type: String, required: true },
  help: { type: Boolean, default: false },
})

const key = computed(() => (VERDICTS[props.verdict] ? props.verdict : 'unchecked'))
const meta = computed(() => VERDICTS[key.value])
</script>

<template>
  <Tooltip v-if="help">
    <TooltipTrigger as-child>
      <span class="vb is-help" :class="`is-${key}`" tabindex="0">
        <component :is="meta.icon" class="vb-icon" aria-hidden="true" />
        <span>{{ meta.word }}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" class="max-w-64 whitespace-normal leading-relaxed">{{ meta.help }}</TooltipContent>
  </Tooltip>
  <span v-else class="vb" :class="`is-${key}`">
    <component :is="meta.icon" class="vb-icon" aria-hidden="true" />
    <span>{{ meta.word }}</span>
  </span>
</template>

<style scoped>
.vb {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.vb.is-help {
  border-radius: var(--radius);
  cursor: help;
}

.vb-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  color: var(--muted-foreground);
}

.is-supported .vb-icon {
  color: var(--viz-good);
}

.is-contradicted .vb-icon {
  color: var(--viz-critical);
}
</style>
