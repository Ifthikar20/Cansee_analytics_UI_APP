<script setup>
// The engine filter: "All engines", Google where the page asks for it,
// then the configured engines. engines: [{key, label, configured}].
import { computed } from 'vue'
import { engineMeta } from '@/lib/engines'
import AnSelect from './AnSelect.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  engines: { type: Array, default: () => [] },
  includeGoogle: { type: Boolean, default: false },
  label: { type: String, default: 'Engine' },
})
const emit = defineEmits(['update:modelValue'])

const options = computed(() => {
  const list = [{ value: '', label: 'All engines' }]
  if (props.includeGoogle) list.push({ value: 'google', label: 'Google' })
  for (const e of props.engines) {
    if (e.configured) list.push({ value: e.key, label: e.label || engineMeta(e.key).label })
  }
  // A value from the URL that is not offered (an engine since removed)
  // still shows as chosen.
  if (props.modelValue && !list.some((o) => o.value === props.modelValue)) {
    list.push({ value: props.modelValue, label: props.modelValue === 'google' ? 'Google' : engineMeta(props.modelValue).label })
  }
  return list
})
</script>

<template>
  <AnSelect
    :label="label"
    :model-value="modelValue"
    :options="options"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
