<template>
  <!-- First-run onboarding takes over the page until the user has a project. -->
  <OnboardingFlow v-if="showOnboarding" />

  <div v-else class="ov">
    <header class="ov-head">
      <div>
        <p class="ov-eyebrow">Search vs AI</p>
        <h1 class="ov-title">{{ activeName || 'Your project' }}</h1>
      </div>
      <div class="ov-actions">
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

    <div v-if="loading && !data" class="ov-skeleton">
      <Skeleton class="h-40 rounded-3xl" />
      <div class="ov-kpis">
        <Skeleton v-for="n in 5" :key="n" class="h-24 rounded-2xl" />
      </div>
      <Skeleton class="h-80 rounded-2xl" />
    </div>

    <template v-else-if="data">
      <Alert v-if="!data.serp_configured" class="ov-alert">
        <Info />
        <AlertTitle>Google checks are off</AlertTitle>
        <AlertDescription>
          The server has no SerpAPI key, so Google positions can't be looked up yet. AI answers still update on schedule.
        </AlertDescription>
      </Alert>

      <!-- Empty project: nothing to compare until prompts exist. -->
      <GradientCard v-if="!data.prompts.length" class="ov-banner">
        <div class="ov-banner-inner">
          <p class="ov-banner-title">Start with the questions your buyers ask.</p>
          <p class="ov-banner-sub">
            Add a few prompts and Cansee checks where Google ranks you for each one, then asks
            ChatGPT, Claude, Gemini, Grok and Perplexity the same question.
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
          <KpiTile
            label="AI visibility"
            :value="k.ai_visibility_pct === null ? '—' : `${k.ai_visibility_pct}%`"
            hint="Share of recent AI answers that name you"
          />
          <KpiTile
            label="Avg. Google position"
            :value="k.avg_google_position === null ? '—' : `#${k.avg_google_position}`"
            :hint="k.not_in_google ? `${k.not_in_google} not in the top 100` : `${k.google_checked} of ${k.prompts} checked`"
          />
          <KpiTile label="AI ahead" :value="k.ai_ahead" :tone="GAP.ai_ahead.color" hint="AI ranks you higher than Google" />
          <KpiTile label="Google ahead" :value="k.google_ahead" :tone="GAP.google_ahead.color" hint="Google ranks you higher than AI" />
          <KpiTile label="Invisible in both" :value="k.invisible_both" :tone="GAP.invisible_both.color" hint="Neither surfaces you" />
        </section>

        <div class="ov-grid">
          <section class="ov-panel" aria-labelledby="ov-map-title">
            <header class="ov-panel-head">
              <h2 id="ov-map-title" class="ov-panel-title">The gap, prompt by prompt</h2>
              <p class="ov-panel-sub">Left is better on Google, up is better in AI answers.</p>
            </header>
            <GapMap :prompts="data.prompts" @open="openPrompt" />
          </section>

          <section class="ov-panel" aria-labelledby="ov-lb-title">
            <header class="ov-panel-head">
              <h2 id="ov-lb-title" class="ov-panel-title">Who AI recommends</h2>
              <p class="ov-panel-sub">Share of the latest answers that name each brand.</p>
            </header>
            <Leaderboard :brands="data.leaderboard" />
          </section>
        </div>

        <section ref="tableRef" aria-labelledby="ov-table-title">
          <header class="ov-section-head">
            <h2 id="ov-table-title" class="ov-panel-title">Every prompt</h2>
            <p class="ov-panel-sub">Biggest gaps first. Open a prompt to see what to change.</p>
          </header>
          <GapTable v-model:filter="filter" :rows="data.prompts" :engines="data.engines" @open="openPrompt" />
        </section>
      </template>
    </template>

    <AddPromptsDialog v-if="activeWebsiteId" v-model:open="showAdd" :website-id="activeWebsiteId" @added="load" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Info, Plus, RefreshCw } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import searchGapApi from '@/api/searchGap'
import { useToast } from '@/composables/useToast'
import { GAP } from '@/lib/gap'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow.vue'
import GradientCard from '@/components/GradientCard.vue'
import KpiTile from '@/components/gap/KpiTile.vue'
import GapMap from '@/components/gap/GapMap.vue'
import GapTable from '@/components/gap/GapTable.vue'
import Leaderboard from '@/components/gap/Leaderboard.vue'
import AddPromptsDialog from '@/components/gap/AddPromptsDialog.vue'
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
const showAdd = ref(false)
const filter = ref('all')
const tableRef = ref(null)

const k = computed(() => data.value?.kpis || {})

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
  if (!activeWebsiteId.value) return
  loading.value = true
  try {
    const res = await searchGapApi.overview(activeWebsiteId.value)
    data.value = res.data
  } catch {
    // The client interceptor already toasts; keep the last good data.
  } finally {
    loading.value = false
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
  let done = 0
  try {
    for (const p of pending) {
      checkProgress.value = `${done + 1} of ${pending.length}`
      try {
        await searchGapApi.checkGoogle(activeWebsiteId.value, p.prompt_id)
      } catch (err) {
        if (err.response?.data?.error === 'serpapi_not_configured') break
      }
      done += 1
    }
    toast.success(`Google checks queued for ${plural(done, 'prompt', 'prompts')}.`)
  } finally {
    checking.value = false
    checkProgress.value = ''
    await load()
  }
}

onMounted(load)
// The overview carries no :websiteId; follow the header's project switcher.
watch(activeWebsiteId, (next, prev) => {
  if (next && next !== prev) {
    data.value = null
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

.ov-panel {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.ov-panel-head,
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
