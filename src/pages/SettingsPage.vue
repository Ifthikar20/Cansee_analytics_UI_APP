<template>
  <SettingsShell :active="section">
    <!-- ── Account ─────────────────────────────────────────────── -->
    <template v-if="section === 'account'">
      <SettingsSection
        label="Profile"
        title="Profile"
        description="Your name and company, as they appear across Cansee."
      >
        <form id="sp-profile-form" class="sp-form" @submit.prevent="saveProfile">
          <div class="sp-field">
            <label for="sp-name" class="sp-label">Full name</label>
            <input id="sp-name" v-model="profile.full_name" class="sp-input" autocomplete="name" />
          </div>
          <div class="sp-field">
            <label for="sp-email" class="sp-label">Email</label>
            <input id="sp-email" v-model="profile.email" class="sp-input" disabled />
          </div>
          <div class="sp-field">
            <label for="sp-company" class="sp-label">Company</label>
            <input id="sp-company" v-model="profile.company_name" class="sp-input" autocomplete="organization" />
          </div>
        </form>
        <template #footer>
          <span v-if="saveState === 'saved'" class="sp-foot-note">Saved</span>
          <span v-else-if="saveState === 'error'" class="sp-foot-note is-error">Couldn't save — try again.</span>
          <Button type="submit" form="sp-profile-form" class="sp-btn" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </Button>
        </template>
      </SettingsSection>

      <SettingsSection
        label="Danger zone"
        title="Delete account"
        description="Permanently erases your account and everything in it — websites, analytics history, knowledge base, subscription and profile. Nothing is kept, and there is no way back."
        danger
      >
        <Button variant="destructive" class="sp-btn" :disabled="deleting" @click="confirmDeleteAccount">
          {{ deleting ? 'Deleting…' : 'Delete account' }}
        </Button>
      </SettingsSection>
    </template>

    <!-- ── AI Usage ────────────────────────────────────────────── -->
    <template v-else-if="section === 'usage'">
      <SettingsSection
        label="Usage"
        title="AI usage"
        description="Tokens and requests used by AI features in the current billing period."
      >
        <div v-if="usageLoading" class="sp-loading">
          <span class="spinner"></span>
          <span>Loading usage…</span>
        </div>

        <template v-else-if="usage">
          <!-- The allowance is a dollar spend cap — the same number
               enforcement uses. Tokens are shown as real counts, never
               converted into an invented "token capacity". -->
          <div
            v-if="usage.allowance && usage.allowance.cap_usd > 0"
            class="sp-allowance"
            :class="{ 'is-warn': usage.allowance.warning, 'is-exceeded': usage.allowance.exceeded }"
          >
            <div class="sp-allowance-head">
              <span class="sp-allowance-title">AI allowance · {{ authStore.planState.tierLabel }}</span>
              <span class="sp-allowance-amt">
                ${{ usage.allowance.spent_usd.toFixed(2) }} of ${{ usage.allowance.cap_usd.toFixed(2) }}
                <b>({{ usage.allowance.pct_used }}%)</b>
              </span>
            </div>
            <div class="sp-bar">
              <div class="sp-bar-fill" :style="{ width: Math.min(100, usage.allowance.pct_used || 0) + '%' }"></div>
            </div>
            <p class="sp-allowance-note">
              {{ formatTokens(usage.allowance.used_tokens) }} tokens used this period.
              Allowance renews {{ new Date(usage.allowance.resets_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) }}.
            </p>
            <p v-if="usage.allowance.exceeded" class="sp-allowance-flag is-exceeded">
              Allowance reached. AI features resume at the renewal date.
            </p>
            <p v-else-if="usage.allowance.warning" class="sp-allowance-flag is-warn">
              Over 80% of this period's allowance used.
            </p>
          </div>

          <!-- Billing period + trailing week, one screen -->
          <div class="sp-tiles">
            <div class="sp-tile">
              <span class="sp-tile-value">{{ formatTokens(usage.totals.total_tokens) }}</span>
              <span class="sp-tile-label">Tokens · billing period</span>
            </div>
            <div class="sp-tile">
              <span class="sp-tile-value">{{ formatNum(usage.totals.calls) }}</span>
              <span class="sp-tile-label">Requests · billing period</span>
            </div>
            <div class="sp-tile">
              <span class="sp-tile-value">{{ formatTokens(weekTotals.tokens) }}</span>
              <span class="sp-tile-label">Tokens · 7 days</span>
            </div>
            <div class="sp-tile">
              <span class="sp-tile-value">{{ formatNum(weekTotals.calls) }}</span>
              <span class="sp-tile-label">Requests · 7 days</span>
            </div>
          </div>

          <!-- Daily spend across the current billing period; compact, as it
               sits inside the section's card. -->
          <VizChart
            v-if="dailySeries.length"
            class="sp-chart"
            :spec="dailyChart"
            :height="208"
            :heading-level="4"
            compact
          />

          <!-- Empty state -->
          <div v-if="!usage.totals.calls" class="sp-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /><path d="M12 6v6l4 2" />
            </svg>
            <p>No AI usage recorded this billing period yet.</p>
          </div>

          <p class="sp-footnote">
            Token counts are reported by the AI providers per request. Costs
            are calculated against the current market rates of the underlying
            providers (Anthropic, OpenAI, xAI, Perplexity, Google); the
            allowance may be adjusted if provider pricing changes.
          </p>
        </template>

        <div v-else class="sp-failed">
          <p class="sp-muted">We couldn't load your AI usage.</p>
          <Button variant="outline" class="sp-btn" @click="loadUsage">Try again</Button>
        </div>
      </SettingsSection>
    </template>

    <!-- ── Notifications ───────────────────────────────────────── -->
    <!-- No email alerts are sent today, so there is nothing to toggle. -->
    <template v-else-if="section === 'notifications'">
      <SettingsSection
        label="Email"
        title="Email notifications"
      >
        <p class="sp-muted">Email alerts aren't available yet.</p>
        <p class="sp-muted sp-muted--spaced">
          For a daily report in Slack, Discord or Microsoft Teams, connect a channel in
          <router-link :to="{ name: 'settings-connections' }" class="sp-inline-link">Connections</router-link>.
        </p>
      </SettingsSection>
    </template>

    <!-- ── Contact us ──────────────────────────────────────────── -->
    <template v-else-if="section === 'contact'">
      <SettingsSection
        label="Support"
        title="Contact us"
        description="Questions, billing issues, refund requests, or something that looks wrong — one channel for all of it."
      >
        <div class="sp-contact">
          <span class="sp-contact-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              <path d="m22 6-10 7L2 6" />
            </svg>
          </span>
          <span class="sp-row-text">
            <span class="sp-row-title">Email support</span>
          </span>
          <a class="sp-contact-btn" :href="supportHref">{{ SUPPORT_EMAIL }}</a>
        </div>
        <p class="sp-contact-hint">
          Write from the email address on your account ({{ authStore.user?.email || 'the one you signed up with' }})
          so we can find your workspace and billing history right away. For refunds, mention the
          approximate charge date.
          <template v-if="feedbackEnabled">
            Prefer to stay in the app? Use the Help &amp; feedback button in the top bar; replies show up there.
          </template>
        </p>
      </SettingsSection>
    </template>

    <!-- ── Organization: Team ──────────────────────────────────── -->
    <template v-else-if="section === 'team'">
      <OrgMembersSection />
    </template>

    <!-- ── Organization: Domains & SSO ─────────────────────────── -->
    <template v-else-if="section === 'domains'">
      <OrgDomainsSection v-if="authStore.isOrgAdmin" />
      <!-- Non-admin deep link: no domain management, no scary error. -->
      <SettingsSection
        v-else
        label="Organization"
        title="Domains &amp; SSO"
        description="Domain verification and single sign-on for your organization."
      >
        <p class="sp-muted">You need admin access to manage domains.</p>
      </SettingsSection>
    </template>

    <!-- ── Appearance ──────────────────────────────────────────── -->
    <template v-else-if="section === 'appearance'">
      <SettingsSection
        label="Theme"
        title="Theme"
        description="How Cansee looks on every screen."
      >
        <div class="sp-options" role="radiogroup" aria-label="Theme">
          <button
            v-for="opt in THEME_OPTIONS" :key="opt.key"
            type="button" class="sp-opt" :class="{ 'is-active': appStore.theme === opt.key }"
            role="radio" :aria-checked="appStore.theme === opt.key ? 'true' : 'false'"
            @click="appStore.setTheme(opt.key)"
          >
            <span class="sp-opt-preview" :class="`sp-opt-preview--${opt.key}`" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="sp-opt-name">{{ opt.label }}</span>
          </button>
        </div>
        <div class="sp-note">
          <span class="sp-note-icon" aria-hidden="true">
            <svg v-if="appStore.resolvedTheme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </span>
          <div>
            <p class="sp-note-title">{{ activeTheme.label }}</p>
            <p class="sp-note-text">{{ activeTheme.note }}</p>
          </div>
        </div>
      </SettingsSection>
    </template>
  </SettingsShell>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'
import authApi from '@/api/auth'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import OrgMembersSection from '@/components/org/OrgMembersSection.vue'
import OrgDomainsSection from '@/components/org/OrgDomainsSection.vue'
import VizChart from '@/components/charts/VizChart.vue'
import { aiUsageSpec } from '@/lib/analytics/polishSpecs'
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '@/constants/support'
import { Button } from '@/components/ui/button'

const authStore = useAuthStore()
const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const saving = ref(false)
const saveState = ref('idle') // idle | saved | error
const deleting = ref(false)

// The active section comes from the URL (?section=...), so the shell's
// nav links are ordinary router-links and every section deep-links.
// Org sections only resolve when the session actually has an org — a
// B2C deep link to ?section=team just lands on Account.
const SECTIONS = computed(() => {
  const base = ['account', 'usage', 'notifications', 'appearance', 'contact']
  return authStore.org ? [...base, 'team', 'domains'] : base
})
const section = computed(() =>
  SECTIONS.value.includes(route.query.section) ? route.query.section : 'account',
)

// mailto with a prefilled subject; the body seeds the account email so
// support can match the sender to a workspace even when people write
// from a personal address.
const supportHref = computed(() => {
  const params = new URLSearchParams({ subject: SUPPORT_SUBJECT })
  const acct = authStore.user?.email
  if (acct) params.set('body', `Account email: ${acct}\n\n`)
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`
})

// The in-app feedback panel only exists when its service URL is set.
const feedbackEnabled = Boolean(import.meta.env.VITE_FEEDBACK_API_URL)

const THEME_OPTIONS = [
  { key: 'system', label: 'System', note: "Follows your device's appearance setting and switches automatically." },
  { key: 'light', label: 'Light', note: 'White surfaces with near-black text.' },
  { key: 'dark', label: 'Dark', note: 'Pure black with white text — high contrast, easy on the eyes at night.' },
]
const activeTheme = computed(() => {
  const opt = THEME_OPTIONS.find((o) => o.key === appStore.theme) || THEME_OPTIONS[1]
  if (opt.key !== 'system') return opt
  return { ...opt, note: `${opt.note} Right now that means ${appStore.resolvedTheme} mode.` }
})

// Deletion is irreversible, so the confirmation is deliberately manual:
// the user must type their email exactly. A misclick cannot pass it.
async function confirmDeleteAccount() {
  const email = authStore.user?.email || profile.value.email
  const typed = window.prompt(
    `This permanently deletes your account and all data. There is no undo.\n\n` +
    `Type your email (${email}) to confirm:`,
  )
  if (typed === null) return
  if (typed.trim().toLowerCase() !== String(email).toLowerCase()) {
    window.alert('Email did not match — nothing was deleted.')
    return
  }
  deleting.value = true
  try {
    await authApi.deleteMe()
    authStore.clearAuth()
    router.push('/')
  } catch (e) {
    window.alert(e?.response?.data?.error?.message || "Deletion failed — nothing was removed.")
  } finally {
    deleting.value = false
  }
}

const profile = ref({
  full_name: '',
  email: '',
  company_name: '',
})

// ── AI Usage ──
const usage = ref(null)
const usageLoading = ref(false)

// The server returns exactly the current billing period — the daily series
// IS the window, no client-side re-windowing. The only derived rollup is
// the trailing-7-days pair of tiles.
const weekTotals = computed(() => {
  const daily = usage.value?.daily || []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 6)
  cutoff.setHours(0, 0, 0, 0)
  let tokens = 0, calls = 0
  for (const d of daily) {
    if (d.day && new Date(d.day) >= cutoff) {
      tokens += d.tokens || 0
      calls += d.calls || 0
    }
  }
  return { tokens, calls }
})

const dailySeries = computed(() => usage.value?.daily || [])

const periodLabel = computed(() => {
  const p = usage.value?.period
  if (!p?.start) return ''
  const opts = { month: 'short', day: 'numeric' }
  const start = new Date(p.start).toLocaleDateString('en-US', opts)
  const end = new Date(p.end).toLocaleDateString('en-US', opts)
  return `${start} – ${end}`
})

// The estimated AI cost of each day in the billing period.
const dailyChart = computed(() => aiUsageSpec(dailySeries.value, { subtitle: periodLabel.value }))

function formatNum(n) { return (n || 0).toLocaleString() }
function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

async function loadUsage() {
  usageLoading.value = true
  try {
    // Silent: the section shows the failure inline.
    const { data } = await api.get('/auth/me/ai-usage/', { _silentError: true })
    usage.value = data
  } catch {
    usage.value = null
  } finally {
    usageLoading.value = false
  }
}

onMounted(() => {
  if (authStore.user) {
    profile.value = {
      full_name: authStore.user.full_name || '',
      email: authStore.user.email || '',
      company_name: authStore.user.company_name || '',
    }
  }
  loadUsage()
})

let savedTimer = null
async function saveProfile() {
  saving.value = true
  saveState.value = 'idle'
  clearTimeout(savedTimer)
  try {
    // PUT /auth/me/ is partial: only the editable fields travel. Email is
    // read-only server-side and is never sent.
    await authApi.updateMe({
      full_name: profile.value.full_name,
      company_name: profile.value.company_name,
    })
    if (authStore.user) {
      authStore.user.full_name = profile.value.full_name
      authStore.user.company_name = profile.value.company_name
    }
    saveState.value = 'saved'
    savedTimer = setTimeout(() => { saveState.value = 'idle' }, 2500)
  } catch (e) {
    console.error('Failed to save profile', e)
    saveState.value = 'error'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* ── Form controls ── */
.sp-form { display: flex; flex-direction: column; gap: 16px; }
.sp-field { display: flex; flex-direction: column; }
.sp-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground);
}
.sp-input {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--input);
  border-radius: 12px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.sp-input:focus,
.sp-input:focus-visible {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}
.sp-input:disabled {
  background: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}

.sp-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 13px;
}
.sp-foot-note { font-size: 12px; color: var(--muted-foreground); }
.sp-foot-note.is-error { color: var(--destructive); }
.sp-muted { margin: 0; font-size: 13px; color: var(--muted-foreground); }

.sp-muted--spaced { margin-top: 8px; }
.sp-inline-link {
  color: var(--foreground);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.sp-failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* ── Row text (contact) ── */
.sp-row-text { display: flex; flex-direction: column; min-width: 0; }
.sp-row-title { font-size: 13px; font-weight: 500; color: var(--foreground); }

/* ── Option tiles (appearance) ── */
.sp-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  max-width: 520px;
}
.sp-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 0;
  background: none;
  border: 0;
  font: inherit;
  color: var(--foreground);
  cursor: pointer;
}
.sp-opt-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 84px;
  padding: 0 22px;
  border-radius: 14px;
  border: 1px solid var(--border);
  box-shadow: 0 0 0 0 transparent;
  transition: box-shadow 150ms ease, border-color 150ms ease;
}
.sp-opt-preview i {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 5px;
}
.sp-opt-preview i::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--_ink);
}
.sp-opt-preview i::after {
  content: '';
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--_ink);
}
.sp-opt-preview i:nth-child(2)::after { flex: 0 0 60%; }
.sp-opt-preview i:nth-child(3)::after { flex: 0 0 80%; }
/* The previews are literal swatches of each theme, so their colours are
   fixed on purpose and do not follow the active theme. */
.sp-opt-preview--light { background: #ffffff; --_ink: #cfcfcb; }
.sp-opt-preview--dark { background: #000000; border-color: #2a2a2a; --_ink: #4a4a4a; }
.sp-opt-preview--system {
  background: linear-gradient(105deg, #ffffff 0 50%, #000000 50% 100%);
  --_ink: #9a9a9a;
}
.sp-opt:hover .sp-opt-preview { border-color: color-mix(in srgb, var(--foreground) 22%, transparent); }
.sp-opt.is-active .sp-opt-preview {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px var(--ring);
}
.sp-opt-name { font-size: 13px; font-weight: 500; }
.sp-opt:focus-visible { outline: none; }
.sp-opt:focus-visible .sp-opt-preview { box-shadow: 0 0 0 2px var(--ring); }

.sp-note {
  display: flex;
  gap: 14px;
  margin-top: 20px;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--accent);
  border: 1px solid color-mix(in srgb, var(--ring) 16%, transparent);
}
.sp-note-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--background) 70%, transparent);
  color: var(--accent-foreground);
}
.sp-note-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--accent-foreground); }
.sp-note-text { margin: 3px 0 0; font-size: 13px; line-height: 1.55; color: var(--foreground); opacity: 0.78; }

/* ── Contact us ── */
.sp-contact {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
}
.sp-contact .sp-row-text { flex: 1; }
.sp-contact-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--muted);
  color: var(--muted-foreground);
}
.sp-contact-btn {
  flex: none;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  text-decoration: none;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.sp-contact-btn:hover {
  border-color: var(--foreground);
  background: color-mix(in srgb, var(--muted) 65%, transparent);
}
.sp-contact-hint {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted-foreground);
}
@media (max-width: 560px) {
  .sp-contact { flex-wrap: wrap; }
  .sp-contact-btn { width: 100%; text-align: center; }
}

/* ── AI usage ── */
.sp-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 0;
  font-size: 13px;
  color: var(--muted-foreground);
}

.sp-allowance {
  margin-bottom: 16px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--muted);
}
.sp-allowance-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 10px;
}
.sp-allowance-title { font-size: 13px; font-weight: 600; color: var(--foreground); }
.sp-allowance-amt { font-size: 13px; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
.sp-allowance-amt b { margin-left: 4px; font-weight: 600; color: var(--foreground); }
.sp-bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--border); }
.sp-bar-fill { height: 100%; border-radius: inherit; background: var(--chart-2); transition: width 200ms ease; }
.is-warn .sp-bar-fill { background: var(--chart-5); }
.is-exceeded .sp-bar-fill { background: var(--destructive); }
.sp-allowance-note { margin: 10px 0 0; font-size: 12px; color: var(--muted-foreground); }
.sp-allowance-flag { margin: 8px 0 0; font-size: 12px; font-weight: 600; }
.sp-allowance-flag.is-warn { color: #b25e09; }
.sp-allowance-flag.is-exceeded { color: var(--destructive); }

.sp-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 640px) {
  .sp-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.sp-tile {
  padding: 16px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--muted);
  text-align: center;
}
.sp-tile-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
}
.sp-tile-label {
  display: block;
  margin-top: 7px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.sp-chart { margin-top: 20px; }

.sp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 30px 16px 26px;
  text-align: center;
  color: var(--muted-foreground);
}
.sp-empty p { max-width: 440px; margin: 0; font-size: 13px; line-height: 1.55; }

.sp-footnote {
  margin: 18px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--muted-foreground);
}

/* ── Spinner ── */
.spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--chart-1);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
