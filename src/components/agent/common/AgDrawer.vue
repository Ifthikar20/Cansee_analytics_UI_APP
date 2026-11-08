<script setup>
// Modal side drawer (the sidebar below 1024px). Focus is trapped while open
// and returns to the opener on close; Escape and the scrim close it.
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, VisuallyHidden } from 'reka-ui'
import { holdHints } from '@/stores/hints'

const open = defineModel('open', { type: Boolean, default: false })

// No first-visit hint while this is open.
holdHints(() => open.value)

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="ag-portal ag-overlay" />
      <DialogContent class="ag-portal ag-drawer">
        <VisuallyHidden>
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription>{{ description || title }}</DialogDescription>
        </VisuallyHidden>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
