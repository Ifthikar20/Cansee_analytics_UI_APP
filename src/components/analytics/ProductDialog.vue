<script setup>
// Add or edit a tracked product (contract 9): its name, the words a result
// must contain to count as it, its page, the shopping questions buyers ask
// and the store names that count as sold by you. Saving never runs a check;
// the shopping check has its own dialog with the cost.
import { computed, ref, watch } from 'vue'
import { CircleAlert, Plus, X } from '@lucide/vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import insightsApi from '@/api/insights'
import { Button } from '@/components/ui/button'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  websiteId: { type: String, required: true },
  // The product to edit; null adds a new one.
  product: { type: Object, default: null },
  // Your store name by default (the project's name).
  projectName: { type: String, default: '' },
  // {max_products, max_queries, max_terms}
  limits: { type: Object, default: null },
})
const emit = defineEmits(['saved'])

const maxQueries = computed(() => props.limits?.max_queries || 3)
const editing = computed(() => Boolean(props.product?.id))

const name = ref('')
const terms = ref('')
const url = ref('')
const questions = ref([''])
const sellers = ref('')

const saving = ref(false)
const fieldErrors = ref({})
const formError = ref('')

function reset() {
  const p = props.product
  name.value = p?.name || ''
  terms.value = (p?.match_terms || []).join(', ')
  url.value = p?.url || ''
  questions.value = p?.queries?.length ? [...p.queries] : ['']
  sellers.value = p ? (p.own_sellers || []).join(', ') : props.projectName || ''
  fieldErrors.value = {}
  formError.value = ''
  saving.value = false
}

watch(open, (isOpen) => {
  if (isOpen) reset()
})
if (open.value) reset()

function list(text) {
  return String(text || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function addQuestion() {
  if (questions.value.length < maxQueries.value) questions.value = [...questions.value, '']
}

function removeQuestion(index) {
  questions.value = questions.value.filter((_, i) => i !== index)
  if (!questions.value.length) questions.value = ['']
}

const filledQuestions = computed(() => questions.value.map((q) => q.trim()).filter(Boolean))
const canSave = computed(() => !saving.value && name.value.trim().length > 0 && filledQuestions.value.length > 0)

function body() {
  const matchTerms = list(terms.value)
  return {
    name: name.value.trim(),
    // An empty field means the product's own name, as the API defaults it.
    match_terms: matchTerms.length ? matchTerms : [name.value.trim()],
    url: url.value.trim(),
    queries: filledQuestions.value,
    own_sellers: list(sellers.value),
  }
}

function errorBody(err) {
  const raw = err?.response?.data?.error
  return raw && typeof raw === 'object' ? raw : { code: typeof raw === 'string' ? raw : '', message: '' }
}

const FIELDS = ['name', 'match_terms', 'url', 'queries', 'own_sellers']

async function save() {
  if (!canSave.value) return
  saving.value = true
  fieldErrors.value = {}
  formError.value = ''
  try {
    const res = editing.value
      ? await insightsApi.updateProduct(props.websiteId, props.product.id, body())
      : await insightsApi.createProduct(props.websiteId, body())
    open.value = false
    emit('saved', res.data)
  } catch (err) {
    const b = errorBody(err)
    const field = b.details?.field
    const message = b.details?.message || b.message || err?.displayMessage || "We couldn't save this product. Try again."
    if (FIELDS.includes(field)) fieldErrors.value = { [field]: message }
    else formError.value = message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="pd-overlay" />
      <DialogContent class="pd" :aria-describedby="undefined">
        <div class="pd-head">
          <DialogTitle class="pd-title">{{ editing ? 'Edit product' : 'Add product' }}</DialogTitle>
          <DialogClose class="pd-close" aria-label="Close">
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <form class="pd-body" novalidate @submit.prevent="save">
          <div class="pd-field">
            <label for="pd-name" class="pd-label">Product name</label>
            <input
              id="pd-name"
              v-model="name"
              class="pd-input"
              maxlength="120"
              autocomplete="off"
              :aria-invalid="fieldErrors.name ? 'true' : undefined"
              :aria-describedby="fieldErrors.name ? 'pd-name-error' : undefined"
            />
            <p v-if="fieldErrors.name" id="pd-name-error" class="pd-error">{{ fieldErrors.name }}</p>
          </div>

          <div class="pd-field">
            <label for="pd-terms" class="pd-label">Match words</label>
            <input
              id="pd-terms"
              v-model="terms"
              class="pd-input"
              autocomplete="off"
              :placeholder="name.trim()"
              :aria-invalid="fieldErrors.match_terms ? 'true' : undefined"
              aria-describedby="pd-terms-help"
            />
            <p id="pd-terms-help" class="pd-help">A result counts as your product when it contains every match word.</p>
            <p v-if="fieldErrors.match_terms" class="pd-error">{{ fieldErrors.match_terms }}</p>
          </div>

          <div class="pd-field">
            <label for="pd-url" class="pd-label">Product page URL (optional)</label>
            <input
              id="pd-url"
              v-model="url"
              class="pd-input"
              type="url"
              inputmode="url"
              autocomplete="off"
              placeholder="https://"
              :aria-invalid="fieldErrors.url ? 'true' : undefined"
            />
            <p v-if="fieldErrors.url" class="pd-error">{{ fieldErrors.url }}</p>
          </div>

          <fieldset class="pd-field">
            <legend class="pd-label">Shopping questions</legend>
            <p id="pd-questions-help" class="pd-help">Write them as a buyer would ask an AI assistant.</p>
            <div v-for="(q, i) in questions" :key="i" class="pd-question">
              <input
                v-model="questions[i]"
                class="pd-input"
                maxlength="200"
                autocomplete="off"
                :aria-label="`Shopping question ${i + 1}`"
                aria-describedby="pd-questions-help"
                :aria-invalid="fieldErrors.queries ? 'true' : undefined"
              />
              <button
                v-if="questions.length > 1"
                type="button"
                class="pd-remove"
                :aria-label="`Remove question ${i + 1}`"
                @click="removeQuestion(i)"
              >
                <X class="size-4" aria-hidden="true" />
              </button>
            </div>
            <button v-if="questions.length < maxQueries" type="button" class="pd-add" @click="addQuestion">
              <Plus class="size-4" aria-hidden="true" />
              Add a question
            </button>
            <p v-if="fieldErrors.queries" class="pd-error">{{ fieldErrors.queries }}</p>
          </fieldset>

          <div class="pd-field">
            <label for="pd-sellers" class="pd-label">Your store names</label>
            <input
              id="pd-sellers"
              v-model="sellers"
              class="pd-input"
              autocomplete="off"
              aria-describedby="pd-sellers-help"
              :aria-invalid="fieldErrors.own_sellers ? 'true' : undefined"
            />
            <p id="pd-sellers-help" class="pd-help">Listings sold under these names count as sold by you.</p>
            <p v-if="fieldErrors.own_sellers" class="pd-error">{{ fieldErrors.own_sellers }}</p>
          </div>

          <p v-if="formError" class="pd-form-error" role="alert">
            <CircleAlert class="pd-icon" aria-hidden="true" />
            <span>{{ formError }}</span>
          </p>
        </form>

        <div class="pd-foot">
          <Button variant="outline" @click="open = false">Cancel</Button>
          <Button :disabled="!canSave" @click="save">
            {{ editing ? 'Save' : 'Add product' }}
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.pd-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--scrim);
}

.pd {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: none;
  transform: translate(-50%, -50%);
  outline: none;
}

.pd-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 24px 0;
}

.pd-title {
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.pd-close,
.pd-remove {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.pd-close:hover,
.pd-remove:hover {
  background: var(--accent);
  color: var(--foreground);
}

.pd-body {
  display: grid;
  gap: 16px;
  min-height: 0;
  padding: 18px 24px;
  overflow-y: auto;
}

.pd-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  border: 0;
}

.pd-label {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.pd-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
}

.pd-input:focus-visible {
  border-color: var(--ring);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.pd-input[aria-invalid='true'] {
  border-color: var(--destructive);
}

.pd-help {
  color: var(--muted-foreground);
  font-size: 12.5px;
  line-height: 1.45;
}

.pd-error {
  color: var(--destructive);
  font-size: 12.5px;
}

.pd-question {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pd-add {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px dashed var(--input);
  border-radius: var(--radius);
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.pd-add:hover {
  border-style: solid;
  background: var(--accent);
}

.pd-form-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--destructive);
  font-size: 13px;
}

.pd-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.pd-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px 20px;
  border-top: 1px solid var(--border);
}

@media (max-width: 767px) {
  .pd {
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
    transform: none;
  }
}
</style>
