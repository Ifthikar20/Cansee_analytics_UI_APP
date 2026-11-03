<template>
  <!-- First-run onboarding takes over the page until the user has a project. -->
  <OnboardingFlow v-if="showOnboarding" />

  <div v-else class="ov">
    <header class="ov-head">
      <div>
        <p class="ov-eyebrow">Search vs AI</p>
        <h1 class="ov-title">{{ activeName || 'Overview' }}</h1>
      </div>
      <div v-if="activeWebsiteId" class="ov-actions">
        <Button
          v-if="uncheckedCount && data?.serp_configured"
          variant="outline"
          class="rounded-full"
          :disabled="checking"
          @click="checkUnchecked"
        >
          <RefreshCw class="size-4" :class="{ 'animate-spin': checking }" />
          {{ checking ? `Checking Google ${checkProgress}` : `Check Google for ${uncheckedCount}` }}
        </Button>
        <Button class="rounded-full" @click="showAdd = true">
          <Plus class="size-4" />
          Add prompts
        </Button>
      </div>
    </header>

    <!-- No active project: the list may still be loading, may have
         failed, or nothing is picked in the header's project switcher. -->
    <section v-if="!activeWebsiteId && projectsState === 'failed'" class="ov-state">
      <p class="ov-state-title">We couldn't load your projects.</p>
      <Button variant="outline" class="ov-state-btn rounded-full" @click="loadProjects">Try again</Button>
    </section>

    <section v-else-if="!activeWebsiteId && projectsState === 'ready'" class="ov-state">
      <p class="ov-state-title">No project selected.</p>
      <p class="ov-state-sub">Add a project to start tracking prompts.</p>
      <Button class="ov-state-btn rounded-full" @click="showAddProject = true">
        <Plus class="size-4" />
        Add project
      </Button>
    </section>

    <div v-else-if="!activeWebsiteId || (loading && !data)" class="ov-skeleton">
      <Skeleton class="h-40 rounded-3xl" />
      <div class="ov-kpis">
        <Skeleton v-for="n in 5" :key="n" class="h-24 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
    </div>

    <section v-else-if="loadFailed && !data" class="ov-state">
      <p class="ov-state-title">We couldn't load this overview.</p>
      <Button variant="outline" class="ov-state-btn rounded-full" @click="load">Try again</Button>
    </section>

    <template v-else-if="data">
      <!-- A refresh failed: the numbers below are from the last good load. -->
      <Alert v-if="loadFailed" variant="destructive" class="ov-alert">
        <CircleX />
        <AlertTitle>We couldn't refresh this overview.</AlertTitle>
        <AlertDescription>
          <button type="button" class="ov-retry" @click="load">Try again</button>
        </AlertDescription>
      </Alert>

      <Alert v-if="!data.serp_configured" class="ov-alert">
        <Info />
        <AlertTitle>Google rank checks aren't available yet.</AlertTitle>
      </Alert>

      <Alert v-if="enginesUnavailable" class="ov-alert">
        <Info />
        <AlertTitle>AI engines aren't available yet.</AlertTitle>
      </Alert>

      <!-- Empty project: nothing to compare until prompts exist. -->
      <GradientCard v-if="!data.prompts.length" class="ov-banner">
        <div class="ov-banner-inner">
          <p class="ov-banner-title">Start with the questions your buyers ask.</p>
          <p class="ov-banner-sub">
            Add a few prompts and Cansee checks where Google ranks you for each one, then asks
            the AI engines the same question.
          </p>
          <div class="ov-banner-ctas">
            <button type="button" class="ov-btn-solid" @click="showAdd = true">Add prompts</button>
          </div>
        </div>
      </GradientCard>

      <template v-else>
        <GradientCard class="ov-banner">
          <div class="ov-banner-inner">
            <p class="ov-banner-title">{{ headline }}</p>
            <p class="ov-banner-sub">{{ subline }}</p>
            <div class="ov-banner-ctas">
              <button v-if="k.ai_ahead" type="button" class="ov-btn-solid" @click="focusGap('ai_ahead')">
                See where AI is ahead
              </button>
              <button v-if="k.google_ahead" type="button" class="ov-btn-ghost" @click="focusGap('google_ahead')">
                See where Google is ahead
              </button>
            </div>
          </div>
        </GradientCard>

        <section class="ov-kpis" aria-label="Key numbers">
          <VizStatTile v-for="t in tiles" :key="t.key" v-bind="t.props" />
        </section>

        <VisibilityTrendPanel
          :website-id="activeWebsiteId"
          :payload="trend"
          :loading="trendLoading"
          :error="trendFailed"
          @retry="loadTrend"
        />

        <div class="ov-grid">
          <VizChart :spec="gapSpec" :heading-level="2">
            <template #custom>
              <GapMap :prompts="data.prompts" @open="openPrompt" />
              <VizLegend class="ov-gap-legend" :items="gapLegend" />
            </template>
          </VizChart>

          <VizChart :spec="leaderboardChart" :selected="yourBrandName" :empty="leaderboardEmpty" :heading-level="2">
            <template #custom>
              <Leaderboard :brands="data.leaderboard" />
            </template>
          </VizChart>
        </div>

        <EngineHeatmapPanel :prompts="data.prompts" :engines="data.engines" @open="openPrompt" />

        <section ref="tableRef" aria-labelledby="ov-table-title">
          <header class="ov-section-head">
            <h2 id="ov-table-title" class="ov-panel-title">Every prompt</h2>
            <p class="ov-panel-sub">Biggest gaps first. Open a prompt to see what to change.</p>
          </header>
          <GapTable
            v-model:filter="filter"
            :rows="data.prompts"
            :engines="data.engines"
            :order="promptOrder"
            @open="openPrompt"
          />
        </section>
      </template>
    </template>

    <AddPromptsDialog v-if="activeWebsiteId" v-model:open="showAdd" :website-id="activeWebsiteId" @added="load" />
    <AddProjectDialog v-model:open="showAddProject" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CircleX, Info, Plus, RefreshCw } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'
import searchGapApi from '@/api/searchGap'
import visibilityApi from '@/api/visibility'
import websitesApi from '@/api/websites'
import { useToast } from '@/composables/useToast'
import { gapMeta } from '@/lib/gap'
import { GAP_MAP_CLASSES, gapMapSpec, leaderboardSpec, overviewTiles, yourBrand } from '@/lib/analytics/polishSpecs'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow.vue'
import GradientCard from '@/components/GradientCard.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizLegend from '@/components/charts/VizLegend.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import GapMap from '@/components/gap/GapMap.vue'
import GapTable from '@/components/gap/GapTable.vue'
import Leaderboard from '@/components/gap/Leaderboard.vue'
import VisibilityTrendPanel from '@/components/gap/VisibilityTrendPanel.vue'
import EngineHeatmapPanel from '@/components/gap/EngineHeatmapPanel.vue'
import AddPromptsDialog from '@/components/gap/AddPromptsDialog.vue'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const toast = useToast()

// The session marks first-run users; the flow refreshes the session (and
// routes to the paywall when required) once a project exists.
const showOnboarding = computed(() => authStore.session?.onboarding?.needs_onboarding === true)

const activeWebsiteId = computed(() => appStore.activeWebsite?.id || '')
const activeName = computed(() => appStore.activeWebsite?.name || '')

const data = ref(null)
const loading = ref(false)
const loadFailed = ref(false)
const showAdd = ref(false)
const showAddProject = ref(false)
const filter = ref('all')
const tableRef = ref(null)

const k = computed(() => data.value?.kpis || {})

// The visibility dashboard's last 30 days: the trend panel, the change on
// the AI visibility tile and the order prompts were added in (for "Newest").
// Loaded after the overview, so it never holds the page up.
const trend = ref(null)
const trendLoading = ref(false)
const trendFailed = ref(false)

const tiles = computed(() =>
  overviewTiles(k.value, trend.value?.headline).map(({ key, ...props }) => ({ key, props })),
)
const gapSpec = computed(() => gapMapSpec(data.value?.prompts))
const gapLegend = GAP_MAP_CLASSES.map((cls) => ({ key: cls, label: gapMeta(cls).label, color: gapMeta(cls).color, shape: 'dot' }))
const leaderboardChart = computed(() => leaderboardSpec(data.value?.leaderboard))
const leaderboardEmpty = computed(() =>
  data.value?.leaderboard?.length ? null : { title: 'Brands appear here once the engines have answered your prompts.' },
)
const yourBrandName = computed(() => yourBrand(data.value?.leaderboard))
const promptOrder = computed(() => (trend.value?.prompts || []).map((p) => String(p.prompt_id)))

// loading | ready | failed. On a cold load the shell fetches the project
// list too; until a list is known, the page shows a skeleton rather than
// "No project selected".
const projectsState = ref(appStore.websites.length ? 'ready' : 'loading')

async function loadProjects() {
  projectsState.value = 'loading'
  try {
    const { data: list } = await websitesApi.list({ _silentError: true })
    appStore.setWebsites(list || [])
    projectsState.value = 'ready'
  } catch {
    projectsState.value = 'failed'
  }
}

// Every engine reports whether the server holds its API key.
const enginesUnavailable = computed(() => {
  const engines = data.value?.engines || []
  return engines.length > 0 && !engines.some((e) => e.configured)
})

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

const headline = computed(() => {
  const { ai_ahead: ai = 0, google_ahead: google = 0, prompts = 0, google_checked: checked = 0 } = k.value
  if (!checked) return `Tracking ${plural(prompts, 'prompt', 'prompts')}. Check Google to see the gap.`
  if (!ai && !google) return 'Google and the AI engines agree on every checked prompt.'
  return `AI ranks you higher than Google on ${plural(ai, 'prompt', 'prompts')}. Google ranks you higher on ${google}.`
})

const subline = computed(() => {
  const { strong_both: strong = 0, invisible_both: invisible = 0, prompts = 0 } = k.value
  return `${strong} strong in both, ${invisible} invisible in both, out of ${plural(prompts, 'tracked prompt', 'tracked prompts')}.`
})

async function load() {
  const websiteId = activeWebsiteId.value
  if (!websiteId) return
  loading.value = true
  loadFailed.value = false
  try {
    // Silent: the page shows the failure inline.
    const res = await api.get(`/search-gap/websites/${websiteId}/overview/`, { _silentError: true })
    // A late answer for a project the user has switched away from.
    if (websiteId !== activeWebsiteId.value) return
    data.value = res.data
    if (res.data?.prompts?.length) loadTrend()
  } catch {
    if (websiteId === activeWebsiteId.value) loadFailed.value = true
  } finally {
    if (websiteId === activeWebsiteId.value) loading.value = false
  }
}

async function loadTrend() {
  const websiteId = activeWebsiteId.value
  if (!websiteId) return
  trendLoading.value = true
  trendFailed.value = false
  try {
    const res = await visibilityApi.dashboard(websiteId, { period: '30d' })
    if (websiteId !== activeWebsiteId.value) return
    trend.value = res.data
  } catch {
    if (websiteId === activeWebsiteId.value) trendFailed.value = true
  } finally {
    if (websiteId === activeWebsiteId.value) trendLoading.value = false
  }
}

function openPrompt(row) {
  router.push({ name: 'prompt', params: { websiteId: activeWebsiteId.value, promptId: row.prompt_id } })
}

async function focusGap(cls) {
  filter.value = cls
  await nextTick()
  tableRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Google checks for prompts that have none yet ──
const checking = ref(false)
const checkProgress = ref('')
const uncheckedCount = computed(() =>
  (data.value?.prompts || []).filter((p) => p.google.status !== 'ok').length,
)

async function checkUnchecked() {
  const pending = data.value.prompts.filter((p) => p.google.status !== 'ok')
  checking.value = true
  let queued = 0
  let failed = 0
  let unavailable = false
  try {
    for (const [i, p] of pending.entries()) {
      checkProgress.value = `${i + 1} of ${pending.length}`
      try {
        await searchGapApi.checkGoogle(activeWebsiteId.value, p.prompt_id)
        queued += 1
      } catch (err) {
        if (err.response?.data?.error === 'serpapi_not_configured') {
          unavailable = true
          break
        }
        failed += 1
      }
    }
    if (queued) toast.success(`Google checks queued for ${plural(queued, 'prompt', 'prompts')}.`)
    if (unavailable) toast.error("Google rank checks aren't available yet.")
    else if (failed) toast.error(`We couldn't queue Google checks for ${plural(failed, 'prompt', 'prompts')}.`)
  } finally {
    checking.value = false
    checkProgress.value = ''
    await load()
  }
}

onMounted(() => {
  if (!showOnboarding.value && !appStore.websites.length) loadProjects()
  load()
})
// Finishing onboarding creates the first project; pick it up.
watch(showOnboarding, (now, before) => {
  if (before && !now) loadProjects()
})
// The overview carries no :websiteId; follow the header's project switcher.
watch(activeWebsiteId, (next, prev) => {
  if (next && next !== prev) {
    data.value = null
    trend.value = null
    trendLoading.value = false
    trendFailed.value = false
    filter.value = 'all'
    load()
  }
})
</script>

<style scoped>
/* minmax(0, 1fr): without it the wide prompt table sets the column's
   minimum width and the whole page scrolls sideways on small screens. */
.ov {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.ov-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.ov-eyebrow {
  color: var(--gap-ai);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ov-title {
  margin-top: 4px;
  color: var(--foreground);
  font-size: clamp(1.6rem, 2.4vw, 2.1rem);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.1;
}

.ov-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ov-skeleton {
  display: grid;
  gap: 16px;
}

.ov-alert {
  border-radius: 14px;
}

.ov-retry {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.ov-state {
  display: grid;
  justify-items: start;
  gap: 6px;
  padding: 28px 30px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--card);
}

.ov-state-title {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
}

.ov-state-sub {
  color: var(--muted-foreground);
  font-size: 14px;
}

.ov-state-btn {
  margin-top: 8px;
}

.ov-banner-inner {
  display: grid;
  gap: 10px;
  padding: 30px 32px;
}

.ov-banner-title {
  max-width: 30ch;
  color: #ffffff;
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  text-wrap: balance;
}

.ov-banner-sub {
  max-width: 60ch;
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  line-height: 1.55;
}

.ov-banner-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.ov-btn-solid,
.ov-btn-ghost {
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ov-btn-solid {
  border: 0;
  background: #ffffff;
  color: #111114;
}

.ov-btn-solid:hover {
  background: #ececf0;
}

.ov-btn-ghost {
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: transparent;
  color: #ffffff;
}

.ov-btn-ghost:hover {
  border-color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.ov-btn-solid:focus-visible,
.ov-btn-ghost:focus-visible {
  border-radius: 999px;
}

.ov-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.ov-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 16px;
}

.ov-gap-legend {
  margin-top: 12px;
}

.ov-section-head {
  margin-bottom: 14px;
}

.ov-panel-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.ov-panel-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 13px;
}

@media (max-width: 1100px) {
  .ov-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .ov-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .ov-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ov-banner-inner {
    padding: 24px 20px;
  }
}
</style>
