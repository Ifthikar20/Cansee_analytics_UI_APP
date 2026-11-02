<script setup>
/**
 * Sources > URLs — the AI answer sources page.
 *
 * Every row is a web page an AI assistant pulled up while answering the
 * prompts this brand tracks. The page tells that story in order: what
 * happened (header facts + AI-referred visits), what to do about it
 * (opportunities), then the evidence (retrievals chart, movers, types,
 * and the URL table with real Google/AI traffic for the brand's own
 * pages). Every metric has a tooltip definition; there are no dead
 * controls.
 */
import { ENGINES } from '@/lib/engines'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip as ChartTooltip, Legend, LineElement, PointElement,
  CategoryScale, LinearScale, Filler,
} from 'chart.js'
import {
  Search, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Check, ChevronDown, CircleX, Loader2,
} from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { useAppStore } from '@/stores/app'
import citationsApi from '@/api/citations'
import { cssVar } from '@/lib/theme'
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card'
import EmptyState from '@/components/ui/EmptyState.vue'
import MetricInfo from '@/components/sources/MetricInfo.vue'
import OpportunitiesRow from '@/components/sources/OpportunitiesRow.vue'

ChartJS.register(Title, ChartTooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler)

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const websiteId = computed(() => route.params.websiteId)
const brandLabel = computed(() => appStore.activeWebsite?.name || 'this brand')


/* ── Metric definitions (tooltips) ── */
const HELP = {
  retrievals: 'How many times AI pulled this page up as a candidate source while answering a tracked prompt. One answer can retrieve many pages.',
  citationRate: 'Of the times this page was retrieved, how often the answer actually cited it. 100% means every retrieval was cited in the answer text.',
  gapScore: 'Tracked competitors named in answers that used this page, times retrievals. High means this page feeds answers where your competitors appear.',
  movers: 'Top: most retrieved. New: first ever seen in the last week. Trending and Losing: biggest change versus the first half of the period.',
  urlTypes: 'Page format classified from the URL and title. Percentages are shares of all retrievals in this period.',
  googleClicks: 'Clicks from Google Search for this page over the same period, from Search Console. Google reports with about a 3-day delay. Only available for your own pages.',
  aiVisits: 'Visits that arrived on this page from an AI assistant (ChatGPT, Perplexity, and others), measured by your tracking pixel. Only available for your own pages.',
}

/* ── Remote state ── */
const loading = ref(true)
const error = ref('')

const DOMAIN_PALETTE = [
  '#475569', '#8b5cf6', '#5b8def', '#ec4899', '#f59e0b',
  '#22c55e', '#06b6d4', '#f97316', '#14b8a6', '#eab308',
]

const domainSeries = ref([])
const chartLabels = ref([])
const trafficSummary = ref(null)
const opportunities = ref(null)
const uniqueUrls = ref(0)

const chartData = computed(() => ({
  labels: chartLabels.value,
  datasets: domainSeries.value.map(d => ({
    label: d.label,
    data: d.data,
    borderColor: d.color,
    backgroundColor: d.color,
    pointHoverBackgroundColor: d.color,
    pointHoverBorderColor: cssVar('--card', '#fff'),
    tension: 0.4,
    cubicInterpolationMode: 'monotone',
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHoverBorderWidth: 2,
    borderWidth: 2,
    fill: false,
  })),
}))

const chartOptions = computed(() => {
  const grid = cssVar('--border', 'rgba(0,0,0,0.08)')
  const text = cssVar('--muted-foreground', '#64748b')
  const popover = cssVar('--popover', '#ffffff')
  const popoverFg = cssVar('--popover-foreground', '#0f172a')
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        usePointStyle: true,
        backgroundColor: popover,
        titleColor: popoverFg,
        bodyColor: popoverFg,
        borderColor: grid,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        boxPadding: 4,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: text, font: { size: 12 }, padding: 8 },
      },
      y: {
        beginAtZero: true,
        grid: { color: grid, drawBorder: false },
        border: { display: false },
        ticks: { color: text, font: { size: 12 }, padding: 8, precision: 0 },
      },
    },
  }
})

/* ── URL movers ── */
const moverTab = ref('Top')
const moverTabs = ['Top', 'New', 'Trending', 'Losing']
const movers = ref({ Top: [], New: [], Trending: [], Losing: [] })
const moverRows = computed(() => movers.value[moverTab.value] || [])
const moverShowsDelta = computed(() => moverTab.value === 'Trending' || moverTab.value === 'Losing')
const moverMax = computed(() => {
  if (moverShowsDelta.value) {
    return Math.max(1, ...moverRows.value.map(r => Math.abs(r.delta || 0)))
  }
  return Math.max(1, ...moverRows.value.map(r => r.retrievals))
})
function moverBarWidth(row) {
  const value = moverShowsDelta.value ? Math.abs(row.delta || 0) : row.retrievals
  return (value / moverMax.value * 100) + '%'
}

const urlTypes = ref([])
const totalRetrievals = ref(0)
const urlTypeMaxPct = computed(() => Math.max(1, ...urlTypes.value.map(t => t.pct)))

/* ── AI model avatars ── */
const MODELS = {
  chatgpt: { label: 'ChatGPT', color: '#10a37f', initial: 'C' },
  perplexity: { label: 'Perplexity', color: '#8b5cf6', initial: 'P' },
  gemini: { label: 'Gemini', color: '#5b8def', initial: 'G' },
  claude: { label: 'Claude', color: '#f97316', initial: 'A' },
  copilot: { label: 'Copilot', color: '#06b6d4', initial: 'M' },
  grok: { label: 'Grok', color: '#0f172a', initial: 'X' },
  deepseek: { label: 'DeepSeek', color: '#2563eb', initial: 'D' },
  mistral: { label: 'Mistral', color: '#ef4444', initial: 'M' },
  cohere: { label: 'Cohere', color: '#d946ef', initial: 'O' },
  llama: { label: 'Llama', color: '#0ea5e9', initial: 'L' },
  nova: { label: 'Nova', color: '#64748b', initial: 'N' },
}
// The five tracked engines take their label and colour from lib/engines,
// so every screen agrees; the other models keep their own.
for (const e of ENGINES) MODELS[e.key] = { ...MODELS[e.key], label: e.label, color: e.color }
function modelStyle(key) {
  return MODELS[key] || { label: key, color: '#94a3b8', initial: (key || '?')[0].toUpperCase() }
}

/* Domain-type badges. "Your site" and "Competitor" carry the ownership
   story; the rest describe the publisher class. Token-based tints. */
const DOMAIN_TYPE_STYLES = {
  'Your site': 'bg-[color:var(--chart-2)]/12 text-[color:var(--chart-2)]',
  Competitor: 'bg-[color:var(--chart-3)]/12 text-[color:var(--chart-3)]',
  Reference: 'bg-[color:var(--chart-4)]/12 text-[color:var(--chart-4)]',
  Corporate: 'bg-secondary text-secondary-foreground',
  Editorial: 'bg-[color:var(--chart-1)]/12 text-[color:var(--chart-1)]',
  UGC: 'bg-accent text-accent-foreground',
}
function domainBadgeClass(type) {
  return DOMAIN_TYPE_STYLES[type] || 'bg-secondary text-secondary-foreground'
}

/* ── Filters ── */
const topics = ref([])
const selectedTopic = ref(route.query.topic || null)
const selectedModel = ref(null)
const periodDays = ref(30)
const openMenu = ref(null)

const MODEL_OPTIONS = [
  { value: 'gpt4', label: 'ChatGPT' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'grok', label: 'Grok' },
  { value: 'deepseek', label: 'DeepSeek' },
]
const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]
const selectedModelLabel = computed(() =>
  MODEL_OPTIONS.find(m => m.value === selectedModel.value)?.label || 'All Models')
const selectedPeriodLabel = computed(() =>
  PERIOD_OPTIONS.find(p => p.value === periodDays.value)?.label || 'Last 30 days')
const topicsTotal = computed(() => topics.value.reduce((s, t) => s + (t.count || 0), 0))

function toggleMenu(name) {
  openMenu.value = openMenu.value === name ? null : name
}
function closeMenus() { openMenu.value = null }
function selectTopic(name) {
  selectedTopic.value = name
  closeMenus()
  router.replace({ query: { ...route.query, topic: name || undefined } })
  load()
}
function selectModel(value) {
  selectedModel.value = value
  closeMenus()
  load()
}
function selectPeriod(value) {
  periodDays.value = value
  closeMenus()
  load()
}

/* ── URLs table: search, ownership filter, client-side sort ── */
const search = ref('')
const ownership = ref('all')
const sortKey = ref('')
const sortDir = ref('desc')
const urls = ref([])

const OWNERSHIP_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'yours', label: 'Your pages' },
  { value: 'competitors', label: 'Competitors' },
  { value: 'third', label: 'Third-party' },
]

function ownershipOf(row) {
  if (row.sourceClass === 'your_site') return 'yours'
  if (row.sourceClass === 'competitor_site') return 'competitors'
  return 'third'
}

const ownershipCounts = computed(() => {
  const counts = { all: urls.value.length, yours: 0, competitors: 0, third: 0 }
  for (const row of urls.value) counts[ownershipOf(row)] += 1
  return counts
})

const SORTABLE = {
  retrievals: (r) => r.retrievals,
  citationRate: (r) => r.citationRate,
  gap: (r) => r.gap,
  gscClicks: (r) => r.gsc?.clicks ?? -1,
  aiVisits: (r) => r.aiVisits ?? -1,
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const filteredUrls = computed(() => {
  let rows = urls.value
  if (ownership.value !== 'all') {
    rows = rows.filter(r => ownershipOf(r) === ownership.value)
  }
  const q = search.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(u =>
      (u.title || '').toLowerCase().includes(q) || (u.path || '').toLowerCase().includes(q))
  }
  const accessor = SORTABLE[sortKey.value]
  if (accessor) {
    rows = [...rows].sort((a, b) => {
      const diff = accessor(a) - accessor(b)
      return sortDir.value === 'desc' ? -diff : diff
    })
  }
  return rows
})

const isFiltered = computed(() => Boolean(search.value.trim() || ownership.value !== 'all'))

/* ── Data fetch ── */
function mapRow(r) {
  const models = Array.isArray(r.models) ? r.models : []
  return {
    title: r.title,
    path: r.path,
    url: r.url,
    normalizedUrl: r.normalized_url,
    type: r.url_type,
    domainType: r.domain_type,
    sourceClass: r.source_class,
    models: models.slice(0, 4),
    extra: Math.max(0, models.length - 4),
    retrievals: r.retrievals,
    citationRate: r.citation_rate ?? 0,
    gap: r.gap_score ?? 0,
    gsc: r.gsc || null,
    aiVisits: r.ai_visits,
    isTarget: r.is_target,
    isCompetitor: r.is_competitor,
  }
}

async function load() {
  if (!websiteId.value) return
  loading.value = true
  error.value = ''
  try {
    const params = { period_days: periodDays.value }
    if (selectedTopic.value) params.topic = selectedTopic.value
    if (selectedModel.value) params.provider = selectedModel.value
    const res = await citationsApi.websiteUrls(websiteId.value, params)
    const data = res.data || {}
    topics.value = data.topics || []
    chartLabels.value = data.overview?.labels || []
    domainSeries.value = (data.overview?.series || []).map((s, i) => ({
      key: s.label,
      label: s.label,
      color: s.color || DOMAIN_PALETTE[i % DOMAIN_PALETTE.length],
      data: s.data || [],
    }))
    movers.value = {
      Top: data.movers?.Top || [],
      New: data.movers?.New || [],
      Trending: data.movers?.Trending || [],
      Losing: data.movers?.Losing || [],
    }
    urlTypes.value = (data.url_types || []).map(t => ({ type: t.type, pct: t.pct, color: t.color }))
    totalRetrievals.value = data.total_retrievals || 0
    uniqueUrls.value = data.unique_urls || 0
    trafficSummary.value = data.traffic_summary || null
    opportunities.value = data.opportunities || null
    urls.value = (data.urls || []).map(mapRow)
  } catch (e) {
    error.value = e?.displayMessage || 'Failed to load URL analytics.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))
watch(websiteId, load)

function onDocClick(e) {
  if (!e.target.closest?.('[data-filter-menu]')) closeMenus()
}

function openDetail(row) {
  router.push({
    name: 'sources-url-detail',
    params: { websiteId: websiteId.value },
    query: {
      url: row.normalizedUrl || row.url,
      ...(selectedTopic.value ? { topic: selectedTopic.value } : {}),
      ...(selectedModel.value ? { provider: selectedModel.value } : {}),
    },
  })
}

function openOpportunity(item) {
  openDetail({ normalizedUrl: item.normalized_url, url: item.url })
}

function faviconFor(path) {
  const domain = (path || '').split('/')[0]
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}
function onFaviconError(e) {
  e.target.style.visibility = 'hidden'
}

function formatRate(rate) {
  return Math.round((rate || 0) * 100) + '%'
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n ?? 0)
}

/* ── Header facts ── */
const headerFacts = computed(() => {
  const counts = ownershipCounts.value
  return {
    pages: uniqueUrls.value,
    yours: counts.yours,
    competitors: counts.competitors,
    third: counts.third,
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- ── Breadcrumb ── -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <span class="font-medium text-foreground">Sources</span>
        <ChevronRight class="size-3.5" />
        <span class="font-semibold text-foreground">URLs</span>
      </div>
    </div>

    <!-- ── Header strip: what this page is + what it means for traffic ── -->
    <div>
      <h2 class="text-lg font-bold text-foreground">AI answer sources</h2>
      <p class="mt-0.5 max-w-3xl text-sm text-muted-foreground">
        Every page AI assistants pulled up while answering the prompts you track for
        {{ brandLabel }} — and what that means for your traffic.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span class="text-foreground/90">
          <span class="font-bold text-foreground">{{ headerFacts.pages }}</span> pages retrieved
          <template v-if="headerFacts.pages">
            · <span class="font-semibold text-[color:var(--chart-2)]">{{ headerFacts.yours }}</span> from your site
            · <span class="font-semibold text-[color:var(--chart-3)]">{{ headerFacts.competitors }}</span> from competitors
            · {{ headerFacts.third }} third-party
          </template>
        </span>
        <template v-if="trafficSummary">
          <span v-if="trafficSummary.pixel_active" class="text-foreground/90">
            <span class="font-bold text-foreground">{{ trafficSummary.ai_sessions }}</span>
            AI-referred visit{{ trafficSummary.ai_sessions === 1 ? '' : 's' }} to your site
            ({{ trafficSummary.ai_percentage }}% of all traffic)
          </span>
          <router-link
            v-if="!trafficSummary.gsc_connected"
            to="/settings/connections"
            class="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >Connect Search Console to see Google performance</router-link>
        </template>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">
      <CircleX />
      <AlertTitle>Could not load sources</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>
    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading URL analytics…
    </div>

    <!-- ── What to do next ── -->
    <div v-if="!loading && opportunities">
      <h2 class="text-base font-bold text-foreground">What to do next</h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Built from where AI already trusts you, where it ignores you, and what earns real visits.
      </p>
      <OpportunitiesRow
        :opportunities="opportunities"
        :website-id="websiteId"
        @open-url="openOpportunity"
      />
    </div>

    <!-- ── Filters ── -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Period -->
      <div class="relative" data-filter-menu>
        <button @click="toggleMenu('period')"
          class="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-ring"
          :class="periodDays !== 30 ? 'border-ring' : 'border-border'">
          <span>{{ selectedPeriodLabel }}</span>
          <ChevronDown class="size-3.5 text-muted-foreground" />
        </button>
        <div v-if="openMenu === 'period'"
          class="absolute left-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-md">
          <button v-for="p in PERIOD_OPTIONS" :key="p.value" @click="selectPeriod(p.value)"
            class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            :class="periodDays === p.value ? 'font-semibold text-foreground' : 'text-muted-foreground'">
            <span>{{ p.label }}</span>
            <Check v-if="periodDays === p.value" class="size-3.5 text-[color:var(--chart-1)]" />
          </button>
        </div>
      </div>

      <!-- Models -->
      <div class="relative" data-filter-menu>
        <button @click="toggleMenu('models')"
          class="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-ring"
          :class="selectedModel ? 'border-ring' : 'border-border'">
          <span>{{ selectedModelLabel }}</span>
          <ChevronDown class="size-3.5 text-muted-foreground" />
        </button>
        <div v-if="openMenu === 'models'"
          class="absolute left-0 z-20 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-md">
          <button @click="selectModel(null)"
            class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            :class="!selectedModel ? 'font-semibold text-foreground' : 'text-muted-foreground'">All Models</button>
          <button v-for="m in MODEL_OPTIONS" :key="m.value" @click="selectModel(m.value)"
            class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            :class="selectedModel === m.value ? 'font-semibold text-foreground' : 'text-muted-foreground'">
            <span>{{ m.label }}</span>
            <Check v-if="selectedModel === m.value" class="size-3.5 text-[color:var(--chart-1)]" />
          </button>
        </div>
      </div>

      <!-- Topics -->
      <div class="relative" data-filter-menu>
        <button @click="toggleMenu('topics')"
          class="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-ring"
          :class="selectedTopic ? 'border-ring' : 'border-border'">
          <span>{{ selectedTopic || 'All Topics' }}</span>
          <ChevronDown class="size-3.5 text-muted-foreground" />
        </button>
        <div v-if="openMenu === 'topics'"
          class="absolute left-0 z-20 mt-1 w-60 rounded-lg border border-border bg-popover p-1 shadow-md">
          <button @click="selectTopic(null)"
            class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            :class="!selectedTopic ? 'font-semibold text-foreground' : 'text-muted-foreground'">
            <span>All Topics</span><span class="text-xs text-muted-foreground">{{ topicsTotal }}</span>
          </button>
          <button v-for="t in topics" :key="t.name" @click="selectTopic(t.name)"
            class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-secondary"
            :class="selectedTopic === t.name ? 'font-semibold text-foreground' : 'text-muted-foreground'">
            <span class="truncate">{{ t.name }}</span><span class="ml-2 shrink-0 text-xs text-muted-foreground">{{ t.count }}</span>
          </button>
          <div v-if="!topics.length" class="px-2.5 py-2 text-xs text-muted-foreground">No topics yet. Group prompts into topics on the Prompts page.</div>
        </div>
      </div>
    </div>

    <!-- ── Retrievals chart ── -->
    <Card>
      <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="flex items-center gap-1.5 text-base">
            Retrievals over time
            <MetricInfo :text="HELP.retrievals" />
          </CardTitle>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Daily retrievals for the five most-used domains in this period
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <template v-if="domainSeries.length">
          <div class="h-72">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span v-for="d in domainSeries" :key="d.key"
              class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="size-2 rounded-full" :style="{ background: d.color }" />
              {{ d.label }}
            </span>
          </div>
        </template>
        <EmptyState
          v-else-if="!loading"
          title="No retrievals in this period yet"
          body="Retrievals appear as your prompt runs complete. Run prompts to give the AI models something to answer."
          cta-label="Run prompts"
          :cta-to="websiteId ? `/llm-ranking/${websiteId}/prompts` : ''"
        />
      </CardContent>
    </Card>

    <!-- ── Movers + URL types ── -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button v-for="t in moverTabs" :key="t"
                class="text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="moverTab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
                :aria-pressed="moverTab === t"
                @click="moverTab = t">{{ t }}</button>
              <MetricInfo :text="HELP.movers" />
            </div>
            <span class="text-xs font-medium text-muted-foreground">
              {{ moverShowsDelta ? 'Change' : 'Retrievals' }}
            </span>
          </div>
        </CardHeader>
        <CardContent class="space-y-1.5">
          <div v-for="(row, i) in moverRows" :key="i"
            class="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-3 py-2">
            <div class="absolute inset-y-0 left-0 rounded-md bg-secondary"
              :style="{ width: moverBarWidth(row) }" />
            <span class="relative z-10 min-w-0 truncate text-sm text-foreground" :title="row.title">{{ row.title }}</span>
            <span
              v-if="moverShowsDelta"
              class="relative z-10 shrink-0 text-sm font-semibold tabular-nums"
              :class="(row.delta || 0) > 0 ? 'text-[color:var(--chart-2)]' : 'text-destructive'"
            >{{ (row.delta || 0) > 0 ? '+' : '' }}{{ row.delta || 0 }}</span>
            <span v-else class="relative z-10 shrink-0 text-sm font-semibold tabular-nums text-foreground">{{ row.retrievals }}</span>
          </div>
          <EmptyState
            v-if="!loading && !moverRows.length"
            title="No movement yet"
            body="Movers appear once a few prompt runs have collected sources."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center justify-between space-y-0">
          <div class="flex items-center gap-1.5">
            <CardTitle class="text-base">URL types</CardTitle>
            <MetricInfo :text="HELP.urlTypes" />
          </div>
          <span class="text-xs text-muted-foreground">Total retrievals: {{ formatCount(totalRetrievals) }}</span>
        </CardHeader>
        <CardContent class="space-y-3">
          <div v-for="t in urlTypes" :key="t.type"
            class="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-3 py-2">
            <div class="absolute inset-y-0 left-0 rounded-md bg-secondary"
              :style="{ width: (t.pct / urlTypeMaxPct * 100) + '%' }" />
            <span class="relative z-10 inline-flex items-center gap-2 text-sm text-foreground">
              <span class="size-2 rounded-full" :style="{ background: t.color }" />
              {{ t.type }}
            </span>
            <span class="relative z-10 text-sm font-semibold tabular-nums text-foreground">{{ t.pct }}%</span>
          </div>
          <EmptyState
            v-if="!loading && !urlTypes.length"
            title="No retrievals in this period"
            body="URL types break down which content formats AI reaches for once sources are collected."
          />
        </CardContent>
      </Card>
    </div>

    <!-- ── URLs table ── -->
    <div>
      <h2 class="text-lg font-bold text-foreground">URLs</h2>
      <p class="text-sm text-muted-foreground">
        Every page retrieved in this period. Traffic columns are available for your own pages.
      </p>
    </div>

    <Card>
      <CardContent class="pt-6">
        <!-- toolbar: ownership chips + search -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <div class="flex rounded-lg border border-border bg-background p-0.5">
            <button v-for="opt in OWNERSHIP_OPTIONS" :key="opt.value"
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="ownership === opt.value
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="ownership === opt.value"
              @click="ownership = opt.value">
              {{ opt.label }}
              <span class="ml-1 tabular-nums">{{ ownershipCounts[opt.value] }}</span>
            </button>
          </div>
          <div class="relative min-w-[200px] flex-1">
            <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input v-model="search" placeholder="Search pages"
              class="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>

        <!-- table -->
        <div class="overflow-x-auto">
          <table class="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th class="w-[34%] py-2 pr-3">URL</th>
                <th class="py-2 pr-3">URL type</th>
                <th class="py-2 pr-3">Domain type</th>
                <th class="py-2 pr-3">Models</th>
                <th class="py-2 pr-3">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('retrievals')">
                    Retrievals
                    <component :is="sortKey === 'retrievals' ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown" class="size-3" />
                  </button>
                  <MetricInfo :text="HELP.retrievals" side="bottom" />
                </th>
                <th class="py-2 pr-3">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('citationRate')">
                    Citation rate
                    <component :is="sortKey === 'citationRate' ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown" class="size-3" />
                  </button>
                  <MetricInfo :text="HELP.citationRate" side="bottom" />
                </th>
                <th class="py-2 pr-3">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('gap')">
                    Gap score
                    <component :is="sortKey === 'gap' ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown" class="size-3" />
                  </button>
                  <MetricInfo :text="HELP.gapScore" side="bottom" />
                </th>
                <th class="py-2 pr-3">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('gscClicks')">
                    Google clicks
                    <component :is="sortKey === 'gscClicks' ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown" class="size-3" />
                  </button>
                  <MetricInfo :text="HELP.googleClicks" side="bottom" />
                </th>
                <th class="py-2 pr-3">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('aiVisits')">
                    AI visits
                    <component :is="sortKey === 'aiVisits' ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown" class="size-3" />
                  </button>
                  <MetricInfo :text="HELP.aiVisits" side="bottom" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in filteredUrls" :key="i"
                @click="openDetail(row)"
                class="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50">
                <td class="py-3 pr-3">
                  <div class="flex items-center gap-2.5">
                    <img :src="faviconFor(row.path)" alt="" class="size-4 shrink-0 rounded-sm" @error="onFaviconError" />
                    <div class="min-w-0">
                      <div class="truncate font-medium text-foreground" :title="row.title">{{ row.title }}</div>
                      <div class="truncate text-xs text-muted-foreground" :title="row.path">{{ row.path }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3 pr-3 text-muted-foreground">{{ row.type }}</td>
                <td class="py-3 pr-3">
                  <span class="rounded-md px-2 py-0.5 text-xs font-semibold" :class="domainBadgeClass(row.domainType)">
                    {{ row.domainType }}
                  </span>
                </td>
                <td class="py-3 pr-3">
                  <div class="flex items-center -space-x-1.5">
                    <span v-for="m in row.models" :key="m"
                      class="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                      :style="{ background: modelStyle(m).color }" :title="modelStyle(m).label">
                      {{ modelStyle(m).initial }}
                    </span>
                    <span v-if="row.extra"
                      class="flex h-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[10px] font-bold text-muted-foreground ring-2 ring-card">
                      +{{ row.extra }}
                    </span>
                  </div>
                </td>
                <td class="py-3 pr-3 tabular-nums text-foreground">{{ row.retrievals }}</td>
                <td class="py-3 pr-3 tabular-nums text-foreground">{{ formatRate(row.citationRate) }}</td>
                <td class="py-3 pr-3 tabular-nums font-semibold text-foreground">{{ row.gap }}</td>
                <td class="py-3 pr-3 tabular-nums" :class="row.gsc ? 'text-foreground' : 'text-muted-foreground'">
                  {{ row.gsc ? row.gsc.clicks : '–' }}
                </td>
                <td class="py-3 pr-3 tabular-nums" :class="row.aiVisits != null ? 'text-foreground' : 'text-muted-foreground'">
                  {{ row.aiVisits != null ? row.aiVisits : '–' }}
                </td>
              </tr>
              <tr v-if="!loading && !filteredUrls.length">
                <td colspan="9" class="p-0">
                  <EmptyState
                    v-if="isFiltered"
                    title="Nothing matches"
                    body="Widen the ownership filter or clear the search to see every page."
                  />
                  <EmptyState
                    v-else
                    title="No URLs yet"
                    body="Pages appear here as your prompt runs collect the sources AI answers rely on."
                    cta-label="Run prompts"
                    :cta-to="websiteId ? `/llm-ranking/${websiteId}/prompts` : ''"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          <span>{{ filteredUrls.length }} items</span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
