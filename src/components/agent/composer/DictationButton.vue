<template>
  <span v-if="dictation.supported" class="ag-mic" :class="{ 'is-listening': listening }">
    <AgIconButton
      :label="listening ? 'Stop dictation' : 'Dictate'"
      :pressed="listening"
      tooltip-side="top"
      :size="30"
      :icon-size="16"
      shape="circle"
      :disabled="disabled"
      @click="dictation.toggle()"
    >
      <Mic aria-hidden="true" />
    </AgIconButton>
  </span>
</template>

<script setup>
// Dictation into the composer (Web Speech API). Hidden where unsupported.
import { onBeforeUnmount, watch } from 'vue'
import { Mic } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import { useDictation } from '@/composables/agent/useDictation'
import { useAgentUiStore } from '@/stores/agentUi'

const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['text', 'interim'])

const ui = useAgentUiStore()
const dictation = useDictation({ onText: (text) => emit('text', text) })
const listening = dictation.listening

watch(dictation.interim, (text) => emit('interim', text))
watch(listening, (on) => ui.announce(on ? 'Dictation on' : 'Dictation off'))
watch(dictation.error, (message) => {
  if (message) ui.announce(message, 'assertive')
})
watch(
  () => props.disabled,
  (off) => {
    if (off) dictation.stop()
  }
)

onBeforeUnmount(() => dictation.stop())
</script>

<style scoped>
.ag-mic {
  display: inline-flex;
  border-radius: var(--radius);
}

.ag-mic.is-listening :deep(.ag-icon-btn) {
  background: var(--ag-you-bg);
  color: var(--ag-accent);
  animation: ag-mic-pulse 1.6s ease-out infinite;
}

@keyframes ag-mic-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--ag-accent) 35%, transparent);
  }
  100% {
    box-shadow: 0 0 0 8px transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-mic.is-listening :deep(.ag-icon-btn) {
    animation: none;
  }
}
</style>
