<template>
  <SettingsShell active="connections">
    <SettingsSection
      label="Google"
      title="Google Search Console"
      description="Adds your real Google clicks, impressions and average position to every prompt, next to the live rank check."
    >
      <p v-if="adopting" class="cn-muted">Checking the connection...</p>
      <p v-else-if="!websiteId" class="cn-muted">Pick a project in the header first.</p>
      <p v-else-if="loading" class="cn-muted">Checking the connection...</p>
      <div v-else-if="statusFailed" class="cn-failed">
        <p class="cn-muted">We couldn't check the Search Console connection.</p>
        <Button variant="outline" class="cn-btn" @click="loadStatus">Try again</Button>
      </div>
      <div v-else-if="gsc && !gsc.configured" class="cn-muted">
        Search Console isn't available yet.
      </div>
      <div v-else-if="gsc?.connected" class="cn-status">
        <span class="cn-dot is-on" aria-hidden="true"></span>
        <div class="cn-status-text">
          <strong>{{ gsc.site_url ? displaySite(gsc.site_url) : 'Connected, no property chosen yet' }}</strong>
          <span v-if="gsc.last_synced_at">Last synced {{ timeAgo(gsc.last_synced_at) }}</span>
          <span v-else-if="gsc.site_url">First sync in progress</span>
        </div>
      </div>
      <div v-else class="cn-status">
        <span class="cn-dot" aria-hidden="true"></span>
        <div class="cn-status-text">
          <strong>Not connected</strong>
          <span>You'll sign in with Google and pick the property for {{ activeName }}.</span>
        </div>
      </div>

      <template v-if="websiteId && !loading && !statusFailed && gsc?.configured" #footer>
        <template v-if="gsc.connected">
          <Button variant="outline" class="cn-btn" :disabled="busy" @click="openPicker">Change property</Button>
          <Button variant="ghost" class="cn-btn" :disabled="busy" @click="disconnect">Disconnect</Button>
        </template>
        <Button v-else class="cn-btn" :disabled="busy" @click="connect">
          {{ busy ? 'Opening Google...' : 'Connect Search Console' }}
        </Button>
      </template>
    </SettingsSection>

    <SettingsSection
      label="Traffic"
      title="Website traffic"
      description="Where Cansee reads your visitors, their countries and visits from AI assistants. Each source measures something different."
    >
      <p v-if="adopting" class="cn-muted">Checking the connection...</p>
      <TrafficSources v-else :website-id="websiteId" :website-url="activeUrl" :ga4-return="ga4Return" />
    </SettingsSection>

    <SettingsSection
      label="Reports"
      title="Where reports go"
      description="Send the daily report to the tools your team already uses."
    >
      <AlertChannels />
    </SettingsSection>

    <PropertyPickerModal
      v-model="showPicker"
      :properties="properties"
      :saving="busy"
      @select="selectProperty"
    />
  </SettingsShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import AlertChannels from '@/components/settings/AlertChannels.vue'
import TrafficSources from '@/components/settings/TrafficSources.vue'
import PropertyPickerModal from '@/components/search_console/PropertyPickerModal.vue'
import { Button } from '@/components/ui/button'
import api from '@/api/client'
import searchConsoleApi from '@/api/searchConsole'
import { ensureWebsites } from '@/router/ensureWebsites'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { timeAgo } from '@/utils/timeAgo'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const toast = useToast()

// Back from Google's consent screen for Analytics
// (?ga4=<connected|select_property|error>&website=<id>[&reason=<code>]) or
// Search Console (?gsc=<outcome>&website_id=<id>[&reason=<code>]). The
// project it names becomes active first (when it is one of the user's), so
// every status on this page is read for it; until the project list has
// loaded, nothing is read.
const returnWebsite = String(route.query.website || route.query.website_id || '')
const ga4Return = route.query.ga4 ? { outcome: String(route.query.ga4), reason: String(route.query.reason || '') } : null
const adopting = ref(false)

function adoptReturnProject(list) {
  const site = list.find((w) => String(w.id) === returnWebsite)
  if (site && String(appStore.activeWebsite?.id || '') !== returnWebsite) appStore.setActiveWebsite(site)
}

if (returnWebsite) {
  if (appStore.websites.length) {
    adoptReturnProject(appStore.websites)
  } else {
    adopting.value = true
    ensureWebsites()
      .then(adoptReturnProject)
      .finally(() => {
        adopting.value = false
      })
  }
}

const websiteId = computed(() => (adopting.value ? '' : appStore.activeWebsite?.id || ''))
const activeName = computed(() => appStore.activeWebsite?.name || 'this project')
const activeUrl = computed(() => appStore.activeWebsite?.url || '')

const gsc = ref(null)
const loading = ref(false)
const statusFailed = ref(false)
const busy = ref(false)
const showPicker = ref(false)
const properties = ref([])

function displaySite(siteUrl) {
  return siteUrl.startsWith('sc-domain:') ? siteUrl.slice('sc-domain:'.length) : siteUrl
}

async function loadStatus() {
  if (!websiteId.value) return
  loading.value = true
  statusFailed.value = false
  try {
    // Silent: the section shows the failure inline.
    const { data } = await api.get(`/search-console/${websiteId.value}/status/`, { _silentError: true })
    gsc.value = data
    if (data.pending_property_selection) await openPicker()
  } catch {
    gsc.value = null
    statusFailed.value = true
  } finally {
    loading.value = false
  }
}

// Full-page redirect to Google; the backend callback returns here with
// ?gsc=connected | select_property | error.
async function connect() {
  busy.value = true
  try {
    const { data } = await searchConsoleApi.connectStart(websiteId.value)
    window.location.assign(data.authorize_url)
  } catch {
    busy.value = false
  }
}

async function openPicker() {
  busy.value = true
  try {
    const { data } = await searchConsoleApi.properties(websiteId.value)
    properties.value = data.properties || []
    showPicker.value = true
  } catch {
    /* the client interceptor toasts */
  } finally {
    busy.value = false
  }
}

async function selectProperty(siteUrl) {
  busy.value = true
  try {
    await searchConsoleApi.selectProperty(websiteId.value, siteUrl)
    showPicker.value = false
    toast.success('Search Console connected. The first sync is running.')
    await loadStatus()
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  busy.value = true
  try {
    await searchConsoleApi.disconnect(websiteId.value)
    toast.success('Search Console disconnected.')
    await loadStatus()
  } finally {
    busy.value = false
  }
}

// Coming back from Google's consent screen. The Analytics outcome was taken
// above; its query goes with the Search Console one.
onMounted(() => {
  const outcome = route.query.gsc
  if (outcome === 'connected') toast.success('Search Console connected.')
  else if (outcome === 'error') toast.error("Search Console wasn't connected. Please try again.")
  const { gsc, ga4, reason, website, website_id: websiteIdParam, ...rest } = route.query
  if (gsc || ga4 || reason || website || websiteIdParam) router.replace({ query: rest })
})

watch(websiteId, loadStatus, { immediate: true })
</script>

<style scoped>
.cn-muted {
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.cn-failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.cn-status {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.cn-dot {
  width: 9px;
  height: 9px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--input);
}

.cn-dot.is-on {
  background: var(--gap-strong);
}

.cn-status-text {
  display: grid;
  gap: 2px;
  font-size: 13.5px;
}

.cn-status-text strong {
  color: var(--foreground);
  font-weight: 600;
}

.cn-status-text span {
  color: var(--muted-foreground);
}

.cn-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 13px;
}
</style>
