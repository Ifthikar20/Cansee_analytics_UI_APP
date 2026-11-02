<template>
  <!-- Alert channels (Slack, Discord, Teams, SMS). Formerly the standalone
       Integrations page; now a section of Settings > Connections. -->
  <div class="integrations-page">

    <!-- Integrations directory -->
    <div class="integrations-grid">
      <!-- Working integrations -->
      <div v-for="intg in integrations" :key="intg.id" class="intg-tile" :class="{ connected: intg.connected }">
        <div class="intg-tile-main">
          <div class="intg-icon-wrap" :style="{ background: intg.bgColor }">
            <span v-html="intg.icon"></span>
          </div>
          <div class="intg-tile-identity">
            <span class="intg-tile-name">{{ intg.name }}</span>
            <span class="intg-tile-status" :class="intg.connected ? 'text-success' : 'text-muted'">
              {{ intg.connected ? 'Connected' : 'Not connected' }}
            </span>
          </div>
        </div>

        <p class="intg-tile-desc">{{ intg.description }}</p>

        <div class="intg-tile-actions">
          <template v-if="intg.connected">
            <Button variant="secondary" size="sm" class="flex-1" @click="openSettings(intg)">Settings</Button>
            <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-destructive" @click="disconnect(intg)">Disconnect</Button>
          </template>
          <Button v-else size="sm" class="flex-1" @click="openConnect(intg)">Connect</Button>
        </div>
      </div>

      <!-- Text messages (SMS) — richer state machine than the webhook tiles,
           so it renders as its own tile rather than joining the v-for. -->
      <div class="intg-tile" :class="{ connected: smsState === 'verified' }">
        <div class="intg-tile-main">
          <div class="intg-icon-wrap" style="background: linear-gradient(135deg, #34C75915, #34C75908)">
            <span v-html="smsIcon"></span>
          </div>
          <div class="intg-tile-identity">
            <span class="intg-tile-name">Text messages</span>
            <span class="intg-tile-status" :class="smsState === 'verified' ? 'text-success' : 'text-muted'">
              {{ smsState === 'verified' ? 'Connected' : 'Not connected' }}
            </span>
          </div>
        </div>

        <p class="intg-tile-desc">Get the Brand Pulse digest and high-severity brand-security alerts as texts, and reply to ask questions &mdash; straight from your phone's Messages app.</p>

        <!-- available=false → muted note, no Connect -->
        <p v-if="smsState === 'unavailable'" class="sms-unavailable">Not available on this deployment yet.</p>

        <!-- Phone entry (after Connect) -->
        <div v-else-if="smsState === 'phone'" class="sms-form">
          <div class="sms-input-row">
            <input
              v-model="smsPhone"
              type="tel"
              autocomplete="tel"
              class="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="+1 415 555 0134"
              @keyup.enter="sendSmsCode"
            />
            <Button size="sm" :disabled="!smsPhone.trim() || smsSending" @click="sendSmsCode">
              <span v-if="smsSending" class="btn-spinner"></span>
              {{ smsSending ? 'Sending...' : 'Send code' }}
            </Button>
          </div>
          <p v-if="smsError" class="sms-error">{{ smsError }}</p>
          <button type="button" class="sms-quiet-link" @click="cancelSmsConnect">Cancel</button>
        </div>

        <!-- Pending: 6-digit code entry -->
        <div v-else-if="smsState === 'pending'" class="sms-form">
          <p class="sms-form-hint">We texted a 6-digit code to <strong>{{ smsSub.phone_masked }}</strong>. Enter it to finish connecting.</p>
          <div class="sms-input-row">
            <input
              v-model="smsCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              class="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="123456"
              @keyup.enter="verifySmsCode"
            />
            <Button size="sm" :disabled="!smsCode.trim() || smsVerifying" @click="verifySmsCode">
              <span v-if="smsVerifying" class="btn-spinner"></span>
              {{ smsVerifying ? 'Verifying...' : 'Verify' }}
            </Button>
          </div>
          <p v-if="smsError" class="sms-error">{{ smsError }}</p>
          <button type="button" class="sms-quiet-link" :disabled="smsResending" @click="resendSmsCode">
            {{ smsResending ? 'Resending...' : 'Resend code' }}
          </button>
        </div>

        <!-- Connected: phone + notification toggles + quiet Disconnect -->
        <template v-else-if="smsState === 'verified'">
          <div class="sms-form">
            <p class="sms-form-hint">Texting <strong>{{ smsSub.phone_masked }}</strong></p>
            <label v-for="t in smsToggles" :key="t.key" class="pref-check">
              <input
                type="checkbox"
                class="modern-check"
                :checked="!!smsSub[t.key]"
                :disabled="smsToggleBusy === t.key"
                @change="toggleSmsPref(t.key, $event.target.checked)"
              />
              <div>
                <span class="pref-name">{{ t.label }}</span>
                <span v-if="t.desc" class="pref-desc">{{ t.desc }}</span>
              </div>
            </label>
          </div>
          <div class="intg-tile-actions">
            <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-destructive" :disabled="smsDisconnecting" @click="disconnectSms">Disconnect</Button>
          </div>
        </template>

        <!-- No subscription (or opted out): Connect -->
        <div v-else-if="smsState === 'disconnected'" class="intg-tile-actions">
          <Button size="sm" class="flex-1" @click="openSmsConnect">Connect</Button>
        </div>

        <!-- smsState === 'loading' (initial fetch, or a failed GET): no body -->
      </div>

    </div>

    <!-- What Gets Sent Section -->
    <div ref="sentSection" class="what-gets-sent">
      <h2 class="section-title">What gets sent to your teams</h2>
      <ul class="sent-list">
        <li v-for="(item, idx) in sentItems" :key="item.title" class="sent-row" :class="sentRevealed ? 'sent-row-revealed' : 'sent-row-hidden'" :style="{ '--reveal-delay': (idx * 70) + 'ms' }">
          <span class="sent-row-title">
            {{ item.title }}
            <span v-if="item.soon" class="soon-badge">Coming soon</span>
          </span>
          <span class="sent-row-desc">{{ item.desc }}</span>
        </li>
      </ul>
    </div>

    <!-- Connect Modal -->
    <BaseModal v-model="showConnectModal" max-width="480px">
      <template #header>
        <h3 class="bm-title">
          <span v-html="activeIntegration?.icon" style="display:inline-flex;vertical-align:-4px;margin-right:8px"></span>
          Connect {{ activeIntegration?.name }}
        </h3>
      </template>

      <div class="connect-steps">
        <!-- Slack -->
        <template v-if="activeIntegration?.id === 'slack'">
          <div class="connect-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Create an Incoming Webhook</h4>
              <p>Create or open your app at <a href="https://api.slack.com/apps" target="_blank" rel="noopener" class="step-link">api.slack.com/apps</a>, enable Incoming Webhooks, and add a webhook for the channel that should receive updates.</p>
            </div>
          </div>
          <div class="connect-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Paste the webhook URL</h4>
              <input v-model="webhookUrl" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="https://hooks.slack.com/services/T.../B.../..." />
            </div>
          </div>
          <div class="connect-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Channel name</h4>
              <p>The channel the webhook posts to, so you can tell connections apart.</p>
              <input v-model="channelName" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="#growth-updates" />
            </div>
          </div>
        </template>

        <!-- Discord -->
        <template v-else-if="activeIntegration?.id === 'discord'">
          <div class="connect-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Create a webhook</h4>
              <p>In Discord, open <strong>Server Settings &gt; Integrations &gt; Webhooks</strong>, select <strong>New Webhook</strong>, pick the channel that should receive updates, and copy the webhook URL.</p>
            </div>
          </div>
          <div class="connect-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Paste the webhook URL</h4>
              <input v-model="webhookUrl" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="https://discord.com/api/webhooks/..." />
            </div>
          </div>
          <div class="connect-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Channel name</h4>
              <p>The channel the webhook posts to, so you can tell connections apart.</p>
              <input v-model="channelName" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="#cansee-updates" />
            </div>
          </div>
        </template>

        <!-- Microsoft Teams -->
        <template v-else-if="activeIntegration?.id === 'teams'">
          <div class="connect-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Create an incoming webhook</h4>
              <p>In Teams, open the channel's <strong>•••</strong> menu &gt; <strong>Workflows</strong>, choose <strong>Post to a channel when a webhook request is received</strong>, and copy the URL it generates. (The classic <strong>Incoming Webhook</strong> connector works too.)</p>
            </div>
          </div>
          <div class="connect-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Paste the webhook URL</h4>
              <input v-model="webhookUrl" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="https://...webhook.office.com/...  or  https://...logic.azure.com/..." />
            </div>
          </div>
          <div class="connect-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Channel name</h4>
              <p>The channel the webhook posts to, so you can tell connections apart.</p>
              <input v-model="channelName" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="#results" />
            </div>
          </div>
        </template>
      </div>

      <!-- In-channel bot (Slack/Discord only; Teams has no two-way bot yet) -->
      <div v-if="activeIntegration && activeIntegration.id !== 'teams'" class="bot-link">
        <h4 class="prefs-title">In-channel bot (optional)</h4>
        <template v-if="activeIntegration?.id === 'slack'">
          <p class="bot-link-desc">Add your Slack Team ID to link @Cansee mentions and the /cansee command in your workspace to this Cansee account.</p>
          <input v-model="externalTeamId" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Team ID, e.g. T0123ABCD" />
          <p class="bot-link-hint">Your Team ID starts with T. Find it in your workspace settings, or in the browser address bar when you open Slack on the web.</p>
        </template>
        <template v-else-if="activeIntegration?.id === 'discord'">
          <p class="bot-link-desc">Add your Discord Server ID to link the /cansee command (report, security, ask, scan) in your server to this Cansee account.</p>
          <input v-model="externalTeamId" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Server ID, e.g. 123456789012345678" />
          <p class="bot-link-hint">The Server ID is numeric. Enable Developer Mode under App Settings &gt; Advanced, then right-click your server name and choose Copy Server ID.</p>
        </template>
      </div>

      <!-- Notification Preferences -->
      <div class="notif-prefs">
        <h4 class="prefs-title">Notifications to send</h4>
        <label class="pref-check" v-for="pref in notifPrefs" :key="pref.key">
          <input type="checkbox" v-model="pref.enabled" class="modern-check" />
          <div>
            <span class="pref-name">{{ pref.label }}</span>
            <span class="pref-desc">{{ pref.desc }}</span>
          </div>
        </label>
      </div>

      <template #footer>
        <Button variant="secondary" @click="showConnectModal = false">Cancel</Button>
        <Button :disabled="!webhookUrl.trim() || connecting" @click="confirmConnect">
          <span v-if="connecting" class="btn-spinner"></span>
          {{ connecting ? 'Connecting...' : 'Connect & Save' }}
        </Button>
      </template>
    </BaseModal>

    <!-- Toast Overlay -->
    <Transition name="toast">
      <div v-if="showSuccessToast" class="success-toast" :class="{ 'toast-error': toastKind === 'error' }">
        <svg v-if="toastKind === 'error'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--chart-2)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
        <span>{{ successMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'
import integrationsApi from '@/api/integrations'

const showConnectModal = ref(false)
const activeIntegration = ref(null)
const webhookUrl = ref('')
const channelName = ref('')
const externalTeamId = ref('')
const connecting = ref(false)
const showSuccessToast = ref(false)
const successMessage = ref('')
const toastKind = ref('success')
const loading = ref(true)

const notifPrefs = reactive([
  { key: 'daily', label: 'Daily Growth Report', desc: 'Morning summary of visitors, leads, and trends', enabled: true },
  { key: 'hotlead', label: 'Hot Lead Alerts', desc: 'Instant alert when a lead scores 80+', enabled: true },
  { key: 'trends', label: 'Weekly Trend Digest', desc: 'Top trending topics relevant to your business', enabled: true },
  { key: 'milestones', label: 'Growth Milestones', desc: 'Team celebrations when targets are hit', enabled: false },
])

const prefDefaults = { daily: true, hotlead: true, trends: true, milestones: false }

// Apply a per-connection {key: boolean} map to the shared checkboxes;
// pass null to reset them to the defaults for a fresh connection.
function setPrefs(values) {
  for (const p of notifPrefs) {
    p.enabled = typeof values?.[p.key] === 'boolean' ? values[p.key] : prefDefaults[p.key]
  }
}

function snapshotPrefs() {
  const snap = {}
  for (const p of notifPrefs) snap[p.key] = p.enabled
  return snap
}

const integrations = reactive([
  {
    id: 'slack',
    name: 'Slack',
    description: 'Deliver the daily report and brand-security alerts to a Slack channel, and bring Cansee into the conversation with @Cansee mentions and the /cansee command.',
    bgColor: 'linear-gradient(135deg, #4A154B15, #E01E5A08)',
    connected: false,
    connectionId: null,
    webhookUrl: '',
    channelName: '',
    externalTeamId: '',
    scheduleTime: '',
    notifPrefs: null,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z" fill="#E01E5A"/><path d="M2 14.5a2.5 2.5 0 0 0 5 0V12H4.5A2.5 2.5 0 0 0 2 14.5z" fill="#36C5F0"/><path d="M9.5 22a2.5 2.5 0 0 0 0-5H7v2.5A2.5 2.5 0 0 0 9.5 22z" fill="#2EB67D"/><path d="M22 9.5a2.5 2.5 0 0 0-5 0V12h2.5A2.5 2.5 0 0 0 22 9.5z" fill="#ECB22E"/></svg>',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Deliver the daily report and brand-security alerts to a Discord channel, and work with Cansee from your server through the /cansee command.',
    bgColor: 'linear-gradient(135deg, #5865F215, #5865F208)',
    connected: false,
    connectionId: null,
    webhookUrl: '',
    channelName: '',
    externalTeamId: '',
    scheduleTime: '',
    notifPrefs: null,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.3 4.1a19.4 19.4 0 0 0-4.8-1.5 14.5 14.5 0 0 0-.6 1.3 18 18 0 0 0-5.4 0c-.2-.5-.4-.9-.6-1.3A19.3 19.3 0 0 0 4 4.1 20 20 0 0 0 .5 17.7a19.5 19.5 0 0 0 6 3 14.6 14.6 0 0 0 1.3-2 12.6 12.6 0 0 1-2-.9l.5-.4c3.8 1.8 8 1.8 11.8 0 .2.1.3.3.5.4-.6.4-1.3.7-2 .9.4.7.8 1.4 1.3 2a19.5 19.5 0 0 0 6-3A20 20 0 0 0 20.3 4.1zM8 14.8c-1.2 0-2.2-1.1-2.2-2.4S6.8 10 8 10s2.2 1.1 2.2 2.4S9.2 14.8 8 14.8zm8 0c-1.2 0-2.2-1.1-2.2-2.4S14.8 10 16 10s2.2 1.1 2.2 2.4S17.2 14.8 16 14.8z"/></svg>',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Deliver the daily report, brand-security alerts, and hot-lead alerts to a Microsoft Teams channel through an incoming webhook.',
    bgColor: 'linear-gradient(135deg, #6264A715, #6264A708)',
    connected: false,
    connectionId: null,
    webhookUrl: '',
    channelName: '',
    externalTeamId: '',
    scheduleTime: '',
    notifPrefs: null,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="7.5" r="3" fill="#7B83EB"/><rect x="8" y="6" width="13" height="13" rx="2.5" fill="#5B5FC7"/><path d="M11 9.3h7M14.5 9.3V16" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
  },
])

// Directory entries for platforms on the roadmap. Rendered as neutral,
// non-interactive monogram tiles; no click handlers, no brand artwork.

// "What gets sent" list. The backend stores the trend and milestone
// toggles but does not send those notifications yet, hence the chips.
const sentItems = [
  { title: 'Daily Growth Report', desc: 'Visitor count, lead score changes, and conversion trends delivered every morning.' },
  { title: 'Brand-Security Alerts', desc: 'A heads-up when a new brand-security finding is opened, with the recommended fix.' },
  { title: 'Hot Lead Alerts', desc: 'Instant notification when a lead reaches 80+ score or visits your pricing page.' },
  { title: 'Brand Pulse Digest', desc: 'A daily brand summary: new alerts, sentiment watchouts, and conversations to join.' },
  { title: 'Trend Intelligence', desc: 'Weekly trending keywords and market shifts relevant to your business posture.', soon: true },
  { title: 'Growth Milestones', desc: 'Celebrate when your team hits traffic goals, lead targets, or SEO improvements.', soon: true },
]

// ── Load saved connections from the API ──
async function loadConnections() {
  try {
    const res = await integrationsApi.list()
    // Notifications endpoints double-wrap: the unwrapped payload is
    // itself {data: [...]}, so res.data?.data is the connection list.
    const saved = res.data?.data || []
    for (const conn of saved) {
      const intg = integrations.find(i => i.id === conn.platform)
      if (!intg) continue
      intg.connected = conn.is_active
      intg.connectionId = conn.id
      // The webhook URL is write-only server-side (a secret we never read
      // back). Track only whether one is configured; leave the input
      // blank — submitting it blank keeps the stored webhook.
      intg.webhookConfigured = !!conn.webhook_configured
      intg.webhookUrl = ''
      intg.channelName = conn.channel_name || ''
      intg.externalTeamId = conn.external_team_id || ''
      // TimeFields may serialize as HH:MM:SS; the API expects HH:MM back.
      intg.scheduleTime = (conn.schedule_time || '').slice(0, 5)
      intg.notifPrefs = {
        daily: typeof conn.notify_daily_report === 'boolean' ? conn.notify_daily_report : prefDefaults.daily,
        hotlead: typeof conn.notify_hot_leads === 'boolean' ? conn.notify_hot_leads : prefDefaults.hotlead,
        trends: typeof conn.notify_trend_digest === 'boolean' ? conn.notify_trend_digest : prefDefaults.trends,
        milestones: typeof conn.notify_milestones === 'boolean' ? conn.notify_milestones : prefDefaults.milestones,
      }
    }
  } catch (e) {
    console.warn('Failed to load integrations:', e)
  } finally {
    loading.value = false
  }
}

// ── Text messages (SMS) ──
const smsIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="#34C759"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'

const smsLoaded = ref(false)      // GET /notifications/sms/ succeeded
const smsAvailable = ref(false)
const smsSub = ref(null)          // active subscription row (pending or verified)
const smsMode = ref('idle')       // 'idle' | 'phone' — inline phone entry open
const smsPhone = ref('')
const smsCode = ref('')
const smsError = ref('')          // inline error under the phone/code input
const smsSending = ref(false)
const smsVerifying = ref(false)
const smsResending = ref(false)
const smsDisconnecting = ref(false)
const smsToggleBusy = ref(null)   // key of the preference currently PATCHing

const smsToggles = [
  { key: 'alert_security', label: 'High-severity security alerts' },
  { key: 'alert_visibility_drop', label: 'Sharp visibility drops' },
  { key: 'pulse_digest', label: 'Brand Pulse digest', desc: 'Recurring summary texts — off unless you turn it on.' },
  { key: 'allow_replies', label: 'Allow replies (ask questions by text)' },
]

// Card state machine. 'loading' covers both the initial fetch and a failed
// GET: the tile renders with no body so the webhook tiles are unaffected.
const smsState = computed(() => {
  if (!smsLoaded.value) return 'loading'
  if (!smsAvailable.value) return 'unavailable'
  if (smsSub.value?.status === 'verified') return 'verified'
  if (smsSub.value?.status === 'pending') return 'pending'
  if (smsMode.value === 'phone') return 'phone'
  return 'disconnected'
})

// The sibling notifications endpoints double-wrap their payload (see
// loadConnections); accept either shape so the card survives both.
function smsPayload(res) {
  const d = res?.data
  if (d && (d.available !== undefined || d.subscriptions !== undefined
    || d.id !== undefined || d.ok !== undefined)) return d
  return d?.data ?? d
}

async function loadSms() {
  try {
    const res = await integrationsApi.smsList()
    const payload = smsPayload(res) || {}
    smsAvailable.value = !!payload.available
    const subs = payload.subscriptions || []
    // opted_out rows count as not connected, so the number can be re-added.
    smsSub.value = subs.find(s => s.status === 'verified')
      || subs.find(s => s.status === 'pending')
      || null
    smsLoaded.value = true
  } catch (e) {
    // Leave smsLoaded false — the card body stays hidden and the
    // Slack/Discord/Teams tiles are unaffected.
    console.warn('Failed to load SMS status:', e)
  }
}

function openSmsConnect() {
  smsMode.value = 'phone'
  smsPhone.value = ''
  smsError.value = ''
}

function cancelSmsConnect() {
  smsMode.value = 'idle'
  smsError.value = ''
}

async function sendSmsCode() {
  const phone = smsPhone.value.trim()
  if (!phone || smsSending.value) return
  smsSending.value = true
  smsError.value = ''
  try {
    const res = await integrationsApi.smsSubscribe(phone)
    const row = smsPayload(res)
    smsSub.value = row || null
    smsMode.value = 'idle'
    smsCode.value = ''
    if (row?.sent === false) {
      smsError.value = 'We could not send the code just now. Use "Resend code" in a moment.'
    } else {
      showToast(`Verification code sent to ${row?.phone_masked || phone}`)
    }
  } catch (err) {
    const backendError = err.response?.data?.error
    if (backendError?.code === 'sms_unavailable') {
      // The whole channel is off on this deployment; fall back to the
      // muted "Not available" body.
      smsAvailable.value = false
      smsMode.value = 'idle'
    }
    smsError.value = backendError?.message || 'Could not send the code. Check the number and try again.'
  } finally {
    smsSending.value = false
  }
}

async function verifySmsCode() {
  const code = smsCode.value.trim()
  if (!code || smsVerifying.value || !smsSub.value) return
  smsVerifying.value = true
  smsError.value = ''
  try {
    const res = await integrationsApi.smsVerify(smsSub.value.id, code)
    smsSub.value = smsPayload(res) || smsSub.value
    smsCode.value = ''
    showToast('Text messages connected')
  } catch (err) {
    // invalid_code / code_expired — the backend message renders inline.
    smsError.value = err.response?.data?.error?.message || 'That code did not work. Try again or resend it.'
  } finally {
    smsVerifying.value = false
  }
}

async function resendSmsCode() {
  if (smsResending.value || !smsSub.value) return
  smsResending.value = true
  smsError.value = ''
  try {
    const res = await integrationsApi.smsResend(smsSub.value.id)
    const payload = smsPayload(res)
    if (payload?.sent === false) {
      smsError.value = 'We could not send the code just now. Try again shortly.'
    } else {
      showToast(`Code re-sent to ${smsSub.value.phone_masked}`)
    }
  } catch (err) {
    smsError.value = err.response?.data?.error?.message || 'Could not resend the code.'
  } finally {
    smsResending.value = false
  }
}

async function toggleSmsPref(key, value) {
  const sub = smsSub.value
  if (!sub || smsToggleBusy.value) return
  const previous = sub[key]
  sub[key] = value // optimistic; reverted on failure
  smsToggleBusy.value = key
  try {
    const res = await integrationsApi.smsUpdate(sub.id, { [key]: value })
    const row = smsPayload(res)
    if (row?.id === sub.id) smsSub.value = row
    showToast('Text message preferences updated')
  } catch (err) {
    sub[key] = previous
    showToast(err.response?.data?.error?.message || 'Could not update that preference.', 'error')
  } finally {
    smsToggleBusy.value = null
  }
}

async function disconnectSms() {
  const sub = smsSub.value
  if (!sub || smsDisconnecting.value) return
  if (!window.confirm('Disconnect text messages? You will stop receiving texts from Cansee.')) return
  smsDisconnecting.value = true
  try {
    await integrationsApi.smsRemove(sub.id)
    smsSub.value = null
    smsMode.value = 'idle'
    smsPhone.value = ''
    smsCode.value = ''
    smsError.value = ''
    showToast('Text messages disconnected')
  } catch (err) {
    showToast(err.response?.data?.error?.message || 'Could not disconnect text messages.', 'error')
  } finally {
    smsDisconnecting.value = false
  }
}

// ── Scroll-triggered reveal for the "What gets sent" list ──
const sentSection = ref(null)
const sentRevealed = ref(false)
let sentObserver = null

function setupSentReveal() {
  // Reduced motion (or no IntersectionObserver): skip the animation and
  // show every row immediately.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || !('IntersectionObserver' in window)
    || !sentSection.value) {
    sentRevealed.value = true
    return
  }
  sentObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      sentRevealed.value = true
      sentObserver.disconnect()
      sentObserver = null
    }
  }, { threshold: 0.2 })
  sentObserver.observe(sentSection.value)
}

onMounted(() => {
  loadConnections()
  loadSms()
  setupSentReveal()
})

onBeforeUnmount(() => {
  if (sentObserver) {
    sentObserver.disconnect()
    sentObserver = null
  }
})

function openConnect(intg) {
  activeIntegration.value = intg
  webhookUrl.value = ''
  channelName.value = ''
  externalTeamId.value = ''
  setPrefs(null)
  showConnectModal.value = true
}

function openSettings(intg) {
  activeIntegration.value = intg
  webhookUrl.value = intg.webhookUrl || ''
  channelName.value = intg.channelName || ''
  externalTeamId.value = intg.externalTeamId || ''
  setPrefs(intg.notifPrefs)
  showConnectModal.value = true
}

async function disconnect(intg) {
  if (intg.connectionId) {
    try {
      await integrationsApi.disconnect(intg.connectionId)
    } catch (e) {
      console.error('Disconnect failed:', e)
    }
  }
  intg.connected = false
  intg.connectionId = null
  intg.webhookUrl = ''
  intg.channelName = ''
  intg.externalTeamId = ''
  intg.scheduleTime = ''
  intg.notifPrefs = null
  showToast(`${intg.name} disconnected`)
}

async function confirmConnect() {
  if (!webhookUrl.value.trim()) return
  connecting.value = true

  const intg = integrations.find(i => i.id === activeIntegration.value.id)
  if (!intg) { connecting.value = false; return }

  try {
    // Map notification prefs to API fields
    const prefMap = { daily: 'notify_daily_report', hotlead: 'notify_hot_leads', trends: 'notify_trend_digest', milestones: 'notify_milestones' }
    const notifData = {}
    for (const p of notifPrefs) {
      if (prefMap[p.key]) notifData[prefMap[p.key]] = p.enabled
    }

    // The schedule selector is gone from the UI, but the payload shape is
    // unchanged: send the saved time for an existing connection, or the
    // 09:00 default for a new one.
    const scheduleTime = intg.scheduleTime || '09:00'

    // Save to backend (upsert). Backend sends a test message server-side.
    const res = await integrationsApi.connect({
      platform: intg.id,
      webhook_url: webhookUrl.value.trim(),
      channel_name: channelName.value.trim(),
      external_team_id: externalTeamId.value.trim(),
      schedule_time: scheduleTime,
      ...notifData,
    })

    const saved = res.data?.data
    intg.connected = true
    intg.connectionId = saved?.id || intg.connectionId || null
    intg.webhookUrl = webhookUrl.value.trim()
    intg.channelName = channelName.value.trim()
    intg.externalTeamId = externalTeamId.value.trim()
    intg.scheduleTime = scheduleTime
    intg.notifPrefs = snapshotPrefs()

    connecting.value = false
    showConnectModal.value = false
    showToast(`${intg.name} connected. A test message was sent to your channel.`)
  } catch (err) {
    console.error('Connect failed:', err)
    connecting.value = false
    // The notifications endpoints return {"error": "..."} with the
    // specific reason (invalid platform, malformed webhook URL, ...).
    const backendError = err.response?.data?.error
    const message = typeof backendError === 'string' && backendError
      ? backendError
      : `Failed to connect ${intg.name}. Please check the webhook URL.`
    showToast(message, 'error')
  }
}

function showToast(msg, kind = 'success') {
  successMessage.value = msg
  toastKind.value = kind
  showSuccessToast.value = true
  setTimeout(() => { showSuccessToast.value = false }, 4000)
}
</script>

<style scoped>
/* ═══════════════════════════════════════
   Integrations Directory
   ═══════════════════════════════════════ */
.integrations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
  margin-bottom: 40px;
}

.intg-tile {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

.intg-tile.connected {
  border-color: color-mix(in srgb, var(--chart-2) 30%, transparent);
}

.intg-tile-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.intg-icon-wrap {
  width: 48px; height: 48px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* The brand SVGs are injected via v-html with width/height 24 attributes;
   scale them from CSS so the markup stays untouched. */
.intg-icon-wrap :deep(svg) {
  width: 28px;
  height: 28px;
}

.intg-tile-identity { flex: 1; min-width: 0; }

.intg-tile-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
}

.intg-tile-status {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-top: 1px;
}
.text-success { color: var(--chart-2); }
.text-muted { color: var(--muted-foreground); }

.intg-tile-desc {
  flex: 1;
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin: 0;
}

.intg-tile-actions {
  display: flex;
  gap: 8px;
}

/* ── Text messages (SMS) tile ── */
.sms-unavailable {
  font-size: 12px;
  color: var(--muted-foreground);
  margin: 0;
}

.sms-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.sms-input-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.sms-form-hint {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin: 0 0 8px;
}
.sms-form-hint strong { color: var(--foreground); }

.sms-error {
  font-size: 12px;
  color: var(--destructive);
  line-height: 1.4;
  margin: 6px 0 0;
}

.sms-quiet-link {
  background: none;
  border: none;
  padding: 0;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.sms-quiet-link:hover { color: var(--foreground); }
.sms-quiet-link:disabled { opacity: 0.6; cursor: default; }

/* .soon-badge is still used by the "What gets sent" list below. */
.soon-badge {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--muted-foreground);
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 2px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.intg-tile-main .soon-badge { margin-left: auto; }

/* ═══════════════════════════════════════
   What Gets Sent
   ═══════════════════════════════════════ */
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  margin-bottom: 8px;
}

.sent-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sent-row {
  padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
.sent-row:last-child { border-bottom: none; }

.sent-row:hover {
  background: color-mix(in srgb, var(--muted) 50%, transparent);
}

/* Scroll-triggered staggered reveal. Rows start hidden and slide up into
   place once the section enters the viewport; --reveal-delay is set
   per-row inline (index * 70ms) for the stagger. */
.sent-row-hidden {
  opacity: 0;
  transform: translateY(10px);
}

.sent-row-revealed {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 400ms ease-out, transform 400ms ease-out;
  transition-delay: var(--reveal-delay, 0ms);
}

@media (prefers-reduced-motion: reduce) {
  .sent-row-hidden,
  .sent-row-revealed {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

.sent-row-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.sent-row-desc {
  display: block;
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin-top: 2px;
}

/* ═══════════════════════════════════════
   Connect Modal
   ═══════════════════════════════════════ */
.connect-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 16px;
}

.connect-step {
  display: flex;
  gap: 12px;
}

.step-number {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-content { flex: 1; }
.step-content h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 4px;
}
.step-content p {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.4;
  margin: 0 0 8px;
}

.step-link { color: var(--primary); text-decoration: none; font-weight: 600; }
.step-link:hover { text-decoration: underline; }

.bot-link {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-bottom: 16px;
}

.bot-link-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin: 0 0 10px;
}

.bot-link-hint {
  font-size: 0.65rem;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin: 8px 0 0;
}

.notif-prefs {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-bottom: 16px;
}

.prefs-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
  margin: 0 0 10px;
}

.pref-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  cursor: pointer;
}

.pref-name {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
}

.pref-desc {
  display: block;
  font-size: 0.65rem;
  color: var(--muted-foreground);
  margin-top: 1px;
}

.modern-check {
  width: 15px; height: 15px;
  cursor: pointer;
  accent-color: var(--primary);
  margin-top: 2px;
}

.btn-spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Success Toast ── */
.success-toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--card);
  border: 1px solid color-mix(in srgb, var(--chart-2) 30%, transparent);
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  z-index: 200;
}

.success-toast.toast-error {
  border-color: color-mix(in srgb, var(--destructive) 35%, transparent);
}

.toast-enter-active { transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(20px); }

/* ── Responsive ── */
@media (max-width: 768px) {
  .integrations-grid { grid-template-columns: 1fr; }
}
</style>
