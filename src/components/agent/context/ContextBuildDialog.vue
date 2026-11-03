<script setup>
// Build from my site (p2_contract.md 11c): the confirm step of a
// context_build run. The page's useInsightRun('context_build') owns the
// options, the debounced estimate and the confirmed start; this dialog
// shows the choices and the cost, and nothing runs until Build is pressed.
// Without the analysis model only a re-check of cited pages runs.
import { computed, ref, watch } from 'vue'
import { CircleAlert, Info, Plus, X } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import { money } from '@/lib/analytics/countrySpecs'
import { CONTEXT_LIMITS } from '@/lib/agent/contextSections'

const props = defineProps({
  // useInsightRun('context_build', ...) of the page
  builder: { type: Object, required: true },
  // ContextOverview.build: {available, reason}
  build: { type: Object, default: null },
  // The project's domain, until the run options name it.
  domain: { type: String, default: '' },
})

const integer = new Intl.NumberFormat('en-US')

const open = computed({
  get: () => props.builder.isOpen.value,
  set: (value) => {
    if (!value) props.builder.close()
  },
})

const aiOff = computed(() => props.build?.reason === 'ai_not_configured')
const options = computed(() => props.builder.options.value)
const choices = computed(() => options.value?.choices || {})
const siteDomain = computed(() => choices.value.domain || props.domain || 'your site')
const allDocuments = computed(() => (Array.isArray(choices.value.documents) ? choices.value.documents : []))

const synthesize = ref(true)
const urls = ref([])
const picked = ref([])

// The params the estimate and the start send.
function paramsNow() {
  const docs = allDocuments.value
  const ids = picked.value.slice(0, CONTEXT_LIMITS.buildDocuments)
  const everything = docs.length <= CONTEXT_LIMITS.buildDocuments && ids.length === docs.length
  return {
    synthesize: synthesize.value && !aiOff.value,
    extra_urls: urls.value.map((u) => u.trim()).filter(Boolean).slice(0, CONTEXT_LIMITS.extraUrls),
    document_ids: everything ? null : ids,
  }
}

// Reset the choices each time the dialog opens: AI on (when available),
// no extra pages, every document (up to the limit).
watch(
  () => props.builder.isOpen.value,
  (isOpen) => {
    if (!isOpen) return
    synthesize.value = !aiOff.value
    urls.value = []
    picked.value = allDocuments.value.slice(0, CONTEXT_LIMITS.buildDocuments).map((d) => String(d.id))
    props.builder.setParams(paramsNow())
  },
)

// The document list arrives with the options; keep "all" when it does.
watch(allDocuments, (docs, before) => {
  if (!props.builder.isOpen.value || (before && before.length)) return
  picked.value = docs.slice(0, CONTEXT_LIMITS.buildDocuments).map((d) => String(d.id))
  props.builder.setParams(paramsNow())
})

function changed() {
  props.builder.setParams(paramsNow())
}

function addUrl() {
  if (urls.value.length >= CONTEXT_LIMITS.extraUrls) return
  urls.value.push('')
}

function removeUrl(index) {
  urls.value.splice(index, 1)
  changed()
}

function toggleDocument(id, checked) {
  const key = String(id)
  if (checked && !picked.value.includes(key)) {
    if (picked.value.length >= CONTEXT_LIMITS.buildDocuments) return
    picked.value = [...picked.value, key]
  } else if (!checked) {
    picked.value = picked.value.filter((p) => p !== key)
  }
  changed()
}

const estimate = computed(() => props.builder.estimate.value)
const unlimited = computed(() => Boolean(estimate.value?.allowance?.unlimited))
// The estimate's own counts (units: pages, rechecks, documents), else the options'.
const recheck = computed(() => {
  const n = Number(estimate.value?.units?.rechecks ?? choices.value.recheck)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const pagesToRead = computed(() => {
  const units = Number(estimate.value?.units?.pages)
  if (Number.isFinite(units) && units > 0) return units
  const fetches = Number(estimate.value?.fetches?.pages_max)
  if (Number.isFinite(fetches) && fetches > recheck.value) return Math.min(fetches - recheck.value, CONTEXT_LIMITS.buildPages)
  return CONTEXT_LIMITS.buildPages
})
const documentCount = computed(() => {
  const sent = Number(estimate.value?.units?.documents)
  if (Number.isFinite(sent) && sent >= 0) return sent
  const ids = paramsNow().document_ids
  return ids === null ? Math.min(allDocuments.value.length, CONTEXT_LIMITS.buildDocuments) : ids.length
})
const factCount = computed(() => Number(choices.value.facts?.approved) || 0)
const aiCalls = computed(() => Number(estimate.value?.ai?.calls_max) || 0)
const aiUsd = computed(() => estimate.value?.ai?.usd_max ?? null)

const lines = computed(() => {
  if (!estimate.value) return []
  const out = []
  // Without AI nothing is read for suggestions: only the re-check line stays.
  if (paramsNow().synthesize) {
    out.push(
      `${integer.format(pagesToRead.value)} pages of ${siteDomain.value}, ${integer.format(documentCount.value)} documents and ${integer.format(factCount.value)} approved brand facts.`,
    )
  }
  if (aiCalls.value > 0) {
    const left = unlimited.value ? '' : ` (${money(estimate.value.allowance?.left_usd)} left this month)`
    out.push(
      `AI: up to ${integer.format(aiCalls.value)} requests, up to ${money(aiUsd.value)} of your AI allowance${left}.`,
    )
  }
  if (recheck.value > 0) out.push(`Also re-checks ${integer.format(recheck.value)} pages your entries cite. Reading pages is free.`)
  return out
})

const warnings = computed(() => (Array.isArray(estimate.value?.warnings) ? estimate.value.warnings : []))
const blockers = computed(() => (Array.isArray(estimate.value?.blockers) ? estimate.value.blockers : []))

// Before the first estimate there is no amount to state (the button waits).
const submitLabel = computed(() => {
  if (!paramsNow().synthesize) return 'Re-check sources'
  return estimate.value ? `Build for up to ${money(aiUsd.value ?? 0)}` : 'Build'
})

const description = computed(
  () =>
    `Cansee reads up to ${CONTEXT_LIMITS.buildPages} pages of ${siteDomain.value} and the documents you choose, then suggests entries with the sources they come from. You review every suggestion before the agents use it. Nothing runs until you confirm the cost.`,
)

function submit() {
  props.builder.start()
}
</script>

<template>
  <AgDialog v-model:open="open" title="Build context from your site" :description="description" wide>
    <form id="ag-cbd-form" class="ag-cbd" novalidate @submit.prevent="submit">
      <label class="ag-cbd-check">
        <input v-model="synthesize" type="checkbox" :disabled="aiOff" @change="changed" />
        <span>Suggest entries (uses AI)</span>
      </label>
      <p v-if="aiOff" class="ag-cbd-note">
        <Info :size="14" aria-hidden="true" />
        <span>The analysis model isn't configured on this server.</span>
      </p>

      <fieldset class="ag-cbd-group">
        <legend class="ag-cbd-label">Also read these pages (optional)</legend>
        <ul v-if="urls.length" class="ag-cbd-urls" role="list">
          <li v-for="(u, i) in urls" :key="i" class="ag-cbd-url">
            <input
              v-model="urls[i]"
              class="ag-cbd-input"
              type="url"
              inputmode="url"
              maxlength="2000"
              :aria-label="`Page ${i + 1}`"
              :placeholder="`https://${siteDomain}/`"
              @change="changed"
            />
            <AgIconButton :label="`Remove page ${i + 1}`" :size="28" muted @click="removeUrl(i)">
              <X />
            </AgIconButton>
          </li>
        </ul>
        <AgButton
          v-if="urls.length < CONTEXT_LIMITS.extraUrls"
          class="ag-cbd-add"
          variant="ghost"
          size="xs"
          :icon="Plus"
          @click="addUrl"
        >
          Add page
        </AgButton>
      </fieldset>

      <fieldset v-if="allDocuments.length" class="ag-cbd-group">
        <legend class="ag-cbd-label">Documents to use</legend>
        <label v-for="d in allDocuments" :key="d.id" class="ag-cbd-check">
          <input
            type="checkbox"
            :checked="picked.includes(String(d.id))"
            :disabled="!picked.includes(String(d.id)) && picked.length >= CONTEXT_LIMITS.buildDocuments"
            @change="toggleDocument(d.id, $event.target.checked)"
          />
          <span>{{ d.title || 'Untitled document' }}</span>
        </label>
      </fieldset>

      <div class="ag-cbd-estimate" :class="{ 'is-stale': builder.estimating.value }" aria-live="polite">
        <p v-for="line in lines" :key="line" class="ag-cbd-line">{{ line }}</p>
        <p v-for="w in warnings" :key="`w-${w.code}`" class="ag-cbd-note">
          <Info :size="14" aria-hidden="true" />
          <span>{{ w.message }}</span>
        </p>
        <p v-for="b in blockers" :key="`b-${b.code}`" class="ag-cbd-blocker">
          <CircleAlert :size="14" aria-hidden="true" />
          <span>{{ b.message }}</span>
        </p>
      </div>

      <p v-if="builder.changedNote.value" class="ag-cbd-blocker" role="alert">
        <CircleAlert :size="14" aria-hidden="true" />
        <span>{{ builder.changedNote.value }}</span>
      </p>
      <p v-if="builder.error.value" class="ag-cbd-blocker" role="alert">
        <CircleAlert :size="14" aria-hidden="true" />
        <span>{{ builder.error.value }}</span>
      </p>
    </form>

    <template #actions>
      <AgButton :disabled="builder.submitting.value" @click="builder.close()">Cancel</AgButton>
      <AgButton
        type="submit"
        form="ag-cbd-form"
        variant="primary"
        :loading="builder.submitting.value"
        :disabled="!builder.canStart.value"
      >
        {{ submitLabel }}
      </AgButton>
    </template>
  </AgDialog>
</template>

<style scoped>
.ag-cbd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ag-cbd-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ag-cbd-label {
  margin-bottom: 2px;
  padding: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-cbd-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.ag-cbd-check input {
  accent-color: var(--ag-accent);
}

.ag-cbd-urls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-cbd-url {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ag-cbd-input {
  flex: 1 1 auto;
  box-sizing: border-box;
  min-width: 0;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 8px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
}

.ag-cbd-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: 8px;
  outline: none;
}

.ag-cbd-group :deep(.ag-cbd-add) {
  align-self: flex-start;
  margin-left: -8px;
}

.ag-cbd-estimate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  background: var(--ag-bubble-bg);
  transition: opacity 120ms ease;
}

.ag-cbd-estimate:empty {
  display: none;
}

.ag-cbd-estimate.is-stale {
  opacity: 0.55;
}

.ag-cbd-line {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13.5px;
  line-height: 20px;
}

.ag-cbd-note,
.ag-cbd-blocker {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  line-height: 19px;
}

.ag-cbd-note {
  color: var(--ag-fg-3);
}

.ag-cbd-blocker {
  color: var(--ag-danger);
}

.ag-cbd-note :deep(svg),
.ag-cbd-blocker :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
}

@media (pointer: coarse) {
  .ag-cbd-input {
    font-size: 16px;
  }
}
</style>
