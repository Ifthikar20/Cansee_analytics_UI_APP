<script setup>
// Ask a teammate to review the latest version: the reviewer (anyone on the
// project's team who can edit it, except you) and an optional note.
import { computed, ref, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import { NO_TEAMMATE_LINE, roleLabel } from '@/lib/agent/review'

const NOTE_MAX = 4000

const props = defineProps({
  // [{id, name, email, role, is_you}]
  team: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['send', 'cancel'])

const others = computed(() => props.team.filter((m) => m && m.id && !m.is_you))
const reviewer = ref('')
const note = ref('')

watch(
  others,
  (list) => {
    if (!list.some((m) => String(m.id) === reviewer.value)) reviewer.value = list[0] ? String(list[0].id) : ''
  },
  { immediate: true },
)

function send() {
  if (!reviewer.value || props.busy) return
  const person = others.value.find((m) => String(m.id) === reviewer.value)
  emit('send', { reviewer_id: reviewer.value, reviewer_name: person?.name || '', note: note.value.trim() })
}
</script>

<template>
  <div class="ag-rsel">
    <p v-if="!loading && !others.length" class="ag-rsel-none">{{ NO_TEAMMATE_LINE }}</p>
    <form v-else class="ag-rsel-form" novalidate @submit.prevent="send">
      <div class="ag-rsel-field">
        <label class="ag-rsel-label" for="ag-rsel-reviewer">Reviewer</label>
        <span class="ag-rsel-select">
          <select id="ag-rsel-reviewer" v-model="reviewer" class="ag-rsel-input" :disabled="loading">
            <option v-for="m in others" :key="m.id" :value="String(m.id)">
              {{ m.name }}{{ roleLabel(m.role) ? ` · ${roleLabel(m.role)}` : '' }}
            </option>
          </select>
          <ChevronDown class="ag-rsel-icon" :size="14" aria-hidden="true" />
        </span>
      </div>
      <div class="ag-rsel-field">
        <label class="ag-rsel-label" for="ag-rsel-note">Note (optional)</label>
        <textarea id="ag-rsel-note" v-model="note" class="ag-rsel-input ag-rsel-area" rows="2" :maxlength="NOTE_MAX" />
      </div>
      <div class="ag-rsel-actions">
        <AgButton size="xs" variant="ghost" :disabled="busy" @click="emit('cancel')">Cancel</AgButton>
        <AgButton type="submit" size="xs" variant="primary" :loading="busy" :disabled="!reviewer">Send request</AgButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.ag-rsel-none {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-rsel-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ag-rsel-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ag-rsel-label {
  color: var(--ag-fg-1);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
}

.ag-rsel-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--ag-composer-border);
  border-radius: var(--radius);
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13.5px;
  line-height: 20px;
  outline: none;
}

.ag-rsel-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-rsel-area {
  min-height: 56px;
  resize: vertical;
}

.ag-rsel-select {
  position: relative;
  display: block;
}

.ag-rsel-select select {
  padding-right: 30px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.ag-rsel-icon {
  position: absolute;
  top: 50%;
  right: 10px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-rsel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

@media (pointer: coarse) {
  .ag-rsel-input {
    font-size: 16px;
  }
}
</style>
