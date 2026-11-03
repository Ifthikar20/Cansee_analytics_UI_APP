<script setup>
// Centered modal dialog in the agent look, with a title, an optional
// description, a close button, a body slot and an `actions` slot.
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden,
} from 'reka-ui'

const open = defineModel('open', { type: Boolean, default: false })

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  // Hide the description visually but keep it for screen readers.
  hideDescription: { type: Boolean, default: false },
  wide: { type: Boolean, default: false },
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="ag-portal ag-overlay" />
      <DialogContent class="ag-portal ag-dialog" :class="{ 'is-wide': wide }">
        <div class="ag-dlg-head">
          <DialogTitle class="ag-dialog-title">{{ title }}</DialogTitle>
          <DialogClose class="ag-dlg-close" aria-label="Close">
            <X :size="16" aria-hidden="true" />
          </DialogClose>
        </div>
        <VisuallyHidden v-if="hideDescription || !description">
          <DialogDescription>{{ description || title }}</DialogDescription>
        </VisuallyHidden>
        <DialogDescription v-else class="ag-dialog-desc">{{ description }}</DialogDescription>
        <div class="ag-dlg-body">
          <slot />
        </div>
        <div v-if="$slots.actions" class="ag-dialog-actions">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ag-dlg-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ag-dlg-close {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: -2px -6px 0 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-3);
  cursor: pointer;
}

.ag-dlg-close:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-dlg-close:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-dlg-body {
  margin-top: 16px;
}

.ag-dlg-body:empty {
  display: none;
}
</style>
