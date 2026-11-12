<script setup>
/**
 * Brand facts (Settings > Brand facts).
 *
 * The single place to feed the platform's understanding of the brand.
 * URLs, pasted markdown, and quick notes all become chunks in the RAG
 * knowledge base — the store that audits, agents, and the Brand
 * Security judges actually read from. One input card with three tabs;
 * everything added shows up in the sources list below with a live
 * ingest status.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  Bot, Link2, FileText, Loader2, RefreshCw, StickyNote,
  Globe, BookOpen, Package, FileCode, ShieldCheck,
} from '@lucide/vue'

import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import api from '@/api/client'
import ragApi from '@/api/rag'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import FilterBar from '@/components/brand_input/FilterBar.vue'
import SourceGroup from '@/components/brand_input/SourceGroup.vue'
import SourceDetailDrawer from '@/components/brand_input/SourceDetailDrawer.vue'

const appStore = useAppStore()
const toast = useToast()
const websiteId = computed(() => appStore.activeWebsite?.id || null)

// ── Input card tabs ───────────────────────────────────────────────────
const INPUT_TABS = [
  { key: 'url',   label: 'Add URL',       icon: Link2 },
  { key: 'paste', label: 'Paste content', icon: FileText },
  { key: 'note',  label: 'Quick note',    icon: StickyNote },
]
const inputTab = ref('url')

// ── Cansee agent crawl consent ─────────────────────────────────────────
const agentCrawl = ref({ enabled: false, enabled_at: null, last_seeded_at: null })
// loading | ready | failed. The switch only works once the real value is
// known, so a failed load never reads as "off".
const agentCrawlState = ref('loading')
const agentCrawlSaving = ref(false)

// Each load gets a ticket; an answer whose ticket is no longer the latest
// (the project switched, or a newer load started) is dropped, so another
// project's state never lands under this one's name.
let crawlTicket = 0

async function loadAgentCrawl() {
  if (!websiteId.value) return
  const ticket = ++crawlTicket
  const id = websiteId.value
  agentCrawlState.value = 'loading'
  try {
    // Silent: a failure renders next to the switch.
    const res = await api.get(`/rag/${id}/agent-crawl/`, { _silentError: true })
    if (ticket !== crawlTicket || id !== websiteId.value) return
    if (res.data) agentCrawl.value = res.data
    agentCrawlState.value = 'ready'
  } catch {
    if (ticket !== crawlTicket || id !== websiteId.value) return
    agentCrawlState.value = 'failed'
  }
}

async function toggleAgentCrawl() {
  if (agentCrawlSaving.value || !websiteId.value || agentCrawlState.value !== 'ready') return
  agentCrawlSaving.value = true
  const id = websiteId.value
  const next = !agentCrawl.value.enabled
  try {
    const res = await ragApi.setAgentCrawl(id, next)
    // Switched projects while saving: the answer is the old project's.
    if (id !== websiteId.value) return
    if (res.data) agentCrawl.value = res.data
    if (next && res.data?.seeded) {
      toast.success('Agent enabled — first crawl queued. New sources will appear below as pages are read.')
      // Give the crawl a moment to create its first pending rows.
      setTimeout(loadSources, 2000)
    } else if (next) {
      toast.success('Agent crawling enabled')
    } else {
      toast.success('Agent crawling disabled')
    }
  } catch {
    /* the client interceptor toasts */
  } finally {
    agentCrawlSaving.value = false
  }
}

function fmtWhen(d) {
  return d ? new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : ''
}

// ── Sources list (paginated + filtered server-side) ────────────────────
const sources = ref([])
const stats = ref({ total: 0, ready: 0, ingesting: 0, pending: 0, failed: 0 })
const pageMeta = ref({ count: 0, next: null, previous: null })
// Starts true so the first paint is "Loading", not an empty list.
const listLoading = ref(true)
const listLoaded = ref(false)
const listFailed = ref(false)

const filters = ref({
  status: '',
  kind: '',
  domain: '',
  search: '',
})
const page = ref(1)
const pageSize = 25

// Debounce search input so we don't fire a request per keystroke.
let searchTimer = null
watch(() => filters.value.search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadSources()
  }, 250)
})
watch([
  () => filters.value.status,
  () => filters.value.kind,
  () => filters.value.domain,
], () => { page.value = 1; loadSources() })
watch(page, () => loadSources())

let listTicket = 0

async function loadSources() {
  if (!websiteId.value) return
  const ticket = ++listTicket
  const id = websiteId.value
  const current = () => ticket === listTicket && id === websiteId.value
  listLoading.value = true
  try {
    const params = { page: page.value, page_size: pageSize }
    if (filters.value.status) params.status = filters.value.status
    if (filters.value.kind) params.kind = filters.value.kind
    if (filters.value.domain) params.domain = filters.value.domain
    if (filters.value.search) params.search = filters.value.search

    // Silent: the list shows the failure inline.
    const res = await api.get(`/rag/${id}/sources/`, { params, _silentError: true })
    if (!current()) return
    sources.value = res.data || []
    const meta = res.meta || {}
    pageMeta.value = {
      count: meta.count || 0,
      next: meta.next,
      previous: meta.previous,
    }
    if (meta.stats) stats.value = meta.stats
    listLoaded.value = true
    listFailed.value = false
    syncIngestPolling()
  } catch {
    if (current()) listFailed.value = true
  } finally {
    if (current()) listLoading.value = false
  }
}

// ── Live ingest status ────────────────────────────────────────────────
// URL ingest runs on a background worker: the POST returns 202 and the
// source moves pending -> ingesting -> ready/failed server-side. Poll the
// list while anything is still in flight so the user watches the status
// change instead of wondering whether the click did anything.
const POLL_MS = 4000
const POLL_MAX = 75 // give up after ~5 minutes
// Keep polling for a few rounds even when nothing looks active yet — a
// just-queued crawl has no source rows until the worker fetches the first
// page, so an immediate "nothing in flight" reading would stop too early.
const POLL_MIN_ROUNDS = 5

let ingestTimer = null
let pollRounds = 0

const activeIngestCount = computed(
  () => (stats.value.pending || 0) + (stats.value.ingesting || 0),
)

function startIngestPolling() {
  pollRounds = 0
  if (ingestTimer) return
  ingestTimer = setInterval(async () => {
    pollRounds += 1
    await loadSources()
    if (
      (activeIngestCount.value === 0 && pollRounds >= POLL_MIN_ROUNDS)
      || pollRounds >= POLL_MAX
    ) {
      stopIngestPolling()
    }
  }, POLL_MS)
}

function stopIngestPolling() {
  if (ingestTimer) {
    clearInterval(ingestTimer)
    ingestTimer = null
  }
}

// Called after every list load: if the server says something is still
// pending or ingesting, make sure a poll loop is running (covers page
// reloads while a crawl started earlier is still working).
function syncIngestPolling() {
  if (activeIngestCount.value > 0 && !ingestTimer) startIngestPolling()
}

onBeforeUnmount(stopIngestPolling)

function clearFilters() {
  filters.value = { status: '', kind: '', domain: '', search: '' }
  page.value = 1
  loadSources()
}

// Domain grouping (derived from the current page). This is a pure UI
// transform — the backend returns a flat paginated list; we group by
// `domain` client-side so a 50-page crawl collapses into one node.
const groupedSources = computed(() => {
  const map = new Map()
  for (const s of sources.value) {
    const host = s.domain || 'other'
    if (!map.has(host)) {
      map.set(host, { host, sources: [], chunks: 0, ready: 0, pending: 0, ingesting: 0, failed: 0 })
    }
    const g = map.get(host)
    g.sources.push(s)
    g.chunks += s.chunk_count || 0
    if (s.status && Object.prototype.hasOwnProperty.call(g, s.status)) {
      g[s.status] += 1
    }
  }
  return [...map.values()].sort((a, b) => b.sources.length - a.sources.length)
})

// Domains that exist across the current page, so the FilterBar's domain
// dropdown reflects reality. When pagination is on this is only the
// current page's domains — good enough as a discoverability aid.
const domainOptions = computed(() => groupedSources.value.map((g) => g.host))

const totalPages = computed(() => Math.max(1, Math.ceil(pageMeta.value.count / pageSize)))

// ── Detail drawer ─────────────────────────────────────────────────────
const selectedSource = ref(null)
function openDetail(source) { selectedSource.value = source }
function closeDetail() { selectedSource.value = null }

async function reingestSource(source) {
  try {
    await ragApi.reingestSource(websiteId.value, source.id)
    toast.success('Reingest queued — status updates below')
    await loadSources()
    startIngestPolling()
  } catch (err) {
    const msg = err?.response?.data?.error
      || err?.response?.data?.error?.message
      || 'Failed to queue reingest'
    toast.error(msg)
  }
}

async function deleteSource(source) {
  if (!confirm(`Delete "${source.title || source.url}"? This removes it from your brand knowledge.`)) return
  try {
    await ragApi.deleteSource(websiteId.value, source.id)
    toast.success('Source deleted')
    await loadSources()
  } catch {
    toast.error('Failed to delete source')
  }
}

// ── Add-URL form ───────────────────────────────────────────────────────
const KIND_OPTIONS = [
  { value: 'homepage', label: 'Homepage', icon: Globe },
  { value: 'blog',     label: 'Blog post', icon: BookOpen },
  { value: 'product',  label: 'Product',   icon: Package },
  { value: 'docs',     label: 'Docs',      icon: FileCode },
  { value: 'review',   label: 'Review',    icon: ShieldCheck },
  { value: 'other',    label: 'Other',     icon: Link2 },
]

const form = ref({
  url: '',
  title: '',
  kind: 'other',
  crawl: false,
  page_cap: 12,
  depth: 1,
})
const submitting = ref(false)

async function submitSource() {
  if (!websiteId.value || !form.value.url) return
  submitting.value = true
  try {
    await ragApi.addSource(websiteId.value, { ...form.value })
    toast.success(
      form.value.crawl
        ? 'Site crawl queued — pages appear below as they are ingested'
        : 'URL queued — watch its status update below',
    )
    form.value = { url: '', title: '', kind: 'other', crawl: false, page_cap: 12, depth: 1 }
    page.value = 1
    await loadSources()
    startIngestPolling()
  } catch (err) {
    const msg = err?.response?.data?.error
      || err?.response?.data?.url?.[0]
      || 'Failed to queue source'
    toast.error(msg)
  } finally {
    submitting.value = false
  }
}

// ── Paste-text form ───────────────────────────────────────────────────
const pasteForm = ref({
  title: '',
  kind: 'other',
  text: '',
})
const pasteSubmitting = ref(false)

async function submitPaste() {
  if (!websiteId.value || pasteForm.value.text.trim().length < 20 || !pasteForm.value.title.trim()) return
  pasteSubmitting.value = true
  try {
    await ragApi.uploadText(websiteId.value, { ...pasteForm.value })
    toast.success('Content added to your brand knowledge')
    pasteForm.value = { title: '', kind: 'other', text: '' }
    page.value = 1
    await loadSources()
  } catch (err) {
    const msg = err?.response?.data?.error
      || err?.response?.data?.text?.[0]
      || err?.response?.data?.title?.[0]
      || 'Failed to save text'
    toast.error(msg)
  } finally {
    pasteSubmitting.value = false
  }
}

// ── Quick-note form ───────────────────────────────────────────────────
// Same upload endpoint as paste — a note is just short free text with a
// title, filed under kind "other". Kept as its own tab so jotting a fact
// ("We never offer lifetime deals") doesn't feel like a document upload.
const noteForm = ref({ title: '', text: '' })
const noteSubmitting = ref(false)

async function submitNote() {
  if (!websiteId.value || noteForm.value.text.trim().length < 20 || !noteForm.value.title.trim()) return
  noteSubmitting.value = true
  try {
    await ragApi.uploadText(websiteId.value, {
      title: noteForm.value.title,
      kind: 'other',
      text: noteForm.value.text,
    })
    toast.success('Note added to your brand knowledge')
    noteForm.value = { title: '', text: '' }
    page.value = 1
    await loadSources()
  } catch (err) {
    const msg = err?.response?.data?.error
      || err?.response?.data?.text?.[0]
      || err?.response?.data?.title?.[0]
      || 'Failed to save note'
    toast.error(msg)
  } finally {
    noteSubmitting.value = false
  }
}

onMounted(async () => {
  if (websiteId.value) {
    loadAgentCrawl()
    await loadSources()
  }
})
watch(websiteId, async (v) => {
  stopIngestPolling()
  // Another project's list must never stand in for this one's.
  sources.value = []
  stats.value = { total: 0, ready: 0, ingesting: 0, pending: 0, failed: 0 }
  listLoaded.value = false
  listFailed.value = false
  selectedSource.value = null
  agentCrawl.value = { enabled: false, enabled_at: null, last_seeded_at: null }
  agentCrawlState.value = 'loading'
  if (v) {
    page.value = 1
    loadAgentCrawl()
    await loadSources()
  }
})
</script>

<template>
  <p v-if="!websiteId" class="text-sm text-muted-foreground">
    Pick a project in the header to add brand facts.
  </p>

  <div v-else class="flex flex-col gap-6">
    <!-- ── Header / breadcrumb ── -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="max-w-xl text-sm text-muted-foreground">
        What's true about your brand. Cansee checks every AI answer against these facts.
      </p>
      <Button variant="ghost" @click="loadSources">
        <RefreshCw class="size-3.5" :class="{ 'animate-spin': listLoading }" />
        Refresh
      </Button>
    </div>

    <!-- ── Intro ── -->
    <div>
      <h2 class="text-lg font-bold text-foreground">Teach the platform your brand</h2>
      <p class="text-sm text-muted-foreground">
        URLs, pasted content, and quick notes added here become part of the platform's
        understanding of your brand — used to ground prompt runs, agents, and Brand Security checks.
      </p>
    </div>

    <!-- ── Cansee AI agent crawl consent ── -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex items-start gap-3">
          <button
            type="button"
            role="switch"
            :aria-checked="agentCrawl.enabled"
            :disabled="agentCrawlSaving || agentCrawlState !== 'ready'"
            class="mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center transition-colors disabled:opacity-60"
            :class="agentCrawl.enabled ? 'bg-[color:var(--chart-2)]' : 'bg-input'"
            @click="toggleAgentCrawl"
          >
            <span
              class="inline-block size-4 transform bg-background shadow-sm transition-transform"
              :class="agentCrawl.enabled ? 'translate-x-4' : 'translate-x-0.5'"
            />
          </button>
          <div class="flex-1">
            <div class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Bot class="size-4" />
              Allow the Cansee AI agent to crawl your site
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              When enabled, the agent may crawl your website to seek knowledge about your brand
              on its own — pages it reads become sources below, grounding prompt runs, agents,
              and Brand Security checks. Turning it off stops future agent crawls; nothing
              already ingested is removed.
            </p>
            <p v-if="agentCrawlState === 'failed'" class="mt-1.5 text-xs text-destructive">
              Couldn't load this setting.
              <button type="button" class="font-medium text-foreground underline underline-offset-2" @click="loadAgentCrawl">Try again</button>
            </p>
            <p v-else-if="agentCrawl.enabled && agentCrawl.last_seeded_at" class="mt-1.5 text-xs text-muted-foreground">
              <span class="font-medium text-foreground">Last agent crawl queued:</span>
              {{ fmtWhen(agentCrawl.last_seeded_at) }}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- ── Single input card with tabs ── -->
    <Card>
      <CardContent class="pt-6">
        <!-- Tab switch -->
        <div class="mb-5 flex rounded-xl bg-secondary p-1">
          <button
            v-for="t in INPUT_TABS"
            :key="t.key"
            type="button"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors"
            :class="inputTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            @click="inputTab = t.key"
          >
            <component :is="t.icon" class="size-3.5" />
            {{ t.label }}
          </button>
        </div>

        <!-- URL tab -->
        <form v-if="inputTab === 'url'" class="flex flex-col gap-4" @submit.prevent="submitSource">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">URL</label>
            <div class="relative">
              <Link2 class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="form.url"
                type="url"
                required
                placeholder="https://www.your-brand.com/about"
                class="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_220px]">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">Title (optional)</label>
              <input
                v-model="form.title"
                type="text"
                placeholder="Auto-detected from page if blank"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">Kind</label>
              <select
                v-model="form.kind"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option v-for="k in KIND_OPTIONS" :key="k.value" :value="k.value">{{ k.label }}</option>
              </select>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <button
              type="button"
              role="switch"
              :aria-checked="form.crawl"
              class="mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center transition-colors"
              :class="form.crawl ? 'bg-[color:var(--chart-2)]' : 'bg-input'"
              @click="form.crawl = !form.crawl"
            >
              <span
                class="inline-block size-4 transform bg-background shadow-sm transition-transform"
                :class="form.crawl ? 'translate-x-4' : 'translate-x-0.5'"
              />
            </button>
            <div class="flex-1">
              <div class="text-sm font-semibold text-foreground">Crawl the whole site</div>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Follows links from the URL up to the configured depth. Costs 5× the rate limit of a single URL.
              </p>
              <div v-if="form.crawl" class="mt-3 grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Page cap</label>
                  <input
                    v-model.number="form.page_cap"
                    type="number" min="1" max="50"
                    class="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Depth</label>
                  <input
                    v-model.number="form.depth"
                    type="number" min="0" max="2"
                    class="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2">
            <Button type="submit" :disabled="submitting || !form.url">
              <Loader2 v-if="submitting" class="size-3.5 animate-spin" />
              {{ form.crawl ? 'Queue crawl' : 'Add URL' }}
            </Button>
          </div>
        </form>

        <!-- Paste tab -->
        <form v-else-if="inputTab === 'paste'" class="flex flex-col gap-4" @submit.prevent="submitPaste">
          <p class="text-sm text-muted-foreground">
            Brand deck copy, FAQ answers, product one-pagers, markdown files — anything that
            describes how your brand should be represented.
          </p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_220px]">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">Title</label>
              <div class="relative">
                <FileText class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  v-model="pasteForm.title"
                  type="text"
                  required
                  placeholder="e.g. Brand voice notes, Refund policy, About us copy"
                  class="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">Kind</label>
              <select
                v-model="pasteForm.kind"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option v-for="k in KIND_OPTIONS" :key="k.value" :value="k.value">{{ k.label }}</option>
              </select>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">
              Text or markdown
              <span class="ml-1 font-normal text-muted-foreground/70">({{ pasteForm.text.length }} chars, min 20)</span>
            </label>
            <textarea
              v-model="pasteForm.text"
              rows="10"
              required
              minlength="20"
              maxlength="200000"
              placeholder="Paste your brand copy here. Section headings (# Heading or === HEADING ===) improve chunking."
              class="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div class="flex items-center justify-end gap-2">
            <Button
              type="submit"
              :disabled="pasteSubmitting || pasteForm.text.trim().length < 20 || !pasteForm.title.trim()"
            >
              <Loader2 v-if="pasteSubmitting" class="size-3.5 animate-spin" />
              Add to brand knowledge
            </Button>
          </div>
        </form>

        <!-- Quick-note tab -->
        <form v-else class="flex flex-col gap-4" @submit.prevent="submitNote">
          <p class="text-sm text-muted-foreground">
            A quick fact or rule the platform should always know — pricing positions,
            things your brand never claims, naming conventions.
          </p>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">Title</label>
            <div class="relative">
              <StickyNote class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="noteForm.title"
                type="text"
                required
                placeholder="e.g. No lifetime deals, Pricing policy, Founder story"
                class="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium font-mono uppercase tracking-wider text-muted-foreground">
              Note
              <span class="ml-1 font-normal text-muted-foreground/70">({{ noteForm.text.length }} chars, min 20)</span>
            </label>
            <textarea
              v-model="noteForm.text"
              rows="5"
              required
              minlength="20"
              maxlength="200000"
              placeholder="e.g. We never discount more than 20%, and we don't offer a free tier."
              class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div class="flex items-center justify-end gap-2">
            <Button
              type="submit"
              :disabled="noteSubmitting || noteForm.text.trim().length < 20 || !noteForm.title.trim()"
            >
              <Loader2 v-if="noteSubmitting" class="size-3.5 animate-spin" />
              Save note
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <!-- Live ingest activity: visible feedback that a queued URL or crawl
         is actually being worked on, without the user having to refresh. -->
    <div
      v-if="activeIngestCount > 0"
      class="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3"
    >
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
      <div class="text-sm text-foreground">
        {{ activeIngestCount }} source{{ activeIngestCount === 1 ? '' : 's' }} being read and added to your brand knowledge.
        <span class="text-muted-foreground">Statuses below refresh automatically.</span>
      </div>
    </div>

    <!-- ── What the platform knows ── -->
    <Card>
      <CardContent class="pt-6">
        <div class="mb-4">
          <h2 class="text-base font-bold text-foreground">Your brand knowledge</h2>
          <p class="text-sm text-muted-foreground">
            <template v-if="listLoaded">{{ stats.total }} source{{ stats.total === 1 ? '' : 's' }} indexed.</template>
            Click a row to inspect its content or test a query against it.
          </p>
        </div>

        <FilterBar
          v-model:status="filters.status"
          v-model:kind="filters.kind"
          v-model:search="filters.search"
          v-model:domain="filters.domain"
          :stats="stats"
          :domain-options="domainOptions"
          @clear="clearFilters"
        />

        <div class="mt-4">
          <div v-if="listLoading && !sources.length" class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Loading sources…
          </div>

          <div v-else-if="listFailed && !sources.length" class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            We couldn't load your brand facts.
            <Button variant="outline" size="sm" @click="loadSources">Try again</Button>
          </div>

          <div v-else-if="!sources.length" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <template v-if="stats.total === 0">
              Nothing here yet. Add a URL, paste content, or save a note above — it becomes
              part of your brand knowledge and shows up in this list.
            </template>
            <template v-else>
              No sources match this filter. Try clearing filters, or search another term.
            </template>
          </div>

          <div v-else class="flex flex-col gap-3">
            <p v-if="listFailed" class="text-sm text-destructive">
              We couldn't refresh your brand facts.
              <button type="button" class="font-medium text-foreground underline underline-offset-2" @click="loadSources">Try again</button>
            </p>
            <SourceGroup
              v-for="group in groupedSources"
              :key="group.host"
              :group="group"
              @select="openDetail"
              @reingest="reingestSource"
              @delete="deleteSource"
            />
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="pageMeta.count > pageSize" class="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p class="text-xs text-muted-foreground">
            Page {{ page }} of {{ totalPages }} · {{ pageMeta.count }} total
          </p>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              :disabled="!pageMeta.previous || listLoading"
              @click="page = Math.max(1, page - 1)"
            >Previous</Button>
            <Button
              variant="ghost"
              size="sm"
              :disabled="!pageMeta.next || listLoading"
              @click="page = Math.min(totalPages, page + 1)"
            >Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Detail drawer -->
    <SourceDetailDrawer
      v-if="selectedSource"
      :website-id="websiteId"
      :source="selectedSource"
      @close="closeDetail"
      @reingested="loadSources"
      @deleted="loadSources"
    />
  </div>
</template>
