<script setup>
// The traffic source filter: "Auto ({label})" (what auto resolves to),
// then each source the page can read. Sources that are not connected are
// listed but disabled. sources: contract 4b `sources`.
import { computed } from 'vue'
import AnSelect from './AnSelect.vue'

const props = defineProps({
  modelValue: { type: String, default: 'auto' },
  sources: { type: Array, default: () => [] },
  // The source key auto resolves to (default_source), for the Auto label.
  autoSource: { type: String, default: '' },
  // Source keys this page can read, in order.
  keys: { type: Array, default: () => ['pixel', 'ga4', 'cloudflare'] },
  label: { type: String, default: 'Source' },
})
const emit = defineEmits(['update:modelValue'])

const LABELS = { pixel: 'Cansee pixel', ga4: 'Google Analytics 4', cloudflare: 'Cloudflare' }

const options = computed(() => {
  const byKey = Object.fromEntries(props.sources.map((s) => [s.key, s]))
  const auto = byKey[props.autoSource]?.label || LABELS[props.autoSource] || ''
  const list = [{ value: 'auto', label: auto ? `Auto (${auto})` : 'Auto' }]
  for (const key of props.keys) {
    const source = byKey[key]
    const name = source?.label || LABELS[key] || key
    if (source?.connected) list.push({ value: key, label: name })
    else list.push({ value: key, label: `${name} (not connected)`, disabled: key !== props.modelValue })
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
