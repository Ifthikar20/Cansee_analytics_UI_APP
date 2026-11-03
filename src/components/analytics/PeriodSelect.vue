<script setup>
// The period filter: last 7, 30 or 90 days (contract 1d). `periods`
// narrows the choice (the Prompt page offers 30 and 90 days).
import { computed } from 'vue'
import AnSelect from './AnSelect.vue'

const LABELS = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }

const props = defineProps({
  modelValue: { type: String, default: '30d' },
  periods: { type: Array, default: () => ['7d', '30d', '90d'] },
  label: { type: String, default: 'Period' },
})
const emit = defineEmits(['update:modelValue'])

const options = computed(() =>
  props.periods.filter((p) => LABELS[p]).map((p) => ({ value: p, label: LABELS[p] })),
)
</script>

<template>
  <AnSelect
    :label="label"
    :model-value="modelValue"
    :options="options"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
