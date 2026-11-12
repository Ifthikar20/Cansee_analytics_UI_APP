<script setup>
// New finding / Edit finding. The parent owns the request: it listens to
// `save`, sets `busy` while it runs and closes the dialog (or sets `error`)
// when it settles. Editing can change the title, the details and the
// severity; the category and the prompt are fixed once a finding exists
// (the API takes no other fields), so they show but cannot be changed.
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import { FINDING_CATEGORY_LIST, FINDING_SEVERITY_LIST, SWARM_CATEGORY_LABELS } from '@/lib/agent/types'

// Same caps as the backend's finding fields (swarm_contract.md 2c, 8).
const LIMITS = { title: 200, detail: 2000, prompt: 300 }
const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const DEFAULT_CATEGORY = 'other'
const DEFAULT_SEVERITY = 'medium'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  // null creates a finding; a finding edits it.
  finding: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['save'])

const form = ref(blank())
const titleError = ref('')
const titleEl = ref(null)

const editing = computed(() => Boolean(props.finding))
const heading = computed(() => (editing.value ? 'Edit finding' : 'New finding'))

const categories = computed(() => {
  const list = [...FINDING_CATEGORY_LIST]
  const current = form.value.category
  // A category outside the list (newer server) still shows on edit.
  if (current && !list.includes(current)) list.push(current)
  return list.map((key) => ({
    key,
    label: SWARM_CATEGORY_LABELS[key] || (key === current && props.finding?.category_label) || key,
  }))
})

function blank() {
  return { title: '', detail: '', category: DEFAULT_CATEGORY, severity: DEFAULT_SEVERITY, prompt_text: '' }
}

function fromFinding(f) {
  return {
    title: String(f.title || ''),
    detail: String(f.detail || ''),
    category: String(f.category || DEFAULT_CATEGORY),
    severity: FINDING_SEVERITY_LIST.includes(f.severity) ? f.severity : DEFAULT_SEVERITY,
    prompt_text: String(f.prompt_text || ''),
  }
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    form.value = props.finding ? fromFinding(props.finding) : blank()
    titleError.value = ''
  },
  { immediate: true },
)

function submit() {
  if (props.busy) return
  const title = form.value.title.trim()
  if (!title) {
    titleError.value = 'Give the finding a title.'
    nextTick(() => titleEl.value?.focus())
    return
  }
  titleError.value = ''
  const fields = {
    title: title.slice(0, LIMITS.title),
    detail: form.value.detail.trim().slice(0, LIMITS.detail),
    severity: form.value.severity,
  }
  if (!editing.value) {
    fields.category = form.value.category
    fields.prompt_text = form.value.prompt_text.trim().slice(0, LIMITS.prompt)
  }
  emit('save', fields)
}
</script>

<template>
  <AgDialog v-model:open="open" :title="heading" wide>
    <form id="ag-fd-form" class="ag-fd" novalidate @submit.prevent="submit">
      <div class="ag-fd-field">
        <label class="ag-fd-label" for="ag-fd-title">Title</label>
        <input
          id="ag-fd-title"
          ref="titleEl"
          v-model="form.title"
          class="ag-fd-input"
          type="text"
          :maxlength="LIMITS.title"
          required
          autocomplete="off"
          :aria-invalid="titleError ? 'true' : undefined"
          :aria-describedby="titleError ? 'ag-fd-title-err' : undefined"
        />
        <p v-if="titleError" id="ag-fd-title-err" class="ag-fd-error">{{ titleError }}</p>
      </div>

      <div class="ag-fd-field">
        <label class="ag-fd-label" for="ag-fd-detail">Details</label>
        <textarea
          id="ag-fd-detail"
          v-model="form.detail"
          class="ag-fd-input ag-fd-area"
          rows="4"
          :maxlength="LIMITS.detail"
          aria-describedby="ag-fd-detail-count"
        />
        <p id="ag-fd-detail-count" class="ag-fd-count ag-tnum">{{ form.detail.length }}/{{ LIMITS.detail }}</p>
      </div>

      <div class="ag-fd-pair">
        <div class="ag-fd-field">
          <label class="ag-fd-label" for="ag-fd-category">Category</label>
          <span class="ag-fd-select">
            <select id="ag-fd-category" v-model="form.category" class="ag-fd-input" :disabled="editing">
              <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
            <ChevronDown class="ag-fd-select-icon" :size="14" aria-hidden="true" />
          </span>
        </div>
        <div class="ag-fd-field">
          <label class="ag-fd-label" for="ag-fd-severity">Severity</label>
          <span class="ag-fd-select">
            <select id="ag-fd-severity" v-model="form.severity" class="ag-fd-input">
              <option v-for="s in FINDING_SEVERITY_LIST" :key="s" :value="s">{{ SEVERITY_LABELS[s] }}</option>
            </select>
            <ChevronDown class="ag-fd-select-icon" :size="14" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div class="ag-fd-field">
        <label class="ag-fd-label" for="ag-fd-prompt">Prompt <span class="ag-fd-optional">(optional)</span></label>
        <input
          id="ag-fd-prompt"
          v-model="form.prompt_text"
          class="ag-fd-input"
          type="text"
          :maxlength="LIMITS.prompt"
          autocomplete="off"
          :disabled="editing"
        />
      </div>

      <p v-if="error" class="ag-fd-error" role="alert">{{ error }}</p>
    </form>

    <template #actions>
      <AgButton :disabled="busy" @click="open = false">Cancel</AgButton>
      <AgButton type="submit" form="ag-fd-form" variant="primary" :loading="busy">
        {{ busy ? 'Saving' : 'Save' }}
      </AgButton>
    </template>
  </AgDialog>
</template>

<style scoped>
.ag-fd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ag-fd-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.ag-fd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ag-fd-label {
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-fd-optional {
  color: var(--ag-fg-4);
  font-weight: 400;
}

.ag-fd-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid var(--ag-composer-border);
  border-radius: var(--radius);
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
  transition: border-color 120ms ease;
}

.ag-fd-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-fd-input:disabled {
  color: var(--ag-fg-3);
  cursor: default;
}

.ag-fd-input[aria-invalid='true'] {
  border-color: var(--ag-danger);
}

.ag-fd-area {
  min-height: 96px;
  resize: vertical;
}

.ag-fd-select {
  position: relative;
  display: block;
}

.ag-fd-select select {
  padding-right: 32px;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.ag-fd-select-icon {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-fd-count {
  margin: 0;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
  text-align: right;
}

.ag-fd-error {
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

@media (max-width: 480px) {
  .ag-fd-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (pointer: coarse) {
  .ag-fd-input {
    font-size: 16px;
  }
}
</style>
