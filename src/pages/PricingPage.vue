<template>
  <!-- The public pricing window (autopilot_frontend.md 1b): the two plans of
       GET /billing/plans/, readable signed out. A choice goes to Billing,
       through login first when signed out. -->
  <div class="pp">
    <header class="pp-top">
      <router-link to="/" class="pp-home" aria-label="Cansee home">
        <img src="/images/cansee-logo.png" alt="Cansee" class="pp-logo" />
      </router-link>
      <router-link v-if="!signedIn" :to="{ name: 'login' }" class="pp-signin">Sign in</router-link>
    </header>

    <main class="pp-main">
      <h1 class="pp-title">Pricing</h1>
      <p class="pp-sub">Track the questions your buyers ask AI. Cansee checks them every day and texts you what changed.</p>

      <p v-if="state === 'loading'" class="pp-note">Loading plans...</p>
      <div v-else-if="state === 'failed'" class="pp-failed">
        <p class="pp-note">We couldn't load the plans.</p>
        <button type="button" class="pp-retry" @click="load">Try again</button>
      </div>
      <PricingCards
        v-else
        :plans="plans"
        :current="current"
        :signed-in="signedIn"
        @choose="choose"
      />
    </main>

    <footer class="pp-foot">
      <span>© 2026 Cansee</span>
      <nav class="pp-foot-links" aria-label="Legal and support">
        <router-link to="/terms">Terms</router-link>
        <router-link to="/privacy">Privacy</router-link>
        <router-link to="/support">Support</router-link>
      </nav>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import billingApi from '@/api/billing'
import PricingCards from '@/components/billing/PricingCards.vue'
import { paidPlanId } from '@/lib/plan'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const plans = ref([])
const state = ref('loading') // loading | ready | failed

const signedIn = computed(() => authStore.isAuthenticated)
// Signed in, the cards say which plan the account is on.
const current = computed(() => (signedIn.value ? paidPlanId(authStore.session?.subscription) : null))

async function load() {
  state.value = 'loading'
  try {
    const res = await billingApi.getPlans()
    plans.value = Array.isArray(res.data) ? res.data : []
    state.value = 'ready'
  } catch {
    state.value = 'failed'
  }
}

// Billing starts the checkout (or the change of plan) for ?plan=.
function choose(id) {
  const billing = `/billing?plan=${encodeURIComponent(id)}`
  if (!signedIn.value) {
    router.push({ name: 'login', query: { redirect: billing } })
    return
  }
  router.push(billing)
}

onMounted(() => {
  document.title = 'Pricing — Cansee'
  load()
})
</script>

<style scoped>
.pp {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  background: var(--background);
  color: var(--foreground);
}

.pp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 16px;
}

@media (min-width: 640px) {
  .pp-top {
    padding: 24px 24px;
  }
}

.pp-home {
  display: inline-flex;
  padding: 4px 0;
}

.pp-logo {
  display: block;
  width: auto;
  height: 22px;
}

[data-theme='dark'] .pp-logo {
  filter: brightness(0) invert(1);
}

.pp-signin {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.pp-signin:hover {
  background: var(--muted);
}

.pp-signin:focus-visible {
  border-radius: var(--radius);
}

.pp-main {
  flex: 1;
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}

@media (min-width: 640px) {
  .pp-main {
    padding: 40px 24px 96px;
  }
}

.pp-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.pp-sub {
  max-width: 560px;
  margin: 12px 0 28px;
  color: var(--muted-foreground);
  font-size: 16px;
  line-height: 1.55;
}

.pp-note {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
}

.pp-failed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.pp-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.pp-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 16px 16px 24px;
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 13px;
}

.pp-foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
}

.pp-foot-links a {
  color: var(--muted-foreground);
}

.pp-foot-links a:hover {
  color: var(--foreground);
}
</style>
