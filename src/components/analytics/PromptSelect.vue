<script setup>
// The prompt filter: "All prompts", then each tracked prompt (text clipped
// to 60 characters). prompts: [{prompt_id, text}].
import { computed } from 'vue'
import AnSelect from './AnSelect.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  prompts: { type: Array, default: () => [] },
  label: { type: String, default: 'Prompt' },
})
const emit = defineEmits(['update:modelValue'])

const MAX = 60

function clip(text) {
  const t = String(text || '').trim()
  return t.length > MAX ? `${t.slice(0, MAX - 1).trimEnd()}…` : t
}

const options = computed(() => {
  const list = [{ value: '', label: 'All prompts' }]
  for (const p of props.prompts) list.push({ value: String(p.prompt_id), label: clip(p.text) })
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
