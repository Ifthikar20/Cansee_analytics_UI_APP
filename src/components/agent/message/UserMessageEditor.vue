<template>
  <form class="ag-edit" aria-label="Edit message" @submit.prevent="save">
    <label class="ag-sr-only" :for="fieldId">Edit your message</label>
    <textarea
      :id="fieldId"
      ref="field"
      v-model="draft"
      class="ag-edit-field"
      rows="1"
      @input="grow"
      @keydown="onKeydown"
      @compositionstart="ime.onCompositionstart"
      @compositionend="ime.onCompositionend"
    ></textarea>
    <div class="ag-edit-actions">
      <span class="ag-edit-hint">A new version of the reply is written; the current one stays available.</span>
      <AgButton size="xs" variant="ghost" @click="emit('cancel')">Cancel</AgButton>
      <AgButton size="xs" variant="primary" type="submit" :disabled="!canSave" :loading="saving">Send</AgButton>
    </div>
  </form>
</template>

<script setup>
// Edits the latest user message. Saving creates a sibling message and a new
// reply (the "‹ 1/2 ›" switcher keeps the old branch).
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import { useImeSafeEnter } from '@/composables/agent/useImeSafeEnter'

const props = defineProps({
  text: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'cancel'])

const fieldId = `ag-edit-${useId()}`
const field = ref(null)
const draft = ref(props.text)

const canSave = computed(() => draft.value.trim().length > 0 && draft.value.trim() !== props.text.trim() && !props.saving)

const ime = useImeSafeEnter({ onSubmit: () => save() })

function save() {
  if (!canSave.value) return
  emit('save', draft.value.trim())
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
    return
  }
  ime.onKeydown(event)
}

function grow() {
  const el = field.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 320)}px`
}

onMounted(async () => {
  await nextTick()
  grow()
  const el = field.value
  if (!el) return
  el.focus({ preventScroll: true })
  el.setSelectionRange(el.value.length, el.value.length)
})
</script>

<style scoped>
.ag-edit {
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 12px;
  background: var(--ag-composer-bg);
}

.ag-edit-field {
  width: 100%;
  min-height: 24px;
  max-height: 320px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 15px;
  line-height: 24px;
  resize: none;
  outline: none;
}

.ag-edit-field:focus-visible {
  outline: none;
}

.ag-edit:focus-within {
  border-color: var(--ag-ring);
}

.ag-edit-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ag-edit-hint {
  flex: 1 1 200px;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
}

@media (pointer: coarse) {
  .ag-edit-field {
    font-size: 16px;
  }
}
</style>
