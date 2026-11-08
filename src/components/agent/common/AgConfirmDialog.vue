<script setup>
// Confirmation for destructive or irreversible actions (alertdialog role).
// The parent owns the work: it listens to `confirm`, sets `busy` while the
// request runs, and closes the dialog (or sets `error`) when it settles.
import { computed } from 'vue'
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { holdHints } from '@/stores/hints'

const open = defineModel('open', { type: Boolean, default: false })

// No first-visit hint while this is open.
holdHints(() => open.value)

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  busyLabel: { type: String, default: '' },
  cancelLabel: { type: String, default: 'Cancel' },
  destructive: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel'])

const confirmText = computed(() => (props.busy && props.busyLabel ? props.busyLabel : props.confirmLabel))

function onOpenChange(value) {
  // Keep the dialog up while the action is in flight.
  if (!value && props.busy) return
  open.value = value
  if (!value) emit('cancel')
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="ag-portal ag-overlay" />
      <AlertDialogContent class="ag-portal ag-dialog" @escape-key-down="busy && $event.preventDefault()">
        <AlertDialogTitle class="ag-dialog-title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="ag-dialog-desc">{{ description }}</AlertDialogDescription>
        <slot />
        <p v-if="error" class="ag-confirm-error" role="alert">{{ error }}</p>
        <div class="ag-dialog-actions">
          <AlertDialogCancel class="ag-btn" :disabled="busy">{{ cancelLabel }}</AlertDialogCancel>
          <button
            type="button"
            class="ag-btn"
            :class="destructive ? 'is-danger' : 'is-primary'"
            :disabled="busy"
            :aria-busy="busy ? 'true' : undefined"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
.ag-confirm-error {
  margin: 12px 0 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}
</style>
