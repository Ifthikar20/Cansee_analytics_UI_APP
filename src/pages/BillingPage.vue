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

    <div v-else-if="loading" class="bp-loading">
      {{ verifyingCheckout ? 'Checking your payment...' : 'Loading…' }}
    </div>

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
                 Free Trial and demote the price to "then $X/mo".
                 The paid-plan name takes over the moment the
                 subscription is active. -->
            <template v-if="isTrialing && !subscription?.cancel_at_period_end">
              Free Trial
              <span v-if="currentPriceLabel" class="bp-current-price">
                · then {{ currentPriceLabel }}<span class="bp-current-period">{{ currentPeriodLabel }}</span>
              </span>
            </template>
            <template v-else>
              {{ currentPlanName }}
              <span v-if="currentPriceLabel" class="bp-current-price">
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
              Free for {{ daysUntilRenewal }} more {{ daysUntilRenewal === 1 ? 'day' : 'days' }}
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
            <div v-if="trialPct !== null" class="bp-usage-bar" style="margin-top: 4px; max-width: 360px;">
              <div class="bp-usage-fill" :style="{ width: trialPct + '%' }"></div>
            </div>
            <p class="bp-current-note" style="margin-top: 6px;">
              Nothing changes on {{ formatDate(subscription.current_period_end) }} — your plan simply
              continues and {{ firstChargeText }} happens. Cancel before then and pay nothing.
            </p>
            <!-- Skip-the-wait upgrade: ends the trial and charges today,
                 for users who hit a trial limit (e.g. the trial's project
                 cap) and want the full allowance immediately. -->
            <div class="bp-upgrade-now">
              <button
                class="bp-btn bp-btn--primary"
                :disabled="upgrading || switchingCycle"
                @click="confirmUpgradeNow"
              >{{ upgrading ? 'Starting…' : `Start ${currentPlanName} now` }}</button>
              <button
                v-if="isLegacyPro"
                class="bp-btn bp-btn--ghost"
                :disabled="upgrading || switchingCycle"
                @click="confirmSwitchCycle"
              >{{ switchingCycle ? 'Switching…' : (isAnnualSub ? 'Switch to monthly billing' : 'Switch to annual billing') }}</button>
            </div>
            <p class="bp-current-note" style="margin-top: 6px;">
              Don't want to wait? Starting now ends your trial and charges your card today.
              The full {{ currentPlanName }} allowance{{ projectsAllowanceText }} unlocks immediately.
            </p>
          </template>
          <p v-else-if="subscription?.cancel_at_period_end" class="bp-current-note" style="margin-top: 6px;">
            Access ends {{ formatDate(subscription.current_period_end) }}. No future charges.
          </p>
          <!-- Invoices live in the provider's portal; this page lists none. -->
          <p v-if="hasManagedSub" class="bp-current-note" style="margin-top: 10px;">
            Invoices and receipts are in the
            <button type="button" class="bp-link" :disabled="portalLoading" @click="openPortal">billing portal</button>.
          </p>
        </div>
        <div class="bp-current-actions">
          <button
            v-if="hasManagedSub"
            class="bp-btn bp-btn--ghost"
            :disabled="portalLoading"
            @click="openPortal"
          >{{ portalLoading ? 'Opening…' : 'Manage billing' }}</button>
          <!-- The monthly/annual switch is a legacy Pro option only; the
               100 and 200 prompt plans are monthly. -->
          <button
            v-if="isLegacyPro && hasManagedSub && !isTrialing && subscription?.subscription_status === 'active' && !subscription?.cancel_at_period_end"
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
          <!-- Limits come from the session (resolved server-side). -->
          <p class="bp-current-note">
            The Free plan doesn't expire.
            <template v-if="freeProjectsText">It includes {{ freeProjectsText }} and a small monthly AI allowance.</template>
            <template v-else>It includes a small monthly AI allowance.</template>
          </p>
        </div>
      </section>

      <!-- ── The pricing window: the same two cards as /pricing. Without a
           paid plan a card starts the checkout; with one it moves the
           subscription to the other plan (ChangePlanDialog). ── -->
      <p class="set-label">Plans</p>
      <p v-if="plansState === 'loading'" class="bp-current-note">Loading plans...</p>

      <p v-else-if="plansState === 'failed'" class="bp-current-note is-warn">
        We couldn't load the plans.
        <button type="button" class="bp-link" @click="loadPlans">Try again</button>
      </p>

      <div v-else-if="hasSelfServe" class="bp-cards">
        <PricingCards
          :plans="plans"
          :current="currentPlanCode"
          :busy="checkingOut"
          :billing-ready="subscription?.billing_ready !== false"
          signed-in
          @choose="choosePlan"
        />
      </div>

      <p v-else class="bp-current-note">Upgrades aren't available right now.</p>

      <ChangePlanDialog
        v-model:open="changeOpen"
        :plan="changeTarget"
        :current-price="currentPrice"
        :tracked-used="trackedUsed"
        @changed="afterPlanChange"
      />
    </template>
  </div>
  </SettingsShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import billingApi from '@/api/billing'
import ChangePlanDialog from '@/components/billing/ChangePlanDialog.vue'
import PricingCards from '@/components/billing/PricingCards.vue'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '@/constants/support'
import { describeSubscription, paidPlanId } from '@/lib/plan'
import { isPolarUrl } from '@/utils/polarRedirect'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const loading = ref(true)
// True while a return from Polar checkout is being verified.
const verifyingCheckout = ref(false)
const subscription = ref(null)
// The plan whose checkout is opening (PricingCards' `busy`).
const checkingOut = ref(null)
// The plan ChangePlanDialog moves to.
const changeOpen = ref(false)
const changeTarget = ref(null)
const portalLoading = ref(false)
const cancelling = ref(false)
const upgrading = ref(false)
const switchingCycle = ref(false)

// Plans, prices and features come from GET /billing/plans/.
const plans = ref([])
const plansState = ref('loading') // loading | ready | failed

// Seat on an org plan: the subscription's source says the organization
// pays. All personal billing UI (checkout, plan grid, portal, cancel)
// and the ?checkout= return-leg are gated off this one flag.
const orgBilled = computed(() => authStore.session?.subscription?.source === 'organization')

function mailto(address, subject, body = '') {
  const params = new URLSearchParams({ subject })
  if (body) params.set('body', body)
  return `mailto:${address}?${params.toString().replace(/\+/g, '%20')}`
}

const orgSupportHref = computed(() => {
  const acct = authStore.user?.email
  return mailto(SUPPORT_EMAIL, SUPPORT_SUBJECT, acct ? `Account email: ${acct}\n\n` : '')
})

// The pricing window shows the self-serve plans (PricingCards).
const hasSelfServe = computed(() => plans.value.some(p => p?.self_serve === true))

function money(amount) {
  return `$${Number(amount).toLocaleString('en-US')}`
}

// "$45" or "$450"; empty for a custom-quoted or unknown plan.
function priceFor(plan, yearly) {
  if (!plan || !(plan.price_monthly > 0)) return ''
  return money(yearly ? plan.price_yearly : plan.price_monthly)
}

// The paid plan the account is on, or null. A payment hiccup is not a
// downgrade: a past-due row keeps its paid plan with a "Past due" pill
// (the top-level `plan` reports free then, so the shared reader falls back
// to the raw subscription plan).
const currentPlanCode = computed(() => paidPlanId(subscription.value))

// Legacy Pro ($45) is not listed any more; the overview's plan_details
// still describes it.
const currentPlan = computed(() => {
  const code = currentPlanCode.value
  if (!code) return null
  const listed = plans.value.find(p => p.id === code)
  if (listed) return listed
  const details = subscription.value?.plan_details
  return details?.id === code ? details : null
})

// The monthly/annual switch stays for legacy Pro subscriptions only.
const isLegacyPro = computed(() => String(subscription.value?.subscription_plan || '').toLowerCase() === 'pro')

// ChangePlanDialog: what the account pays now and how many prompts it tracks.
const currentPrice = computed(() => {
  const price = Number(currentPlan.value?.price_monthly)
  return Number.isFinite(price) && price > 0 ? price : null
})
const trackedUsed = computed(() => {
  const used = subscription.value?.limits?.tracked_prompts?.used
  return typeof used === 'number' ? used : null
})

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
// that works while trialing, where the period is the trial window on
// both products. The period-length inference stays as a fallback for
// rows synced before the interval column existed.
const isAnnualSub = computed(() => {
  const sub = subscription.value
  if (sub?.interval) return sub.interval === 'year'
  if (!sub?.current_period_start || !sub?.current_period_end) return false
  const ms = new Date(sub.current_period_end) - new Date(sub.current_period_start)
  return ms > 1000 * 60 * 60 * 24 * 60   // > 60 days  →  annual
})

// Status words + trial arithmetic come from the shared describer
// (src/lib/plan.js) so this page, the header and Settings agree on
// what a trial is. `is_trialing` from the API already excludes a
// trial that ended without a confirmed conversion.
const planState = computed(() => describeSubscription(subscription.value))
const statusLabel = computed(() => planState.value.statusLabel)
const isTrialing = computed(() => planState.value.isTrialing)
const daysUntilRenewal = computed(() => planState.value.daysLeft ?? 0)

const currentPlanName = computed(() =>
  currentPlan.value?.name || planState.value.tierName || 'Pro',
)
const currentPriceLabel = computed(() => priceFor(currentPlan.value, isAnnualSub.value))
const currentPeriodLabel = computed(() => {
  if (!currentPriceLabel.value) return ''
  return isAnnualSub.value ? '/year' : '/month'
})
const firstChargeText = computed(() =>
  currentPriceLabel.value ? `the first ${currentPriceLabel.value} charge` : 'the first charge',
)

// Trial progress: elapsed share of the plan's trial window.
const trialPct = computed(() => {
  const total = currentPlan.value?.trial_days || 0
  if (!total) return null
  const left = Math.min(total, daysUntilRenewal.value)
  return Math.round(((total - left) / total) * 100)
})

function projectsText(n) {
  if (n === -1) return 'unlimited projects'
  if (typeof n !== 'number' || n < 0) return ''
  return `${n} ${n === 1 ? 'project' : 'projects'}`
}

// ", including 5 projects," when the plan states its project allowance.
const projectsAllowanceText = computed(() => {
  const text = projectsText(currentPlan.value?.limits?.projects)
  return text ? `, including ${text},` : ''
})

// The Free banner states the allowance the session resolved for this account.
const freeProjectsText = computed(() => projectsText(authStore.session?.limits?.projects))

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function startCheckout(planId) {
  checkingOut.value = planId
  try {
    // Polar hosted checkout — the backend creates the session and we
    // redirect. Silent: every outcome below is reported once.
    const res = await billingApi.checkout({ plan: planId })
    // CheckoutView's payload is {"success", "data": {"checkout_url"}}.
    const url = res.data?.data?.checkout_url || res.data?.checkout_url
    if (url && isPolarUrl(url)) {
      window.location.href = url
      return
    }
    toast.error("We couldn't start checkout. Please try again.")
  } catch (e) {
    if (e?.response?.data?.error?.code === 'already_subscribed') {
      // Backend self-healed from Polar's records (stale local state):
      // refresh what we show instead of erroring.
      toast.success('Your subscription is already active.')
      try { await authStore.fetchSession() } catch (_) { /* refresh below */ }
      await refresh()
      return
    }
    toast.error(e?.displayMessage || "We couldn't start checkout. Please try again.")
  } finally {
    checkingOut.value = null
  }
}

// A card's button: checkout without a paid plan, else a change of plan
// (legacy Pro included) after the dialog's confirm.
function choosePlan(planId) {
  if (!currentPlanCode.value) {
    startCheckout(planId)
    return
  }
  if (planId === currentPlanCode.value) return
  const target = plans.value.find(p => p.id === planId && p.self_serve === true)
  if (!target) return
  changeTarget.value = target
  changeOpen.value = true
}

async function afterPlanChange() {
  // The dialog refreshed the session; the overview follows.
  await refresh()
}

// /billing?plan=<id> (from /pricing or after signing in): a checkout for an
// account without a paid plan, once; with a paid plan, the change dialog.
// The query goes either way, so a reload starts nothing.
function takePlanFromQuery() {
  const wanted = route.query.plan ? String(route.query.plan) : ''
  if (!wanted) return
  const { plan: _plan, ...rest } = route.query
  router.replace({ query: rest })
  const known = plans.value.some(p => p.id === wanted && p.self_serve === true)
  if (!known || overviewError.value || subscription.value?.billing_ready === false) return
  choosePlan(wanted)
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
    /* the client interceptor toasts */
  } finally {
    portalLoading.value = false
  }
}

async function confirmUpgradeNow() {
  const charge = currentPriceLabel.value
    ? `${currentPriceLabel.value} for the first ${isAnnualSub.value ? 'year' : 'month'}`
    : 'for your first billing period'
  if (!window.confirm(
    `Start ${currentPlanName.value} now? Your free trial ends immediately and your card is charged ${charge}.`,
  )) return
  upgrading.value = true
  try {
    await billingApi.upgradeNow({})
    toast.success(`Your ${currentPlanName.value} plan is now active.`)
    // Session first so plan labels and project limits flip everywhere,
    // then the overview so this page shows the paid state.
    try { await authStore.fetchSession() } catch (_) { /* refresh below */ }
    await refresh()
  } catch {
    /* the client interceptor toasts */
  } finally {
    upgrading.value = false
  }
}

async function confirmSwitchCycle() {
  const toAnnual = !isAnnualSub.value
  const target = priceFor(currentPlan.value, toAnnual)
  const price = target ? ` (${target}${toAnnual ? '/year' : '/month'})` : ''
  const msg = isTrialing.value
    ? `Switch to ${toAnnual ? 'annual' : 'monthly'} billing${price}? Nothing is charged until your trial ends.`
    : `Switch to ${toAnnual ? 'annual' : 'monthly'} billing${price}? The price difference is settled on your card right away.`
  if (!window.confirm(msg)) return
  switchingCycle.value = true
  try {
    await billingApi.changePlan({ annual: toAnnual })
    toast.success(`Switched to ${toAnnual ? 'annual' : 'monthly'} billing.`)
    try { await authStore.fetchSession() } catch (_) { /* refresh below */ }
    await refresh()
  } catch {
    /* the client interceptor toasts */
  } finally {
    switchingCycle.value = false
  }
}

async function confirmCancel() {
  const end = subscription.value?.current_period_end
  const tail = end ? ` Access continues until ${formatDate(end)}.` : ''
  if (!window.confirm(`Cancel your ${currentPlanName.value} subscription?${tail}`)) return
  cancelling.value = true
  try {
    await billingApi.cancel()
    toast.success('Subscription will end at the period end.')
    await refresh()
  } catch {
    /* the client interceptor toasts */
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
  } catch {
    /* the client interceptor toasts */
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
    // Silent: a failure renders inline. The overview is the one call
    // that must not soft-fail into a "Free plan" render.
    const res = await billingApi.getCurrent({ _silentError: true })
    subscription.value = res.data || null
    overviewError.value = !res.data
  } catch {
    overviewError.value = true
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

// After a checkout return, say what the refreshed subscription shows.
function reportCheckoutState() {
  if (currentPlanCode.value) {
    toast.success('Your subscription is active.')
  } else if (!overviewError.value) {
    toast.info("We haven't received your payment yet. Refresh this page in a moment.")
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
  const plansLoaded = loadPlans()
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
  if (checkoutParam === 'success') {
    verifyingCheckout.value = true
    if (checkoutId) {
      // Returning from Polar checkout: verify server-side and sync the
      // subscription (works without webhooks in local dev).
      try {
        const res = await billingApi.confirm(checkoutId)
        if (res.data?.data?.active) {
          toast.success('Your subscription is active.')
          try { await authStore.fetchSession() } catch (_) { /* best effort */ }
          // A fresh subscriber goes straight back to the product — the
          // dashboard — not a billing statement. The toast survives the
          // navigation (ToastContainer is global).
          router.replace({ name: 'dashboard' })
          return
        }
      } catch (_) {
        /* the client interceptor toasts; the refresh below shows the real state */
      }
    }
    await refresh()
    verifyingCheckout.value = false
    loading.value = false
    reportCheckoutState()
    return
  }
  if (checkoutParam === 'canceled') {
    toast.info('Checkout canceled.')
  }
  await refresh()
  loading.value = false
  await plansLoaded
  takePlanFromQuery()
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
.bp-pill--danger  { background: rgba(239, 68, 68, 0.10); color: #b91c1c; border-color: rgba(239, 68, 68, 0.30); }
.bp-pill--neutral { background: var(--bp-surface); color: var(--bp-muted); }

/* ── The pricing window: PricingCards on this page's surface ── */
.bp-cards {
  --pc-fg: var(--bp-fg);
  --pc-muted: var(--bp-muted);
  --pc-border: var(--bp-border);
  --pc-card-bg: var(--bp-bg);
  --pc-btn-bg: var(--bp-fg);
  --pc-btn-fg: var(--bp-bg);
  margin-bottom: 24px;
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

.bp-link {
  color: var(--bp-fg);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid var(--bp-border);
  transition: border-color 0.2s;
}
.bp-link:hover { border-color: var(--bp-fg); }

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

@media (max-width: 720px) {
  .bp { padding: 18px 16px 64px; }
  .bp-current {
    flex-direction: column;
    align-items: flex-start;
  }
  .bp-current-actions { width: 100%; justify-content: flex-start; }
}
</style>
