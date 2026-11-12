<template>
  <AgTooltip :text="busy ? (stopping ? 'Stopping' : 'Stop') : 'Send'" :shortcut="busy ? 'esc' : 'enter'" side="top">
    <button
      v-if="busy"
      type="button"
      class="ag-send is-stop"
      :aria-label="stopping ? 'Stopping the agent' : 'Stop the agent'"
      :disabled="stopping"
      @click="emit('stop')"
    >
      <span class="ag-send-square" aria-hidden="true"></span>
    </button>
    <button v-else type="submit" class="ag-send" aria-label="Send message" :disabled="disabled">
      <ArrowUp aria-hidden="true" />
    </button>
  </AgTooltip>
</template>

<script setup>
// The composer's round button: Send, or Stop while the agent is working.
import { ArrowUp } from '@lucide/vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'

defineProps({
  busy: { type: Boolean, default: false },
  stopping: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['stop'])
</script>

<style scoped>
.ag-send {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: var(--ag-send-bg);
  color: var(--ag-send-fg);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.ag-send:hover:not(:disabled) {
  opacity: 0.86;
}

.ag-send:disabled {
  background: var(--ag-send-disabled-bg);
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-send.is-stop:disabled {
  background: var(--ag-send-bg);
  color: var(--ag-send-fg);
  opacity: 0.6;
}

.ag-send svg {
  width: 16px;
  height: 16px;
}

.ag-send-square {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: currentColor;
}

.ag-send:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: var(--radius);
}
</style>
