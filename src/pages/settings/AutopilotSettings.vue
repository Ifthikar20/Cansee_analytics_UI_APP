<template>
  <SettingsShell active="autopilot">
    <p v-if="!websiteId" class="ap-muted">Pick a project in the header first.</p>

    <p v-else-if="state === 'loading'" class="ap-muted">Loading Autopilot...</p>

    <div v-else-if="state === 'failed'" class="ap-failed">
      <p class="ap-muted">We couldn't load Autopilot.</p>
      <Button variant="outline" class="ap-btn" @click="load">Try again</Button>
    </div>

    <SettingsSection v-else-if="payload.available === false" label="Project" title="Autopilot" :description="DESCRIPTION">
      <p class="ap-muted">Autopilot is turned off on this server.</p>
    </SettingsSection>

    <SettingsSection v-else-if="planBlocked" label="Project" title="Autopilot" :description="DESCRIPTION">
      <div class="ap-failed">
        <p class="ap-muted">Autopilot is part of the 100 and 200 prompt plans.</p>
        <Button as-child class="ap-btn">
          <router-link :to="{ name: 'billing' }">See plans</router-link>
        </Button>
      </div>
    </SettingsSection>

    <template v-else>
      <SettingsSection label="Project" title="Autopilot" :description="DESCRIPTION">
        <form id="ap-form" class="ap-form" novalidate @submit.prevent="save">
          <p v-if="paused" class="ap-notice" role="status">
            Autopilot paused after 3 failed runs. Check the last run below, then turn it back on.
          </p>

          <div class="ap-group">
            <div class="ap-switch-row">
              <input
                id="ap-enabled"
                v-model="draft.enabled"
                type="checkbox"
                role="switch"
                class="ap-switch"
                :aria-describedby="errors.enabled ? 'ap-enabled-error' : undefined"
              />
              <label for="ap-enabled" class="ap-switch-label">Run Autopilot every day</label>
              <HelpTip :text="TIPS.settings.autopilot" label="About the daily run" />
            </div>
            <p v-if="errors.enabled" id="ap-enabled-error" class="ap-error">{{ errors.enabled }}</p>
          </div>

          <div class="ap-group">
            <div class="ap-time-row">
              <label for="ap-run-time" class="ap-label">Start at</label>
              <select id="ap-run-time" v-model="draft.run_time" class="ap-select" aria-describedby="ap-time-help">
                <option v-for="t in runTimes" :key="t" :value="t">{{ t }}</option>
              </select>
              <label for="ap-timezone" class="ap-label">in</label>
              <select id="ap-timezone" v-model="draft.timezone" class="ap-select ap-zone" aria-describedby="ap-time-help">
                <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
              </select>
            </div>
            <p id="ap-time-help" class="ap-help">Runs once a day at about this time. A run takes a few minutes.</p>
            <p v-if="errors.run_time" class="ap-error">{{ errors.run_time }}</p>
            <p v-if="errors.timezone" class="ap-error">{{ errors.timezone }}</p>
          </div>

          <fieldset class="ap-group ap-fieldset">
            <legend class="ap-legend">What runs</legend>

            <div class="ap-check">
              <input id="ap-engines" v-model="draft.run_engines" type="checkbox" aria-describedby="ap-engines-help" />
              <div class="ap-check-text">
                <label for="ap-engines">{{ enginesLabel }}</label>
                <p id="ap-engines-help" class="ap-help">Asks each tracked prompt once per engine, the way a buyer would.</p>
              </div>
            </div>

            <div v-if="googleConfigured" class="ap-check">
              <input id="ap-google" v-model="draft.run_google" type="checkbox" aria-describedby="ap-google-help" />
              <div class="ap-check-text">
                <div class="ap-check-line">
                  <label for="ap-google">Check Google page one</label>
                  <select
                    v-model="draft.google_cadence"
                    class="ap-select ap-cadence"
                    aria-label="How often to check Google"
                    :disabled="!draft.run_google"
                  >
                    <option value="daily">Every day</option>
                    <option value="weekly">Once a week</option>
                  </select>
                </div>
                <p id="ap-google-help" class="ap-help">{{ googleHelp }}</p>
                <p v-if="errors.google_cadence" class="ap-error">{{ errors.google_cadence }}</p>
              </div>
            </div>

            <div class="ap-check">
              <input id="ap-analysis" v-model="draft.run_analysis" type="checkbox" aria-describedby="ap-analysis-help" />
              <div class="ap-check-text">
                <label for="ap-analysis">Analyze new answers that name you</label>
                <p id="ap-analysis-help" class="ap-help">Reads the claims and tone of new answers (Fact check and Sentiment).</p>
              </div>
            </div>
          </fieldset>

          <div v-if="planText || costs.length" class="ap-lines">
            <p v-if="planText" class="ap-line">{{ planText }}</p>
            <p v-for="line in costs" :key="line" class="ap-line">{{ line }}</p>
          </div>
        </form>

        <template #footer>
          <Button type="submit" form="ap-form" class="ap-btn" :disabled="!dirty || saving">
            {{ saving ? 'Saving...' : 'Save changes' }}
          </Button>
        </template>
      </SettingsSection>

      <DailyTextSection
        v-model:digest="draft.sms_digest"
        v-model:recipient="draft.sms_subscription_id"
        v-model:quiet-start="draft.quiet_start"
        v-model:quiet-end="draft.quiet_end"
        v-model:consent="consent"
        :website-id="websiteId"
        :sms="payload.sms || {}"
        :saved="payload.settings || {}"
        :timezone="draft.timezone"
        :errors="errors"
        :last-text="lastText"
        :agree-again="agreeAgain"
        :dirty="dirty"
        :saving="saving"
        @save="save"
      />

      <SettingsSection title="Runs">
        <AutopilotRunsTable
          :runs="runs"
          :timezone="payload.settings?.timezone || 'UTC'"
          :stopping="stopping"
          @run-now="runNowOpen = true"
          @stop="stopRun"
        />
      </SettingsSection>

      <RunNowDialog
        v-model:open="runNowOpen"
        :website-id="websiteId"
        :analysis="payload.settings?.run_analysis !== false"
        @started="onStarted"
      />
    </template>
  </SettingsShell>
</template>

<script setup>
// Autopilot of the project picked in the header (autopilot_frontend.md 2,
// autopilot_contract.md 3). One form saves the whole settings payload: the
// Autopilot section and the daily text. While a run is waiting or running
// the payload is read again every few seconds, so the runs table, the cost
// lines and the last text follow it to the end.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import AutopilotRunsTable from '@/components/settings/autopilot/AutopilotRunsTable.vue'
import DailyTextSection from '@/components/settings/autopilot/DailyTextSection.vue'
import RunNowDialog from '@/components/settings/autopilot/RunNowDialog.vue'
import { Button } from '@/components/ui/button'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { TIPS } from '@/lib/help/tips'
import autopilotApi from '@/api/autopilot'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import {
  QUARTER_HOURS,
  browserTimeZone,
  consentNeeded,
  costLines,
  hhmm,
  isActiveRun,
  joinLabels,
  planLine,
  timeZones,
} from '@/lib/autopilot/format'

const DESCRIPTION =
  "Cansee checks every tracked prompt of this project once a day, on its own, and can text you the results, so you don't need to log in."
// How often the payload is read again while a run is waiting or running.
const POLL_MS = 5000
// The fields a 400 `invalid` can name; each shows its words under itself.
const FIELDS = new Set([
  'enabled',
  'run_time',
  'timezone',
  'google_cadence',
  'sms_digest',
  'sms_subscription_id',
  'sms_consent',
  'quiet_start',
  'quiet_end',
])

const appStore = useAppStore()
const toast = useToast()

const websiteId = computed(() => appStore.activeWebsite?.id || '')

const state = ref('loading') // loading | ready | failed
const payload = ref({})
const draft = ref(blankDraft())
const baseline = ref('')
const consent = ref(false)
const errors = ref({})
const saving = ref(false)
// Set by a 403 plan_required on save: the plan copy replaces the form.
const planRequired = ref(false)
const runNowOpen = ref(false)
const stopping = ref(null)
const lastText = ref(null)
let lastTextKey = ''
let pollTimer = null
let alive = true

function blankDraft() {
  return {
    enabled: false,
    run_time: '07:00',
    timezone: 'UTC',
    run_engines: true,
    run_google: true,
    google_cadence: 'daily',
    run_analysis: true,
    sms_digest: false,
    sms_subscription_id: null,
    quiet_start: '21:00',
    quiet_end: '08:00',
  }
}

const planBlocked = computed(() => planRequired.value || payload.value?.plan?.autopilot === false)
const paused = computed(() => payload.value?.settings?.paused_reason === 'failures')
// Something to save: a changed setting, or the owner's agreement given again.
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value || (agreeAgain.value && consent.value))

const runTimes = computed(() => withValue(QUARTER_HOURS, draft.value.run_time))
const zones = computed(() => timeZones(draft.value.timezone, payload.value?.settings?.timezone))

function withValue(list, value) {
  return value && !list.includes(value) ? [...list, value].sort() : list
}

const enginesLabel = computed(() => {
  const labels = (payload.value?.engines || []).filter((e) => e && e.configured !== false).map((e) => e.label)
  const names = joinLabels(labels)
  return names ? `Ask the AI engines (${names})` : 'Ask the AI engines'
})

const googleConfigured = computed(() => payload.value?.google?.configured !== false)
const googleHelp = computed(() => {
  const credits = payload.value?.google?.credits_per_page
  return credits === null || credits === undefined
    ? 'Uses 1 Google results page per prompt.'
    : `Uses 1 Google results page per prompt (${credits} ScraperAPI credits).`
})

const planText = computed(() => planLine(payload.value?.tracked))
const costs = computed(() => costLines(payload.value))

// RunSummary rows, newest first (today's run included).
const runs = computed(() => {
  const list = [...(payload.value?.runs || [])]
  const today = payload.value?.today_run
  if (today?.id && !list.some((r) => r.id === today.id)) list.push(today)
  return list.sort(
    (a, b) =>
      String(b.local_date || '').localeCompare(String(a.local_date || '')) ||
      String(b.started_at || '').localeCompare(String(a.started_at || '')),
  )
})

/* ── Loading and the form ── */

function resetDraft() {
  const s = payload.value?.settings || {}
  // No saved row yet: the page offers the browser's time zone.
  const timezone = payload.value?.saved === false ? browserTimeZone() : s.timezone || 'UTC'
  const next = {
    enabled: Boolean(s.enabled),
    run_time: hhmm(s.run_time) || '07:00',
    timezone,
    run_engines: s.run_engines !== false,
    run_google: s.run_google !== false,
    google_cadence: s.google_cadence === 'weekly' ? 'weekly' : 'daily',
    run_analysis: s.run_analysis !== false,
    sms_digest: Boolean(s.sms_digest),
    sms_subscription_id: s.sms_subscription_id || null,
    quiet_start: hhmm(s.quiet_start) || '21:00',
    quiet_end: hhmm(s.quiet_end) || '08:00',
  }
  draft.value = next
  baseline.value = JSON.stringify(next)
  consent.value = false
  errors.value = {}
}

function applyPayload(data, { keepDraft = false } = {}) {
  payload.value = data || {}
  if (!keepDraft) resetDraft()
  refreshLastText()
  schedulePoll()
}

async function load() {
  const id = websiteId.value
  stopPolling()
  runNowOpen.value = false
  planRequired.value = false
  agreedAgainFor.value = ''
  lastText.value = null
  lastTextKey = ''
  if (!id) return
  state.value = 'loading'
  try {
    const { data } = await autopilotApi.get(id)
    if (!alive || id !== websiteId.value) return
    applyPayload(data)
    state.value = 'ready'
  } catch {
    if (alive && id === websiteId.value) state.value = 'failed'
  }
}

// Reads the payload again without touching the user's unsaved changes.
async function refresh() {
  const id = websiteId.value
  if (!id) return
  try {
    const { data } = await autopilotApi.get(id)
    if (!alive || id !== websiteId.value) return
    applyPayload(data, { keepDraft: dirty.value })
  } catch {
    // Keep what is on screen; a poll tries again while a run is active.
    schedulePoll()
  }
}

/* ── The last text ── */

// The latest run whose text was asked for: its body comes from the run detail.
// Without texting on this server, the latest run's text is shown as a preview.
async function refreshLastText() {
  const preview = !payload.value?.sms?.available
  const run = runs.value.find((r) => r?.text?.status && (r.text.status !== 'not_requested' || (preview && ['done', 'partial'].includes(r.status))))
  if (!run) {
    lastText.value = null
    lastTextKey = ''
    return
  }
  const key = `${run.id}:${run.text.status}:${run.text.reason || ''}`
  if (key === lastTextKey) {
    if (lastText.value) lastText.value = { ...lastText.value, text: run.text }
    return
  }
  lastTextKey = key
  const id = websiteId.value
  try {
    const { data } = await autopilotApi.run(id, run.id)
    if (!alive || id !== websiteId.value || lastTextKey !== key) return
    lastText.value = data?.text_body ? { text: data.text || run.text, body: data.text_body } : null
  } catch {
    // The block waits for the next read of the payload.
    if (lastTextKey === key) lastTextKey = ''
  }
}

/* ── Polling while a run is active ── */

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}

function schedulePoll() {
  stopPolling()
  if (!alive || !runs.value.some(isActiveRun)) return
  pollTimer = setTimeout(() => {
    pollTimer = null
    refresh()
  }, POLL_MS)
}

/* ── Saving ── */

// The latest run whose text was asked for (the last text block's run).
const latestTextRun = computed(() => runs.value.find((r) => r?.text?.status && r.text.status !== 'not_requested') || null)
// The run whose held text the owner agreed again for, in this visit.
const agreedAgainFor = ref('')

// The last text was held because the number was verified again since its
// owner agreed (contract 3b): the owner agrees again from here, with the
// text and its number unchanged. Optional: other changes save without it.
const agreeAgain = computed(() => {
  const run = latestTextRun.value
  const s = payload.value?.settings || {}
  const own = (payload.value?.sms?.numbers || []).some((n) => n && n.yours !== false && n.id === s.sms_subscription_id)
  return Boolean(
    run &&
      run.text.status === 'skipped' &&
      run.text.reason === 'consent_needed' &&
      agreedAgainFor.value !== run.id &&
      s.sms_digest &&
      own &&
      draft.value.sms_digest &&
      draft.value.sms_subscription_id === s.sms_subscription_id,
  )
})

// Turning the text on or changing its number cannot save without it.
const consentRequired = computed(() => consentNeeded(draft.value, payload.value?.settings))
const needsConsent = computed(() => consentRequired.value || agreeAgain.value)

// The server checks all of this too; checking first keeps the words next to the field.
function localErrors() {
  const d = draft.value
  if (d.enabled && !d.run_engines && !d.run_google && !d.run_analysis) {
    return { enabled: 'Choose at least one thing for Autopilot to run.' }
  }
  if (d.sms_digest && !d.sms_subscription_id) return { sms_subscription_id: 'Choose a mobile number you verified.' }
  if (consentRequired.value && !consent.value) {
    return { sms_consent: 'Agree to the text message terms to turn on the daily text.' }
  }
  if (d.quiet_start === d.quiet_end) {
    return { quiet_end: 'Quiet hours need a start and an end that differ.' }
  }
  return null
}

async function save() {
  if (!dirty.value || saving.value) return
  const local = localErrors()
  if (local) {
    errors.value = local
    return
  }
  const id = websiteId.value
  const agreedRun = agreeAgain.value && consent.value ? latestTextRun.value?.id || '' : ''
  saving.value = true
  errors.value = {}
  try {
    const body = { ...draft.value, sms_consent: needsConsent.value ? consent.value : false }
    const { data } = await autopilotApi.save(id, body)
    if (!alive || id !== websiteId.value) return
    if (agreedRun) agreedAgainFor.value = agreedRun
    applyPayload(data)
    toast.success('Autopilot settings saved.')
  } catch (e) {
    const err = e?.response?.data?.error
    const status = e?.response?.status
    if (status === 403 && err?.code === 'plan_required') {
      planRequired.value = true
    } else if (err?.code === 'invalid' && FIELDS.has(err.details?.field)) {
      errors.value = { [err.details.field]: err.details.message || err.message }
    } else if (err?.code === 'sms_unavailable') {
      errors.value = { sms_digest: err.message }
    } else {
      toast.error(err?.message || e?.displayMessage || "We couldn't save Autopilot. Please try again.")
    }
  } finally {
    saving.value = false
  }
}

// Any change takes the old error words away.
watch(
  [draft, consent],
  () => {
    if (Object.keys(errors.value).length) errors.value = {}
  },
  { deep: true },
)

/* ── Runs ── */

async function onStarted() {
  await refresh()
}

async function stopRun(run) {
  if (!run?.id || stopping.value) return
  stopping.value = run.id
  try {
    await autopilotApi.cancel(websiteId.value, run.id)
    await refresh()
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || e?.displayMessage || "We couldn't stop the run.")
  } finally {
    stopping.value = null
  }
}

watch(websiteId, load, { immediate: true })

onBeforeUnmount(() => {
  alive = false
  stopPolling()
})
</script>

<style scoped>
.ap-muted {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.55;
}

.ap-failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.ap-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ap-notice {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.ap-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ap-fieldset {
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ap-legend {
  margin-bottom: 10px;
  padding: 0;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
}

.ap-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  --cs-helptip-fg: var(--muted-foreground);
  --cs-helptip-fg-hover: var(--foreground);
}

.ap-switch-label {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

/* Same anatomy as the switches of the other settings pages. */
.ap-switch {
  appearance: none;
  -webkit-appearance: none;
  flex: none;
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  border: 0;
  border-radius: var(--radius);
  background: var(--input);
  cursor: pointer;
  transition: background-color 160ms ease;
}

.ap-switch::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 0;
  background: var(--background);
  box-shadow: none;
  transition: transform 160ms ease;
}

[data-theme='dark'] .ap-switch:not(:checked) {
  background: var(--bar);
}

.ap-switch:checked {
  background: var(--primary);
}

.ap-switch:checked::before {
  transform: translateX(16px);
}

.ap-switch:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.ap-time-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

.ap-label {
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 500;
}

.ap-select {
  height: 36px;
  max-width: 100%;
  padding: 0 10px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13.5px;
}

.ap-select:focus-visible {
  border-color: var(--ring);
  border-radius: var(--radius);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}

.ap-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ap-zone {
  flex: 1 1 200px;
  min-width: 0;
}

.ap-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ap-check input[type='checkbox'] {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 3px;
  accent-color: var(--primary);
}

.ap-check-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ap-check-text label {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.ap-check-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.ap-cadence {
  height: 32px;
}

.ap-help {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12.5px;
  line-height: 1.5;
}

.ap-error {
  margin: 0;
  color: var(--destructive);
  font-size: 12.5px;
  line-height: 1.5;
}

.ap-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.ap-line {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.55;
}

.ap-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius);
  font-size: 13px;
}
</style>
