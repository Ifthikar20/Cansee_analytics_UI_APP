<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-card" :class="{ 'modal-wide': wide }" :style="{ maxWidth: wide ? '760px' : maxWidth }" role="dialog" aria-modal="true">
          <button class="modal-close" @click="close" aria-label="Close">&times;</button>

          <div v-if="title || $slots.header" class="bm-header">
            <slot name="header">
              <h3 class="bm-title">{{ title }}</h3>
              <p v-if="subtitle" class="bm-subtitle">{{ subtitle }}</p>
            </slot>
          </div>

          <div class="bm-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="bm-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { holdHints } from '@/stores/hints'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  maxWidth: { type: String, default: '520px' },
  wide: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'close'])

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onEscape(e) {
  if (e.key === 'Escape' && props.modelValue) close()
}
onMounted(() => window.addEventListener('keydown', onEscape))
onUnmounted(() => window.removeEventListener('keydown', onEscape))

// No first-visit hint while the modal is open.
holdHints(() => props.modelValue)

defineExpose({ close })
</script>

<style scoped>
/* Surface styles inherited from global .modal-overlay / .modal-card in
   components.css. This component only adds header/body/footer layout
   and the open/close transition. */
.bm-header {
  margin-bottom: 16px;
  padding-right: 28px;
}
.bm-title {
  margin: 0;
  font-size: var(--font-lg, 18px);
  font-weight: 600;
  color: var(--text-primary);
}
.bm-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.bm-body { flex: 1; min-height: 0; }
.modal-wide .bm-body { padding: 0; }
.modal-wide .bm-header { display: none; }
.bm-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.modal-enter-active { transition: opacity 0.15s ease; }
.modal-leave-active { transition: opacity 0.12s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal-card { animation: slideUp 0.2s ease; }
</style>
