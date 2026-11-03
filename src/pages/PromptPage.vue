<template>
  <div class="pp">
    <router-link :to="{ name: 'dashboard' }" class="pp-back">
      <ArrowLeft class="size-4" aria-hidden="true" />
      Overview
    </router-link>

    <div v-if="loading && !detail" class="pp-skeleton">
      <Skeleton class="h-10 w-2/3 rounded-xl" />
      <Skeleton class="h-36 rounded-3xl" />
      <Skeleton class="h-72 rounded-2xl" />
    </div>

    <p v-else-if="notFound" class="pp-missing">
      This prompt isn't tracked in this project any more.
      <router-link :to="{ name: 'dashboard' }">Back to the overview</router-link>
    </p>

    <section v-else-if="loadFailed && !detail" class="pp-state">
      <p class="pp-state-title">We couldn't load this prompt.</p>
      <Button variant="outline" class="rounded-full" @click="load">Try again</Button>
    </section>

    <template v-else-if="detail">
      <p v-if="loadFailed" class="pp-refresh-error">
        We couldn't refresh this prompt.
        <button type="button" class="pp-retry" @click="load">Try again</button>
      </p>

      <header class="pp-head">
        <div class="pp-head-text">
          <p class="pp-eyebrow">Prompt</p>
          <h1 class="pp-title">{{ detail.prompt.text }}</h1>
          <p class="pp-meta">
            <span v-if="detail.prompt.location">Searched from {{ detail.prompt.location.toUpperCase() }}</span>
            <span v-else>Global</span>
            <span v-if="detail.google.checked_at"> · Google checked {{ timeAgo(detail.google.checked_at) }}</span>
          </p>
        </div>
        <div class="pp-actions">
          <Button class="rounded-full" :disabled="checking" @click="checkNow">
            <RefreshCw class="size-4" :class="{ 'animate-spin': checking }" />
            {{ checking ? 'Checking...' : 'Check now' }}
          </Button>
          <Button variant="outline" class="rounded-full" @click="showSchedule = true">
            <CalendarClock class="size-4" />
            Schedule
          </Button>
          <Button variant="ghost" class="rounded-full" :disabled="archiving" @click="archive">
            <Archive class="size-4" />
            Archive
          </Button>
        </div>
      </header>

      <GradientCard class="pp-verdict">
        <div class="pp-verdict-inner">
          <div class="pp-verdict-badge"><GapBadge :cls="detail.gap.class" :value="detail.gap.value" show-value /></div>
          <p class="pp-verdict-text">{{ detail.verdict }}</p>
          <p v-if="detail.gap.ai_score !== null && detail.gap.search_score !== null" class="pp-verdict-scores">
            AI score {{ detail.gap.ai_score }} against a Google score of {{ detail.gap.search_score }}.
            {{ gapMeta(detail.gap.class).blurb }}
          </p>
        </div>
      </GradientCard>

      <section class="pp-section" aria-labelledby="pp-actions-title">
        <header class="pp-section-head">
          <h2 id="pp-actions-title" class="pp-section-title">Where to change</h2>
          <p class="pp-section-sub">Ranked by how big the gap is and how many engines it affects.</p>
        </header>
        <ActionList :actions="detail.actions" />
      </section>

      <section class="pp-section" aria-labelledby="pp-compare-title">
        <header class="pp-section-head">
          <h2 id="pp-compare-title" class="pp-section-title">Google next to every engine</h2>
          <p class="pp-section-sub">Same question, same day. The badge on each engine is its gap against Google.</p>
        </header>
        <div class="pp-compare">
          <GoogleCard :google="detail.google" :available="detail.serp_configured" />
          <p v-if="!anyEngineConfigured" class="pp-engines-empty">AI engines aren't available yet.</p>
          <p v-else-if="!anyEngineAnswered" class="pp-engines-empty">No engine results yet. Use Check now.</p>
          <div v-else class="pp-engines">
            <EngineCard v-for="e in detail.engines" :key="e.key" :engine="e" @read="openAnswer" />
          </div>
        </div>
      </section>

      <section class="pp-section" aria-labelledby="pp-findings-title">
        <header class="pp-section-head">
          <h2 id="pp-findings-title" class="pp-section-title">What AI gets wrong</h2>
          <p class="pp-section-sub">Claims in these answers that conflict with your brand facts.</p>
        </header>
        <PromptSecurityFindings :website-id="websiteId" :prompt-id="promptId" />
      </section>
    </template>

    <PromptScheduleModal
      v-if="detail"
      v-model="showSchedule"
      :website-id="websiteId"
      :prompt-id="promptId"
      @run-now="rerunEngines"
    />
    <ChatDetailModal
      :website-id="websiteId"
      :result-id="answerId"
      :open="!!answerId"
      @close="answerId = ''"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Archive, CalendarClock, RefreshCw } from '@lucide/vue'
import api from '@/api/client'
import searchGapApi from '@/api/searchGap'
import promptLibrary from '@/api/promptLibrary'
import { useToast } from '@/composables/useToast'
import { gapMeta } from '@/lib/gap'
import { timeAgo } from '@/utils/timeAgo'
import GradientCard from '@/components/GradientCard.vue'
import GapBadge from '@/components/gap/GapBadge.vue'
import ActionList from '@/components/gap/ActionList.vue'
import GoogleCard from '@/components/gap/GoogleCard.vue'
import EngineCard from '@/components/gap/EngineCard.vue'
import ChatDetailModal from '@/components/ChatDetailModal.vue'
import PromptScheduleModal from '@/components/prompt_library/PromptScheduleModal.vue'
import PromptSecurityFindings from '@/components/prompt_library/PromptSecurityFindings.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
  promptId: { type: String, required: true },
})

const router = useRouter()
const toast = useToast()

const detail = ref(null)
const loading = ref(false)
const loadFailed = ref(false)
const notFound = ref(false)
const checking = ref(false)
const archiving = ref(false)
const showSchedule = ref(false)
const answerId = ref('')
let refreshTimer = null

// Each engine says whether the server holds its API key.
const anyEngineConfigured = computed(() => (detail.value?.engines || []).some((e) => e.configured))
const anyEngineAnswered = computed(() => (detail.value?.engines || []).some((e) => e.answers))

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    // Silent: the page shows the failure inline.
    const res = await api.get(
      `/search-gap/websites/${props.websiteId}/prompts/${props.promptId}/`,
      { _silentError: true },
    )
    detail.value = res.data
    notFound.value = false
  } catch (err) {
    if (err.response?.status === 404) notFound.value = true
    else loadFailed.value = true
  } finally {
    loading.value = false
  }
}

// Checks run in the background; look again once they have had time to land.
function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(load, 8000)
}

// The API answers some failures with a bare code ({"error": "code"}) and
// others with {"error": {"code", "message"}}.
function errorCode(err) {
  const e = err?.response?.data?.error
  return typeof e === 'string' ? e : e?.code || ''
}

// Queue AI engine answers for this prompt. Silent: callers report the
// outcome in a single toast.
function askEngines(payload = {}) {
  return api.post(
    `/prompt-library/websites/${props.websiteId}/prompts/${props.promptId}/crawl/`,
    payload,
    { _silentError: true },
  )
}

const CHECK_NOTES = {
  engines: { off: "AI engines aren't available yet.", failed: "We couldn't ask the AI engines." },
  google: { off: "Google rank checks aren't available yet.", failed: "We couldn't start the Google check." },
}

function outcome(result, offCode) {
  if (result.status === 'fulfilled') return 'queued'
  return errorCode(result.reason) === offCode ? 'off' : 'failed'
}

// Google (forced fresh) plus any engine that has not answered yet. A full
// re-run of every engine is the schedule dialog's "Run now".
async function checkNow() {
  checking.value = true
  const googleOn = Boolean(detail.value?.serp_configured)
  const [enginesResult, googleResult] = await Promise.allSettled([
    askEngines({ mode: 'missing' }),
    googleOn ? searchGapApi.checkGoogle(props.websiteId, props.promptId, { force: true }) : Promise.resolve(),
  ])
  checking.value = false

  const engines = outcome(enginesResult, 'no_llm_provider_configured')
  const google = googleOn ? outcome(googleResult, 'serpapi_not_configured') : 'off'
  const started = []
  if (google === 'queued') started.push('Google')
  if (engines === 'queued') started.push('any engine without an answer')
  const notes = [CHECK_NOTES.engines[engines], CHECK_NOTES.google[google]].filter(Boolean)

  if (!started.length) {
    toast.error(notes.join(' '))
    return
  }
  toast.success([`Checking ${started.join(' and ')}.`, ...notes].join(' '))
  await load()
  refreshSoon()
}

async function rerunEngines() {
  try {
    await askEngines()
    toast.success('Asking the AI engines again.')
    refreshSoon()
  } catch (err) {
    toast.error(
      errorCode(err) === 'no_llm_provider_configured'
        ? "AI engines aren't available yet."
        : "We couldn't start the run. Please try again.",
    )
  }
}

async function archive() {
  archiving.value = true
  try {
    await promptLibrary.setArchived(detail.value.prompt.brand_prompt_id, true)
    toast.success('Prompt archived. It no longer runs or counts in the overview.')
    router.push({ name: 'dashboard' })
  } catch {
    archiving.value = false
  }
}

function openAnswer(engine) {
  answerId.value = engine.latest_result_public_id
}

// A different prompt starts from a clean slate, so a failed load never
// shows the previous prompt's data.
watch(() => [props.websiteId, props.promptId], () => {
  clearTimeout(refreshTimer)
  detail.value = null
  notFound.value = false
  load()
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(refreshTimer))
</script>

<style scoped>
.pp {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.pp-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  color: var(--muted-foreground);
  font-size: 13.5px;
  font-weight: 500;
}

.pp-back:hover {
  color: var(--foreground);
  opacity: 1;
}

.pp-skeleton {
  display: grid;
  gap: 16px;
}

.pp-missing {
  color: var(--muted-foreground);
}

.pp-missing a {
  text-decoration: underline;
}

.pp-state {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 28px 30px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--card);
}

.pp-state-title {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
}

.pp-refresh-error {
  color: var(--destructive);
  font-size: 13.5px;
}

.pp-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--foreground);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.pp-engines-empty {
  align-self: start;
  padding: 18px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.pp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.pp-head-text {
  min-width: 0;
  max-width: 820px;
}

.pp-eyebrow {
  color: var(--gap-ai);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pp-title {
  margin-top: 4px;
  color: var(--foreground);
  font-size: clamp(1.5rem, 2.6vw, 2.2rem);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.12;
  text-wrap: balance;
}

.pp-meta {
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.pp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pp-verdict-inner {
  display: grid;
  gap: 8px;
  padding: 26px 30px;
}

.pp-verdict-badge :deep(.gap-badge) {
  background: rgba(255, 255, 255, 0.92);
}

.pp-verdict-text {
  color: #ffffff;
  font-size: clamp(1.25rem, 2.1vw, 1.75rem);
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.25;
  text-wrap: balance;
}

.pp-verdict-scores {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
}

.pp-section-head {
  margin-bottom: 12px;
}

.pp-section-title {
  color: var(--foreground);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.pp-section-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.pp-compare {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(0, 2fr);
  align-items: start;
  gap: 16px;
}

.pp-engines {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

@media (max-width: 960px) {
  .pp-compare {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .pp-verdict-inner {
    padding: 22px 20px;
  }
}
</style>
