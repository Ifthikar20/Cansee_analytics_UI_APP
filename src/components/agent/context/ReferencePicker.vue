<script setup>
// "Add a source" for a context entry: a page of the project's site (with
// the words from it, optional), a current brand fact, a document or a
// tracked competitor. Emits `add` with the RefInput the API takes and a
// display copy for the form; the parent sends it.
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import agentApi from '@/api/agent'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { asList } from '@/components/agent/common/agentText'
import { CONTEXT_LIMITS, normalizeUrl, onSite, pathOf } from '@/lib/agent/contextSections'

const FACT_LABEL_MAX = 160
const FACT_SEARCH_DELAY_MS = 250

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  websiteId: { type: String, default: null },
  // The project's domain ("notion.so"): pages must be on it.
  domain: { type: String, default: '' },
  // [{id, title}]
  documents: { type: Array, default: () => [] },
  // [{name, domain}]
  competitors: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['add'])

const KINDS = [
  { value: 'page', label: 'Page of your site' },
  { value: 'fact', label: 'Brand fact' },
  { value: 'document', label: 'Document' },
  { value: 'competitor', label: 'Competitor' },
]

const kind = ref('page')
const url = ref('')
const quote = ref('')
const documentId = ref('')
const competitorDomain = ref('')
const fieldError = ref('')

// Brand fact combobox
const factQuery = ref('')
const facts = ref([])
const factsState = ref('idle')
const factId = ref('')
const factLabel = ref('')
const activeIndex = ref(-1)
const listOpen = ref(false)
let factTimer = null
let factRequest = 0

const urlEl = ref(null)

function reset() {
  kind.value = 'page'
  url.value = ''
  quote.value = ''
  documentId.value = props.documents[0]?.id ? String(props.documents[0].id) : ''
  competitorDomain.value = props.competitors[0]?.domain || ''
  fieldError.value = ''
  factQuery.value = ''
  facts.value = []
  factsState.value = 'idle'
  factId.value = ''
  factLabel.value = ''
  activeIndex.value = -1
  listOpen.value = false
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      clearTimeout(factTimer)
      return
    }
    reset()
    nextTick(() => urlEl.value?.focus())
  },
  { immediate: true },
)

watch(kind, (value) => {
  fieldError.value = ''
  if (value === 'fact' && factsState.value === 'idle') loadFacts()
})

function factText(f) {
  const text = [f.subject, f.predicate, f.object].map((p) => String(p || '').trim()).filter(Boolean).join(' ')
  return text.length > FACT_LABEL_MAX ? `${text.slice(0, FACT_LABEL_MAX - 1).trimEnd()}…` : text
}

// Approved facts first, then the ones the extractor accepted on its own.
async function loadFacts() {
  if (!props.websiteId) return
  const mine = ++factRequest
  const q = factQuery.value.trim()
  factsState.value = 'loading'
  try {
    const [approved, auto] = await Promise.all([
      agentApi.brandFacts(props.websiteId, { status: 'approved', q }),
      agentApi.brandFacts(props.websiteId, { status: 'auto', q }),
    ])
    if (mine !== factRequest) return
    facts.value = [...asList(approved?.data), ...asList(auto?.data)]
      .filter((f) => f && f.id !== undefined && f.id !== null)
      .map((f) => ({ id: String(f.id), label: factText(f) }))
    factsState.value = 'ready'
    activeIndex.value = facts.value.length ? 0 : -1
  } catch {
    if (mine !== factRequest) return
    factsState.value = 'error'
  }
}

function onFactInput() {
  factId.value = ''
  factLabel.value = ''
  listOpen.value = true
  clearTimeout(factTimer)
  factTimer = setTimeout(loadFacts, FACT_SEARCH_DELAY_MS)
}

function pickFact(fact) {
  factId.value = fact.id
  factLabel.value = fact.label
  factQuery.value = fact.label
  listOpen.value = false
  fieldError.value = ''
}

function onFactKeydown(event) {
  const n = facts.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    listOpen.value = true
    if (n) activeIndex.value = (activeIndex.value + 1) % n
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    listOpen.value = true
    if (n) activeIndex.value = (activeIndex.value - 1 + n) % n
  } else if (event.key === 'Enter') {
    if (listOpen.value && facts.value[activeIndex.value]) {
      event.preventDefault()
      pickFact(facts.value[activeIndex.value])
    }
  } else if (event.key === 'Escape' && listOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    listOpen.value = false
  }
}

const activeOptionId = computed(() =>
  listOpen.value && facts.value[activeIndex.value] ? `ag-rp-fact-${facts.value[activeIndex.value].id}` : undefined,
)

const documentOptions = computed(() =>
  props.documents.filter((d) => d && d.id).map((d) => ({ value: String(d.id), label: d.title || 'Untitled document' })),
)
const competitorOptions = computed(() =>
  props.competitors.filter((c) => c && c.domain).map((c) => ({ value: c.domain, label: c.name || c.domain })),
)

function submit() {
  if (props.busy) return
  fieldError.value = ''
  const words = quote.value.trim().slice(0, CONTEXT_LIMITS.quote)
  if (kind.value === 'page') {
    const value = normalizeUrl(url.value)
    if (!value || (props.domain && !onSite(value, props.domain))) {
      fieldError.value = props.domain ? `Use pages of ${props.domain} only.` : 'Use a full web address, like https://…'
      nextTick(() => urlEl.value?.focus())
      return
    }
    emit('add', {
      input: { kind: 'page', url: value, ...(words ? { quote: words } : {}) },
      reference: { kind: 'page', label: pathOf(value), url: value, quote: words, state: 'unchecked' },
    })
    return
  }
  if (kind.value === 'fact') {
    if (!factId.value) {
      fieldError.value = 'Choose a brand fact.'
      return
    }
    emit('add', {
      input: { kind: 'fact', fact_id: factId.value },
      reference: { kind: 'fact', label: factLabel.value, fact_id: factId.value, state: 'ok' },
    })
    return
  }
  if (kind.value === 'document') {
    const doc = documentOptions.value.find((d) => d.value === documentId.value)
    if (!doc) {
      fieldError.value = 'Choose a document.'
      return
    }
    emit('add', {
      input: { kind: 'document', document_id: doc.value, ...(words ? { quote: words } : {}) },
      reference: { kind: 'document', label: doc.label, document_id: doc.value, quote: words, state: 'ok' },
    })
    return
  }
  const competitor = competitorOptions.value.find((c) => c.value === competitorDomain.value)
  if (!competitor) {
    fieldError.value = 'Choose a competitor.'
    return
  }
  emit('add', {
    input: { kind: 'competitor', competitor_domain: competitor.value },
    reference: { kind: 'competitor', label: competitor.label, competitor_domain: competitor.value, state: 'ok' },
  })
}
</script>

<template>
  <AgDialog v-model:open="open" title="Add a source" wide>
    <form id="ag-rp-form" class="ag-rp" novalidate @submit.prevent="submit">
      <fieldset class="ag-rp-kinds">
        <legend class="ag-rp-label">Source</legend>
        <label v-for="k in KINDS" :key="k.value" class="ag-rp-kind">
          <input v-model="kind" type="radio" name="ag-rp-kind" :value="k.value" />
          <span>{{ k.label }}</span>
        </label>
      </fieldset>

      <template v-if="kind === 'page'">
        <div class="ag-rp-field">
          <label class="ag-rp-label" for="ag-rp-url">Page</label>
          <input
            id="ag-rp-url"
            ref="urlEl"
            v-model="url"
            class="ag-rp-input"
            type="url"
            inputmode="url"
            maxlength="2000"
            :placeholder="domain ? `https://${domain}/` : 'https://'"
            autocomplete="off"
            :aria-invalid="fieldError ? 'true' : undefined"
            :aria-describedby="fieldError ? 'ag-rp-err' : undefined"
          />
        </div>
        <div class="ag-rp-field">
          <label class="ag-rp-label" for="ag-rp-quote">Words from the page <span class="ag-rp-optional">(optional)</span></label>
          <textarea id="ag-rp-quote" v-model="quote" class="ag-rp-input ag-rp-area" rows="2" :maxlength="CONTEXT_LIMITS.quote" />
        </div>
      </template>

      <div v-else-if="kind === 'fact'" class="ag-rp-field">
        <label class="ag-rp-label" for="ag-rp-fact">Brand fact</label>
        <div class="ag-rp-combo">
          <input
            id="ag-rp-fact"
            v-model="factQuery"
            class="ag-rp-input"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-controls="ag-rp-facts"
            :aria-expanded="listOpen ? 'true' : 'false'"
            :aria-activedescendant="activeOptionId"
            :aria-invalid="fieldError ? 'true' : undefined"
            placeholder="Search brand facts"
            @input="onFactInput"
            @focus="listOpen = true"
            @keydown="onFactKeydown"
          />
          <ul v-show="listOpen" id="ag-rp-facts" class="ag-rp-options" role="listbox" aria-label="Brand facts">
            <li v-if="factsState === 'loading'" class="ag-rp-note" role="presentation">
              <AgSpinner :size="12" /> Loading brand facts
            </li>
            <li v-else-if="factsState === 'error'" class="ag-rp-note" role="presentation">
              Couldn't load this list.
              <button type="button" class="ag-rp-retry" @click="loadFacts">Try again</button>
            </li>
            <li v-else-if="factsState === 'ready' && !facts.length" class="ag-rp-note" role="presentation">
              No approved brand facts match.
            </li>
            <template v-else>
              <li
                v-for="(f, i) in facts"
                :id="`ag-rp-fact-${f.id}`"
                :key="f.id"
                class="ag-rp-option"
                :class="{ 'is-active': i === activeIndex, 'is-picked': f.id === factId }"
                role="option"
                :aria-selected="f.id === factId ? 'true' : 'false'"
                @mousedown.prevent="pickFact(f)"
              >
                {{ f.label }}
              </li>
            </template>
          </ul>
        </div>
      </div>

      <template v-else-if="kind === 'document'">
        <p v-if="!documentOptions.length" class="ag-rp-note">No documents yet.</p>
        <template v-else>
          <div class="ag-rp-field">
            <label class="ag-rp-label" for="ag-rp-doc">Document</label>
            <span class="ag-rp-select">
              <select id="ag-rp-doc" v-model="documentId" class="ag-rp-input">
                <option v-for="d in documentOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
              <ChevronDown class="ag-rp-select-icon" :size="14" aria-hidden="true" />
            </span>
          </div>
          <div class="ag-rp-field">
            <label class="ag-rp-label" for="ag-rp-doc-quote">Words from the document <span class="ag-rp-optional">(optional)</span></label>
            <textarea id="ag-rp-doc-quote" v-model="quote" class="ag-rp-input ag-rp-area" rows="2" :maxlength="CONTEXT_LIMITS.quote" />
          </div>
        </template>
      </template>

      <template v-else>
        <p v-if="!competitorOptions.length" class="ag-rp-note">Track competitors in Project settings first.</p>
        <div v-else class="ag-rp-field">
          <label class="ag-rp-label" for="ag-rp-competitor">Competitor</label>
          <span class="ag-rp-select">
            <select id="ag-rp-competitor" v-model="competitorDomain" class="ag-rp-input">
              <option v-for="c in competitorOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
            <ChevronDown class="ag-rp-select-icon" :size="14" aria-hidden="true" />
          </span>
        </div>
      </template>

      <p v-if="fieldError" id="ag-rp-err" class="ag-rp-error" role="alert">{{ fieldError }}</p>
      <p v-else-if="error" class="ag-rp-error" role="alert">{{ error }}</p>
    </form>

    <template #actions>
      <AgButton :disabled="busy" @click="open = false">Cancel</AgButton>
      <AgButton type="submit" form="ag-rp-form" variant="primary" :loading="busy">Add</AgButton>
    </template>
  </AgDialog>
</template>

<style scoped>
.ag-rp {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ag-rp-kinds {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ag-rp-kinds .ag-rp-label {
  grid-column: 1 / -1;
  margin-bottom: 2px;
  padding: 0;
}

.ag-rp-kind {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.ag-rp-kind input {
  accent-color: var(--ag-accent);
}

.ag-rp-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ag-rp-label {
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-rp-optional {
  color: var(--ag-fg-4);
  font-weight: 400;
}

.ag-rp-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 8px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
}

.ag-rp-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: 8px;
  outline: none;
}

.ag-rp-input[aria-invalid='true'] {
  border-color: var(--ag-danger);
}

.ag-rp-area {
  min-height: 60px;
  resize: vertical;
}

.ag-rp-select {
  position: relative;
  display: block;
}

.ag-rp-select select {
  padding-right: 32px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.ag-rp-select-icon {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-rp-combo {
  position: relative;
}

.ag-rp-options {
  max-height: 220px;
  margin: 4px 0 0;
  padding: 4px;
  overflow-y: auto;
  border: 1px solid var(--ag-menu-border);
  border-radius: 8px;
  background: var(--ag-menu-bg);
  list-style: none;
}

.ag-rp-option {
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
  cursor: pointer;
}

.ag-rp-option.is-active,
.ag-rp-option:hover {
  background: var(--ag-menu-hover);
}

.ag-rp-option.is-picked {
  font-weight: 500;
}

.ag-rp-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-rp-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.ag-rp-error {
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

@media (max-width: 480px) {
  .ag-rp-kinds {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (pointer: coarse) {
  .ag-rp-input {
    font-size: 16px;
  }
}
</style>
