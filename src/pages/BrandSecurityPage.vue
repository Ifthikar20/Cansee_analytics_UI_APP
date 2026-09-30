<script setup>
/**
 * Brand Security alert center.
 *
 * Findings-first: the response auditor reads every stored LLM answer
 * (audits, prompt runs, chat checks) as it lands and raises findings with
 * exact flagged phrases — there is no scan for the user to trigger, and
 * no settings surface here (brand terms are read from config behind the
 * scenes; reference material lives on Brand Input). This page is the
 * queue: a plain protection-summary line, category chips and filters
 * over a flat alert table, and a right-side drawer for one finding.
 * Filter state lives in the URL so a filtered view — or one specific
 * finding via ?alert=BSA-... — is shareable.
 *
 * The one control that does live here is the Brand Pulse agent card:
 * an autonomous per-project monitor that digests what changed (scans,
 * AI answers, security alerts) to the user's connected Slack/Discord
 * and can queue research scans on its own.
 */
import { computed, reactive, ref, watch } from 'vue'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, BookOpen, ArrowRight, Search, X, Radar } from '@lucide/vue'

import { useAppStore } from '@/stores/app'
import { useBrandSecurityStore } from '@/stores/brandSecurity'
import { useToast } from '@/composables/useToast'
import brandSecurity from '@/api/brandSecurity'
import integrationsApi from '@/api/integrations'
import ragApi from '@/api/rag'
import { timeAgo } from '@/utils/timeAgo'
import { SOURCE_LABELS, categoryForAlert } from '@/constants/detectors'
import { compareSeverity } from '@/constants/severity'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AlertsTable from '@/components/brand_security/AlertsTable.vue'
import SecurityPerceptionPanel from '@/components/brand_security/SecurityPerceptionPanel.vue'
import AlertDetailSheet from '@/components/brand_security/AlertDetailSheet.vue'
import CategoryChips from '@/components/brand_security/CategoryChips.vue'
import ProtectionSummary from '@/components/brand_security/ProtectionSummary.vue'
import ChatDetailModal from '@/components/ChatDetailModal.vue'

const appStore = useAppStore()
const store = useBrandSecurityStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const websiteId = computed(() => appStore.activeWebsite?.id || null)

// ── Views ───────────────────────────────────────────────────────────────
// "findings" is the alert queue; "perception" is the security-perception
// dashboard. URL-synced (?view=perception) so the tab is shareable.
const VIEWS = ['findings', 'perception']
const view = ref(VIEWS.includes(route.query.view) ? route.query.view : 'findings')

watch(view, (v) => {
  router.replace({ query: { ...route.query, view: v === 'findings' ? undefined : v } })
})

// A detector chip on the perception panel jumps to the queue, scoped to
// the security category so the reader lands on the relevant findings.
function showSecurityFindings() {
  filter.category = 'security'
  filter.status = 'open'
  view.value = 'findings'
  syncQuery()
  loadAlerts()
}

const alerts = ref([])
const config = ref({ brand_terms: [], negative_keywords: [] })
const loadingAlerts = ref(false)

// null = not loaded yet; 0 = first visit, no reference content ingested.
const brandSourcesTotal = ref(null)

// Drawer + conversation modal state.
const selected = ref(null)
const chatResultId = ref('')
const chatOpen = ref(false)

// ── Filters (URL-synced) ────────────────────────────────────────────────

const filter = reactive({
  status: 'open',
  severity: '',
  category: '',
  source: '',
  q: '',
  sort: 'newest',
})
const promptScope = ref('')

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' },
]

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'severity', label: 'Severity' },
]

const FILTER_DEFAULTS = { status: 'open', severity: '', category: '', source: '', q: '', sort: 'newest' }

function initFromQuery() {
  const q = route.query
  filter.status = typeof q.status === 'string' ? q.status : 'open'
  filter.severity = typeof q.severity === 'string' ? q.severity : ''
  filter.category = typeof q.category === 'string' ? q.category : ''
  filter.source = typeof q.source === 'string' ? q.source : ''
  filter.q = typeof q.q === 'string' ? q.q : ''
  filter.sort = typeof q.sort === 'string' ? q.sort : 'newest'
  promptScope.value = typeof q.prompt === 'string' ? q.prompt : ''
}

// Mirror filter state into the URL, omitting defaults so clean views get
// clean links. router.replace: filter changes are not history entries.
function syncQuery(extra = {}) {
  const query = { ...route.query }
  for (const [key, fallback] of Object.entries(FILTER_DEFAULTS)) {
    const value = filter[key]
    query[key] = value !== fallback ? value : undefined
  }
  query.prompt = promptScope.value || undefined
  Object.assign(query, extra)
  router.replace({ query })
}

// ── Data loading ────────────────────────────────────────────────────────

async function initPage() {
  initFromQuery()
  await Promise.all([
    store.loadTaxonomy(),
    loadConfig(),
    loadBrandSourceStats(),
    loadPulse(),
    loadChatChannels(),
    store.refreshOverview(websiteId.value),
    loadAlerts(),
  ])
  await openDeepLinkedAlert()
}

onMounted(() => {
  if (websiteId.value) initPage()
})
watch(websiteId, (v) => {
  if (v) initPage()
})

async function loadAlerts() {
  loadingAlerts.value = true
  try {
    // URLSearchParams so multi-value keys serialize as repeated bare keys
    // (detector_code=a&detector_code=b) — what DRF's getlist() reads.
    // Axios' default array serialization (detector_code[]=a) would be
    // ignored by the backend.
    const params = new URLSearchParams()
    if (filter.status) params.append('status', filter.status)
    if (filter.severity) params.append('severity', filter.severity)
    if (filter.source) params.append('source', filter.source)
    if (filter.category) {
      // Category chips expand to detector codes via the taxonomy, the
      // same shape as the old capture-type -> issue expansion. Without a
      // taxonomy (fetch failed) the category filter falls back to
      // client-side filtering in displayAlerts.
      for (const code of store.detectorCodesForCategory(filter.category)) {
        params.append('detector_code', code)
      }
    }
    if (promptScope.value) params.append('source_prompt', promptScope.value)
    if (filter.sort === 'oldest') params.append('ordering', 'detected_at')
    else if (filter.sort === 'severity') params.append('ordering', 'severity')
    const { data } = await brandSecurity.alerts(websiteId.value, params)
    alerts.value = data.results || data
  } catch {
    toast.error('Failed to load findings')
  } finally {
    loadingAlerts.value = false
  }
}

async function loadConfig() {
  try {
    const { data } = await brandSecurity.config(websiteId.value)
    config.value = data
  } catch {
    /* config lazily created — ignore */
  }
}

// The first-visit guide keys off whether any reference content exists in
// the RAG knowledge base. One source is enough to consider setup done.
async function loadBrandSourceStats() {
  try {
    const res = await ragApi.listSources(websiteId.value, { page: 1, page_size: 1 })
    brandSourcesTotal.value = res.meta?.stats?.total ?? (res.data?.length || 0)
  } catch {
    // Unknown — do not block the page on the guide check.
    brandSourcesTotal.value = null
  }
}

const isFirstVisit = computed(() => brandSourcesTotal.value === 0)

// ── Brand Pulse agent ───────────────────────────────────────────────────

const pulse = reactive({
  enabled: false,
  auto_scan: false,
  frequency: 'daily',
  last_digest_at: null,
  last_scan_queued_at: null,
})
// The card renders only once the config has loaded, so a backend without
// the pulse endpoint (or a failed fetch) leaves the page exactly as it was.
const pulseLoaded = ref(false)
const pulseSaving = ref(false)

async function loadPulse() {
  pulseLoaded.value = false
  try {
    const { data } = await brandSecurity.pulse(websiteId.value)
    Object.assign(pulse, data)
    pulseLoaded.value = true
  } catch {
    /* pulse config unavailable — keep the card hidden */
  }
}

// Persist one field per interaction, optimistically (same shape as
// applyStatus below): flip locally, revert on failure.
async function savePulseField(patch) {
  const previous = { ...pulse }
  Object.assign(pulse, patch)
  pulseSaving.value = true
  try {
    const { data } = await brandSecurity.savePulse(websiteId.value, patch)
    Object.assign(pulse, data)
    toast.success('Brand Pulse settings saved')
  } catch {
    Object.assign(pulse, previous)
    toast.error('Could not save Brand Pulse settings')
  } finally {
    pulseSaving.value = false
  }
}

// Where digests land. null = unknown (listing failed) — fall back to the
// static explainer; [] = nothing connected — nudge towards Integrations.
const chatChannels = ref(null)

async function loadChatChannels() {
  try {
    const res = await integrationsApi.list()
    // Notifications endpoints double-wrap: the unwrapped payload is
    // itself {data: [...]} (see IntegrationsPage).
    const saved = res.data?.data || []
    const labels = { slack: 'Slack', discord: 'Discord', teams: 'Microsoft Teams' }
    chatChannels.value = saved
      .filter((c) => c.is_active && labels[c.platform])
      .map((c) => labels[c.platform])
  } catch {
    chatChannels.value = null
  }
}

// Terms highlighted in evidence panels: the configured brand terms plus
// the website's own name, so brand mentions light up even before any
// monitoring terms have been added.
const highlightBrandTerms = computed(() => {
  const terms = [...(config.value.brand_terms || [])]
  const name = appStore.activeWebsite?.name
  if (name && !terms.some((t) => t.toLowerCase() === name.toLowerCase())) {
    terms.push(name)
  }
  return terms
})

// ── Derived list (client-side search + fallbacks) ───────────────────────

const displayAlerts = computed(() => {
  let rows = alerts.value
  if (filter.category && store.taxonomyFailed) {
    rows = rows.filter(
      (a) => categoryForAlert(a, store.detectorByCode).key === filter.category,
    )
  }
  const needle = filter.q.trim().toLowerCase()
  if (needle) {
    rows = rows.filter((a) =>
      [a.title, a.reference, a.detector_code, a.snippet, a.prompt_text, a.detail]
        .some((v) => v && String(v).toLowerCase().includes(needle)),
    )
  }
  if (filter.sort === 'severity') {
    // Server already ordered by severity; re-assert for client-filtered
    // lists so search results keep the severity-first reading order.
    rows = [...rows].sort(compareSeverity)
  }
  return rows
})

const isFiltered = computed(() =>
  Boolean(filter.severity || filter.category || filter.source || filter.q || promptScope.value),
)

// ── Filter actions ──────────────────────────────────────────────────────

function setFilter(key, value) {
  filter[key] = value
  syncQuery()
  if (key !== 'q') loadAlerts()
}

function toggleSeverity(sev) {
  setFilter('severity', filter.severity === sev ? '' : sev)
}

function toggleCategory(key) {
  setFilter('category', filter.category === key ? '' : key)
}

function clearFilters() {
  filter.severity = ''
  filter.category = ''
  filter.source = ''
  filter.q = ''
  promptScope.value = ''
  syncQuery()
  loadAlerts()
}

function clearPromptScope() {
  promptScope.value = ''
  syncQuery()
  loadAlerts()
}

// ── Drawer + deep links ─────────────────────────────────────────────────

function openAlert(alert) {
  selected.value = alert
  syncQuery({ alert: alert.reference || undefined })
}

function closeAlert() {
  selected.value = null
  syncQuery({ alert: undefined })
}

// ?alert=BSA-... opens the drawer on load: prefer the already-loaded
// list, fall back to an exact reference fetch (the alert may not match
// the current filters).
async function openDeepLinkedAlert() {
  const reference = route.query.alert
  if (typeof reference !== 'string' || !reference) return
  const local = alerts.value.find(
    (a) => (a.reference || '').toLowerCase() === reference.toLowerCase(),
  )
  if (local) {
    selected.value = local
    return
  }
  try {
    const { data } = await brandSecurity.alerts(websiteId.value, { reference })
    const rows = data.results || data
    if (rows.length) selected.value = rows[0]
  } catch {
    /* stale link — leave the queue as-is */
  }
}

function viewConversation(resultPublicId) {
  chatResultId.value = resultPublicId
  chatOpen.value = true
}

// ── Workflow actions (optimistic) ───────────────────────────────────────

async function applyStatus(alert, nextStatus, apiCall) {
  const previous = alert.status
  alert.status = nextStatus
  if (filter.status && filter.status !== nextStatus) {
    alerts.value = alerts.value.filter((a) => a.id !== alert.id)
  }
  try {
    await apiCall(alert.id)
    toast.success(`${nextStatus === 'resolved' ? 'Resolved' : 'Dismissed'} · ${alert.reference || 'finding'}`)
    store.refreshOverview(websiteId.value)
  } catch {
    alert.status = previous
    await loadAlerts()
    toast.error('Could not update finding')
  }
}

function resolveAlert(alert) {
  applyStatus(alert, 'resolved', brandSecurity.resolveAlert)
}
function dismissAlert(alert) {
  applyStatus(alert, 'dismissed', brandSecurity.dismissAlert)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- ── Header / breadcrumb row ── -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <span class="font-medium text-foreground">AI Visibility</span>
        <ChevronRight class="size-3.5" />
        <span class="font-semibold text-foreground">Brand Security</span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="view === 'findings'" class="text-xs text-muted-foreground">
          Findings appear automatically as prompt runs complete
        </span>
        <Tabs v-model="view">
          <TabsList>
            <TabsTrigger value="findings">Findings</TabsTrigger>
            <TabsTrigger value="perception">Security perception</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>

    <!-- ── Security perception dashboard ── -->
    <SecurityPerceptionPanel
      v-if="view === 'perception'"
      :website-id="websiteId || ''"
      @show-findings="showSecurityFindings"
    />

    <template v-else>
    <!-- ── First-visit guide: no reference content yet ── -->
    <Card v-if="isFirstVisit" class="border-dashed">
      <CardContent class="pt-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="rounded-lg bg-secondary p-2.5">
              <BookOpen class="size-5 text-foreground" />
            </div>
            <div>
              <h2 class="text-base font-bold text-foreground">Start by teaching us your brand</h2>
              <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
                Before we can tell you what is wrong out there, we need to know what is right.
                Add your site pages, docs, or paste brand copy on the Brand Ingestion page — that
                reference content is the benchmark every finding on this page is checked against.
              </p>
            </div>
          </div>
          <router-link :to="`/llm-ranking/${websiteId}/brand-input`">
            <Button>
              Add reference content
              <ArrowRight class="size-3.5" />
            </Button>
          </router-link>
        </div>
      </CardContent>
    </Card>

    <!-- ── Protection summary ── -->
    <ProtectionSummary
      :overview="store.overview"
      :loading="store.overviewLoading"
      :active-severity="filter.severity"
      @filter-severity="toggleSeverity"
    />

    <!-- ── Brand Pulse agent ── -->
    <Card v-if="pulseLoaded">
      <CardContent class="pt-6">
        <div class="flex items-start gap-3">
          <button
            type="button"
            role="switch"
            :aria-checked="pulse.enabled"
            :disabled="pulseSaving"
            class="mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
            :class="pulse.enabled ? 'bg-[color:var(--chart-2)]' : 'bg-input'"
            @click="savePulseField({ enabled: !pulse.enabled })"
          >
            <span
              class="inline-block size-4 transform rounded-full bg-background shadow-sm transition-transform"
              :class="pulse.enabled ? 'translate-x-4' : 'translate-x-0.5'"
            />
          </button>
          <div class="flex-1">
            <div class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Radar class="size-4" />
              Brand Pulse agent
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Watches your brand across research scans, AI answers, and security alerts, and
              posts what changed to your connected Slack or Discord.
            </p>

            <div v-if="pulse.enabled" class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
              <div class="flex flex-col gap-1">
                <label
                  for="bs-pulse-frequency"
                  class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >Frequency</label>
                <select
                  id="bs-pulse-frequency"
                  :value="pulse.frequency"
                  :disabled="pulseSaving"
                  class="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  @change="savePulseField({ frequency: $event.target.value })"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div class="flex items-center gap-2 self-end pb-2">
                <button
                  type="button"
                  role="switch"
                  :aria-checked="pulse.auto_scan"
                  :disabled="pulseSaving"
                  class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
                  :class="pulse.auto_scan ? 'bg-[color:var(--chart-2)]' : 'bg-input'"
                  @click="savePulseField({ auto_scan: !pulse.auto_scan })"
                >
                  <span
                    class="inline-block size-4 transform rounded-full bg-background shadow-sm transition-transform"
                    :class="pulse.auto_scan ? 'translate-x-4' : 'translate-x-0.5'"
                  />
                </button>
                <span class="text-xs font-medium text-foreground">Run research scans automatically</span>
              </div>
            </div>

            <p v-if="pulse.enabled" class="mt-2.5 text-xs text-muted-foreground">
              <span class="font-medium text-foreground">Last digest:</span>
              <template v-if="pulse.last_digest_at">
                {{ timeAgo(pulse.last_digest_at) }}
              </template>
              <template v-else>
                Never — the first digest goes out at the next scheduled run.
              </template>
              <template v-if="pulse.auto_scan && pulse.last_scan_queued_at">
                · Last scan queued: {{ timeAgo(pulse.last_scan_queued_at) }}
              </template>
            </p>

            <p v-if="chatChannels && chatChannels.length" class="mt-1.5 text-xs text-muted-foreground">
              Delivers to: {{ chatChannels.join(', ') }}
            </p>
            <p v-else-if="chatChannels" class="mt-1.5 text-xs text-muted-foreground">
              No chat connection yet — digests will arrive as in-app notifications.
              <router-link
                to="/app/integrations"
                class="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
              >Connect one in Integrations</router-link>.
            </p>
            <p v-else class="mt-1.5 text-xs text-muted-foreground">
              Digests go to your connected Slack or Discord — manage connections in
              <router-link
                to="/app/integrations"
                class="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
              >Integrations</router-link>.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-col gap-4">
      <CategoryChips
        :categories="store.categories"
        :active-category="filter.category"
        @filter-category="toggleCategory"
      />

      <Card>
          <CardContent class="pt-6">
            <!-- Toolbar -->
            <div class="mb-4 flex flex-wrap items-end gap-3">
              <!-- Search -->
              <div class="flex min-w-56 flex-1 flex-col gap-1">
                <label
                  for="bs-search"
                  class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >Search</label>
                <div class="relative">
                  <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="bs-search"
                    :value="filter.q"
                    type="search"
                    placeholder="Search title, reference, detector code..."
                    class="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    @input="setFilter('q', $event.target.value)"
                  />
                </div>
              </div>

              <!-- Status segmented control -->
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                <div class="flex rounded-lg border border-border bg-background p-0.5">
                  <button
                    v-for="opt in STATUS_OPTIONS"
                    :key="opt.value || 'all'"
                    type="button"
                    class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :class="filter.status === opt.value
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground'"
                    :aria-pressed="filter.status === opt.value"
                    @click="setFilter('status', opt.value)"
                  >{{ opt.label }}</button>
                </div>
              </div>

              <!-- Source -->
              <div class="flex flex-col gap-1">
                <label
                  for="bs-source"
                  class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >Source</label>
                <select
                  id="bs-source"
                  :value="filter.source"
                  class="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  @change="setFilter('source', $event.target.value)"
                >
                  <option v-for="opt in SOURCE_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <!-- Sort -->
              <div class="flex flex-col gap-1">
                <label
                  for="bs-sort"
                  class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >Sort</label>
                <select
                  id="bs-sort"
                  :value="filter.sort"
                  class="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  @change="setFilter('sort', $event.target.value)"
                >
                  <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Prompt scope chip -->
            <div v-if="promptScope" class="mb-3">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Scoped to one prompt's responses
                <button
                  type="button"
                  class="rounded-full p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Remove prompt scope"
                  @click="clearPromptScope"
                >
                  <X class="size-3" />
                </button>
              </span>
            </div>

            <AlertsTable
              :alerts="displayAlerts"
              :loading="loadingAlerts"
              :filtered="isFiltered"
              :show-status="filter.status !== 'open'"
              :website-id="websiteId"
              @open="openAlert"
              @resolve="resolveAlert"
              @dismiss="dismissAlert"
              @clear-filters="clearFilters"
            />
          </CardContent>
        </Card>
    </div>
    </template>

    <!-- ── Finding detail drawer ── -->
    <AlertDetailSheet
      :open="Boolean(selected)"
      :alert="selected"
      :website-id="websiteId || ''"
      :brand-terms="highlightBrandTerms"
      :negative-keywords="config.negative_keywords || []"
      @close="closeAlert"
      @resolve="resolveAlert"
      @dismiss="dismissAlert"
      @view-conversation="viewConversation"
    />

    <!-- ── Conversation modal (opened from the drawer) ── -->
    <ChatDetailModal
      v-if="websiteId"
      :website-id="websiteId"
      :result-id="chatResultId"
      :open="chatOpen"
      @close="chatOpen = false"
    />
  </div>
</template>
