<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogContent class="ag-portal ag-pane-dialog" @close-auto-focus="onCloseAutoFocus">
        <VisuallyHidden>
          <DialogTitle>Browser</DialogTitle>
          <DialogDescription>Google results, inspected pages and drafts from this chat.</DialogDescription>
        </VisuallyHidden>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import { DialogContent, DialogDescription, DialogPortal, DialogRoot, DialogTitle, VisuallyHidden } from 'reka-ui'
import { useAgentPaneStore } from '@/stores/agentPane'

// The browser pane as a full-screen dialog on phones (767px and below).

defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open'])

const pane = useAgentPaneStore()

function onCloseAutoFocus(event) {
  const el = pane.returnFocusEl
  if (el && el.isConnected && typeof el.focus === 'function') {
    event.preventDefault()
    el.focus()
  }
}
</script>

<style scoped>
.ag-pane-dialog {
  position: fixed;
  inset: 0;
  z-index: 91;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--ag-pane-bg);
  outline: none;
}

.ag-pane-dialog[data-state='open'] {
  animation: ag-pane-up 220ms var(--ag-ease);
}

@keyframes ag-pane-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-pane-dialog[data-state='open'] {
    animation: none;
  }
}
</style>
