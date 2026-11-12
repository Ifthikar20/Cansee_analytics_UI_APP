<script setup>
// Project monogram: the first letter of the project name on the logo
// colours. No third-party logo is fetched.
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 18 },
})

const initial = computed(() => {
  const match = String(props.name || '').trim().match(/[\p{L}\p{N}]/u)
  return match ? match[0].toUpperCase() : ''
})
</script>

<template>
  <span
    class="ag-monogram"
    :style="{
      '--ag-mono-size': `${size}px`,
      '--ag-mono-font': `${Math.max(9, Math.round(size * 0.6))}px`,
      '--ag-mono-radius': 'var(--radius)',
    }"
    aria-hidden="true"
  >{{ initial }}</span>
</template>

<style scoped>
.ag-monogram {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--ag-mono-size);
  height: var(--ag-mono-size);
  border-radius: var(--ag-mono-radius);
  background: var(--ag-logo-bg);
  color: var(--ag-logo-fg);
  font-size: var(--ag-mono-font);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}
</style>
