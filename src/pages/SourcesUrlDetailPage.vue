<script setup>
// One AI answer source: how often answers retrieved and cited it, its
// Google performance when it is your page, the prompts and brands around
// it and the answers that used it. It is the board's Citations panel when
// the panel's query names a `url`; there the breadcrumb becomes a link back
// to the list, keeping the list's topic and engine.
import { engineMeta } from '@/lib/engines'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, ChevronRight, Search, Loader2, ExternalLink, CircleX,
} from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import api from '@/api/client'
import { useBoard, useInPanel } from '@/lib/board/context'
import { boardLocation } from '@/lib/board/links'
import ChatDetailModal from '@/components/ChatDetailModal.vue'
import VizChart from '@/components/charts/VizChart.vue'
import MetricInfo from '@/components/sources/MetricInfo.vue'
import { urlModelsSpec, urlRetrievalsSpec } from '@/lib/analytics/polishSpecs'
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card'

const route = useRoute()
const router = useRouter()
const websiteId = computed(() => route.params.websiteId)
const targetUrl = computed(() => route.query.url || '')

const inPanel = useInPanel()
const board = inPanel ? useBoard() : null

// The list's own filters, which the way back keeps.
const listQuery = computed(() => {
  const query = {}
  for (const key of ['topic', 'provider']) {
    const value = route.query[key]
    if (typeof value === 'string' && value) query[key] = value
  }
  return query
})
const allCitationsTo = computed(() => boardLocation(websiteId.value, 'citations', listQuery.value))

// A plain click stays in the panel; a modified click (new tab) keeps the link.
function openList(event) {
  if (!board || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  board.open('citations', listQuery.value)
}

const loading = ref(true)
const error = ref('')
const detail = ref(null)
const promptSearch = ref('')

function modelStyle(key) {
  const meta = engineMeta(key)
  return { label: meta.label, color: meta.color, initial: meta.label.slice(0, 2) }
}

/* Domain-type badges, matching the list page: ownership classes carry
   the story, tints ride the chart tokens. */
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

/* ── Metric definitions (tooltips) ── */
const HELP = {
  urlType: 'Page format classified from the URL and title (listicle, comparison, how-to, and so on).',
  domainType: 'Who publishes this page: your site, a competitor, or a third-party class like UGC or editorial.',
  retrievals: 'How many times AI pulled this page up as a candidate source while answering a tracked prompt, versus the previous period.',
  citationRate: 'Of the times this page was retrieved, how often the answer actually cited it. 100% means every retrieval was cited.',
  prompts: 'Distinct tracked prompts whose answers retrieved this page.',
  firstSeen: 'First time any tracked prompt answer retrieved this URL.',
  lastSeen: 'Most recent time any tracked prompt answer retrieved this URL.',
  googleClicks: 'Clicks from Google Search for this page over this period, from Search Console (about a 3-day reporting delay).',
  googleImpressions: 'How often this page appeared in Google results over this period.',
  googlePosition: 'Impression-weighted average Google position. Lower is better; a negative change means the page moved up.',
}


const metrics = computed(() => detail.value?.metrics || {})
const title = computed(() => metrics.value.title || 'URL')
const realTraffic = computed(() => detail.value?.real_traffic || null)
const brandsMentioned = computed(() => detail.value?.brands_mentioned || [])
const chats = computed(() => detail.value?.chats || [])

function fmtDelta(d) {
  if (d == null) return ''
  if (d > 0) return `+${d}`
  return String(d)
}
function deltaClass(d) {
  if (d == null || d === 0) return 'text-muted-foreground'
  return d > 0 ? 'text-[color:var(--chart-2)]' : 'text-destructive'
}
// Position deltas invert: moving DOWN the number means moving UP the
// rankings, so negative is the good direction.
function positionDeltaClass(d) {
  if (d == null || d === 0) return 'text-muted-foreground'
  return d < 0 ? 'text-[color:var(--chart-2)]' : 'text-destructive'
}
function fmtRate(rate) {
  return Math.round((rate || 0) * 100) + '%'
}
function fmtRateDelta(d) {
  if (d == null || d === 0) return ''
  const points = Math.round(d * 100)
  return points > 0 ? `+${points}pp` : `${points}pp`
}

/* ── Retrievals over time (current vs previous) ── */
function total(values) {
  return (values || []).reduce((sum, v) => sum + (Number(v) || 0), 0)
}

const overTime = computed(() => detail.value?.retrievals_over_time || { labels: [], current: [], previous: [] })
const hasOverTime = computed(() => total(overTime.value.current) + total(overTime.value.previous) > 0)
const overTimeChart = computed(() => urlRetrievalsSpec(overTime.value))

/* ── Retrievals by model ── */
const byModelRows = computed(() => detail.value?.retrievals_by_model || [])
const hasByModel = computed(() =>
  byModelRows.value.some(r => (Number(r.current) || 0) + (Number(r.previous) || 0) > 0))
const byModelChart = computed(() => urlModelsSpec(byModelRows.value))

const NO_RETRIEVALS = { title: 'No retrievals for this URL in this period.' }

const filteredPrompts = computed(() => {
  const rows = detail.value?.prompts || []
  const q = promptSearch.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(r => (r.prompt || '').toLowerCase().includes(q))
})

async function load() {
  if (!websiteId.value || !targetUrl.value) {
    error.value = 'No URL specified.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const params = { url: targetUrl.value }
    if (route.query.topic) params.topic = route.query.topic
    if (route.query.provider) params.provider = route.query.provider
    // Silent: the page shows the failure inline.
    const res = await api.get(`/citations/websites/${websiteId.value}/urls/detail/`, { params, _silentError: true })
    detail.value = res.data || null
  } catch (e) {
    detail.value = null
    error.value = e?.displayMessage || "We couldn't load this URL."
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => [websiteId.value, targetUrl.value], load)

function backToList() {
  router.push({ name: 'sources-urls', params: { websiteId: websiteId.value } })
}

/* ── Chat detail modal ── */
const chatOpen = ref(false)
const chatIndex = ref(0)
const currentChatId = computed(() => chats.value[chatIndex.value]?.result_id || '')
function openChat(i) {
  chatIndex.value = i
  chatOpen.value = true
}
function prevChat() {
  if (chatIndex.value > 0) chatIndex.value -= 1
}
function nextChat() {
  if (chatIndex.value < chats.value.length - 1) chatIndex.value += 1
}
function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- In the board's panel: back to the list (the panel's title names it) -->
    <RouterLink v-if="inPanel" v-slot="{ href }" :to="allCitationsTo" custom>
      <a
        :href="href"
        class="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        @click="openList"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        All citations
      </a>
    </RouterLink>

    <!-- breadcrumb -->
    <div v-else class="flex items-center gap-2 text-sm text-muted-foreground">
      <span class="font-medium text-foreground">Sources</span>
      <ChevronRight class="size-3.5" />
      <button class="hover:text-foreground" @click="backToList">URLs</button>
      <ChevronRight class="size-3.5" />
      <span class="max-w-[420px] truncate font-semibold text-foreground" :title="title">{{ title }}</span>
    </div>

    <Alert v-if="error" variant="destructive">
      <CircleX />
      <AlertTitle>We couldn't load this URL.</AlertTitle>
      <AlertDescription>
        <p>{{ error }}</p>
        <button
          v-if="targetUrl"
          type="button"
          class="mt-1 font-semibold text-foreground underline underline-offset-2"
          @click="load"
        >Try again</button>
      </AlertDescription>
    </Alert>
    <div v-else-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading URL details…
    </div>

    <template v-if="detail">
      <!-- url + open link -->
      <a v-if="metrics.url" :href="metrics.url" target="_blank" rel="noopener"
        class="inline-flex items-center gap-1.5 text-sm text-[color:var(--chart-1)] hover:underline">
        <ExternalLink class="size-3.5" /> <span class="truncate max-w-[600px]">{{ metrics.url }}</span>
      </a>

      <!-- metrics bar -->
      <div class="grid grid-cols-2 gap-3 @md:grid-cols-3 @3xl:grid-cols-7">
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">URL type <MetricInfo :text="HELP.urlType" /></div>
          <div class="mt-1 text-sm font-semibold text-foreground">{{ metrics.url_type }}</div>
        </CardContent></Card>
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">Domain type <MetricInfo :text="HELP.domainType" /></div>
          <span class="mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold"
            :class="domainBadgeClass(metrics.domain_type)">{{ metrics.domain_type }}</span>
        </CardContent></Card>
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">Retrievals <MetricInfo :text="HELP.retrievals" /></div>
          <div class="mt-1 text-sm font-semibold text-foreground">
            {{ metrics.retrievals?.value }}
            <span class="text-xs font-medium" :class="deltaClass(metrics.retrievals?.delta)">{{ fmtDelta(metrics.retrievals?.delta) }}</span>
          </div>
        </CardContent></Card>
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">Citation rate <MetricInfo :text="HELP.citationRate" /></div>
          <div class="mt-1 text-sm font-semibold text-foreground">
            {{ fmtRate(metrics.citation_rate?.value) }}
            <span class="text-xs font-medium" :class="deltaClass(metrics.citation_rate?.delta)">{{ fmtRateDelta(metrics.citation_rate?.delta) }}</span>
          </div>
        </CardContent></Card>
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">No. of prompts <MetricInfo :text="HELP.prompts" /></div>
          <div class="mt-1 text-sm font-semibold text-foreground">
            {{ metrics.prompts?.value }}
            <span class="text-xs font-medium" :class="deltaClass(metrics.prompts?.delta)">{{ fmtDelta(metrics.prompts?.delta) }}</span>
          </div>
        </CardContent></Card>
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">First Seen <MetricInfo :text="HELP.firstSeen" /></div>
          <div class="mt-1 text-sm font-semibold text-foreground">{{ fmtTime(metrics.first_seen) }}</div>
        </CardContent></Card>
        <Card><CardContent class="pt-5">
          <div class="flex items-center gap-1 text-xs text-muted-foreground">Last Seen <MetricInfo :text="HELP.lastSeen" /></div>
          <div class="mt-1 text-sm font-semibold text-foreground">{{ fmtTime(metrics.last_seen) }}</div>
        </CardContent></Card>
      </div>

      <!-- Google performance (your pages only) -->
      <div v-if="realTraffic">
        <h2 class="text-base font-bold text-foreground">Google performance for this page</h2>
        <p class="mb-3 text-sm text-muted-foreground">
          What this page earns on Google, over the same period.
        </p>
        <div class="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
          <template v-if="realTraffic.gsc">
            <Card><CardContent class="pt-5">
              <div class="flex items-center gap-1 text-xs text-muted-foreground">Google clicks <MetricInfo :text="HELP.googleClicks" /></div>
              <div class="mt-1 text-lg font-bold text-foreground">
                {{ realTraffic.gsc.clicks }}
                <span class="text-xs font-medium" :class="deltaClass(realTraffic.gsc.clicks_delta)">{{ fmtDelta(realTraffic.gsc.clicks_delta) }}</span>
              </div>
            </CardContent></Card>
            <Card><CardContent class="pt-5">
              <div class="flex items-center gap-1 text-xs text-muted-foreground">Google impressions <MetricInfo :text="HELP.googleImpressions" /></div>
              <div class="mt-1 text-lg font-bold text-foreground">{{ realTraffic.gsc.impressions }}</div>
            </CardContent></Card>
            <Card><CardContent class="pt-5">
              <div class="flex items-center gap-1 text-xs text-muted-foreground">Avg. position <MetricInfo :text="HELP.googlePosition" /></div>
              <div class="mt-1 text-lg font-bold text-foreground">
                {{ realTraffic.gsc.position ?? '—' }}
                <span class="text-xs font-medium" :class="positionDeltaClass(realTraffic.gsc.position_delta)">{{ fmtDelta(realTraffic.gsc.position_delta) }}</span>
              </div>
            </CardContent></Card>
          </template>
          <Card v-else-if="!realTraffic.gsc_connected" class="col-span-2 @3xl:col-span-3"><CardContent class="pt-5 text-sm text-muted-foreground">
            Connect Search Console to see this page's Google clicks, impressions and position.
            <router-link to="/settings/connections" class="font-medium text-foreground hover:underline">Open Connections</router-link>
          </CardContent></Card>
          <Card v-else class="col-span-2 @3xl:col-span-3"><CardContent class="pt-5 text-sm text-muted-foreground">
            No Google Search data recorded for this page in this period.
          </CardContent></Card>
        </div>
      </div>

      <!-- charts -->
      <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
        <VizChart
          :spec="overTimeChart"
          :empty="hasOverTime ? null : NO_RETRIEVALS"
          :height="224"
        />
        <VizChart
          :spec="byModelChart"
          :empty="hasByModel ? null : NO_RETRIEVALS"
          :height="224"
        />
      </div>

      <!-- prompts -->
      <Card>
        <CardHeader class="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle class="text-base">Prompts</CardTitle>
            <p class="text-sm text-muted-foreground">No. of times this URL was retrieved per prompt</p>
          </div>
          <div class="relative">
            <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input v-model="promptSearch" placeholder="Search"
              class="h-9 w-48 rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th class="w-[55%] py-2 pr-3">Prompts</th>
                  <th class="py-2 pr-3">Topic</th>
                  <th class="py-2 pr-3 text-right">Retrieved</th>
                  <th class="py-2 pr-3 text-right">Citation rate</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in filteredPrompts" :key="i" class="border-b border-border/60">
                  <td class="py-3 pr-3 text-foreground">{{ p.prompt }}</td>
                  <td class="py-3 pr-3"><span class="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{{ p.topic }}</span></td>
                  <td class="py-3 pr-3 text-right tabular-nums text-foreground">{{ p.retrieved }}</td>
                  <td class="py-3 pr-3 text-right tabular-nums text-foreground">{{ fmtRate(p.citation_rate) }}</td>
                </tr>
                <tr v-if="!filteredPrompts.length"><td colspan="4" class="py-6 text-center text-sm text-muted-foreground">No prompts.</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- brands mentioned -->
      <Card>
        <CardHeader class="space-y-0">
          <CardTitle class="text-base">Brands in answers that used this page</CardTitle>
          <p class="text-sm text-muted-foreground">Which brands the AI answers named, and where, when they sourced this URL</p>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th class="py-2 pr-3">Brand</th>
                  <th class="py-2 pr-3 text-right">Position</th>
                  <th class="py-2 pr-3 text-right">Frequency</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(b, i) in brandsMentioned" :key="i" class="border-b border-border/60">
                  <td class="py-3 pr-3 font-medium text-foreground">{{ b.brand }}</td>
                  <td class="py-3 pr-3 text-right tabular-nums text-foreground">{{ b.position ?? '—' }}</td>
                  <td class="py-3 pr-3 text-right tabular-nums text-foreground">{{ b.frequency }}</td>
                </tr>
                <tr v-if="!brandsMentioned.length"><td colspan="3" class="py-6 text-center text-sm text-muted-foreground">No brands detected.</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- chats -->
      <Card>
        <CardHeader class="space-y-0">
          <CardTitle class="text-base">Chats</CardTitle>
          <p class="text-sm text-muted-foreground">Recent chats using this URL</p>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th class="w-[45%] py-2 pr-3">Chat</th>
                  <th class="py-2 pr-3">Brand mentioned</th>
                  <th class="py-2 pr-3">Mentions</th>
                  <th class="py-2 pr-3">Sources</th>
                  <th class="py-2 pr-3 text-right">Position</th>
                  <th class="py-2 pr-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, ci) in chats" :key="c.result_id"
                  class="cursor-pointer border-b border-border/60 hover:bg-muted/50" @click="openChat(ci)">
                  <td class="py-3 pr-3">
                    <div class="font-medium text-foreground line-clamp-1">{{ c.prompt }}</div>
                    <div class="text-xs text-muted-foreground line-clamp-1">{{ c.response_preview }}</div>
                  </td>
                  <td class="py-3 pr-3">
                    <span :class="c.brand_mentioned ? 'text-[color:var(--chart-2)]' : 'text-destructive'" class="text-xs font-semibold">
                      {{ c.brand_mentioned ? 'Yes' : 'No' }}
                    </span>
                  </td>
                  <td class="py-3 pr-3">
                    <div class="flex items-center -space-x-1.5">
                      <span v-for="m in c.models" :key="m"
                        class="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                        :style="{ background: modelStyle(m).color }" :title="modelStyle(m).label">{{ modelStyle(m).initial }}</span>
                    </div>
                  </td>
                  <td class="py-3 pr-3 text-xs text-muted-foreground">
                    <span class="truncate">{{ (c.sources || []).slice(0, 2).join(', ') || '—' }}</span>
                    <span v-if="(c.sources || []).length > 2"> +{{ c.sources.length - 2 }}</span>
                  </td>
                  <td class="py-3 pr-3 text-right tabular-nums text-foreground">{{ c.position ?? '—' }}</td>
                  <td class="py-3 pr-3 text-right text-xs text-muted-foreground">{{ fmtTime(c.created_at) }}</td>
                </tr>
                <tr v-if="!chats.length"><td colspan="6" class="py-6 text-center text-sm text-muted-foreground">No chats yet.</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </template>

    <ChatDetailModal
      :open="chatOpen"
      :website-id="websiteId"
      :result-id="currentChatId"
      :has-prev="chatIndex > 0"
      :has-next="chatIndex < chats.length - 1"
      @close="chatOpen = false"
      @prev="prevChat"
      @next="nextChat"
    />
  </div>
</template>
