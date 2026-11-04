/**
 * The ONE place that turns a subscription payload into words.
 *
 * A free trial is not a paid plan: the card has not been charged until
 * Polar converts the subscription at trial end. Every surface that names
 * the plan (Settings allowance, Add project, Billing) reads
 * from here so a trial is always "Free trial", a charged subscription is
 * "100 prompts", "200 prompts" (the two monthly plans) or "Pro plan"
 * (legacy), and a lapsed or unpaid row never poses as either.
 *
 * Accepts either payload shape:
 *   GET /auth/session/  -> { status, plan, tier, is_paying, is_trialing,
 *                            trial_end, current_period_end, cancel_at_period_end }
 *   GET /billing/       -> { subscription_status, subscription_plan, tier,
 *                            is_trialing, trial_end, current_period_end,
 *                            cancel_at_period_end }
 */

const BUSINESS_ALIASES = ['business', 'enterprise', 'scale', 'team']
// The two monthly plans of the pricing window. Their names already say
// what they are, so they are never followed by "plan".
const PROMPT_PLANS = ['prompts_100', 'prompts_200']

function normalizeTier(value) {
  const v = String(value || '').toLowerCase()
  if (!v || v === 'free' || v === 'none') return null
  if (PROMPT_PLANS.includes(v)) return v
  return BUSINESS_ALIASES.includes(v) ? 'business' : 'pro'
}

const TIER_NAMES = { pro: 'Pro', business: 'Business', prompts_100: '100 prompts', prompts_200: '200 prompts' }

// "Pro plan", "Business plan", but "100 prompts".
function planTitle(tier, tierName) {
  return PROMPT_PLANS.includes(tier) ? tierName : `${tierName} plan`
}

/**
 * The paid plan a subscription payload is on (`prompts_100`, `prompts_200`,
 * `pro`, `business`), or null for Free. Active and trialing rows give their
 * access plan; a past-due row keeps its paid plan (a payment hiccup is not a
 * downgrade). Accepts the session's and the billing overview's shapes.
 */
export function paidPlanId(sub) {
  const s = sub || {}
  const status = s.status ?? s.subscription_status ?? null
  if (status === 'active' || status === 'trialing') {
    const code = String(s.plan || s.plan_code || '').toLowerCase()
    if (!code || code === 'free' || code === 'none') return null
    return PROMPT_PLANS.includes(code) ? code : normalizeTier(code)
  }
  if (status === 'past_due') return normalizeTier(s.subscription_plan ?? s.tier ?? s.plan) || 'pro'
  return null
}

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatShortDate(date) {
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

/**
 * @returns {{
 *   status: string|null, tier: 'prompts_100'|'prompts_200'|'pro'|'business'|null, tierName: string|null,
 *   isPaying: boolean, isTrialing: boolean, isActive: boolean, isPastDue: boolean,
 *   cancelAtPeriodEnd: boolean, trialEnd: Date|null, periodEnd: Date|null,
 *   daysLeft: number|null,
 *   badge: {text: string, tone: 'gold'|'neutral'|'warn'}|null,
 *   title: string, detail: string|null, planLabel: string, tierLabel: string,
 *   statusLabel: string,
 * }}
 */
export function describeSubscription(sub, now = new Date()) {
  const s = sub || {}
  const status = s.status ?? s.subscription_status ?? null
  const tier = normalizeTier(s.tier) ?? normalizeTier(s.subscription_plan) ?? normalizeTier(s.plan)
  const tierName = tier ? TIER_NAMES[tier] : null
  const cancelAtPeriodEnd = s.cancel_at_period_end === true
  const periodEnd = toDate(s.current_period_end)

  // The backend says whether a trial is still live (it knows the grace
  // window); fall back to the raw status for payloads that predate it.
  const isTrialing = typeof s.is_trialing === 'boolean' ? s.is_trialing : status === 'trialing'
  const isActive = status === 'active'
  const isPastDue = status === 'past_due'
  const isPaying = typeof s.is_paying === 'boolean' ? s.is_paying : isActive || isTrialing

  // Seat on an organization plan: the org (not this user's card) pays,
  // so none of the personal trial/past-due arithmetic applies. Personal
  // subscriptions (source 'user' or absent) fall through untouched.
  if (s.source === 'organization') {
    const orgTier = tier || 'business'
    const orgTierName = tierName || 'Business'
    const orgTitle = planTitle(orgTier, orgTierName)
    return {
      status,
      tier: orgTier,
      tierName: orgTierName,
      isPaying: true,
      isTrialing: false,
      isActive: true,
      isPastDue: false,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      periodEnd,
      daysLeft: null,
      badge: { text: orgTierName, tone: 'gold' },
      title: orgTitle,
      detail: 'Managed by your organization',
      planLabel: `${orgTitle} · Managed by your organization`,
      tierLabel: orgTitle,
      statusLabel: 'Active',
    }
  }

  const trialEnd = isTrialing ? (toDate(s.trial_end) ?? periodEnd) : null
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86_400_000)) : null

  let title = 'Free plan'
  let detail = null
  let badge = null
  let tierLabel = 'Free plan'
  let statusLabel = 'Inactive'

  if (isTrialing) {
    title = 'Free trial'
    detail = trialEnd ? `ends ${formatShortDate(trialEnd)}` : null
    if (cancelAtPeriodEnd) detail = detail ? `${detail} (won't renew)` : "won't renew"
    badge = { text: 'Trial', tone: 'neutral' }
    tierLabel = `${tierName || 'Pro'} trial`
    statusLabel = 'Free trial'
  } else if (isActive) {
    title = planTitle(tier || 'pro', tierName || 'Pro')
    detail = cancelAtPeriodEnd && periodEnd ? `ends ${formatShortDate(periodEnd)}` : null
    badge = { text: tierName || 'Pro', tone: 'gold' }
    tierLabel = title
    statusLabel = 'Active'
  } else if (isPastDue) {
    title = planTitle(tier || 'pro', tierName || 'Pro')
    detail = 'payment issue'
    badge = { text: tierName || 'Pro', tone: 'warn' }
    tierLabel = title
    statusLabel = 'Past due'
  } else if (status === 'trialing') {
    // Column still says trialing but the backend no longer trusts it:
    // the trial ended and no conversion was ever confirmed.
    statusLabel = 'Trial ended'
  } else if (status === 'canceled') {
    statusLabel = 'Canceled'
  } else if (status === 'incomplete') {
    statusLabel = 'Incomplete'
  }

  return {
    status,
    tier,
    tierName,
    isPaying,
    isTrialing,
    isActive,
    isPastDue,
    cancelAtPeriodEnd,
    trialEnd,
    periodEnd,
    daysLeft,
    badge,
    title,
    detail,
    planLabel: detail ? `${title} · ${detail}` : title,
    tierLabel,
    statusLabel,
  }
}
