<template>
  <RadioGroupRoot
    :model-value="modelValue"
    class="viz-switch"
    aria-label="Chart type"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <RadioGroupItem v-for="option in options" :key="option.value" :value="option.value" class="viz-switch-item">
      {{ option.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<script setup>
// The representation switcher: a radio group (one tab stop, arrow keys
// move and select), drawn as a 28px segmented control. Items are words,
// never icons alone.
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

defineProps({
  modelValue: { type: String, default: '' },
  // [{ value, label }]
  options: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
/* Wraps onto a second line in very narrow cards rather than hiding an
   option (Table included) off the edge. */
.viz-switch {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  min-height: 28px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--viz-nodata);
}

.viz-switch-item {
  height: 22px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--viz-ink-2);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  cursor: pointer;
}

.viz-switch-item:hover {
  color: var(--viz-ink-1);
}

.viz-switch-item[data-state='checked'] {
  background: var(--viz-surface);
  box-shadow: 0 0 0 1px var(--border);
  color: var(--viz-ink-1);
}

.viz-switch-item:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
</style>
