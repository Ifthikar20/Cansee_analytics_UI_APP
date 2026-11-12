<script setup>
// Adds or edits one context entry in place of its card: section, title,
// text and sources. Sources added or removed here are sent with Save, so
// Cancel leaves the entry as it was. `save` is the page's request; a stale
// revision comes back as `conflict`, and the form then offers a reload
// instead of overwriting someone else's version.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ChevronDown, Plus, RotateCcw } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { CONTEXT_LIMITS, CONTEXT_SECTIONS } from '@/lib/agent/contextSections'
import ReferenceChip from './ReferenceChip.vue'
import ReferencePicker from './ReferencePicker.vue'

const props = defineProps({
  // null adds an entry to `section`
  entry: { type: Object, default: null },
  section: { type: String, default: 'company' },
  sections: { type: Array, default: () => CONTEXT_SECTIONS },
  websiteId: { type: String, default: null },
  domain: { type: String, default: '' },
  documents: { type: Array, default: () => [] },
  competitors: { type: Array, default: () => [] },
  conflict: { type: Boolean, default: false },
  // (entry, {section, title, body}, {add, remove}) => Promise
  save: { type: Function, required: true },
})

const emit = defineEmits(['done', 'cancel', 'reload', 'dirty'])

const count = new Intl.NumberFormat('en-US')

// The entry as the form opened it: its revision guards the save.
const base = props.entry ? { ...props.entry, references: [...(props.entry.references || [])] } : null
const uid = base ? base.id : `new-${Math.random().toString(36).slice(2, 8)}`

const form = ref({
  section: base?.section || props.section,
  title: base?.title || '',
  body: base?.body || '',
})
const kept = ref(base ? base.references.filter(Boolean) : [])
const removed = ref([])
const added = ref([])
const busy = ref(false)
const error = ref('')
const pickerOpen = ref(false)
const titleEl = ref(null)

const sourceCount = computed(() => kept.value.length + added.value.length)
const sourcesFull = computed(() => sourceCount.value >= CONTEXT_LIMITS.references)

const dirty = computed(() => {
  const f = form.value
  if (removed.value.length || added.value.length) return true
  return (
    f.section !== (base?.section || props.section) ||
    f.title !== (base?.title || '') ||
    f.body !== (base?.body || '')
  )
})

watch(dirty, (value) => emit('dirty', value), { immediate: true })

onMounted(() => nextTick(() => titleEl.value?.focus()))

function removeKept(index) {
  const [ref_] = kept.value.splice(index, 1)
  if (ref_) removed.value.push(ref_)
}

function removeAdded(index) {
  added.value.splice(index, 1)
}

function onAdd({ input, reference }) {
  if (sourcesFull.value) return
  added.value.push({ input, reference: { ...reference, id: `pending-${added.value.length}-${Date.now()}` } })
  pickerOpen.value = false
}

async function submit() {
  if (busy.value || props.conflict) return
  const title = form.value.title.trim()
  const body = form.value.body.trim()
  if (!title && !body) {
    error.value = 'Write a title or a text.'
    nextTick(() => titleEl.value?.focus())
    return
  }
  error.value = ''
  busy.value = true
  try {
    await props.save(
      base,
      { section: form.value.section, title, body },
      { add: added.value.map((a) => a.input), remove: removed.value },
    )
    emit('dirty', false)
    emit('done')
  } catch (err) {
    if (!props.conflict && !(err?.code === 'revision_conflict' || err?.status === 409)) {
      error.value = err?.message || "Couldn't save the entry. Try again."
    }
  } finally {
    busy.value = false
  }
}

function onKeydown(event) {
  const mod = event.metaKey || event.ctrlKey
  if (mod && !event.altKey && !event.shiftKey && String(event.key).toLowerCase() === 's') {
    event.preventDefault()
    submit()
  }
}

function cancel() {
  emit('dirty', false)
  emit('cancel')
}
</script>

<template>
  <form class="ag-cef" novalidate @submit.prevent="submit" @keydown="onKeydown">
    <div v-if="conflict" class="ag-cef-banner" role="alert">
      <span>Someone else changed this entry. Reload to see their version.</span>
      <AgButton size="xs" :icon="RotateCcw" @click="emit('reload')">Reload</AgButton>
    </div>

    <div class="ag-cef-row">
      <div class="ag-cef-field is-section">
        <label class="ag-cef-label" :for="`${uid}-section`">Section</label>
        <span class="ag-cef-select">
          <select :id="`${uid}-section`" v-model="form.section" class="ag-cef-input">
            <option v-for="s in sections" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
          <ChevronDown class="ag-cef-select-icon" :size="14" aria-hidden="true" />
        </span>
      </div>
      <div class="ag-cef-field is-title">
        <label class="ag-cef-label" :for="`${uid}-title`">Title</label>
        <input
          :id="`${uid}-title`"
          ref="titleEl"
          v-model="form.title"
          class="ag-cef-input"
          type="text"
          :maxlength="CONTEXT_LIMITS.title"
          autocomplete="off"
          :aria-invalid="error && !form.title.trim() && !form.body.trim() ? 'true' : undefined"
        />
      </div>
    </div>

    <div class="ag-cef-field">
      <label class="ag-cef-label" :for="`${uid}-body`">Text</label>
      <textarea
        :id="`${uid}-body`"
        v-model="form.body"
        class="ag-cef-input ag-cef-area"
        rows="4"
        :maxlength="CONTEXT_LIMITS.body"
        :aria-describedby="`${uid}-count`"
      />
      <p :id="`${uid}-count`" class="ag-cef-count ag-tnum">
        {{ count.format(form.body.length) }} of {{ count.format(CONTEXT_LIMITS.body) }}
      </p>
    </div>

    <div class="ag-cef-field">
      <p class="ag-cef-label">Sources</p>
      <ul v-if="sourceCount" class="ag-cef-sources" role="list">
        <li v-for="(r, i) in kept" :key="r.id || `k${i}`">
          <ReferenceChip :reference="r" removable @remove="removeKept(i)" />
        </li>
        <li v-for="(a, i) in added" :key="a.reference.id">
          <ReferenceChip :reference="a.reference" removable @remove="removeAdded(i)" />
        </li>
      </ul>
      <AgTooltip v-if="sourcesFull" :text="`An entry has at most ${CONTEXT_LIMITS.references} sources.`">
        <button type="button" class="ag-cef-add-off" aria-disabled="true">
          <Plus :size="14" aria-hidden="true" />
          Add source
        </button>
      </AgTooltip>
      <AgButton v-else class="ag-cef-add" variant="ghost" size="xs" :icon="Plus" @click="pickerOpen = true">
        Add source
      </AgButton>
    </div>

    <p v-if="error" class="ag-cef-error" role="alert">{{ error }}</p>

    <div class="ag-cef-actions">
      <AgButton size="sm" :disabled="busy" @click="cancel">Cancel</AgButton>
      <AgButton type="submit" size="sm" variant="primary" :loading="busy" :disabled="conflict">Save</AgButton>
    </div>

    <ReferencePicker
      v-model:open="pickerOpen"
      :website-id="websiteId"
      :domain="domain"
      :documents="documents"
      :competitors="competitors"
      @add="onAdd"
    />
  </form>
</template>

<style scoped>
.ag-cef {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--ag-ring);
  border-radius: var(--radius);
  background: var(--ag-pane-bg);
}

.ag-cef-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--ag-warning) 40%, transparent);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--ag-warning) 8%, transparent);
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 19px;
}

.ag-cef-row {
  display: grid;
  grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
  gap: 12px;
}

.ag-cef-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ag-cef-label {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-cef-input {
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
}

.ag-cef-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-cef-input[aria-invalid='true'] {
  border-color: var(--ag-danger);
}

.ag-cef-area {
  min-height: 96px;
  resize: vertical;
}

.ag-cef-select {
  position: relative;
  display: block;
}

.ag-cef-select select {
  padding-right: 32px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.ag-cef-select-icon {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-cef-count {
  margin: 0;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
  text-align: right;
}

.ag-cef-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-cef-field :deep(.ag-cef-add) {
  align-self: flex-start;
  margin-left: -8px;
}

.ag-cef-add-off {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 6px;
  height: 26px;
  margin-left: -8px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-disabled);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: default;
}

.ag-cef-add-off:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-cef-error {
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

.ag-cef-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 560px) {
  .ag-cef-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (pointer: coarse) {
  .ag-cef-input {
    font-size: 16px;
  }
}
</style>
