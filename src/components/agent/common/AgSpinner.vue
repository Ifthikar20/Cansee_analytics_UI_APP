<script setup>
// Small indeterminate spinner. Decorative unless `label` is given.
defineProps({
  size: { type: Number, default: 14 },
  label: { type: String, default: '' },
})
</script>

<template>
  <span
    class="ag-spinner"
    :style="{ '--ag-spinner-size': `${size}px` }"
    :role="label ? 'status' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>

<style scoped>
.ag-spinner {
  display: inline-block;
  flex-shrink: 0;
  box-sizing: border-box;
  width: var(--ag-spinner-size);
  height: var(--ag-spinner-size);
  border: 1.5px solid color-mix(in srgb, currentColor 22%, transparent);
  border-top-color: currentColor;
  border-radius: 999px;
  animation: ag-spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ag-spinner {
    animation-duration: 1.6s;
  }
}
</style>
