<script setup>
// How a country result was localized: a small outlined chip with the
// method label ("Asked to answer for GB"), and the method's note in a
// tooltip on hover and keyboard focus. Brings its own tooltip provider,
// so it works on any page.
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { methodNote } from '@/lib/analytics/methods'

const props = defineProps({
  method: { type: String, default: '' },
  label: { type: String, default: '' },
})

const note = computed(() => methodNote(props.method))
</script>

<template>
  <TooltipProvider v-if="label && note" :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <button type="button" class="mchip" :data-method="method || null">{{ label }}</button>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-72 whitespace-normal leading-relaxed">{{ note }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <span v-else-if="label" class="mchip" :data-method="method || null">{{ label }}</span>
</template>

<style scoped>
.mchip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.4;
  text-align: left;
  white-space: normal;
}

button.mchip {
  cursor: help;
}

button.mchip:hover {
  border-color: var(--input);
  color: var(--foreground);
}

button.mchip:focus-visible {
  border-radius: 999px;
}
</style>
