<script setup>
// "Check rankings in other countries": pick countries, prompts, engines and
// Google depth; the server estimates the cost 300 ms after every change
// (contract 2e) and nothing runs until the user confirms that estimate.
// The run is created with the estimate's own `confirm`; if the cost moved
// meanwhile (409 estimate_changed) the new estimate replaces the old one
// and the user confirms again.
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, CircleAlert, Info, X } from '@lucide/vue'
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxItemIndicator,
  ComboboxRoot, ComboboxTrigger, ComboboxViewport,
  DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle,
} from 'reka-ui'
import countriesApi from '@/api/countries'
import { useToast } from '@/composables/useToast'
import { money, visitorSuggestions } from '@/lib/analytics/countrySpecs'
import { Button } from '@/components/ui/button'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  websiteId: { type: String, required: true },
  // CountryOptions (contract 2d).
  options: { type: Object, default: null },
  // A prompt to preselect (the page's ?prompt=).
  presetPromptId: { type: String, default: '' },
  // The site's visitor countries ([{code, value}], uppercase), for suggestions.
  trafficCountries: { type: Array, default: () => [] },
})
const emit = defineEmits(['started'])

const toast = useToast()
const integer = new Intl.NumberFormat('en-US')

const limits = computed(() => ({
  countries: props.options?.limits?.max_countries || 5,
  prompts: props.options?.limits?.max_prompts || 10,
  pages: props.options?.limits?.max_pages || 1,
}))
const catalog = computed(() => props.options?.countries || [])
const promptList = computed(() => props.options?.prompts || [])
const engineList = computed(() => props.options?.engines || [])
const googleConfigured = computed(() => Boolean(props.options?.google?.configured))

// ── Selection ──
const countries = ref([])
const promptIds = ref([])
const engines = ref([])
const includeGoogle = ref(false)
const googlePages = ref(1)

function reset() {
  countries.value = []
  const preset = promptList.value.find((p) => String(p.prompt_id) === String(props.presetPromptId))
  promptIds.value = preset
    ? [String(preset.prompt_id)]
    : promptList.value.slice(0, Math.min(5, limits.value.prompts)).map((p) => String(p.prompt_id))
  engines.value = engineList.value.filter((e) => e.configured).map((e) => e.key)
  includeGoogle.value = googleConfigured.value
  googlePages.value = 1
  estimate.value = null
  estimateError.value = ''
  submitError.value = ''
  changedNote.value = ''
}

const countryName = (cc) => catalog.value.find((c) => c.country === cc)?.name || cc.toUpperCase()
const countriesFull = computed(() => countries.value.length >= limits.value.countries)
const promptsFull = computed(() => promptIds.value.length >= limits.value.prompts)

function addCountry(cc) {
  if (countriesFull.value || countries.value.includes(cc)) return
  countries.value = [...countries.value, cc]
}

function removeCountry(cc) {
  countries.value = countries.value.filter((c) => c !== cc)
}

const suggestions = computed(() =>
  countriesFull.value ? [] : visitorSuggestions(props.trafficCountries, props.options, countries.value),
)

function promptLocation(p) {
  return p.location ? String(p.location).toUpperCase() : 'Global'
}

const selection = computed(() => ({
  countries: [...countries.value],
  prompt_ids: [...promptIds.value],
  engines: [...engines.value],
  include_google: includeGoogle.value,
  google_pages: googlePages.value,
}))

const invalid = computed(() => {
  if (!countries.value.length) return 'Choose at least one country to see the cost.'
  if (!promptIds.value.length) return 'Choose at least one prompt to see the cost.'
  if (!includeGoogle.value && !engines.value.length) return 'Choose Google or at least one AI engine.'
  return ''
})

// ── Estimate (debounced; the latest answer wins) ──
const estimate = ref(null)
const estimating = ref(false)
const estimateError = ref('')
let timer = null
let token = 0

function errorBody(err) {
  const body = err?.response?.data?.error
  return body && typeof body === 'object' ? body : { code: typeof body === 'string' ? body : '', message: '' }
}

function queueEstimate() {
  clearTimeout(timer)
  changedNote.value = ''
  submitError.value = ''
  token += 1
  if (!open.value || invalid.value) {
    estimate.value = null
    estimating.value = false
    estimateError.value = ''
    return
  }
  estimating.value = true
  timer = setTimeout(runEstimate, 300)
}

async function runEstimate() {
  const mine = ++token
  try {
    const res = await countriesApi.estimate(props.websiteId, selection.value)
    if (mine !== token) return
    estimate.value = res.data
    estimateError.value = ''
  } catch (err) {
    if (mine !== token) return
    estimate.value = null
    estimateError.value = errorBody(err).message || err?.displayMessage || "We couldn't estimate the cost. Try again."
  } finally {
    if (mine === token) estimating.value = false
  }
}

watch(() => JSON.stringify(selection.value), queueEstimate)

watch(open, (isOpen) => {
  if (isOpen) {
    reset()
    queueEstimate()
  } else {
    clearTimeout(timer)
    token += 1
  }
})

function plural(n, one, many) {
  return `${integer.format(n)} ${n === 1 ? one : many}`
}

const googleLines = computed(() => {
  const g = estimate.value?.google
  if (!g?.included) return []
  const pages = `up to ${plural(g.pages_max || 0, 'results page', 'results pages')}`
  const cost =
    g.provider === 'serpapi'
      ? `up to ${money(g.usd_max)}`
      : `about ${integer.format(g.credits_max || 0)} ScraperAPI credits`
  const lines = [`Google: ${pages}, ${cost}.`]
  if (typeof g.daily_left === 'number' && typeof g.daily_limit === 'number') {
    lines.push(`${integer.format(g.daily_left)} of ${integer.format(g.daily_limit)} Google pages left today for this project.`)
  }
  return lines
})

const engineLine = computed(() => {
  const e = estimate.value?.engines
  if (!e || !e.answers) return ''
  const answers = plural(e.answers, 'answer', 'answers')
  const allowance = estimate.value?.allowance
  if (!allowance || allowance.unlimited) return `AI engines: ${answers}, up to ${money(e.usd_max)}.`
  return `AI engines: ${answers}, up to ${money(e.usd_max)} of your AI allowance (${money(allowance.left_usd)} left this month).`
})

const warnings = computed(() => estimate.value?.warnings || [])
const blockers = computed(() => estimate.value?.blockers || [])

const runLabel = computed(() => {
  const e = estimate.value
  if (!e) return 'Run check'
  const usd = Number(e.engines?.usd_max || 0) + (e.google?.included ? Number(e.google.usd_max || 0) : 0)
  const credits = e.google?.included && e.google.provider !== 'serpapi' ? e.google.credits_max || 0 : 0
  const parts = []
  if (usd > 0 || !credits) parts.push(money(usd))
  if (credits) parts.push(`${integer.format(credits)} credits`)
  return `Run for up to ${parts.join(' and ')}`
})

// ── Submit ──
const submitting = ref(false)
const submitError = ref('')
const changedNote = ref('')

const canRun = computed(
  () => !invalid.value && !estimating.value && !submitting.value && Boolean(estimate.value?.can_run && estimate.value?.confirm),
)

async function submit() {
  if (!canRun.value) return
  submitting.value = true
  submitError.value = ''
  changedNote.value = ''
  try {
    const res = await countriesApi.startRun(props.websiteId, { ...selection.value, confirm: estimate.value.confirm })
    toast.success('Country check started.')
    open.value = false
    emit('started', res.data)
  } catch (err) {
    const body = errorBody(err)
    if (err?.response?.status === 409 && body.code === 'estimate_changed' && body.details?.estimate) {
      estimate.value = body.details.estimate
      changedNote.value = 'The cost changed. Check the new estimate and confirm again.'
    } else {
      submitError.value = body.message || err?.displayMessage || "We couldn't start this check. Try again."
    }
  } finally {
    submitting.value = false
  }
}

// Mounted already open (the page's ?check=1): start from the defaults.
if (open.value) {
  reset()
  queueEstimate()
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="crd-overlay" />
      <DialogContent class="crd" :aria-busy="estimating ? 'true' : 'false'">
        <div class="crd-head">
          <div>
            <DialogTitle class="crd-title">Check rankings in other countries</DialogTitle>
            <DialogDescription class="crd-desc">
              Cansee searches Google and asks the AI engines your prompts as if from each country. Nothing runs until you confirm the cost.
            </DialogDescription>
          </div>
          <DialogClose class="crd-close" aria-label="Close">
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <div class="crd-body">
          <!-- Countries -->
          <fieldset class="crd-field">
            <legend class="crd-legend">
              Countries <span class="crd-limit">Up to {{ limits.countries }} countries</span>
            </legend>

            <ul v-if="countries.length" class="crd-chosen" aria-label="Chosen countries">
              <li v-for="cc in countries" :key="cc" class="crd-chosen-chip">
                {{ countryName(cc) }}
                <button type="button" class="crd-chip-x" :aria-label="`Remove ${countryName(cc)}`" @click="removeCountry(cc)">
                  <X class="size-3" aria-hidden="true" />
                </button>
              </li>
            </ul>

            <ComboboxRoot v-model="countries" multiple open-on-click class="crd-combo">
              <ComboboxAnchor class="crd-anchor">
                <ComboboxInput class="crd-input" placeholder="Search countries" aria-label="Search countries" />
                <ComboboxTrigger class="crd-trigger" aria-label="Show countries">
                  <ChevronDown class="size-4" aria-hidden="true" />
                </ComboboxTrigger>
              </ComboboxAnchor>
              <ComboboxContent class="crd-list">
                <ComboboxViewport class="crd-viewport">
                  <ComboboxEmpty class="crd-empty">No country matches.</ComboboxEmpty>
                  <ComboboxItem
                    v-for="c in catalog"
                    :key="c.country"
                    :value="c.country"
                    :text-value="c.name"
                    :disabled="countriesFull && !countries.includes(c.country)"
                    class="crd-option"
                  >
                    <span class="crd-option-text">
                      <span class="crd-option-name">{{ c.name }}</span>
                      <span v-if="c.google_method_label" class="crd-option-sub">Google: {{ c.google_method_label }}</span>
                    </span>
                    <ComboboxItemIndicator class="crd-option-check">
                      <Check class="size-4" aria-hidden="true" />
                    </ComboboxItemIndicator>
                  </ComboboxItem>
                </ComboboxViewport>
              </ComboboxContent>
            </ComboboxRoot>

            <p v-if="suggestions.length" class="crd-suggest">
              <span class="crd-suggest-label">From your visitors:</span>
              <button
                v-for="s in suggestions"
                :key="s.country"
                type="button"
                class="crd-suggest-btn"
                @click="addCountry(s.country)"
              >{{ s.name }}</button>
            </p>
          </fieldset>

          <!-- Prompts -->
          <fieldset class="crd-field">
            <legend class="crd-legend">
              Prompts <span class="crd-limit">Up to {{ limits.prompts }} prompts</span>
            </legend>
            <ul class="crd-checks">
              <li v-for="p in promptList" :key="p.prompt_id">
                <label class="crd-check">
                  <input
                    v-model="promptIds"
                    type="checkbox"
                    :value="String(p.prompt_id)"
                    :disabled="promptsFull && !promptIds.includes(String(p.prompt_id))"
                  />
                  <span class="crd-check-text">{{ p.text }}</span>
                  <span class="crd-badge">{{ promptLocation(p) }}</span>
                </label>
              </li>
            </ul>
          </fieldset>

          <!-- AI engines -->
          <fieldset class="crd-field">
            <legend class="crd-legend">AI engines</legend>
            <ul class="crd-checks">
              <li v-for="e in engineList" :key="e.key">
                <label class="crd-check" :class="{ 'is-off': !e.configured }">
                  <input v-model="engines" type="checkbox" :value="e.key" :disabled="!e.configured" />
                  <span class="crd-check-text">
                    {{ e.label }}
                    <span class="crd-check-sub">{{ e.configured ? e.method_label : 'Not configured' }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </fieldset>

          <!-- Google -->
          <fieldset class="crd-field">
            <legend class="crd-legend">Google</legend>
            <label class="crd-check" :class="{ 'is-off': !googleConfigured }">
              <input v-model="includeGoogle" type="checkbox" :disabled="!googleConfigured" />
              <span class="crd-check-text">
                Search Google
                <span v-if="!googleConfigured" class="crd-check-sub">Google results aren't available yet.</span>
              </span>
            </label>
            <div v-if="googleConfigured" class="crd-seg-row">
              <span id="crd-results-label" class="crd-seg-label">Results</span>
              <div class="crd-seg" role="radiogroup" aria-labelledby="crd-results-label">
                <label class="crd-seg-item" :class="{ 'is-on': googlePages === 1, 'is-off': !includeGoogle }">
                  <input v-model="googlePages" type="radio" name="crd-pages" :value="1" :disabled="!includeGoogle" />
                  Top 10
                </label>
                <label
                  v-if="limits.pages >= 2"
                  class="crd-seg-item"
                  :class="{ 'is-on': googlePages === 2, 'is-off': !includeGoogle }"
                >
                  <input v-model="googlePages" type="radio" name="crd-pages" :value="2" :disabled="!includeGoogle" />
                  Top 20
                </label>
              </div>
            </div>
          </fieldset>

          <!-- Estimate -->
          <section class="crd-estimate" :class="{ 'is-stale': estimating }" aria-live="polite" aria-label="Estimated cost">
            <p v-if="invalid" class="crd-muted">{{ invalid }}</p>
            <p v-else-if="estimateError" class="crd-blocker">
              <CircleAlert class="crd-icon" aria-hidden="true" />
              <span>{{ estimateError }}</span>
            </p>
            <p v-else-if="!estimate" class="crd-muted">Estimating the cost...</p>
            <template v-else>
              <p v-for="line in googleLines" :key="line" class="crd-line">{{ line }}</p>
              <p v-if="engineLine" class="crd-line">{{ engineLine }}</p>
              <p v-for="w in warnings" :key="w.code" class="crd-warning">
                <Info class="crd-icon" aria-hidden="true" />
                <span>{{ w.message }}</span>
              </p>
              <p v-for="b in blockers" :key="b.code" class="crd-blocker">
                <CircleAlert class="crd-icon" aria-hidden="true" />
                <span>{{ b.message }}</span>
              </p>
            </template>
          </section>

          <p v-if="changedNote" class="crd-note" role="status">{{ changedNote }}</p>
          <p v-if="submitError" class="crd-blocker" role="alert">
            <CircleAlert class="crd-icon" aria-hidden="true" />
            <span>{{ submitError }}</span>
          </p>
        </div>

        <div class="crd-foot">
          <Button variant="outline" class="rounded-full" @click="open = false">Cancel</Button>
          <Button class="rounded-full" :disabled="!canRun" @click="submit">
            {{ submitting ? 'Starting...' : runLabel }}
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.crd-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 10, 12, 0.45);
}

.crd {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%);
  outline: none;
}

.crd-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 24px 0;
}

.crd-title {
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.crd-desc {
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.crd-close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.crd-close:hover {
  background: var(--accent);
  color: var(--foreground);
}

.crd-body {
  display: grid;
  gap: 18px;
  min-height: 0;
  padding: 18px 24px;
  overflow-y: auto;
}

.crd-field {
  display: grid;
  gap: 10px;
  min-width: 0;
  border: 0;
}

.crd-legend {
  margin-bottom: 8px;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.crd-limit {
  margin-left: 8px;
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-weight: 400;
}

.crd-chosen {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
}

.crd-chosen-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--accent);
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
}

.crd-chip-x {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.crd-chip-x:hover {
  background: var(--background);
  color: var(--foreground);
}

.crd-combo {
  position: relative;
}

.crd-anchor {
  display: flex;
  align-items: center;
  height: 38px;
  border: 1px solid var(--input);
  border-radius: 10px;
  background: var(--background);
}

.crd-anchor:focus-within {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.crd-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.crd-input:focus-visible {
  outline: none;
}

.crd-trigger {
  display: grid;
  place-items: center;
  width: 34px;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.crd-list {
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--popover);
  overflow: hidden;
}

.crd-viewport {
  max-height: 220px;
  padding: 4px;
  overflow-y: auto;
}

.crd-empty {
  padding: 10px 12px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.crd-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
}

.crd-option[data-highlighted] {
  background: var(--accent);
}

.crd-option[data-disabled] {
  cursor: not-allowed;
  opacity: 0.45;
}

.crd-option-text {
  display: grid;
  min-width: 0;
}

.crd-option-name {
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 500;
}

.crd-option-sub {
  color: var(--muted-foreground);
  font-size: 12px;
}

.crd-option-check {
  flex-shrink: 0;
  color: var(--foreground);
}

.crd-suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.crd-suggest-label {
  color: var(--muted-foreground);
}

.crd-suggest-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px dashed var(--input);
  border-radius: 999px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.crd-suggest-btn:hover {
  border-style: solid;
  background: var(--accent);
}

.crd-checks {
  display: grid;
  gap: 2px;
  list-style: none;
}

.crd-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 8px;
  color: var(--foreground);
  font-size: 13.5px;
  cursor: pointer;
}

.crd-check input {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: var(--primary);
}

.crd-check.is-off {
  cursor: not-allowed;
}

.crd-check.is-off .crd-check-text {
  color: var(--muted-foreground);
}

.crd-check-text {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.45;
}

.crd-check-sub {
  color: var(--muted-foreground);
  font-size: 12px;
}

.crd-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted-foreground);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.crd-seg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 30px;
}

.crd-seg-label {
  color: var(--muted-foreground);
  font-size: 13px;
}

.crd-seg {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--muted);
}

.crd-seg-item {
  position: relative;
  padding: 4px 12px;
  border-radius: 8px;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.crd-seg-item input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: inherit;
}

.crd-seg-item.is-on {
  background: var(--background);
  color: var(--foreground);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.crd-seg-item.is-off {
  cursor: not-allowed;
  opacity: 0.5;
}

.crd-seg-item:focus-within {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.crd-estimate {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--muted);
  font-size: 13.5px;
  line-height: 1.5;
  transition: opacity 0.15s ease;
}

.crd-estimate.is-stale {
  opacity: 0.55;
}

.crd-line {
  color: var(--foreground);
}

.crd-muted {
  color: var(--muted-foreground);
}

.crd-warning,
.crd-blocker {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
}

.crd-warning {
  color: var(--muted-foreground);
}

.crd-blocker {
  color: var(--destructive);
}

.crd-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.crd-note {
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
}

.crd-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px 20px;
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .crd-head,
  .crd-body {
    padding-left: 18px;
    padding-right: 18px;
  }
  .crd-foot {
    padding-left: 18px;
    padding-right: 18px;
  }
}
</style>
