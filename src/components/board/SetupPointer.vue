<script setup>
// One line under an empty card's state: while the board's Setup panel
// shows (first landing, missing setup, research still running), an empty
// card says why it may be empty and takes the user to the panel instead of
// staying silent. Nothing renders outside a board page, inside the side
// panel (the board under it is out of reach) or while the panel is hidden.
import { computed, unref } from 'vue'
import { useInPanel, useSetupPointer } from '@/lib/board/context'

const pointer = useSetupPointer()
const inPanel = useInPanel()

const text = computed(() => (pointer && !inPanel ? unref(pointer.text) || '' : ''))

function show() {
  pointer?.show?.()
}
</script>

<template>
  <p v-if="text" class="bd-setup-pointer">
    <span>{{ text }}</span>
    <button type="button" class="bd-setup-pointer-link" @click="show">Show setup</button>
  </p>
</template>

<style scoped>
.bd-setup-pointer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  max-width: 60ch;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.bd-setup-pointer-link {
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.bd-setup-pointer-link:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
