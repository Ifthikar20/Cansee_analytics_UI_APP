<script setup>
// The inputs an agent needs, drafted into a task for a new chat
// (p2_contract.md 15d). The six specialists ask for their own inputs; the
// four general agents and the research agents start from a task template
// (lib/agent/taskTemplates TASK_FORMS) whose fields it shows. The dialog
// never sends anything: Open in chat hands the text to the composer through
// askAgent and the person reviews it there. Lists come from Cansee's own
// data; a list that fails keeps free entry where the field has it. A
// project switch while it is open starts it over, so a list of the previous
// project never shows.
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDown, CircleAlert } from '@lucide/vue'
import agentApi from '@/api/agent'
import insightsApi from '@/api/insights'
import { askAgent } from '@/lib/agent/askAgent'
import { agentBlock, allowanceLine, blockHelp, hidesDollars, researchPromptLimit } from '@/lib/agent/availability'
import {
  CHANNELS,
  CHANNEL_KEYS,
  FORM_FIELDS,
  PR_FORMATS,
  RESEARCH_AGENTS_KEY,
  entryAgentOf,
  fieldLabel,
  formTaskText,
  formTemplate,
  formTemplates,
  hasTaskForm,
  missingFields,
  taskText,
} from '@/lib/agent/taskTemplates'
import { domainOf, normalizeUrl, onSite } from '@/lib/agent/contextSections'
import { money } from '@/lib/analytics/countrySpecs'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { asList } from '@/components/agent/common/agentText'

const NOTES_MAX = 1000
const CLAIM_LABEL_MAX = 140

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  // agentList() entry {key, name, description}
  agent: { type: Object, default: null },
  websiteId: { type: String, default: null },
  // the project {name, url, competitors}
  website: { type: Object, default: null },
  // GET status/
  status: { type: Object, default: null },
  // The task template to start from (agents with TASK_FORMS); the first one
  // when empty or unknown.
  template: { type: String, default: '' },
})

const router = useRouter()

const key = computed(() => props.agent?.key || '')
const name = computed(() => props.agent?.name || 'agent')
const domain = computed(() => domainOf(props.website?.url || ''))
const brand = computed(() => props.website?.name || domain.value)
const competitors = computed(() =>
  (Array.isArray(props.website?.competitors) ? props.website.competitors : []).filter((c) => c && c.domain),
)

/* ── Fields ── */

const page = ref('')
const prompt = ref('')
const notes = ref('')
const competitor = ref('')
const theirUrl = ref('')
const channels = ref(['linkedin', 'x'])
const artifactId = ref('')
const format = ref('press_release')
const claimKey = ref('')
const pageError = ref('')
const theirError = ref('')
const sending = ref(false)

// Task templates (the four general agents and the research agents).
const hasForm = computed(() => hasTaskForm(key.value))
const templates = computed(() => formTemplates(key.value))
const templateKey = ref('')
const currentTemplate = computed(() => formTemplate(key.value, templateKey.value))
const templateFields = computed(() => (currentTemplate.value ? currentTemplate.value.fields.filter((f) => f !== 'notes') : []))
const form = reactive({ prompt: '', question: '', search: '', offering: '', cta: '', audience: '', region: '', url: '' })
const pickedCompetitors = ref([])
const urlError = ref('')

/* ── Lists ── */

function list() {
  return { state: 'idle', items: [] }
}

const pages = ref(list())
const prompts = ref(list())
const drafts = ref(list())
const claims = ref(list())
let token = 0

async function load(target, fetcher) {
  const mine = token
  target.value = { state: 'loading', items: target.value.items }
  try {
    const items = await fetcher()
    if (mine !== token) return
    target.value = { state: 'ready', items }
  } catch {
    if (mine !== token) return
    target.value = { state: 'error', items: [] }
  }
}

const loaders = {
  pages: () =>
    load(pages, async () => {
      const res = await insightsApi.pages(props.websiteId, { period: '30d', filter: 'all' })
      return asList(res?.data?.pages).filter((p) => p && p.url)
    }),
  prompts: () =>
    load(prompts, async () => {
      const res = await agentApi.trackedPrompts(props.websiteId)
      return asList(res?.data?.prompts).filter((p) => p && p.text)
    }),
  drafts: () =>
    load(drafts, async () => {
      const res = await agentApi.listArtifacts(props.websiteId, { kinds: ['document', 'page', 'report'] }, { _silentError: true })
      return asList(res?.data).filter((a) => a && a.id)
    }),
  claims: () =>
    load(claims, async () => {
      const res = await insightsApi.factCheck(props.websiteId, { period: '90d', verdict: 'contradicted' })
      return asList(res?.data?.claims).filter((c) => c && c.key)
    }),
}

const NEEDS = {
  page_optimizer: ['pages', 'prompts'],
  comparison_page: ['prompts'],
  social_posts: ['drafts'],
  pr_writer: ['claims'],
  [RESEARCH_AGENTS_KEY]: ['prompts'],
  gap_analyst: ['prompts'],
  landing_page: ['prompts'],
  aeo_article: ['prompts'],
}

function reset() {
  token += 1
  page.value = ''
  prompt.value = ''
  notes.value = ''
  competitor.value = competitors.value[0]?.domain || ''
  theirUrl.value = ''
  channels.value = ['linkedin', 'x']
  artifactId.value = ''
  format.value = 'press_release'
  claimKey.value = ''
  pageError.value = ''
  theirError.value = ''
  urlError.value = ''
  sending.value = false
  templateKey.value = formTemplate(key.value, props.template)?.key || ''
  for (const field of Object.keys(form)) form[field] = ''
  pickedCompetitors.value = competitors.value.map((c) => c.domain)
  pages.value = list()
  prompts.value = list()
  drafts.value = list()
  claims.value = list()
  if (props.websiteId) for (const what of NEEDS[key.value] || []) loaders[what]()
}

watch(
  open,
  (isOpen) => {
    if (isOpen) reset()
  },
  { immediate: true },
)

// Another project while open: its lists, competitors and page checks are
// that project's, so start over (a late answer of the old one is dropped).
watch(
  () => props.websiteId,
  (now, before) => {
    if (open.value && now !== before) reset()
  },
)

const pickedCompetitor = computed(() => competitors.value.find((c) => c.domain === competitor.value) || null)
const pickedDraft = computed(() => drafts.value.items.find((a) => String(a.id) === artifactId.value) || null)
const pickedClaim = computed(() => claims.value.items.find((c) => c.key === claimKey.value) || null)

function claimLabel(c) {
  const text = String(c.text || '')
  return text.length > CLAIM_LABEL_MAX ? `${text.slice(0, CLAIM_LABEL_MAX - 1).trimEnd()}…` : text
}

// A path picked from the list, a path typed by hand, or a full address.
function pageUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const known = pages.value.items.find((p) => p.path === value || p.url === value)
  if (known) return known.url
  if (value.startsWith('/') && domain.value) return `https://${domain.value}${value}`
  return normalizeUrl(value)
}

/* ── Cost and availability ── */

// Why this agent cannot run now ({title, action, setting}), or null.
const block = computed(() => agentBlock(key.value, props.status))
const unavailable = computed(() => block.value?.title || '')
const unavailableHelp = computed(() => blockHelp(block.value))
const maxPrompts = computed(() => researchPromptLimit(props.status))

// The research agents and the Gap Analyst have no writer request of their
// own: say what a research draws on (prompt runs, or the reply's ceiling).
const researchCostLine = computed(() => {
  if (key.value !== RESEARCH_AGENTS_KEY && key.value !== 'gap_analyst') return ''
  const s = props.status
  if (hidesDollars(s)) {
    const left = allowanceLine(s)
    return ['Each prompt answered by one AI engine uses one free prompt run.', left ? `${left}.` : ''].filter(Boolean).join(' ')
  }
  const cap = s?.limits?.run_cost_usd
  if (s?.allowance?.show_usd !== true || cap === undefined || cap === null || cap === '') return ''
  return `The whole reply, research included, stops at ${money(cap)}.`
})

const costLine = computed(() => {
  const s = props.status
  const max = s?.writers?.[key.value]?.max_usd
  const cap = s?.limits?.run_cost_usd
  if (max === undefined || max === null || cap === undefined || cap === null) return ''
  const head = `The ${name.value}'s own request costs at most ${money(max)} for a new draft; the whole reply, the agent's requests included, stops at ${money(cap)}.`
  const allowanceCap = Number(s?.allowance?.cap_usd)
  const spent = Number(s?.allowance?.spent_usd)
  // Cap 0 is an unlimited allowance: there is no amount left to state.
  if (!(allowanceCap > 0) || !Number.isFinite(spent)) return head
  return `${head} ${money(Math.max(0, allowanceCap - spent))} of AI allowance left this month.`
})

/* ── The drafted task ── */

const valid = computed(() => {
  if (hasForm.value) return missingFields(key.value, templateKey.value, formValues()).length === 0
  switch (key.value) {
    case 'page_optimizer':
      return Boolean(page.value.trim())
    case 'comparison_page':
      return Boolean(pickedCompetitor.value)
    case 'social_posts':
      return channels.value.length > 0 && (Boolean(pickedDraft.value) || Boolean(notes.value.trim()))
    case 'pr_writer':
      return format.value === 'correction_request' ? Boolean(pickedClaim.value) : Boolean(notes.value.trim())
    default:
      return true
  }
})

// The template's values: its fields, the tracked competitors ticked, and
// how many prompts one research covers.
function formValues() {
  return {
    ...form,
    url: form.url.trim() ? pageUrl(form.url) : '',
    notes: notes.value.trim().slice(0, NOTES_MAX),
    competitors: competitors.value.filter((c) => pickedCompetitors.value.includes(c.domain)),
    max_prompts: maxPrompts.value,
  }
}

const draftText = computed(() => (hasForm.value ? formTaskText(key.value, templateKey.value, formValues()) : ''))

function values() {
  const base = { notes: notes.value.trim().slice(0, NOTES_MAX), prompt: prompt.value.trim() }
  switch (key.value) {
    case 'page_optimizer':
      return { ...base, url: pageUrl(page.value) }
    case 'comparison_page':
      return {
        ...base,
        brand: brand.value,
        competitor: pickedCompetitor.value?.name || pickedCompetitor.value?.domain || '',
        domain: pickedCompetitor.value?.domain || '',
        url: normalizeUrl(theirUrl.value),
      }
    case 'social_posts':
      return {
        notes: base.notes,
        channels: CHANNEL_KEYS.filter((c) => channels.value.includes(c)),
        artifact_id: pickedDraft.value ? String(pickedDraft.value.id) : '',
        artifact_title: pickedDraft.value?.title || '',
      }
    case 'pr_writer': {
      if (format.value !== 'correction_request') return { format: format.value, notes: base.notes }
      const c = pickedClaim.value || {}
      const evidence = c.evidence || {}
      return {
        format: format.value,
        claim: c.text || '',
        key: c.key || '',
        evidence_label: evidence.kind === 'page' ? evidence.url || '' : 'brand fact',
        evidence_quote: evidence.quote || '',
      }
    }
    case 'llms_txt':
      return { notes: base.notes, domain: domain.value }
    case 'messaging_brief':
      return { notes: base.notes, brand: brand.value }
    default:
      return { starter: props.agent?.starter || '' }
  }
}

function check() {
  pageError.value = ''
  theirError.value = ''
  urlError.value = ''
  if (hasForm.value && templateFields.value.includes('url') && form.url.trim()) {
    const url = pageUrl(form.url)
    if (!url || (domain.value && !onSite(url, domain.value))) {
      urlError.value = `Use a page of ${domain.value || 'your site'}.`
      return false
    }
  }
  if (key.value === 'page_optimizer') {
    const url = pageUrl(page.value)
    if (!url || (domain.value && !onSite(url, domain.value))) {
      pageError.value = `Use a page of ${domain.value || 'your site'}.`
      return false
    }
  }
  if (key.value === 'comparison_page' && theirUrl.value.trim()) {
    const url = normalizeUrl(theirUrl.value)
    const theirs = pickedCompetitor.value?.domain || ''
    if (!url || (theirs && !onSite(url, theirs))) {
      theirError.value = `Use a page of ${theirs}.`
      return false
    }
  }
  return true
}

async function openInChat() {
  if (sending.value || !valid.value || unavailable.value || !check()) return
  sending.value = true
  try {
    const moved = await askAgent(router, {
      websiteId: props.websiteId,
      agent: entryAgentOf(key.value),
      from: 'agents',
      text: hasForm.value ? formTaskText(key.value, templateKey.value, formValues()) : taskText(key.value, values()),
    })
    if (moved) open.value = false
  } finally {
    sending.value = false
  }
}

const fieldId = (suffix) => `ag-atd-${key.value}-${suffix}`
const blankChat = computed(() =>
  props.websiteId ? { name: 'agent-home', params: { websiteId: props.websiteId }, query: { agent: entryAgentOf(key.value) } } : null,
)
</script>

<template>
  <AgDialog v-model:open="open" :title="name" :description="agent?.description || ''" wide>
    <form :id="fieldId('form')" class="ag-atd" novalidate @submit.prevent="openInChat">
      <!-- Task templates: the four general agents and the research agents -->
      <template v-if="hasForm">
        <fieldset class="ag-atd-group">
          <legend class="ag-atd-label">Start from</legend>
          <label v-for="t in templates" :key="t.key" class="ag-atd-template">
            <input
              v-model="templateKey"
              type="radio"
              :name="fieldId('template')"
              :value="t.key"
              :aria-describedby="fieldId(`template-${t.key}`)"
            />
            <span class="ag-atd-template-text">
              <span class="ag-atd-template-name">{{ t.label }}</span>
              <span :id="fieldId(`template-${t.key}`)" class="ag-atd-template-summary">{{ t.summary }}</span>
            </span>
          </label>
        </fieldset>

        <template v-for="field in templateFields" :key="`${templateKey}-${field}`">
          <fieldset v-if="FORM_FIELDS[field].kind === 'competitors'" class="ag-atd-group">
            <legend class="ag-atd-label">{{ fieldLabel(currentTemplate, field) }}</legend>
            <p v-if="!competitors.length" class="ag-atd-hint">
              Track competitors in Project settings first.
              <RouterLink :to="{ name: 'settings-project' }" class="ag-atd-link" @click="open = false">Project settings</RouterLink>
            </p>
            <label v-for="c in competitors" :key="c.domain" class="ag-atd-check">
              <input v-model="pickedCompetitors" type="checkbox" :value="c.domain" />
              <span>{{ c.name || c.domain }}</span>
            </label>
          </fieldset>
          <div v-else class="ag-atd-field">
            <label class="ag-atd-label" :for="fieldId(field)">{{ fieldLabel(currentTemplate, field) }}</label>
            <input
              :id="fieldId(field)"
              v-model="form[field]"
              class="ag-atd-input"
              :type="FORM_FIELDS[field].kind === 'url' ? 'url' : 'text'"
              :inputmode="FORM_FIELDS[field].kind === 'url' ? 'url' : undefined"
              :list="FORM_FIELDS[field].kind === 'prompt' ? fieldId('prompts') : undefined"
              autocomplete="off"
              :maxlength="FORM_FIELDS[field].max || undefined"
              :placeholder="FORM_FIELDS[field].kind === 'url' ? (domain ? `https://${domain}/` : 'https://') : undefined"
              :aria-invalid="FORM_FIELDS[field].kind === 'url' && urlError ? 'true' : undefined"
              :aria-describedby="FORM_FIELDS[field].kind === 'url' ? fieldId('url-hint') : undefined"
            />
            <template v-if="FORM_FIELDS[field].kind === 'prompt'">
              <datalist :id="fieldId('prompts')">
                <option v-for="p in prompts.items" :key="p.prompt_id || p.text" :value="p.text" />
              </datalist>
              <p v-if="prompts.state === 'ready' && prompts.items.length" class="ag-atd-hint">Pick one of your tracked prompts or type another.</p>
              <p v-else-if="prompts.state === 'error'" class="ag-atd-list-state">
                Couldn't load your tracked prompts.
                <button type="button" class="ag-atd-retry" @click="loaders.prompts()">Try again</button>
              </p>
            </template>
            <p v-if="FORM_FIELDS[field].kind === 'url'" :id="fieldId('url-hint')" class="ag-atd-hint" :class="{ 'is-error': urlError }">
              {{ urlError || `Use a page of ${domain || 'your site'}.` }}
            </p>
          </div>
        </template>
      </template>

      <!-- Page Optimizer -->
      <template v-if="key === 'page_optimizer'">
        <div class="ag-atd-field">
          <label class="ag-atd-label" :for="fieldId('page')">Page</label>
          <input
            :id="fieldId('page')"
            v-model="page"
            class="ag-atd-input"
            type="text"
            :list="fieldId('pages')"
            autocomplete="off"
            :placeholder="domain ? `https://${domain}/` : 'https://'"
            :aria-invalid="pageError ? 'true' : undefined"
            :aria-describedby="fieldId('page-hint')"
          />
          <datalist :id="fieldId('pages')">
            <option v-for="p in pages.items" :key="p.url" :value="p.path || p.url" />
          </datalist>
          <p :id="fieldId('page-hint')" class="ag-atd-hint" :class="{ 'is-error': pageError }">
            {{ pageError || `Use a page of ${domain || 'your site'}.` }}
          </p>
          <p v-if="pages.state === 'loading'" class="ag-atd-list-state"><AgSpinner :size="12" /> Loading</p>
          <p v-else-if="pages.state === 'error'" class="ag-atd-list-state">
            Couldn't load this list.
            <button type="button" class="ag-atd-retry" @click="loaders.pages()">Try again</button>
          </p>
        </div>
      </template>

      <!-- Comparison Page Agent -->
      <template v-if="key === 'comparison_page'">
        <div class="ag-atd-field">
          <label class="ag-atd-label" :for="fieldId('competitor')">Competitor</label>
          <p v-if="!competitors.length" class="ag-atd-hint">
            Track competitors in Project settings first.
            <RouterLink :to="{ name: 'settings-project' }" class="ag-atd-link" @click="open = false">Project settings</RouterLink>
          </p>
          <span v-else class="ag-atd-select">
            <select :id="fieldId('competitor')" v-model="competitor" class="ag-atd-input">
              <option v-for="c in competitors" :key="c.domain" :value="c.domain">{{ c.name || c.domain }}</option>
            </select>
            <ChevronDown class="ag-atd-select-icon" :size="14" aria-hidden="true" />
          </span>
        </div>
        <div v-if="competitors.length" class="ag-atd-field">
          <label class="ag-atd-label" :for="fieldId('their')">A page of theirs to read (optional)</label>
          <input
            :id="fieldId('their')"
            v-model="theirUrl"
            class="ag-atd-input"
            type="url"
            inputmode="url"
            autocomplete="off"
            :aria-invalid="theirError ? 'true' : undefined"
            :aria-describedby="fieldId('their-hint')"
          />
          <p :id="fieldId('their-hint')" class="ag-atd-hint" :class="{ 'is-error': theirError }">
            {{ theirError || `Use a page of ${pickedCompetitor?.domain || 'theirs'}.` }}
          </p>
        </div>
      </template>

      <!-- Target prompt (Page Optimizer, Comparison Page Agent) -->
      <div v-if="key === 'page_optimizer' || key === 'comparison_page'" class="ag-atd-field">
        <label class="ag-atd-label" :for="fieldId('prompt')">Target prompt (optional)</label>
        <input
          :id="fieldId('prompt')"
          v-model="prompt"
          class="ag-atd-input"
          type="text"
          :list="fieldId('prompts')"
          autocomplete="off"
          maxlength="300"
        />
        <datalist :id="fieldId('prompts')">
          <option v-for="p in prompts.items" :key="p.prompt_id || p.text" :value="p.text" />
        </datalist>
        <p v-if="prompts.state === 'error'" class="ag-atd-list-state">
          Couldn't load this list.
          <button type="button" class="ag-atd-retry" @click="loaders.prompts()">Try again</button>
        </p>
      </div>

      <!-- Social Posts Agent -->
      <template v-if="key === 'social_posts'">
        <fieldset class="ag-atd-group">
          <legend class="ag-atd-label">Channels</legend>
          <label v-for="c in CHANNEL_KEYS" :key="c" class="ag-atd-check">
            <input v-model="channels" type="checkbox" :value="c" />
            <span>{{ CHANNELS[c].label }}</span>
          </label>
        </fieldset>
        <div class="ag-atd-field">
          <label class="ag-atd-label" :for="fieldId('draft')">Promote a draft (optional)</label>
          <span class="ag-atd-select">
            <select :id="fieldId('draft')" v-model="artifactId" class="ag-atd-input" :disabled="drafts.state === 'loading'">
              <option value="">None</option>
              <option v-for="a in drafts.items" :key="a.id" :value="String(a.id)">{{ a.title || 'Untitled' }}</option>
            </select>
            <ChevronDown class="ag-atd-select-icon" :size="14" aria-hidden="true" />
          </span>
          <p v-if="drafts.state === 'error'" class="ag-atd-list-state">
            Couldn't load this list.
            <button type="button" class="ag-atd-retry" @click="loaders.drafts()">Try again</button>
          </p>
        </div>
      </template>

      <!-- PR Agent -->
      <template v-if="key === 'pr_writer'">
        <fieldset class="ag-atd-group">
          <legend class="ag-atd-label">What to write</legend>
          <label v-for="(label, value) in PR_FORMATS" :key="value" class="ag-atd-check">
            <input v-model="format" type="radio" :name="fieldId('format')" :value="value" />
            <span>{{ label }}</span>
          </label>
        </fieldset>
        <div v-if="format === 'correction_request'" class="ag-atd-field">
          <label class="ag-atd-label" :for="fieldId('claim')">Claim</label>
          <p v-if="claims.state === 'loading'" class="ag-atd-list-state"><AgSpinner :size="12" /> Loading</p>
          <p v-else-if="claims.state === 'error'" class="ag-atd-list-state">
            Couldn't load this list.
            <button type="button" class="ag-atd-retry" @click="loaders.claims()">Try again</button>
          </p>
          <p v-else-if="claims.state === 'ready' && !claims.items.length" class="ag-atd-hint">
            The Fact check found no contradicted claims in the last 90 days.
          </p>
          <span v-else class="ag-atd-select">
            <select :id="fieldId('claim')" v-model="claimKey" class="ag-atd-input">
              <option value="" disabled>Choose a claim</option>
              <option v-for="c in claims.items" :key="c.key" :value="c.key">{{ claimLabel(c) }}</option>
            </select>
            <ChevronDown class="ag-atd-select-icon" :size="14" aria-hidden="true" />
          </span>
        </div>
      </template>

      <!-- Free text: Topic, About or Focus -->
      <div v-if="key !== 'pr_writer' || format !== 'correction_request'" class="ag-atd-field">
        <label class="ag-atd-label" :for="fieldId('notes')">
          <template v-if="key === 'social_posts'">Topic</template>
          <template v-else-if="key === 'pr_writer'">About</template>
          <template v-else-if="hasForm">{{ fieldLabel(currentTemplate, 'notes') }}</template>
          <template v-else>Focus (optional)</template>
        </label>
        <textarea :id="fieldId('notes')" v-model="notes" class="ag-atd-input ag-atd-area" rows="3" :maxlength="NOTES_MAX" />
      </div>

      <div v-if="hasForm && draftText" class="ag-atd-preview">
        <p :id="fieldId('preview-label')" class="ag-atd-label">Drafted message</p>
        <p class="ag-atd-preview-text" :aria-labelledby="fieldId('preview-label')">{{ draftText }}</p>
        <p class="ag-atd-hint">It opens in a new chat for you to review and send. Nothing runs until you send it.</p>
      </div>

      <p v-if="costLine" class="ag-atd-cost">{{ costLine }}</p>
      <p v-if="researchCostLine" class="ag-atd-cost">{{ researchCostLine }}</p>
      <p v-if="unavailable" class="ag-atd-unavailable" role="status">
        <CircleAlert :size="14" aria-hidden="true" />
        <span>
          <span class="ag-atd-unavailable-title">{{ unavailable }}</span>
          <span v-if="unavailableHelp" class="ag-atd-unavailable-help">{{ unavailableHelp }}</span>
        </span>
      </p>
    </form>

    <template #actions>
      <AgButton v-if="hasForm && blankChat && !unavailable" variant="ghost" :to="blankChat" class="ag-atd-blank" @click="open = false">
        Blank chat
      </AgButton>
      <AgButton @click="open = false">Cancel</AgButton>
      <AgButton
        type="submit"
        :form="fieldId('form')"
        variant="primary"
        :loading="sending"
        :disabled="!valid || Boolean(unavailable) || !websiteId"
      >
        Open in chat
      </AgButton>
    </template>
  </AgDialog>
</template>

<style scoped>
.ag-atd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ag-atd-field,
.ag-atd-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.ag-atd-label {
  margin: 0 0 2px;
  padding: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-atd-input {
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

.ag-atd-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: 8px;
  outline: none;
}

.ag-atd-input[aria-invalid='true'] {
  border-color: var(--ag-danger);
}

.ag-atd-area {
  min-height: 72px;
  resize: vertical;
}

.ag-atd-select {
  position: relative;
  display: block;
}

.ag-atd-select select {
  padding-right: 32px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.ag-atd-select-icon {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-atd-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.ag-atd-check input {
  accent-color: var(--ag-accent);
}

.ag-atd-hint,
.ag-atd-list-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 18px;
}

.ag-atd-hint.is-error {
  color: var(--ag-danger);
}

.ag-atd-link,
.ag-atd-retry {
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

.ag-atd-cost {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-atd-template {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--ag-card-border);
  border-radius: 8px;
  cursor: pointer;
}

.ag-atd-template:has(input:checked) {
  border-color: color-mix(in srgb, var(--ag-accent) 55%, var(--ag-card-border));
  background: var(--ag-row-active);
}

.ag-atd-template input {
  margin: 3px 0 0;
  accent-color: var(--ag-accent);
}

.ag-atd-template-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ag-atd-template-name {
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-atd-template-summary {
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 18px;
}

.ag-atd-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ag-atd-preview-text {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--ag-bubble-bg);
  color: var(--ag-fg-1b);
  font-size: 13px;
  line-height: 19px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-atd-blank {
  margin-right: auto;
}

.ag-atd-unavailable-title,
.ag-atd-unavailable-help {
  display: block;
}

.ag-atd-unavailable-help {
  color: var(--ag-fg-3);
}

.ag-atd-unavailable {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ag-warning);
  font-size: 13px;
  line-height: 19px;
}

@media (pointer: coarse) {
  .ag-atd-input {
    font-size: 16px;
  }
}
</style>
