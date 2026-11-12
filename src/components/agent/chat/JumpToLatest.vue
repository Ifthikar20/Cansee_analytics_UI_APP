<template>
  <Transition name="ag-jump">
    <button v-if="visible" type="button" class="ag-jump" aria-label="Jump to the latest message" @click="emit('jump')">
      <ArrowDown aria-hidden="true" />
    </button>
  </Transition>
</template>

<script setup>
// Round button above the composer when the user has scrolled up.
import { ArrowDown } from '@lucide/vue'

defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['jump'])
</script>

<style scoped>
.ag-jump {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--ag-btn-border);
  border-radius: var(--radius);
  background: var(--ag-btn-bg);
  box-shadow: var(--ag-composer-shadow);
  color: var(--ag-fg-1);
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-jump:hover {
  background: var(--ag-btn-hover);
}

.ag-jump:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: var(--radius);
}

.ag-jump svg {
  width: 16px;
  height: 16px;
}

.ag-jump-enter-active,
.ag-jump-leave-active {
  transition: opacity 0.15s ease, transform 0.2s var(--ag-ease);
}

.ag-jump-enter-from,
.ag-jump-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .ag-jump-enter-active,
  .ag-jump-leave-active {
    transition: none;
  }
}
</style>
