<script setup>
/**
 * Sources > URLs — the AI answer sources page.
 *
 * Every row is a web page an AI assistant pulled up while answering the
 * prompts this brand tracks. The page tells that story in order: citation
 * analytics (which sources the engines list, and where you and your
 * competitors are cited), what happened (header facts), what to do about
 * it (opportunities), then the evidence (retrievals chart, movers, types,
 * and the URL table with Google clicks for the brand's own pages). Every
 * metric has a tooltip definition; there are no dead controls.
 *
 * It is the board's Citations panel: there the panel's title replaces the
 * breadcrumb, and a row opens its detail in the same panel.
 */
import { ENGINES, engineMeta } from '@/lib/engines'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Search, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Check, ChevronDown, CircleX, Loader2,
} from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { useAppStore } from '@/stores/app'
import api from '@/api/client'
import { useBoard, useInPanel } from '@/lib/board/context'
import { boardLocation } from '@/lib/board/links'
import { stableSlots } from '@/lib/charts/palette'
import { retrievalsSpec, urlTypesSpec } from '@/lib/analytics/polishSpecs'
import {
  Card, CardHeader, CardContent,
} from '@/components/ui/card'
import EmptyState from '@/components/ui/EmptyState.vue'
import CitationAnalytics from '@/components/analytics/CitationAnalytics.vue'
import VizChart from '@/components/charts/VizChart.vue'
import MetricInfo from '@/components/sources/MetricInfo.vue'
import OpportunitiesRow from '@/components/sources/OpportunitiesRow.vue'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const websiteId = computed(() => route.params.websiteId)
const brandLabel = computed(() => appStore.activeWebsite?.name || 'this brand')

// In the board's panel the detail opens through the board (its own query keys).
const inPanel = useInPanel()
const board = inPanel ? useBoard() : null

// No prompt has answers yet: open Prompts on the board with Add prompts.
const addPromptsTo = computed(() => boardLocation(websiteId.value, 'prompts', { add: '1' }))
const addPromptsPath = computed(() => router.resolve(addPromptsTo.value).fullPath)


/* ── Metric definitions (tooltips) ── */
const HELP = {
  retrievals: 'How many times AI pulled this page up as a candidate source while answering a tracked prompt. One answer can retrieve many pages.',
  citationRate: 'Of the times this page was retrieved, how often the answer actually cited it. 100% means every retrieval was cited in the answer text.',
  gapScore: 'Tracked competitors named in answers that used this page, times retrievals. High means this page feeds answers where your competitors appear.',
  movers: 'Top: most retrieved. New: first ever seen in the last week. Trending and Losing: biggest change versus the first half of the period.',
  urlTypes: 'Page format classified from the URL and title. Percentages are shares of all retrievals in this period.',
  googleClicks: 'Clicks from Google Search for this page over the same period, from Search Console. Google reports with about a 3-day delay. Only available for your own pages.',
}

/* ── Remote state ── */
const loading = ref(true)
const loaded = ref(false)
const error = ref('')

// The five most-used domains per day. Each domain keeps the colour slot it
// first got for as long as the page is open, so a filter change never
// repaints a domain that stays on the chart.
const overview = ref({ labels: [], series: [] })
const periodStart = ref(null)
const slotMemory = new Map()
const domainSlots = ref(new Map())
const trafficSummary = ref(null)
const opportunities = ref(null)
const uniqueUrls = ref(0)

const retrievalsChart = computed(() =>
  retrievalsSpec(overview.value, domainSlots.value, { start: periodStart.value }),
)
const retrievalsEmpty = computed(() =>
  overview.value.series.length
    ? null
    : {
        title: 'No retrievals in this period yet',
        body: 'Retrievals appear as the AI engines answer the prompts you track.',
        action: { label: 'Add prompts', to: addPromptsTo.value },
      },
)

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
const urlTypesChart = computed(() => urlTypesSpec(urlTypes.value))
const urlTypesEmpty = computed(() =>
  urlTypes.value.length
    ? null
    : {
        title: 'No retrievals in this period',
        body: 'URL types break down which content formats AI reaches for once sources are collected.',
      },
)

/* ── AI model avatars ── */
function modelStyle(key) {
  const meta = engineMeta(key)
  return { label: meta.label, color: meta.color, initial: meta.label.slice(0, 2) }
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
// The filter sends the backend provider id; only ChatGPT's (gpt4)
// differs from its display key.
const MODEL_OPTIONS = ENGINES.map(e => ({
  value: e.key === 'chatgpt' ? 'gpt4' : e.key,
  label: e.label,
}))

// Topic and engine live in the query (the Citations panel's own keys), so
// a URL's detail and the way back to this list keep them.
const topics = ref([])
const selectedTopic = ref(route.query.topic || null)
const selectedModel = ref(MODEL_OPTIONS.some(m => m.value === route.query.provider) ? route.query.provider : null)
const periodDays = ref(30)
const openMenu = ref(null)
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
  router.replace({ query: { ...route.query, provider: value || undefined } })
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
    // Silent: the page shows the failure inline.
    const res = await api.get(`/citations/websites/${websiteId.value}/urls/`, { params, _silentError: true })
    const data = res.data || {}
    topics.value = data.topics || []
    const series = (data.overview?.series || []).map(s => ({ key: String(s.key ?? s.label), label: s.label, data: s.data || [] }))
    domainSlots.value = stableSlots(series.map(s => s.key), slotMemory)
    overview.value = { labels: data.overview?.labels || [], series }
    periodStart.value = data.period_start || null
    movers.value = {
      Top: data.movers?.Top || [],
      New: data.movers?.New || [],
      Trending: data.movers?.Trending || [],
      Losing: data.movers?.Losing || [],
    }
    urlTypes.value = (data.url_types || []).map(t => ({ type: t.type, pct: t.pct }))
    totalRetrievals.value = data.total_retrievals || 0
    uniqueUrls.value = data.unique_urls || 0
    trafficSummary.value = data.traffic_summary || null
    opportunities.value = data.opportunities || null
    urls.value = (data.urls || []).map(mapRow)
    loaded.value = true
  } catch (e) {
    error.value = e?.displayMessage || "We couldn't load your sources."
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
  const query = {
    url: row.normalizedUrl || row.url,
    ...(selectedTopic.value ? { topic: selectedTopic.value } : {}),
    ...(selectedModel.value ? { provider: selectedModel.value } : {}),
  }
  if (board) board.open('citations', query)
  else router.push({ name: 'sources-url-detail', params: { websiteId: websiteId.value }, query })
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
    <!-- ── Breadcrumb (the panel's title says it in the board) ── -->
    <div v-if="!inPanel" class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <span class="font-medium text-foreground">Sources</span>
        <ChevronRight class="size-3.5" />
        <span class="font-semibold text-foreground">URLs</span>
      </div>
    </div>

    <!-- ── Citation analytics: its own period and engine filters ── -->
    <CitationAnalytics v-if="websiteId" :website-id="String(websiteId)" />

    <!-- ── Header strip: what this page is ── -->
    <div>
      <h2 class="text-lg font-bold text-foreground">AI answer sources</h2>
      <p class="mt-0.5 max-w-3xl text-sm text-muted-foreground">
        Every page AI assistants pulled up while answering the prompts you track for
        {{ brandLabel }}.
      </p>
      <div v-if="loaded && !error" class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span class="text-foreground/90">
          <span class="font-bold text-foreground">{{ headerFacts.pages }}</span> pages retrieved
          <template v-if="headerFacts.pages">
            · <span class="font-semibold text-[color:var(--chart-2)]">{{ headerFacts.yours }}</span> from your site
            · <span class="font-semibold text-[color:var(--chart-3)]">{{ headerFacts.competitors }}</span> from competitors
            · {{ headerFacts.third }} third-party
          </template>
        </span>
        <router-link
          v-if="trafficSummary && !trafficSummary.gsc_connected"
          to="/settings/connections"
          class="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >Connect Search Console to see Google performance</router-link>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">
      <CircleX />
      <AlertTitle>We couldn't load your sources.</AlertTitle>
      <AlertDescription>
        <p>{{ error }}</p>
        <button
          type="button"
          class="mt-1 font-semibold text-foreground underline underline-offset-2"
          @click="load"
        >Try again</button>
      </AlertDescription>
    </Alert>
    <div v-else-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading URL analytics…
    </div>

    <!-- Empty states below render only when the last load succeeded. -->
    <template v-if="!error">
    <!-- ── What to do next ── -->
    <div v-if="!loading && opportunities">
      <h2 class="text-base font-bold text-foreground">What to do next</h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Built from where AI already trusts you, where it ignores you, and what earns real visits.
      </p>
      <OpportunitiesRow
        :opportunities="opportunities"
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
          <div v-if="!topics.length" class="px-2.5 py-2 text-xs text-muted-foreground">No topics yet.</div>
        </div>
      </div>
    </div>

    <!-- ── Retrievals chart ── -->
    <VizChart :spec="retrievalsChart" :loading="loading" :empty="retrievalsEmpty" :height="288">
      <template #actions>
        <MetricInfo :text="HELP.retrievals" />
      </template>
    </VizChart>

    <!-- ── Movers + URL types ── -->
    <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
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

      <VizChart :spec="urlTypesChart" :loading="loading" :empty="urlTypesEmpty">
        <template #actions>
          <MetricInfo :text="HELP.urlTypes" />
          <span class="text-xs text-muted-foreground">Total retrievals: {{ formatCount(totalRetrievals) }}</span>
        </template>
      </VizChart>
    </div>

    <!-- ── URLs table ── -->
    <div>
      <h2 class="text-lg font-bold text-foreground">URLs</h2>
      <p class="text-sm text-muted-foreground">
        Every page retrieved in this period. Google clicks show for your own pages when Search Console is connected.
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
              </tr>
              <tr v-if="!loading && !filteredUrls.length">
                <td colspan="8" class="p-0">
                  <EmptyState
                    v-if="isFiltered"
                    title="Nothing matches"
                    body="Widen the ownership filter or clear the search to see every page."
                  />
                  <EmptyState
                    v-else
                    title="No URLs yet"
                    body="Pages appear here as the AI engines answer the prompts you track."
                    cta-label="Add prompts"
                    :cta-to="addPromptsPath"
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
    </template>
  </div>
</template>
