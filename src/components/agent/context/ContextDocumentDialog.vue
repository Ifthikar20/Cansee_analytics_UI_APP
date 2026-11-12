<script setup>
// Add or edit a context document. Editing loads the document's text first;
// `save` is the page's request and the dialog shows its error inline.
import { computed, nextTick, ref, watch } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { CONTEXT_LIMITS } from '@/lib/agent/contextSections'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  // null adds a document; {id, title} edits it
  document: { type: Object, default: null },
  // (id) => Promise<{title, text}>
  load: { type: Function, default: null },
  // ({title, text}, document) => Promise
  save: { type: Function, required: true },
})

const count = new Intl.NumberFormat('en-US')

const title = ref('')
const text = ref('')
const state = ref('ready')
const busy = ref(false)
const error = ref('')
const titleEl = ref(null)
let opened = 0

const heading = computed(() => (props.document ? 'Edit document' : 'Add document'))

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return
    const mine = ++opened
    error.value = ''
    busy.value = false
    title.value = props.document?.title || ''
    text.value = ''
    if (props.document && props.load) {
      state.value = 'loading'
      try {
        const doc = await props.load(props.document.id)
        if (mine !== opened) return
        title.value = doc?.title ?? title.value
        text.value = doc?.text ?? ''
        state.value = 'ready'
      } catch (err) {
        if (mine !== opened) return
        state.value = 'error'
        error.value = err?.message || "Couldn't load the document."
      }
    } else {
      state.value = 'ready'
    }
    nextTick(() => titleEl.value?.focus())
  },
  { immediate: true },
)

async function submit() {
  if (busy.value || state.value !== 'ready') return
  const t = title.value.trim()
  const body = text.value.trim()
  if (!t || !body) {
    error.value = t ? 'Add the text the agents should read.' : 'Give the document a title.'
    return
  }
  error.value = ''
  busy.value = true
  try {
    await props.save({ title: t.slice(0, CONTEXT_LIMITS.documentTitle), text: body }, props.document)
    open.value = false
  } catch (err) {
    error.value = err?.message || "Couldn't save the document. Try again."
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AgDialog v-model:open="open" :title="heading" wide>
    <div v-if="state === 'loading'" class="ag-cdd-state" role="status">
      <AgSpinner :size="14" />
      <span>Loading the document</span>
    </div>
    <form v-else id="ag-cdd-form" class="ag-cdd" novalidate @submit.prevent="submit">
      <div class="ag-cdd-field">
        <label class="ag-cdd-label" for="ag-cdd-title">Title</label>
        <input
          id="ag-cdd-title"
          ref="titleEl"
          v-model="title"
          class="ag-cdd-input"
          type="text"
          :maxlength="CONTEXT_LIMITS.documentTitle"
          autocomplete="off"
          :disabled="state === 'error'"
        />
      </div>
      <div class="ag-cdd-field">
        <label class="ag-cdd-label" for="ag-cdd-text">Text</label>
        <textarea
          id="ag-cdd-text"
          v-model="text"
          class="ag-cdd-input ag-cdd-area"
          rows="10"
          :maxlength="CONTEXT_LIMITS.documentChars"
          aria-describedby="ag-cdd-count"
          :disabled="state === 'error'"
        />
        <p id="ag-cdd-count" class="ag-cdd-count ag-tnum">
          {{ count.format(text.length) }} of {{ count.format(CONTEXT_LIMITS.documentChars) }}
        </p>
      </div>
      <p v-if="error" class="ag-cdd-error" role="alert">{{ error }}</p>
    </form>

    <template #actions>
      <AgButton :disabled="busy" @click="open = false">Cancel</AgButton>
      <AgButton
        type="submit"
        form="ag-cdd-form"
        variant="primary"
        :loading="busy"
        :disabled="state !== 'ready'"
      >
        Save
      </AgButton>
    </template>
  </AgDialog>
</template>

<style scoped>
.ag-cdd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ag-cdd-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-cdd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ag-cdd-label {
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-cdd-input {
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

.ag-cdd-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-cdd-area {
  min-height: 200px;
  resize: vertical;
}

.ag-cdd-count {
  margin: 0;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
  text-align: right;
}

.ag-cdd-error {
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

@media (pointer: coarse) {
  .ag-cdd-input {
    font-size: 16px;
  }
}
</style>
