<template>
  <div class="pw">
    <WatercolorBackdrop src="/videos/watercolor-second.mp4" />

    <header class="pw-top">
      <div class="pw-brand">
        <img src="/images/cansee-logo.png" alt="Cansee" class="pw-brand-mark" />
      </div>
      <div class="pw-top-right">
        <span v-if="email" class="pw-top-email">{{ email }}</span>
        <button type="button" class="pw-signout" @click.prevent="signOut">Sign out</button>
      </div>
    </header>

    <main class="pw-main">
      <div class="pw-content">
        <div class="pw-stagger">
          <span class="pw-eyebrow">Upgrade</span>
          <h1 class="pw-title">Get serious about how AI sees you.</h1>

          <p v-if="onbSummary" class="pw-sub">
            <strong>{{ onbSummary.domain }}</strong> is set up with
            <strong>{{ onbSummary.competitors }} {{ onbSummary.competitors === 1 ? 'competitor' : 'competitors' }}</strong>
            to compare against.
          </p>
          <p v-else class="pw-sub">
            See what every major LLM says about you — and who they
            recommend instead.
          </p>

          <p v-if="plansState === 'loading'" class="pw-plans-note">Loading plans...</p>
          <p v-else-if="plansState === 'failed'" class="pw-plans-note">
            We couldn't load the plans.
            <button type="button" class="pw-retry" @click="loadPlans">Try again</button>
          </p>
          <p v-else-if="!hasSelfServe" class="pw-plans-note">Upgrades aren't available right now.</p>

          <!-- The pricing window: the same two cards as /pricing. -->
          <div v-else class="pw-cards">
            <PricingCards
              :plans="plans"
              :busy="submitting"
              :billing-ready="billingReady"
              signed-in
              @choose="startCheckout"
            />
          </div>

          <p v-if="error" class="pw-error" role="alert">{{ error }}</p>

          <ul class="pw-trust">
            <li>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5"/>
                <path d="M5 7V5a3 3 0 016 0v2"/>
              </svg>
              Secure checkout by Polar
            </li>
          </ul>

          <div class="pw-after">
            <button
              type="button"
              class="pw-free-link"
              :disabled="dismissing"
              @click="continueFree"
            >
              <span v-if="dismissing" class="pw-spinner pw-spinner--sm" aria-hidden="true"></span>
              <span>Continue with the free plan for now</span>
              <svg v-if="!dismissing" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>

    <footer class="pw-footer">
      <span>© 2026 Cansee</span>
      <nav class="pw-footer-links" aria-label="Legal and support">
        <a href="/support" target="_blank" rel="noopener">Support</a>
        <a href="/terms" target="_blank" rel="noopener">Terms</a>
        <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
      </nav>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import billingApi from '@/api/billing'
import PricingCards from '@/components/billing/PricingCards.vue'
import WatercolorBackdrop from '@/components/onboarding/WatercolorBackdrop.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { isPolarUrl } from '@/utils/polarRedirect'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// Plans come from GET /billing/plans/. The page offers the self-serve plans
// in the pricing window; its footnote carries the contact-sales line.
const plans = ref([])
const plansState = ref('loading') // loading | ready | failed
const hasSelfServe = computed(() => plans.value.some(p => p?.self_serve === true))
// False until Polar checkout is set up on the server (GET /billing/
// billing_ready). Unknown reads as ready: the checkout then says why.
const billingReady = ref(true)

async function loadBillingState() {
  try {
    const res = await billingApi.getCurrent({ _silentError: true })
    billingReady.value = res.data?.billing_ready !== false
  } catch {
    billingReady.value = true
  }
}

async function loadPlans() {
  plansState.value = 'loading'
  try {
    const res = await billingApi.getPlans()
    plans.value = Array.isArray(res.data) ? res.data : []
    plansState.value = 'ready'
  } catch {
    plansState.value = 'failed'
  }
}

// The plan whose checkout is opening (PricingCards' `busy`), or null.
const submitting = ref(null)
const dismissing = ref(false)
const error = ref('')

const email = computed(() => authStore.user?.email || '')

// Personalization handoff written by the onboarding flow in the same
// tab (sessionStorage). Used only when fresh and non-empty; left in
// place so a paywall refresh keeps the line. Falls back to generic copy.
const onbSummary = (() => {
  try {
    const raw = sessionStorage.getItem('cs-onb-summary')
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return null
    if (!p.domain || !(p.competitors > 0)) return null
    if (!p.ts || Date.now() - p.ts > 24 * 60 * 60 * 1000) return null
    return p
  } catch (_) {
    return null
  }
})()

async function startCheckout(planId) {
  if (!planId || submitting.value) return
  submitting.value = planId
  error.value = ''
  try {
    // Polar hosted checkout — the backend creates the session and we
    // redirect. Silent: a failure is shown once, inline below.
    const res = await billingApi.checkout({ plan: planId })
    const url = res.data?.data?.checkout_url || res.data?.checkout_url
    if (url && isPolarUrl(url)) {
      window.location.href = url
      return
    }
    error.value = "We couldn't start checkout. Please try again."
  } catch (e) {
    if (e?.response?.data?.error?.code === 'already_subscribed') {
      // The backend self-healed from Polar's records: this account is
      // subscribed (e.g. a paid checkout whose confirm redirect never
      // landed). Refresh the session and get out of the paywall loop.
      toast.success('Your subscription is already active — taking you to your dashboard.')
      try { await authStore.fetchSession() } catch (_) { /* routed below regardless */ }
      router.replace('/dashboard')
      return
    }
    error.value = e?.displayMessage || "We couldn't start checkout. Please try again."
  } finally {
    submitting.value = null
  }
}

async function continueFree() {
  if (dismissing.value) return
  dismissing.value = true
  try {
    await billingApi.dismissPaywall()
    // The router guard keeps bouncing to /paywall until the refreshed
    // session's next_route stops saying 'paywall' — so the session
    // fetch must complete before navigating.
    await authStore.fetchSession()
    router.replace('/dashboard')
  } catch {
    // The client interceptor toasts the reason.
    dismissing.value = false
  }
}

async function signOut() {
  try { await authStore.logout() } catch (_) { /* clear locally regardless */ }
  router.replace('/login')
}

onMounted(() => {
  // A paying account has no business on the paywall (stale tab, manual
  // URL, or a session refreshed elsewhere) — send it home.
  if (authStore.session?.subscription?.is_paying) {
    router.replace('/dashboard')
    return
  }
  loadPlans()
  loadBillingState()
})
</script>

<style scoped>
.pw {
  --pw-bg: #ffffff;
  --pw-fg: #0a0a0a;
  --pw-muted: #5d5d5d;
  --pw-border: rgba(10, 10, 10, 0.10);
  --pw-surface: #fafafa;
  --pw-accent: #ff6a2c;
  --pw-accent-soft: rgba(255, 106, 44, 0.10);
  --pw-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --pw-spring-strong: cubic-bezier(0.16, 1, 0.3, 1);
  /* Framer-style back-out for entrances and pops. */
  --pw-spring-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
  --pw-label-font: 'Geist', 'Inter', system-ui, sans-serif;

  position: relative;
  min-height: 100vh;
  color: var(--pw-fg);
  font-feature-settings: 'cv11', 'ss01';
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
.pw :focus-visible { outline-color: var(--pw-accent); }

/* ── Topbar (white on the watercolor video) ──────────────── */
.pw-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px;
  color: #fff;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
  animation: pw-drop 450ms var(--pw-spring) 80ms both;
}
.pw-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.pw-brand-mark {
  width: auto;
  height: 17px;
  object-fit: contain;
  flex-shrink: 0;
  filter: brightness(0) invert(1);
}
.pw-top-right { display: flex; align-items: center; gap: 4px; min-width: 0; }
.pw-top-email {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pw-signout {
  background: transparent;
  border: none;
  font: inherit;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.pw-signout:hover { color: #fff; text-decoration: underline; }
@keyframes pw-drop {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Layout: one white card over the video ───────────────── */
.pw-main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px 16px;
}
.pw-content {
  width: min(760px, 100%);
  background: var(--pw-bg);
  border-radius: 24px;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.35),
    0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 38px 40px 30px;
  animation: pw-card-in 0.65s var(--pw-spring-pop) both;
}

/* Blur-in stagger, same voice as onboarding. */
.pw-stagger > * { animation: pw-rise 0.55s var(--pw-spring-strong) both; }
.pw-stagger > *:nth-child(2) { animation-delay: 0.06s; }
.pw-stagger > *:nth-child(3) { animation-delay: 0.12s; }
.pw-stagger > *:nth-child(4) { animation-delay: 0.18s; }
.pw-stagger > *:nth-child(5) { animation-delay: 0.24s; }
.pw-stagger > *:nth-child(6) { animation-delay: 0.30s; }
.pw-stagger > *:nth-child(7) { animation-delay: 0.36s; }
.pw-stagger > *:nth-child(8) { animation-delay: 0.42s; }

.pw-eyebrow {
  display: inline-block;
  font-family: var(--pw-label-font);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pw-muted);
  margin-bottom: 12px;
}
.pw-eyebrow::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: var(--pw-accent);
  margin-right: 9px;
  vertical-align: 3px;
}
.pw-title {
  /* App-standard face (Inter), kept deliberately small. */
  font-size: clamp(22px, 2.6vw, 27px);
  line-height: 1.16;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}
.pw-sub {
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--pw-muted);
  margin: 0 0 22px;
}
.pw-sub strong { color: var(--pw-fg); font-weight: 600; }

/* ── The pricing window: PricingCards on the white card ──── */
.pw-cards {
  --pc-fg: var(--pw-fg);
  --pc-muted: var(--pw-muted);
  --pc-border: var(--pw-border);
  --pc-card-bg: var(--pw-bg);
  --pc-btn-bg: var(--pw-fg);
  --pc-btn-fg: var(--pw-bg);
  --pc-ring: var(--pw-accent);
  margin-bottom: 14px;
}

.pw-plans-note {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--pw-muted);
}
.pw-retry {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--pw-fg);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

/* ── Fine print ──────────────────────────────────────────── */
.pw-error {
  margin: 10px 0 0;
  text-align: center;
  color: var(--pw-accent);
  font-size: 12.5px;
}

.pw-trust {
  list-style: none;
  padding: 13px 0 0;
  margin: 14px 0 0;
  border-top: 1px solid var(--pw-border);
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.pw-trust li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--pw-muted);
}
.pw-trust svg { color: var(--pw-muted); }

/* ── Free escape ───────────────────────────────────────── */
.pw-after { text-align: center; margin-top: 18px; }
.pw-free-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--pw-muted);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: color 0.2s;
}
.pw-free-link svg { transition: transform 0.25s var(--pw-spring-pop); }
.pw-free-link:hover:not(:disabled) { color: var(--pw-fg); text-decoration: underline; }
.pw-free-link:hover:not(:disabled) svg { transform: translateX(3px); }
.pw-free-link:disabled { opacity: 0.6; cursor: progress; }

/* ── Footer (legal links over the video) ─────────────────── */
.pw-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px 18px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  animation: pw-fade-in 0.8s ease 0.5s both;
}
.pw-footer-links { display: flex; gap: 20px; }
.pw-footer-links a {
  color: rgba(255, 255, 255, 0.78);
  text-decoration: none;
  transition: color 0.2s;
}
.pw-footer-links a:hover { color: #fff; text-decoration: underline; }
@keyframes pw-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* ── Bits ────────────────────────────────────────────────── */
.pw-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: pw-spin 0.7s linear infinite;
  display: inline-block;
}
.pw-spinner--sm { width: 11px; height: 11px; }
@keyframes pw-spin { to { transform: rotate(360deg); } }

@keyframes pw-rise {
  from { opacity: 0; transform: translateY(12px) scale(0.995); filter: blur(5px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes pw-card-in {
  from { opacity: 0; transform: translateY(26px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Reduced motion ──────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .pw *,
  .pw *::before,
  .pw *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .pw-stagger > *, .pw-content, .pw-footer {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 640px) {
  .pw-top { padding: 14px 16px; }
  .pw-top-email { display: none; }
  .pw-main { padding: 8px 12px 12px; }
  .pw-content { padding: 26px 20px 24px; border-radius: 18px; }
  .pw-footer { padding: 12px 16px 14px; }
  .pw-title { font-size: clamp(21px, 6vw, 24px); }
}
</style>
