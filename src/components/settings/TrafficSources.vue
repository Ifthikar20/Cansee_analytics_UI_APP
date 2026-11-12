<template>
  <div class="ts">
    <p v-if="!websiteId" class="ts-muted">Pick a project in the header first.</p>
    <template v-else>
      <div class="ts-cards">
        <!-- Cansee pixel -->
        <section class="ts-card" aria-labelledby="ts-pixel-title">
          <header class="ts-card-head">
            <h4 id="ts-pixel-title" class="ts-card-title">Cansee pixel</h4>
            <p class="ts-status" :class="{ 'is-on': pixelView.on }">
              <span class="ts-dot" aria-hidden="true"></span>
              {{ pixelView.text }}
              <button v-if="pixelView.failed" type="button" class="ts-retry" @click="loadSources">Try again</button>
            </p>
          </header>
          <p class="ts-note">
            Counts unique visitors and visits from AI assistants. Visitors who decline analytics consent are not counted.
          </p>
          <PixelSnippet :website-id="websiteId" :website-url="websiteUrl" @verified="loadSources" />
        </section>

        <!-- Google Analytics 4 -->
        <section class="ts-card" aria-labelledby="ts-ga4-title">
          <header class="ts-card-head">
            <h4 id="ts-ga4-title" class="ts-card-title">Google Analytics 4</h4>
            <p class="ts-status" :class="{ 'is-on': ga4View.on }">
              <span class="ts-dot" aria-hidden="true"></span>
              {{ ga4View.text }}
              <button v-if="ga4View.failed" type="button" class="ts-retry" @click="loadGa4">Try again</button>
            </p>
          </header>
          <div v-if="ga4View.actions" class="ts-actions">
            <Button v-if="!ga4?.connected" size="sm" class="ts-btn" :disabled="busy.ga4" @click="connectGa4">
              {{ busy.ga4 ? 'Opening Google...' : 'Connect Google Analytics' }}
            </Button>
            <template v-else>
              <Button variant="outline" size="sm" class="ts-btn" :disabled="busy.ga4" @click="openPropertyPicker">
                Choose property
              </Button>
              <Button variant="ghost" size="sm" class="ts-btn" :disabled="busy.ga4" @click="disconnectGa4">Disconnect</Button>
            </template>
          </div>
        </section>

        <!-- Cloudflare -->
        <section class="ts-card" aria-labelledby="ts-cf-title">
          <header class="ts-card-head">
            <h4 id="ts-cf-title" class="ts-card-title">Cloudflare</h4>
            <p class="ts-status" :class="{ 'is-on': cfView.on }">
              <span class="ts-dot" aria-hidden="true"></span>
              {{ cfView.text }}
              <button v-if="cfView.failed" type="button" class="ts-retry" @click="loadCloudflare">Try again</button>
            </p>
          </header>
          <p class="ts-note">
            Cloudflare counts every request, including bots, so its numbers are requests, not visitors. It is the only
            source that can see AI crawlers.
          </p>
          <form v-if="cfView.form" class="ts-form" @submit.prevent="connectCloudflare">
            <label for="ts-cf-token" class="ts-label">Cloudflare API token (Zone, Analytics, Read)</label>
            <div class="ts-form-row">
              <input
                id="ts-cf-token"
                v-model="cfToken"
                type="password"
                autocomplete="off"
                spellcheck="false"
                class="ts-input"
                :aria-invalid="cfError ? 'true' : undefined"
                :aria-describedby="cfError ? 'ts-cf-error' : undefined"
              />
              <Button type="submit" size="sm" class="ts-btn" :disabled="busy.cf || !cfToken.trim()">
                {{ busy.cf ? 'Connecting...' : 'Connect' }}
              </Button>
            </div>
            <p v-if="cfError" id="ts-cf-error" class="ts-error" role="alert">{{ cfError }}</p>
          </form>
          <div v-else-if="cfView.actions" class="ts-actions">
            <Button v-if="cf?.pending_zone_selection" variant="outline" size="sm" class="ts-btn" :disabled="busy.cf" @click="openZonePicker">
              Choose zone
            </Button>
            <Button variant="ghost" size="sm" class="ts-btn" :disabled="busy.cf" @click="disconnectCloudflare">Disconnect</Button>
          </div>
        </section>
      </div>

      <SourceCapabilities v-if="sources" :sources="sources.sources || []" />
    </template>

    <Ga4PropertyPicker
      v-model="propertyPickerOpen"
      :properties="properties"
      :current="ga4?.property_id || ''"
      :saving="busy.ga4"
      @select="selectProperty"
    />
    <CloudflareZonePicker v-model="zonePickerOpen" :zones="zones" :saving="busy.cf" @select="selectZone" />
  </div>
</template>

<script setup>
// Settings > Connections > Website traffic: the Cansee pixel, Google
// Analytics 4 and Cloudflare for the active project, each with its status
// and the steps that connect it, then what each source can measure.
//
// GA4 connects through Google's consent screen; the page passes back what
// the return URL said (`ga4Return`) once its project is the one Google
// connected. A Cloudflare token is sent once and never shown again.
import { computed, reactive, ref, watch } from 'vue'
import trafficApi from '@/api/traffic'
import webAnalyticsApi from '@/api/webAnalytics'
import { useToast } from '@/composables/useToast'
import SourceCapabilities from '@/components/analytics/SourceCapabilities.vue'
import PixelSnippet from '@/components/settings/PixelSnippet.vue'
import Ga4PropertyPicker from '@/components/settings/Ga4PropertyPicker.vue'
import CloudflareZonePicker from '@/components/settings/CloudflareZonePicker.vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  websiteId: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },
  // {outcome: 'connected'|'select_property'|'error', reason} from ?ga4=...
  ga4Return: { type: Object, default: null },
})

const toast = useToast()

const CHECKING = 'Checking the connection...'
const UNAVAILABLE = 'Not available on this server'
const RETURN_ERRORS = {
  denied: 'You declined access in Google.',
  exchange_failed: "Google didn't confirm the connection. Try again.",
  invalid_state: 'The connection link expired. Try again.',
}

// Each source: 'loading' | 'ready' | 'off' (404: web analytics is turned
// off on the server) | 'failed'.
const sources = ref(null)
const sourcesState = ref('loading')
const ga4 = ref(null)
const ga4State = ref('loading')
const cf = ref(null)
const cfState = ref('loading')

const busy = reactive({ ga4: false, cf: false })
const properties = ref([])
const propertyPickerOpen = ref(false)
const zones = ref([])
const zonePickerOpen = ref(false)
const cfToken = ref('')
const cfError = ref('')

// These endpoints answer errors as a bare {"error": "<code or sentence>"}.
function errorOf(err) {
  const e = err?.response?.data?.error
  return typeof e === 'string' ? e : e?.code || ''
}

function isOff(err) {
  return err?.response?.status === 404
}

/* ── Status lines ── */

const pixelView = computed(() => {
  if (sourcesState.value === 'loading') return { text: CHECKING }
  if (sourcesState.value !== 'ready') return { text: "We couldn't check the pixel.", failed: true }
  const pixel = (sources.value?.sources || []).find((s) => s.key === 'pixel')
  if (pixel?.status === 'ok') return { text: 'Installed and recording', on: true }
  if (pixel?.connected) return { text: 'Installed, no visits yet' }
  return { text: 'Not installed' }
})

const ga4View = computed(() => {
  if (ga4State.value === 'loading') return { text: CHECKING }
  if (ga4State.value === 'off') return { text: UNAVAILABLE }
  if (ga4State.value === 'failed') return { text: "We couldn't check the Google Analytics connection.", failed: true }
  const s = ga4.value || {}
  if (!s.configured) return { text: UNAVAILABLE }
  if (!s.connected) return { text: 'Not connected', actions: true }
  if (s.pending_property_selection || !(s.property_display_name || s.property_id)) {
    return { text: 'Choose a property', actions: true }
  }
  return { text: `Connected: ${s.property_display_name || s.property_id}`, on: true, actions: true }
})

const cfView = computed(() => {
  if (cfState.value === 'loading') return { text: CHECKING }
  if (cfState.value === 'off') return { text: UNAVAILABLE }
  if (cfState.value === 'failed') return { text: "We couldn't check the Cloudflare connection.", failed: true }
  const s = cf.value || {}
  if (!s.connected) return { text: 'Not connected', form: true }
  if (s.pending_zone_selection || !(s.zone_name || s.zone_id)) return { text: 'Choose a zone', actions: true }
  return { text: `Connected: ${s.zone_name || s.zone_id}`, on: true, actions: true }
})

/* ── Loading ── */

// Runs `request` for the current project; a late answer for another
// project is dropped.
async function read(request, target, state) {
  const id = props.websiteId
  if (!id) return
  state.value = 'loading'
  try {
    const res = await request(id)
    if (id !== props.websiteId) return
    target.value = res.data || null
    state.value = 'ready'
  } catch (err) {
    if (id === props.websiteId) state.value = isOff(err) ? 'off' : 'failed'
  }
}

const loadSources = () => read(trafficApi.sources, sources, sourcesState)
const loadGa4 = () => read(webAnalyticsApi.ga4Status, ga4, ga4State)
const loadCloudflare = () => read(webAnalyticsApi.cfStatus, cf, cfState)

function loadAll() {
  return Promise.all([loadSources(), loadGa4(), loadCloudflare()])
}

/* ── Google Analytics 4 ── */

// A full-page redirect to Google; the callback returns to this page.
async function connectGa4() {
  busy.ga4 = true
  try {
    const res = await webAnalyticsApi.ga4Connect(props.websiteId)
    window.location.assign(res.data.authorize_url)
  } catch (err) {
    busy.ga4 = false
    if (isOff(err) || errorOf(err) === 'not_configured') loadGa4()
    else toast.error("We couldn't start the Google Analytics connection. Try again.")
  }
}

async function openPropertyPicker() {
  busy.ga4 = true
  try {
    const res = await webAnalyticsApi.ga4Properties(props.websiteId)
    properties.value = res.data?.properties || []
    propertyPickerOpen.value = true
  } catch {
    toast.error("We couldn't load your Google Analytics properties. Try again.")
  } finally {
    busy.ga4 = false
  }
}

async function selectProperty(propertyId) {
  busy.ga4 = true
  try {
    const res = await webAnalyticsApi.ga4SelectProperty(props.websiteId, { property_id: propertyId })
    if (res.data) ga4.value = res.data
    propertyPickerOpen.value = false
    toast.success('Google Analytics is connected.')
    loadSources()
  } catch {
    toast.error("We couldn't use that property. Try again.")
  } finally {
    busy.ga4 = false
  }
}

async function disconnectGa4() {
  if (!window.confirm('Disconnect Google Analytics? Cansee stops reading it; your Google data is not touched.')) return
  busy.ga4 = true
  try {
    await webAnalyticsApi.ga4Disconnect(props.websiteId)
    toast.success('Google Analytics disconnected.')
    await Promise.all([loadGa4(), loadSources()])
  } catch {
    toast.error("We couldn't disconnect Google Analytics. Try again.")
  } finally {
    busy.ga4 = false
  }
}

/* ── Cloudflare ── */

async function connectCloudflare() {
  const token = cfToken.value.trim()
  // Cleared on every submit: the token is never shown again.
  cfToken.value = ''
  cfError.value = ''
  if (!token) return
  busy.cf = true
  try {
    const res = await webAnalyticsApi.cfConnect(props.websiteId, { api_token: token })
    cf.value = res.data || null
    cfState.value = 'ready'
    if (cf.value?.pending_zone_selection) await openZonePicker()
    else toast.success('Cloudflare is connected.')
    loadSources()
  } catch (err) {
    if (errorOf(err) === 'invalid_token') cfError.value = "Cloudflare didn't accept this token."
    else if (isOff(err)) cfState.value = 'off'
    else cfError.value = "We couldn't connect Cloudflare. Try again."
  } finally {
    busy.cf = false
  }
}

async function openZonePicker() {
  busy.cf = true
  try {
    const res = await webAnalyticsApi.cfZones(props.websiteId)
    zones.value = res.data?.zones || []
    zonePickerOpen.value = true
  } catch {
    toast.error("We couldn't load your Cloudflare zones. Try again.")
  } finally {
    busy.cf = false
  }
}

async function selectZone(zoneId) {
  busy.cf = true
  try {
    const res = await webAnalyticsApi.cfSelectZone(props.websiteId, { zone_id: zoneId })
    if (res.data) cf.value = res.data
    zonePickerOpen.value = false
    toast.success('Cloudflare is connected.')
    loadSources()
  } catch {
    toast.error("We couldn't use that zone. Try again.")
  } finally {
    busy.cf = false
  }
}

async function disconnectCloudflare() {
  if (!window.confirm('Disconnect Cloudflare? Cansee stops reading it; your Cloudflare data is not touched.')) return
  busy.cf = true
  try {
    await webAnalyticsApi.cfDisconnect(props.websiteId)
    toast.success('Cloudflare disconnected.')
    await Promise.all([loadCloudflare(), loadSources()])
  } catch {
    toast.error("We couldn't disconnect Cloudflare. Try again.")
  } finally {
    busy.cf = false
  }
}

/* ── Project and the return from Google ── */

watch(
  () => props.websiteId,
  (id) => {
    sources.value = null
    ga4.value = null
    cf.value = null
    cfToken.value = ''
    cfError.value = ''
    propertyPickerOpen.value = false
    zonePickerOpen.value = false
    if (id) loadAll()
  },
  { immediate: true },
)

let handledReturn = null
watch(
  () => [props.ga4Return, props.websiteId],
  ([ret]) => {
    if (!ret || ret === handledReturn || !props.websiteId) return
    handledReturn = ret
    if (ret.outcome === 'connected') toast.success('Google Analytics is connected.')
    else if (ret.outcome === 'select_property') openPropertyPicker()
    else if (ret.outcome === 'error') toast.error(RETURN_ERRORS[ret.reason] || RETURN_ERRORS.exchange_failed)
  },
  { immediate: true },
)
</script>

<style scoped>
.ts {
  display: grid;
  gap: 16px;
}

.ts-muted {
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.ts-cards {
  display: grid;
  gap: 12px;
}

.ts-card {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.ts-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

.ts-card-title {
  margin: 0;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.ts-status {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.ts-status.is-on {
  color: var(--foreground);
}

.ts-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--input);
}

.ts-status.is-on .ts-dot {
  background: var(--gap-strong);
}

.ts-retry {
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

.ts-note {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.55;
}

.ts-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ts-btn {
  border-radius: var(--radius);
}

.ts-form {
  display: grid;
  gap: 6px;
}

.ts-label {
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
}

.ts-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ts-input {
  flex: 1 1 240px;
  min-width: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.ts-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}

.ts-error {
  color: var(--destructive);
  font-size: 13px;
}
</style>
