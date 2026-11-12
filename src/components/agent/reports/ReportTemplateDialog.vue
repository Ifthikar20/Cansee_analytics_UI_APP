<script setup>
// "Use template": what the template's report covers and needs, the
// prompts (and, for the comparison, competitors) it should cover, then a
// new chat with the request drafted in its composer and the template set
// for its first reply (askAgent ?template=). Nothing is sent from here:
// the person reviews the draft and sends it.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CircleAlert } from '@lucide/vue'
import agentApi from '@/api/agent'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { asList } from '@/components/agent/common/agentText'
import { regionName } from '@/components/agent/browser/format'
import { askAgent } from '@/lib/agent/askAgent'
import { domainOf } from '@/lib/agent/contextSections'
import { draftText, promptRunsLine } from '@/lib/agent/reportTemplates'

// The agent the Reports page hands research to (AgentArtifactsPage).
const REPORT_AGENT = 'gap_analyst'
const MAX_COMPETITORS = 3

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  // A template of lib/agent/reportTemplates.
  template: { type: Object, default: null },
  websiteId: { type: String, default: null },
  // The project {name, url, competitors}.
  website: { type: Object, default: null },
  // GET status/ prompt_runs, for the free plan's line.
  promptRuns: { type: Object, default: null },
})

const router = useRouter()

const id = computed(() => props.template?.id || '')
const picks = computed(() => props.template?.prompts || { min: 0, max: 0 })
const brand = computed(() => props.website?.name || domainOf(props.website?.url || ''))
const competitors = computed(() =>
  (Array.isArray(props.website?.competitors) ? props.website.competitors : []).filter(
    (c) => c && (c.name || c.domain)
  )
)
const wantsCompetitors = computed(() => (props.template?.header_fields || []).includes('competitors'))

const prompts = ref({ state: 'idle', items: [] })
const picked = ref([])
const pickedCompetitors = ref([])
const sending = ref(false)
let token = 0

async function loadPrompts() {
  const mine = ++token
  const wid = props.websiteId
  if (!wid || !(picks.value.max > 0)) {
    prompts.value = { state: 'idle', items: [] }
    return
  }
  prompts.value = { state: 'loading', items: [] }
  try {
    const res = await agentApi.trackedPrompts(wid)
    // A reply for another project, or for an older opening, is dropped.
    if (mine !== token || wid !== props.websiteId) return
    const seen = new Set()
    const items = asList(res?.data?.prompts)
      .filter((p) => p && typeof p.text === 'string' && p.text.trim())
      .map((p) => ({ id: String(p.prompt_id ?? p.id ?? p.text), text: p.text.trim(), location: p.location || '' }))
      .filter((p) => !seen.has(p.id) && seen.add(p.id))
    prompts.value = { state: 'ready', items }
  } catch {
    if (mine !== token || wid !== props.websiteId) return
    prompts.value = { state: 'error', items: [] }
  }
}

function reset() {
  picked.value = []
  pickedCompetitors.value = []
  sending.value = false
  loadPrompts()
}

watch(
  open,
  (isOpen) => {
    if (isOpen) reset()
    else token += 1
  },
  { immediate: true }
)

// Another project while open: its own prompts, nothing picked.
watch(
  () => props.websiteId,
  () => {
    if (open.value) reset()
  }
)

const single = computed(() => picks.value.max === 1)
const atMax = computed(() => picks.value.max > 0 && picked.value.length >= picks.value.max)

function togglePrompt(promptId, checked) {
  if (single.value) {
    picked.value = checked ? [promptId] : []
    return
  }
  if (checked && !picked.value.includes(promptId) && !atMax.value) picked.value = [...picked.value, promptId]
  if (!checked) picked.value = picked.value.filter((p) => p !== promptId)
}

function toggleCompetitor(key, checked) {
  const list = pickedCompetitors.value
  if (checked && !list.includes(key) && list.length < MAX_COMPETITORS) pickedCompetitors.value = [...list, key]
  if (!checked) pickedCompetitors.value = list.filter((c) => c !== key)
}

const competitorKey = (c) => c.domain || c.name

const unavailable = computed(() => (props.template && !props.template.available ? props.template.unavailable : null))

// The deep dive covers one tracked prompt: with prompts listed, one must be
// picked; with none tracked it cannot start. When the list failed, the
// agent asks which prompt in the chat.
const needsPrompt = computed(() => picks.value.min > 0 && picked.value.length < picks.value.min)
const blockedReason = computed(() => {
  if (unavailable.value) return unavailable.value.message
  if (!props.websiteId) return 'Pick a project first.'
  if (picks.value.min > 0 && prompts.value.state === 'ready' && !prompts.value.items.length) {
    return 'Track a prompt first: this report covers one tracked prompt.'
  }
  return ''
})
const canOpen = computed(
  () =>
    Boolean(props.template) &&
    !blockedReason.value &&
    !sending.value &&
    prompts.value.state !== 'loading' &&
    !(needsPrompt.value && prompts.value.state === 'ready')
)

const pickHint = computed(() => {
  const { min, max } = picks.value
  if (max === 1) return 'Pick the prompt this report covers.'
  const limit = `Pick up to ${max}.`
  return min > 0 ? limit : `${limit} With none picked, the agent picks from your tracked prompts.`
})

const runsLine = computed(() => promptRunsLine(props.template, props.promptRuns))

async function openInChat() {
  if (!canOpen.value) return
  sending.value = true
  try {
    const chosen = picked.value
      .map((p) => prompts.value.items.find((item) => item.id === p))
      .filter(Boolean)
    const rivals = wantsCompetitors.value
      ? pickedCompetitors.value.map((key) => competitors.value.find((c) => competitorKey(c) === key)).filter(Boolean)
      : []
    const moved = await askAgent(router, {
      websiteId: props.websiteId,
      agent: REPORT_AGENT,
      from: 'reports',
      template: id.value,
      text: draftText(id.value, { brand: brand.value, prompts: chosen, competitors: rivals }),
    })
    if (moved) open.value = false
  } finally {
    sending.value = false
  }
}

const fieldId = (suffix) => `ag-rtd-${id.value}-${suffix}`
</script>

<template>
  <AgDialog v-model:open="open" :title="template ? template.name : 'Report template'" :description="template?.purpose || ''" wide>
    <form v-if="template" :id="fieldId('form')" class="ag-rtd" novalidate @submit.prevent="openInChat">
      <section class="ag-rtd-block" :aria-labelledby="fieldId('sections')">
        <h3 :id="fieldId('sections')" class="ag-rtd-label">The report's sections</h3>
        <ol class="ag-rtd-sections">
          <li v-for="(section, i) in template.sections" :key="`${i}-${section.title}`">
            <span class="ag-rtd-section-title">
              {{ section.repeat === 'prompt' ? 'One section per prompt' : section.title }}
            </span>
            <span v-if="section.shows" class="ag-rtd-section-shows">{{ section.shows }}</span>
          </li>
        </ol>
      </section>

      <p class="ag-rtd-note">{{ template.requirements.note }}</p>
      <p v-if="runsLine" class="ag-rtd-note">{{ runsLine }}</p>

      <ul v-if="template.limitations.length" class="ag-rtd-limits" :aria-label="`What ${template.name} will report as not set up`">
        <li v-for="(l, i) in template.limitations" :key="`${l.code}-${i}`">
          {{ l.message }}<span v-if="l.setting" class="ag-rtd-setting"> Setting: {{ l.setting }}</span>
        </li>
      </ul>

      <fieldset v-if="picks.max > 0" class="ag-rtd-block ag-rtd-fieldset" :aria-describedby="fieldId('pick-hint')">
        <legend class="ag-rtd-label">{{ single ? 'Prompt' : 'Prompts' }}</legend>
        <p :id="fieldId('pick-hint')" class="ag-rtd-hint">{{ pickHint }}</p>
        <p v-if="prompts.state === 'loading'" class="ag-rtd-hint" role="status"><AgSpinner :size="12" /> Loading your prompts</p>
        <p v-else-if="prompts.state === 'error'" class="ag-rtd-hint">
          Couldn't load your tracked prompts.{{ picks.min > 0 ? ' The agent asks which prompt to cover.' : '' }}
          <button type="button" class="ag-rtd-retry" @click="loadPrompts()">Try again</button>
        </p>
        <p v-else-if="prompts.state === 'ready' && !prompts.items.length" class="ag-rtd-hint">
          This project has no tracked prompts yet.
        </p>
        <ul v-else-if="prompts.items.length" class="ag-rtd-choices">
          <li v-for="p in prompts.items" :key="p.id">
            <label class="ag-rtd-check">
              <input
                :type="single ? 'radio' : 'checkbox'"
                :name="fieldId('prompt')"
                :value="p.id"
                :checked="picked.includes(p.id)"
                :disabled="!single && atMax && !picked.includes(p.id)"
                @change="togglePrompt(p.id, $event.target.checked)"
              />
              <span>
                {{ p.text }}
                <span v-if="regionName(p.location)" class="ag-rtd-muted">· {{ regionName(p.location) }}</span>
              </span>
            </label>
          </li>
        </ul>
      </fieldset>

      <fieldset v-if="wantsCompetitors" class="ag-rtd-block ag-rtd-fieldset" :aria-describedby="fieldId('rival-hint')">
        <legend class="ag-rtd-label">Competitors</legend>
        <p :id="fieldId('rival-hint')" class="ag-rtd-hint">
          {{
            competitors.length
              ? `Pick up to ${MAX_COMPETITORS}. With none picked, the agent uses your tracked competitors.`
              : 'This project tracks no competitors yet. Add them in Project settings.'
          }}
        </p>
        <ul v-if="competitors.length" class="ag-rtd-choices">
          <li v-for="c in competitors" :key="competitorKey(c)">
            <label class="ag-rtd-check">
              <input
                type="checkbox"
                :value="competitorKey(c)"
                :checked="pickedCompetitors.includes(competitorKey(c))"
                :disabled="pickedCompetitors.length >= MAX_COMPETITORS && !pickedCompetitors.includes(competitorKey(c))"
                @change="toggleCompetitor(competitorKey(c), $event.target.checked)"
              />
              <span>
                {{ c.name || c.domain }}
                <span v-if="c.name && c.domain" class="ag-rtd-muted">· {{ c.domain }}</span>
              </span>
            </label>
          </li>
        </ul>
      </fieldset>

      <p v-if="blockedReason" class="ag-rtd-unavailable" role="status">
        <CircleAlert :size="14" aria-hidden="true" />
        <span>
          {{ blockedReason }}
          <span v-if="unavailable && unavailable.setting" class="ag-rtd-setting"> Setting: {{ unavailable.setting }}</span>
        </span>
      </p>
      <p v-else class="ag-rtd-hint">The request opens in a new chat. Review it there, then send.</p>
    </form>

    <template #actions>
      <AgButton @click="open = false">Cancel</AgButton>
      <AgButton type="submit" :form="fieldId('form')" variant="primary" :loading="sending" :disabled="!canOpen">
        Open in chat
      </AgButton>
    </template>
  </AgDialog>
</template>

<style scoped>
.ag-rtd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ag-rtd-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
}

.ag-rtd-fieldset {
  padding: 0;
  border: 0;
}

.ag-rtd-label {
  margin: 0 0 2px;
  padding: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-rtd-sections {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 20px;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtd-section-title {
  display: block;
  font-weight: 500;
}

.ag-rtd-section-shows,
.ag-rtd-muted {
  color: var(--ag-fg-3);
}

.ag-rtd-note,
.ag-rtd-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtd-limits {
  margin: 0;
  padding-left: 18px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtd-setting {
  color: var(--ag-fg-3);
  font-family: var(--ag-font-mono);
  font-size: 12px;
}

.ag-rtd-choices {
  display: grid;
  gap: 6px;
  max-height: 220px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.ag-rtd-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.ag-rtd-check input {
  margin-top: 3px;
  accent-color: var(--ag-accent);
}

.ag-rtd-check input:disabled + span {
  color: var(--ag-fg-disabled);
}

.ag-rtd-check input:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-rtd-retry {
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

.ag-rtd-retry:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-rtd-unavailable {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ag-warning);
  font-size: 13px;
  line-height: 19px;
}
</style>
