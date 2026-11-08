<template>
  <!-- The pricing window (autopilot_frontend.md 1a): the self-serve plans of
       GET /billing/plans/, in the API's order. Exactly two cards today, side
       by side when there is room. Colours come from the page through the
       --pc-* custom properties, so the card sits on any surface. -->
  <div class="pc">
    <div class="pc-grid">
      <article v-for="plan in cards" :key="plan.id" class="pc-card" :aria-labelledby="nameId(plan)">
        <h3 :id="nameId(plan)" class="pc-name">{{ plan.name }}</h3>
        <p class="pc-price">
          <span class="pc-amount">{{ price(plan) }}</span>
          <span class="pc-period">/month</span>
        </p>
        <ul v-if="plan.features?.length" class="pc-features">
          <li v-for="feature in plan.features" :key="feature">
            <Check class="pc-check" aria-hidden="true" />
            <span>{{ feature }}</span>
          </li>
        </ul>
        <button
          type="button"
          class="pc-btn"
          :class="{ 'is-current': isCurrent(plan) }"
          :disabled="isDisabled(plan)"
          :aria-describedby="nameId(plan)"
          @click="emit('choose', plan.id)"
        >{{ label(plan) }}</button>
      </article>
    </div>

    <p v-if="!billingReady" class="pc-note">Checkout isn't set up yet.</p>
    <p class="pc-foot">
      Prices in US dollars, billed monthly through Polar. Cancel anytime; your plan stays on until the end of the month you paid for.
    </p>
    <p v-if="hasCustomPlan" class="pc-foot">
      Need more? Email <a :href="`mailto:${SALES_EMAIL}`">{{ SALES_EMAIL }}</a>.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { SALES_EMAIL } from '@/constants/support'

const props = defineProps({
  // GET /billing/plans/.
  plans: { type: Array, default: () => [] },
  // The account's paid plan id (prompts_100, prompts_200, pro...), or null.
  current: { type: String, default: null },
  // The plan whose checkout is opening, or null.
  busy: { type: String, default: null },
  // False until Polar checkout is set up on the server.
  billingReady: { type: Boolean, default: true },
  signedIn: { type: Boolean, default: false },
})
const emit = defineEmits(['choose'])

const cards = computed(() => props.plans.filter((p) => p?.self_serve === true))
// A custom-quoted plan (Business) has price_monthly -1.
const hasCustomPlan = computed(() => props.plans.some((p) => Number(p?.price_monthly) < 0))

function nameId(plan) {
  return `pc-name-${plan.id}`
}

function price(plan) {
  return `$${Number(plan.price_monthly).toLocaleString('en-US')}`
}

function isCurrent(plan) {
  return Boolean(props.current) && props.current === plan.id
}

function label(plan) {
  if (props.busy === plan.id) return 'Opening checkout...'
  if (!props.signedIn) return 'Get started'
  if (!props.current) return `Choose ${plan.name}`
  if (isCurrent(plan)) return 'Current plan'
  return `Move to ${plan.name}`
}

function isDisabled(plan) {
  return !props.billingReady || Boolean(props.busy) || isCurrent(plan)
}
</script>

<style scoped>
.pc {
  container-type: inline-size;
  color: var(--pc-fg, var(--foreground));
}

.pc-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@container (min-width: 480px) {
  .pc-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.pc-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--pc-border, var(--border));
  border-radius: 12px;
  background: var(--pc-card-bg, var(--card));
  color: var(--pc-fg, var(--foreground));
}

.pc-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.pc-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 0;
}

.pc-amount {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.pc-period {
  color: var(--pc-muted, var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
}

.pc-features {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
  line-height: 1.45;
}

.pc-features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.pc-check {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

.pc-btn {
  height: 40px;
  padding: 0 16px;
  border: 1px solid var(--pc-btn-bg, var(--primary));
  border-radius: 10px;
  background: var(--pc-btn-bg, var(--primary));
  color: var(--pc-btn-fg, var(--primary-foreground));
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.pc-btn:hover:not(:disabled) {
  opacity: 0.88;
}

.pc-btn.is-current {
  border-color: var(--pc-border, var(--border));
  background: transparent;
  color: var(--pc-fg, var(--foreground));
}

.pc-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pc-btn.is-current:disabled {
  opacity: 1;
  cursor: default;
}

.pc-btn:focus-visible {
  border-radius: 10px;
  outline: 2px solid var(--pc-ring, var(--ring));
  outline-offset: 2px;
}

.pc-note {
  margin: 14px 0 0;
  font-size: 13px;
  font-weight: 600;
}

.pc-foot {
  margin: 12px 0 0;
  color: var(--pc-muted, var(--muted-foreground));
  font-size: 12.5px;
  line-height: 1.5;
}

.pc-foot a {
  color: var(--pc-fg, var(--foreground));
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
