<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div
          ref="cardRef"
          class="modal-card"
          :class="{ 'modal-wide': wide }"
          :style="{ maxWidth: wide ? '760px' : maxWidth }"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="title || $slots.header ? titleId : undefined"
          :aria-label="!title && !$slots.header ? ariaLabel || undefined : undefined"
          :aria-describedby="subtitle && !$slots.header ? subtitleId : undefined"
        >
          <button type="button" class="modal-close" @click="close" aria-label="Close">&times;</button>

          <div v-if="title || $slots.header" :id="$slots.header ? titleId : undefined" class="bm-header">
            <slot name="header">
              <h3 :id="titleId" class="bm-title">{{ title }}</h3>
              <p v-if="subtitle" :id="subtitleId" class="bm-subtitle">{{ subtitle }}</p>
            </slot>
          </div>

          <div class="bm-body" data-dialog-body>
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
import { ref, useId } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  // Accessible name when the dialog shows neither a title nor a header.
  ariaLabel: { type: String, default: '' },
  maxWidth: { type: String, default: '520px' },
  wide: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'close'])

const cardRef = ref(null)
const titleId = useId()
const subtitleId = useId()

function close() {
  emit('update:modelValue', false)
  emit('close')
}

// Focus moves into the dialog, Tab stays inside it, closing gives focus back
// to what opened it, and Escape closes the dialog opened last (only while it
// is open).
useDialogFocus(cardRef, () => props.modelValue, { onEscape: close })

defineExpose({ close })
</script>

<style scoped>
/* Surface styles inherited from global .modal-overlay / .modal-card in
   components.css. This component only adds header/body/footer layout
   and the open/close transition. */
/* The card takes focus itself when it has no field to focus first; the
   dialog's name is announced, an outline around the whole card adds nothing. */
.modal-card:focus { outline: none; }
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
