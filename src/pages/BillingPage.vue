<template>
  <SettingsShell active="subscription">
  <div class="bp bp--embedded">
    <!-- ── Organization-billed seat: the org (not this user) pays, so
         every personal checkout / upgrade / portal control is withheld —
         inviting a seat-holder to start their own subscription would
         double-bill them. ── -->
    <template v-if="orgBilled">
      <p class="set-label">Membership</p>
      <section class="bp-current">
        <div class="bp-current-info">
          <span class="bp-eyebrow">Current plan</span>
          <h2 class="bp-current-name">
            {{ authStore.planState.title }}
            <span class="bp-current-price">· {{ authStore.org?.name || 'Organization' }}</span>
          </h2>
          <div class="bp-current-meta">
            <span class="bp-pill bp-pill--success">Active</span>
            <span class="bp-current-note">Billing is managed by your organization.</span>
          </div>
          <p class="bp-current-note" style="margin-top: 10px;">
            Plan changes, invoices and payment methods are handled by your
            organization's admins. Questions about your seat?
            <a class="bp-link" :href="orgSupportHref">{{ SUPPORT_EMAIL }}</a>
          </p>
        </div>
      </section>
    </template>

    <div v-else-if="loading" class="bp-loading">Loading…</div>

    <!-- ── Overview failed: never guess "Free". The session already knows
         the plan state, so the headline stays truthful, and the plan
         picker is withheld — a trialing or paying customer must not be
         invited to start another checkout. ── -->
    <template v-else-if="overviewError">
      <p class="set-label">Membership</p>
      <section class="bp-current bp-current--empty">
        <div class="bp-current-info">
          <span class="bp-eyebrow">Current plan</span>
          <h2 class="bp-current-name">
            {{ authStore.planState.title }}
            <span v-if="authStore.planState.detail" class="bp-current-price">· {{ authStore.planState.detail }}</span>
          </h2>
          <p class="bp-current-note is-warn">
            We couldn't load your billing details just now.
            <button type="button" class="bp-link" :disabled="retrying" @click="retryOverview">
              {{ retrying ? 'Retrying…' : 'Try again' }}
            </button>
          </p>
        </div>
      </section>
    </template>

    <template v-else>
      <!-- ── Current plan banner ─────────────────────────────────── -->
      <p class="set-label">Membership</p>
      <section v-if="currentPlanCode" class="bp-current">
        <div class="bp-current-info">
          <span class="bp-eyebrow">Current plan</span>
          <h2 class="bp-current-name">
            <!-- During the trial the state IS the headline: lead with
                 Free Trial and demote the price to "then $X/mo",
                 treasury.sh-style. The paid-plan name takes over the
                 moment the subscription is active. -->
            <template v-if="isTrialing && !subscription?.cancel_at_period_end">
              Free Trial
              <span class="bp-current-price">
                · then {{ currentPriceLabel }}<span class="bp-current-period">{{ currentPeriodLabel }}</span>
              </span>
            </template>
            <template v-else>
              {{ currentTier?.name || currentPlanCode }}
              <span class="bp-current-price">
                · {{ currentPriceLabel }}<span class="bp-current-period">{{ currentPeriodLabel }}</span>
              </span>
            </template>
          </h2>
          <div class="bp-current-meta">
            <!-- The pill is redundant while the headline itself says
                 Free Trial; it returns for every other state. -->
            <span
              v-if="!(isTrialing && !subscription?.cancel_at_period_end)"
              class="bp-pill" :class="statusClass"
            >{{ statusLabel }}</span>
            <span
              v-if="isTrialing && !subscription?.cancel_at_period_end"
              class="bp-current-note"
            >
              Everything is unlocked — free for {{ daysUntilRenewal }} more {{ daysUntilRenewal === 1 ? 'day' : 'days' }}
            </span>
            <span
              v-else-if="subscription?.subscription_status === 'past_due'"
              class="bp-current-note is-warn"
            >
              Payment issue — update your card in Manage billing to keep access.
            </span>
            <span
              v-else-if="subscription?.current_period_end"
              class="bp-current-note"
              :class="{ 'is-warn': subscription.cancel_at_period_end }"
            >
              {{ subscription.cancel_at_period_end ? 'Cancels' : 'Renews' }}
              {{ formatDate(subscription.current_period_end) }}
            </span>
          </div>
          <template v-if="isTrialing && !subscription?.cancel_at_period_end">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; max-width: 360px;">
              <span class="bp-current-note">Billing period</span>
              <span class="bp-current-note">Trial ends {{ formatDate(subscription.current_period_end) }}</span>
            </div>
            <div class="bp-usage-bar" style="margin-top: 4px; max-width: 360px;">
              <div class="bp-usage-fill" :style="{ width: trialPct + '%' }"></div>
            </div>
            <p class="bp-current-note" style="margin-top: 6px;">
              Nothing changes on {{ formatDate(subscription.current_period_end) }} — your plan simply
              continues and the first {{ currentPriceLabel }} charge happens. Cancel before
              then and pay nothing.
            </p>
            <!-- Skip-the-wait upgrade: ends the trial and charges today,
                 for users who hit a trial limit (e.g. the 1-project cap)
                 and want the full Pro allowance immediately. -->
            <div class="bp-upgrade-now">
              <button
                class="bp-btn bp-btn--primary"
                :disabled="upgrading || switchingCycle"
                @click="confirmUpgradeNow"
              >{{ upgrading ? 'Starting…' : 'Start Pro now' }}</button>
              <button
                class="bp-btn bp-btn--ghost"
                :disabled="upgrading || switchingCycle"
                @click="confirmSwitchCycle"
              >{{ switchingCycle ? 'Switching…' : (isAnnualSub ? 'Switch to monthly billing' : 'Switch to annual billing') }}</button>
            </div>
            <p class="bp-current-note" style="margin-top: 6px;">
              Don't want to wait? Start Pro now ends your trial and charges
              {{ currentPriceLabel }} today — every Pro allowance (including
              all five projects) unlocks immediately.
            </p>
          </template>
          <p v-else-if="subscription?.cancel_at_period_end" class="bp-current-note" style="margin-top: 6px;">
            Access ends {{ formatDate(subscription.current_period_end) }}. No future charges.
          </p>
        </div>
        <div class="bp-current-actions">
          <button
            v-if="hasManagedSub"
            class="bp-btn bp-btn--ghost"
            :disabled="portalLoading"
            @click="openPortal"
          >{{ portalLoading ? 'Opening…' : 'Manage billing' }}</button>
          <button
            v-if="hasManagedSub && !isTrialing && subscription?.subscription_status === 'active' && !subscription?.cancel_at_period_end"
            class="bp-btn bp-btn--ghost"
            :disabled="switchingCycle"
            @click="confirmSwitchCycle"
          >{{ switchingCycle ? 'Switching…' : (isAnnualSub ? 'Switch to monthly billing' : 'Switch to annual billing') }}</button>
          <button
            v-if="subscription?.cancel_at_period_end"
            class="bp-btn bp-btn--primary"
            :disabled="cancelling"
            @click="resume"
          >{{ cancelling ? 'Working…' : 'Resume subscription' }}</button>
          <button
            v-else
            class="bp-btn bp-btn--ghost-danger"
            :disabled="cancelling"
            @click="confirmCancel"
          >{{ cancelling ? 'Working…' : 'Cancel subscription' }}</button>
        </div>
      </section>
      <section v-else class="bp-current bp-current--empty">
        <div class="bp-current-info">
          <span class="bp-eyebrow">Current plan</span>
          <h2 class="bp-current-name">Free plan</h2>
          <!-- Answer the questions people actually have: does it end,
               and what happens at the limits. (Limits mirror
               PLAN_LIMITS[FREE] — keep in sync with the backend.) -->
          <p class="bp-current-note">
            The Free plan doesn't expire — your dashboard and data stay
            yours for as long as you like. It's limited instead: 1 project,
            5 prompts per run, 2 prompt runs per month, and a small monthly AI
            allowance. When you hit a limit, prompt runs simply pause until your
            monthly reset — there's no hard wall and you're never locked
            out. Upgrade to Pro any time for daily prompt runs, every AI model,
            and the full allowance.
          </p>
        </div>
      </section>

      <!-- ── Pricing tiers: only while unsubscribed. Subscribed users
           change plans through the Polar portal (Manage billing). ── -->
      <div
        v-if="!currentPlanCode && subscription && subscription.billing_ready === false"
        class="bp-error"
        style="margin: 6px 0 2px;"
      >
        Checkout is not configured yet — the Polar products have not been
        set up for this environment. Subscribing is disabled until then.
      </div>

      <div v-if="!currentPlanCode" class="bp-toggle" role="tablist" aria-label="Billing cycle">
        <button
          type="button"
          class="bp-toggle-opt"
          :class="{ 'is-active': !annual }"
          @click="annual = false"
        >Monthly</button>
        <button
          type="button"
          class="bp-toggle-opt"
          :class="{ 'is-active': annual }"
          @click="annual = true"
        >
          Annual
          <span class="bp-toggle-save">Save 17%</span>
        </button>
      </div>

      <p v-if="!currentPlanCode" class="set-label">Plans</p>
      <section v-if="!currentPlanCode" class="bp-tiers">
        <article
          v-for="tier in mainTiers"
          :key="tier.id"
          class="bp-tier"
          :class="{
            'is-featured': tier.highlight,
            'is-current': isCurrent(tier),
          }"
        >
          <div v-if="isCurrent(tier)" class="bp-tier-pill">Active plan</div>
          <div v-else-if="tier.highlight" class="bp-tier-pill">Most popular</div>

          <div class="bp-tier-head">
            <h3 class="bp-tier-name">{{ tier.name }}</h3>
            <p class="bp-tier-desc">{{ tier.description }}</p>
          </div>

          <div class="bp-tier-price">
            <span class="bp-tier-amount">{{ priceLabel(tier) }}</span>
            <span class="bp-tier-period" v-if="tier.price !== null">
              {{ annual ? '/year' : tier.period }}
            </span>
          </div>
          <p class="bp-tier-note" v-if="tier.price !== null">
            <template v-if="tier.trialDays && !isCurrent(tier)">{{ tier.trialDays }}-day free trial · </template>
            {{ annual ? 'Two months free' : 'Cancel anytime' }}
          </p>

          <ul class="bp-tier-features">
            <li v-for="f in tier.features" :key="f">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 8.5l3.2 3 6.3-6.5"/>
              </svg>
              <span>{{ f }}</span>
            </li>
          </ul>

          <button
            v-if="isCurrent(tier)"
            class="bp-btn bp-btn--ghost"
            disabled
          >You're on this plan</button>
          <button
            v-else
            type="button"
            class="bp-btn"
            :class="{ 'bp-btn--primary': tier.highlight || !currentPlanCode }"
            :disabled="checkingOut === tier.id || (tier.price !== null && subscription?.billing_ready === false)"
            @click="changePlan(tier)"
          >
            <span v-if="checkingOut === tier.id" class="bp-spinner" aria-hidden="true"></span>
            <span v-else>{{ currentPlanCode ? 'Switch to ' + tier.name : (tier.cta || 'Choose ' + tier.name) }}</span>
          </button>
        </article>
      </section>

      <p v-if="!currentPlanCode && enterpriseTier" class="bp-enterprise">
        Need more? <a href="#" @click.prevent="contactEnterprise">Talk to us about {{ enterpriseTier.name }}</a>
      </p>

      <p v-if="error" class="bp-error">{{ error }}</p>

      <!-- ── Invoices ─────────────────────────────────────────────── -->
      <p v-if="invoices.length" class="set-label" style="margin-top: 34px;">Billing history</p>
      <section v-if="invoices.length" class="bp-card">
        <header class="bp-card-head">
          <h3 class="bp-card-title">Invoices</h3>
        </header>
        <table class="bp-table">
          <thead>
            <tr><th>Date</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="inv in invoices" :key="inv.id">
              <td>{{ formatDate(inv.period_start || inv.created_at) }}</td>
              <td class="bp-amount">${{ (inv.amount_paid / 100).toFixed(2) }}</td>
              <td>
                <span class="bp-pill" :class="inv.status === 'paid' ? 'bp-pill--success' : 'bp-pill--warn'">
                  {{ inv.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

    </template>
  </div>
  </SettingsShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import billingApi from '@/api/billing'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '@/constants/support'
import { TIERS } from '@/constants/pricing'
import { openDemoLink } from '@/constants/demo'
import { describeSubscription } from '@/lib/plan'
import { isPolarUrl } from '@/utils/polarRedirect'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const loading = ref(true)
const subscription = ref(null)
const invoices = ref([])
const tokenUsage = ref(null)
const annual = ref(false)
const checkingOut = ref(null)
const portalLoading = ref(false)
const cancelling = ref(false)
const upgrading = ref(false)
const switchingCycle = ref(false)
const error = ref('')

// Seat on an org plan: the subscription's source says the organization
// pays. All personal billing UI (checkout, plan grid, portal, cancel)
// and the ?checkout= return-leg are gated off this one flag.
const orgBilled = computed(() => authStore.session?.subscription?.source === 'organization')

const orgSupportHref = computed(() => {
  const params = new URLSearchParams({ subject: SUPPORT_SUBJECT })
  const acct = authStore.user?.email
  if (acct) params.set('body', `Account email: ${acct}\n\n`)
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`
})

const mainTiers = computed(() => TIERS.filter(t => t.price !== null))
const enterpriseTier = computed(() => TIERS.find(t => t.price === null))

const currentPlanCode = computed(() => {
  const s = subscription.value
  const status = s?.subscription_status
  if (status === 'active' || status === 'trialing') {
    const code = s?.plan || s?.plan_code || null
    return code && code !== 'free' ? code : null
  }
  if (status === 'past_due') {
    // A payment hiccup is not a downgrade: keep showing the paid plan
    // with a "Past due" pill instead of dumping a paying customer onto
    // the Free card. The top-level `plan` reports free here, so read
    // the raw subscription plan (legacy values normalize to pro).
    const raw = String(s?.subscription_plan || '').toLowerCase()
    return raw === 'business' || raw === 'enterprise' || raw === 'scale' || raw === 'team'
      ? 'business'
      : 'pro'
  }
  return null
})

const currentTier = computed(() =>
  TIERS.find(t => t.planCode === currentPlanCode.value) || null,
)

const statusClass = computed(() => {
  const s = subscription.value?.subscription_status
  if (s === 'active') return 'bp-pill--success'
  if (s === 'trialing') return 'bp-pill--neutral'
  if (s === 'past_due' || s === 'canceled') return 'bp-pill--danger'
  return 'bp-pill--neutral'
})

// True when the subscription is managed by the billing provider (Polar)
// — gates the "Manage billing" portal button.
const hasManagedSub = computed(() => !!subscription.value?.managed)

// Which cadence the subscription is on. The backend mirrors Polar's
// recurring_interval as `interval` ("month" | "year") — the only signal
// that works while trialing, where the period is the 7-day trial window
// on both products. The period-length inference stays as a fallback for
// rows synced before the interval column existed.
const isAnnualSub = computed(() => {
  const sub = subscription.value
  if (sub?.interval) return sub.interval === 'year'
  if (!sub?.current_period_start || !sub?.current_period_end) return annual.value
  const ms = new Date(sub.current_period_end) - new Date(sub.current_period_start)
  return ms > 1000 * 60 * 60 * 24 * 60   // > 60 days  →  annual
})

const currentPriceLabel = computed(() => {
  const t = currentTier.value
  if (!t || t.price === null) return t?.priceLabel || '—'
  return isAnnualSub.value ? `$${t.price * 10}` : t.priceLabel
})

const currentPeriodLabel = computed(() => {
  const t = currentTier.value
  if (!t || t.price === null) return ''
  return isAnnualSub.value ? '/year' : t.period || '/month'
})

// Status words + trial arithmetic come from the shared describer
// (src/lib/plan.js) so this page, the sidebar and Settings agree on
// what a trial is. `is_trialing` from the API already excludes a
// trial that ended without a confirmed conversion.
const planState = computed(() => describeSubscription(subscription.value))
const statusLabel = computed(() => planState.value.statusLabel)
const isTrialing = computed(() => planState.value.isTrialing)
const daysUntilRenewal = computed(() => planState.value.daysLeft ?? 0)

// Trial progress: elapsed share of the 7-day trial window.
const trialPct = computed(() => {
  const total = 7
  const left = Math.min(total, daysUntilRenewal.value)
  return Math.round(((total - left) / total) * 100)
})


function isCurrent(tier) { return currentPlanCode.value === tier.planCode }

function priceLabel(tier) {
  if (!tier) return ''
  if (tier.price === null) return tier.priceLabel
  if (annual.value) return `$${tier.price * 10}`
  return tier.priceLabel
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function changePlan(tier) {
  if (tier.price === null) {
    contactEnterprise()
    return
  }
  error.value = ''
  checkingOut.value = tier.id
  try {
    // Polar hosted checkout — the backend creates the session and we
    // redirect. Sandbox/dev uses the same real flow with test cards.
    const res = await billingApi.checkout({
      plan: tier.planCode,
      annual: annual.value,
    })
    // CheckoutView's payload is {"success", "data": {"checkout_url"}}.
    const url = res.data?.data?.checkout_url
    if (url && isPolarUrl(url)) {
      window.location.href = url
      return
    }
    error.value = "We couldn't start checkout. Please try again."
    toast.error(error.value)
  } catch (e) {
    if (e?.response?.data?.error?.code === 'already_subscribed') {
      // Backend self-healed from Polar's records (stale local state):
      // refresh what we show instead of erroring.
      toast.success('Your subscription is already active.')
      try { await authStore.fetchSession() } catch (_) { /* refresh below */ }
      await refresh()
      return
    }
    error.value = e?.response?.data?.error?.message || "We couldn't start checkout."
    // Loud failure: the inline text alone was easy to miss and made the
    // button feel dead.
    toast.error(error.value)
  } finally {
    checkingOut.value = null
  }
}

function contactEnterprise() {
  openDemoLink(enterpriseTier.value?.contactTarget)
}

async function openPortal() {
  portalLoading.value = true
  try {
    const res = await billingApi.portal()
    // PortalView's payload is {"success", "data": {"portal_url"}}.
    const url = res.data?.data?.portal_url
    if (url && isPolarUrl(url)) window.location.href = url
    else toast.error("We couldn't open the billing portal.")
  } catch {
    toast.error("We couldn't open the billing portal.")
  } finally {
    portalLoading.value = false
  }
}

async function confirmUpgradeNow() {
  const charge = isAnnualSub.value
    ? `${currentPriceLabel.value} for the first year`
    : `${currentPriceLabel.value} for the first month`
  if (!window.confirm(
    `Start Pro now? Your free trial ends immediately and your card is charged ${charge}.`,
  )) return
  upgrading.value = true
  try {
    await billingApi.upgradeNow({})
    toast.success('Welcome to Pro — your plan is now active.')
    // Session first so plan labels and project limits flip everywhere,
    // then the overview so this page shows the paid state.
    try { await authStore.fetchSession() } catch (_) { /* refresh below */ }
    await refresh()
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || "We couldn't start your plan. Please try again.")
  } finally {
    upgrading.value = false
  }
}

async function confirmSwitchCycle() {
  const toAnnual = !isAnnualSub.value
  const t = currentTier.value
  const price = t?.price
    ? (toAnnual ? `$${t.price * 10}/year` : `${t.priceLabel}/month`)
    : ''
  const msg = isTrialing.value
    ? `Switch to ${toAnnual ? 'annual' : 'monthly'} billing${price ? ` (${price})` : ''}? Nothing is charged until your trial ends.`
    : `Switch to ${toAnnual ? 'annual' : 'monthly'} billing${price ? ` (${price})` : ''}? The price difference is settled on your card right away.`
  if (!window.confirm(msg)) return
  switchingCycle.value = true
  try {
    await billingApi.changePlan({ annual: toAnnual })
    toast.success(`Switched to ${toAnnual ? 'annual' : 'monthly'} billing.`)
    try { await authStore.fetchSession() } catch (_) { /* refresh below */ }
    await refresh()
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || "We couldn't change your plan. Please try again.")
  } finally {
    switchingCycle.value = false
  }
}

async function confirmCancel() {
  const end = subscription.value?.current_period_end
  const tail = end ? ` Access continues until ${formatDate(end)}.` : ''
  if (!window.confirm(`Cancel your ${currentTier.value?.name || 'subscription'}?${tail}`)) return
  cancelling.value = true
  try {
    await billingApi.cancel()
    toast.success('Subscription will end at the period end.')
    await refresh()
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || "We couldn't cancel.")
  } finally {
    cancelling.value = false
  }
}

async function resume() {
  cancelling.value = true
  try {
    await billingApi.resume()
    toast.success('Subscription resumed.')
    await refresh()
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || "We couldn't resume.")
  } finally {
    cancelling.value = false
  }
}

const overviewError = ref(false)
const retrying = ref(false)

async function retryOverview() {
  retrying.value = true
  try { await refresh() } finally { retrying.value = false }
}

async function refresh() {
  try {
    const [subRes, invRes, tokRes] = await Promise.all([
      // The overview is the one call that must not soft-fail into a
      // "Free plan" render: remember that it failed.
      billingApi.getCurrent().catch(() => ({ data: null, failed: true })),
      billingApi.invoices().catch(() => ({ data: [] })),
      billingApi.tokenUsage().catch(() => ({ data: null })),
    ])
    overviewError.value = Boolean(subRes.failed) || !subRes.data
    subscription.value = subRes.data || null
    const inv = invRes.data || []
    invoices.value = Array.isArray(inv) ? inv : (inv.results || [])
    // Token usage soft-fails to null; the section is v-if'd on that.
    tokenUsage.value = tokRes.data || null
  } catch (_) {
    overviewError.value = true
  }
}



onMounted(async () => {
  // Org-billed seats never ran a personal checkout, and the personal
  // overview endpoints describe a subscription that isn't theirs to
  // manage — skip the whole leg (incl. the ?checkout= return handling).
  if (orgBilled.value) {
    loading.value = false
    return
  }
  const checkoutParam = route.query.checkout
  const checkoutId = route.query.checkout_id ? String(route.query.checkout_id) : ''
  if (checkoutParam) {
    // Scrub the URL BEFORE any awaited work: Polar's return redirect
    // appends a customer_session_token (a live customer-portal
    // credential) alongside our one-shot params. It must not sit in
    // the address bar/history while we confirm — and stripping first
    // also means a refresh can't re-run confirmation. Our code never
    // reads or stores that token.
    router.replace({ query: {} })
  }
  if (checkoutParam === 'success' && checkoutId) {
    // Returning from Polar checkout: verify server-side and sync the
    // subscription (works without webhooks in local dev).
    try {
      const res = await billingApi.confirm(checkoutId)
      if (res.data?.data?.active) {
        toast.success('Subscription activated. Welcome to Pro!')
        try { await authStore.fetchSession() } catch (_) {}
        // A fresh subscriber goes straight back to the product — the
        // dashboard — not a billing statement. The toast survives the
        // navigation (ToastContainer is global).
        router.replace({ name: 'dashboard' })
        return
      }
      toast.info('Checkout received - finalizing. Refresh in a moment.')
    } catch (_) {
      toast.error("We couldn't verify the checkout yet. Refresh in a moment.")
    }
  } else if (checkoutParam === 'success') {
    toast.success('Subscription activated!')
  } else if (checkoutParam === 'canceled') {
    toast.info('Checkout canceled.')
  }
  await refresh()
  loading.value = false
})
</script>

<style scoped>
/* Inside the settings shell the page no longer centers itself. */
.bp--embedded {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
}
.set-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  margin: 0 0 10px;
}

.bp {
  --bp-fg: #0a0a0a;
  --bp-muted: #6b6b6b;
  --bp-border: rgba(10, 10, 10, 0.10);
  --bp-surface: #fafafa;
  --bp-bg: #ffffff;
  --bp-accent: #ff6a2c;
  --bp-accent-soft: rgba(255, 106, 44, 0.10);
  --bp-spring: cubic-bezier(0.22, 1, 0.36, 1);

  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 96px;
  color: var(--bp-fg);
  font-feature-settings: 'cv11', 'ss01';
}

[data-theme='dark'] .bp {
  --bp-fg: #f7f7f7;
  --bp-muted: #888;
  --bp-border: rgba(255, 255, 255, 0.10);
  --bp-surface: #0e0e0e;
  --bp-bg: #060606;
  --bp-accent-soft: rgba(255, 106, 44, 0.14);
}

.bp-header { margin-bottom: 24px; }
.bp-title {
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
}
.bp-sub {
  margin: 0;
  color: var(--bp-muted);
  font-size: 14px;
}

.bp-link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.bp-link:disabled { opacity: 0.6; cursor: default; }

.bp-loading {
  padding: 80px 0;
  text-align: center;
  color: var(--bp-muted);
}

/* ── Current-plan banner ──────────────────────────────────── */
.bp-current {
  margin-bottom: 28px;
  padding: 22px 26px;
  border-radius: 18px;
  background: var(--bp-surface);
  border: 1px solid var(--bp-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.bp-current--empty {
  border-style: dashed;
}
.bp-eyebrow {
  display: inline-block;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bp-muted);
  margin-bottom: 6px;
}
.bp-current-name {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.bp-current-info { display: flex; flex-direction: column; min-width: 0; }
.bp-current-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.bp-upgrade-now { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.bp-current-price {
  font-size: 14px;
  font-weight: 500;
  color: var(--bp-muted);
  letter-spacing: 0;
}
.bp-current-period {
  font-size: 13px;
  color: var(--bp-muted);
  font-weight: 500;
}
.bp-current-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0;
  font-size: 13px;
  color: var(--bp-muted);
}
.bp-current-note {
  font-size: 13px;
  color: var(--bp-muted);
  margin: 0;
}
.bp-current-note.is-warn {
  color: #b45309;
  font-weight: 500;
}

/* At-a-glance row: next charge + payment method. */
.bp-glance {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 28px;
}
.bp-glance-card {
  padding: 20px 22px;
  background: var(--bp-bg);
  border: 1px solid var(--bp-border);
  border-radius: 16px;
}
.bp-glance-value {
  margin: 4px 0 6px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}
.bp-glance-period {
  font-size: 13px;
  color: var(--bp-muted);
  font-weight: 500;
}
.bp-glance-note {
  margin: 0;
  font-size: 12px;
  color: var(--bp-muted);
  line-height: 1.5;
}

.bp-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: capitalize;
  background: var(--bp-surface);
  border: 1px solid var(--bp-border);
}
.bp-pill--success { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.30); }
.bp-pill--warn    { background: rgba(234, 179, 8, 0.12); color: #a16207; border-color: rgba(234, 179, 8, 0.30); }
.bp-pill--danger  { background: rgba(239, 68, 68, 0.10); color: #b91c1c; border-color: rgba(239, 68, 68, 0.30); }
.bp-pill--neutral { background: var(--bp-surface); color: var(--bp-muted); }

/* ── Pill toggle (mirrors paywall) ────────────────────────── */
.bp-toggle {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: 999px;
  background: var(--bp-surface);
  border: 1px solid var(--bp-border);
  margin: 0 0 20px;
  gap: 2px;
}
.bp-toggle-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--bp-muted);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.25s var(--bp-spring), background 0.25s var(--bp-spring);
}
.bp-toggle-opt.is-active {
  background: var(--bp-bg);
  color: var(--bp-fg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.bp-toggle-save {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--bp-accent-soft);
  color: var(--bp-accent);
  font-weight: 600;
}

/* ── Tier cards ───────────────────────────────────────────── */
.bp-tiers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 24px;
}
.bp-tier {
  position: relative;
  padding: 26px;
  background: var(--bp-bg);
  border: 1px solid var(--bp-border);
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s var(--bp-spring), box-shadow 0.25s var(--bp-spring), border-color 0.25s var(--bp-spring);
}
.bp-tier:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.04);
}
.bp-tier.is-featured {
  border-color: var(--bp-fg);
}
.bp-tier.is-current {
  border-color: var(--bp-accent);
  box-shadow: 0 0 0 1px var(--bp-accent), 0 18px 40px rgba(255, 106, 44, 0.08);
}
.bp-tier-pill {
  position: absolute;
  top: -10px;
  right: 20px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-radius: 999px;
  background: var(--bp-fg);
  color: var(--bp-bg);
}
.bp-tier.is-current .bp-tier-pill {
  background: var(--bp-accent);
  color: var(--bp-bg);
}
.bp-tier-head { margin-bottom: 18px; }
.bp-tier-name {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.bp-tier-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bp-muted);
}
.bp-tier-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}
.bp-tier-amount {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.bp-tier-period {
  font-size: 13px;
  color: var(--bp-muted);
  font-weight: 500;
}
.bp-tier-note {
  margin: 0 0 20px;
  font-size: 12px;
  color: var(--bp-muted);
}
.bp-tier-features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex-grow: 1;
}
.bp-tier-features li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.45;
}
.bp-tier-features svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--bp-accent);
}

.bp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid var(--bp-border);
  background: var(--bp-bg);
  color: var(--bp-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: transform 0.2s var(--bp-spring), background 0.25s var(--bp-spring), color 0.25s, border-color 0.25s;
}
.bp-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--bp-fg);
}
.bp-btn--primary {
  background: var(--bp-fg);
  color: var(--bp-bg);
  border-color: var(--bp-fg);
}
.bp-btn--primary:hover:not(:disabled) {
  background: var(--bp-accent);
  border-color: var(--bp-accent);
}
.bp-btn--ghost {
  background: transparent;
}
.bp-btn--ghost-danger {
  background: transparent;
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.25);
}
.bp-btn--ghost-danger:hover:not(:disabled) {
  border-color: #b91c1c;
  background: rgba(239, 68, 68, 0.06);
  transform: translateY(-1px);
}
.bp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.bp-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: bp-spin 0.7s linear infinite;
}
@keyframes bp-spin { to { transform: rotate(360deg); } }

.bp-enterprise {
  margin: 0 0 28px;
  font-size: 14px;
  color: var(--bp-muted);
}
.bp-enterprise a {
  color: var(--bp-fg);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid var(--bp-border);
  transition: border-color 0.2s;
}
.bp-enterprise a:hover { border-color: var(--bp-accent); }
.bp-error { margin: 0 0 16px; color: var(--bp-accent); font-size: 13px; }

.bp-link {
  color: var(--bp-fg);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid var(--bp-border);
  transition: border-color 0.2s;
}
.bp-link:hover { border-color: var(--bp-fg); }

/* ── Invoices / usage cards ───────────────────────────────── */
.bp-card {
  margin-top: 16px;
  padding: 22px 26px;
  background: var(--bp-bg);
  border: 1px solid var(--bp-border);
  border-radius: 18px;
}
.bp-card-head { margin-bottom: 14px; }
.bp-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.bp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.bp-table th,
.bp-table td {
  text-align: left;
  padding: 12px 8px;
  border-bottom: 1px solid var(--bp-border);
}
.bp-table th {
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--bp-muted);
  border-bottom: 1px solid var(--bp-border);
}
.bp-table tbody tr:last-child td { border-bottom: none; }
.bp-amount { font-variant-numeric: tabular-nums; font-weight: 600; }

.bp-usage {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 18px;
}
.bp-usage-item { display: flex; flex-direction: column; gap: 6px; }
.bp-usage-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bp-muted);
  font-weight: 600;
}
.bp-usage-value {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}
.bp-usage-bar {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--bp-surface);
  border: 1px solid var(--bp-border);
  overflow: hidden;
}
.bp-usage-fill {
  height: 100%;
  background: var(--bp-accent);
  transition: width 0.4s var(--bp-spring);
}

/* ── AI token usage card ────────────────────────────────────── */
.bp-card-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.bp-tok-totals {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}
.bp-tok-tile {
  padding: 12px;
  background: var(--muted);
  border-radius: 10px;
  text-align: center;
}
.bp-tok-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--foreground);
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.bp-tok-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.bp-tok-block {
  margin-top: 14px;
}
.bp-tok-block-title {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
  margin: 0 0 8px;
}
.bp-tok-row {
  display: grid;
  grid-template-columns: 150px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
}
.bp-tok-row-label {
  font-weight: 600;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bp-tok-row-bar {
  height: 6px;
  background: var(--muted);
  border-radius: 999px;
  overflow: hidden;
}
.bp-tok-row-fill {
  height: 100%;
  background: var(--bp-accent);
  border-radius: 999px;
  transition: width 0.4s var(--bp-spring);
}
.bp-tok-row-num {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--foreground);
  min-width: 60px;
  text-align: right;
}
.bp-tok-row-cost {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--muted-foreground);
  min-width: 60px;
  text-align: right;
}

@media (max-width: 720px) {
  .bp { padding: 18px 16px 64px; }
  .bp-current {
    flex-direction: column;
    align-items: flex-start;
  }
  .bp-current-actions { width: 100%; justify-content: flex-start; }
  .bp-glance { grid-template-columns: 1fr; }
  .bp-tiers { grid-template-columns: 1fr; }
}
</style>
