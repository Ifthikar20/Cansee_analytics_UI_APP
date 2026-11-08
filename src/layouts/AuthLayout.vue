<template>
  <!-- data-theme here (not only on <html>) keeps every shadcn token inside
       the form dark even if something re-applies the user's preference. -->
  <div class="auth" data-theme="dark">
    <!-- Left: the form. -->
    <section class="auth-main">
      <header class="auth-top">
        <router-link to="/" class="auth-home" aria-label="Cansee home">
          <img src="/images/cansee-logo.png" alt="Cansee" class="auth-logo" />
        </router-link>
        <router-link to="/" class="auth-back">
          <ArrowLeft class="auth-back-icon" aria-hidden="true" />
          Back to home
        </router-link>
      </header>

      <div class="auth-body">
        <div class="auth-form-container">
          <div class="auth-form-header">
            <h1 class="auth-title">{{ title }}</h1>
            <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>
          </div>
          <slot />
        </div>
      </div>

      <footer class="auth-footer">
        <span>© 2026 Cansee</span>
        <router-link class="auth-footer-link" to="/support">Support</router-link>
        <router-link class="auth-footer-link" to="/privacy">Privacy</router-link>
        <router-link class="auth-footer-link" to="/terms">Terms</router-link>
        <!-- Internal-only backend build marker (deliberately near-invisible). -->
        <span v-if="apiBuild" class="auth-build" :title="apiCommit">{{ apiBuild }}</span>
      </footer>
    </section>

    <!-- Right: the same gradient panel as the landing hero. -->
    <aside class="auth-aside">
      <GradientCard class="auth-card">
        <div class="auth-card-inner">
          <span class="auth-card-pill">AI visibility analytics</span>

          <div>
            <p class="auth-card-title">See your brand the way AI sees it.</p>
            <!-- Jobs, not internal feature names. Each one is backed by a
                 capability that ships and is reachable in the UI. -->
            <ul class="auth-card-list">
              <li v-for="job in jobs" :key="job">
                <span class="auth-card-check" aria-hidden="true"><Check /></span>
                {{ job }}
              </li>
            </ul>
          </div>

          <p class="auth-card-engines">ChatGPT · Claude · Gemini · Grok · Perplexity</p>
        </div>
      </GradientCard>
    </aside>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ArrowLeft, Check } from '@lucide/vue'
import api from '@/api/client'
import GradientCard from '@/components/GradientCard.vue'
import { useForcedTheme } from '@/composables/useForcedTheme'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})

// Auth screens are dark-only, matching the landing page. The composable
// hands the user's own theme back on the way into the app.
useForcedTheme('dark')

const jobs = [
  'Where AI ranks you',
  'Who it recommends instead',
  'Which sources it trusts',
  'When it gets your facts wrong',
]

// Backend build marker for the footer. Internal use: tells us which
// API build is live without opening the server. Stays empty (and the
// element unrendered) if the endpoint is unreachable. The commit hash
// goes into the title attribute so hovering the marker reveals it.
const apiBuild = ref('')
const apiCommit = ref('')

onMounted(async () => {
  try {
    const res = await api.get('/version/', { _silentError: true })
    const v = res.data || {}
    // Prefer the server-computed vMMDD-N label; fall back to the raw
    // commit hash if talking to an older backend without it.
    if (v.label) {
      apiBuild.value = v.label
      apiCommit.value = v.version || ''
    } else if (v.version) {
      apiBuild.value = `api ${v.version}`
    }
  } catch {
    // Version marker is cosmetic; never let it disturb the login page.
  }
})
</script>

<style scoped>
/* Token overrides: a slightly lifted near-black instead of the app's pure
   black dark mode, and a lavender focus ring to match the landing page. */
.auth {
  --background: #0a0a0c;
  --foreground: #f5f5f7;
  --card: #111115;
  --card-foreground: #f5f5f7;
  --popover: #111115;
  --muted: #16161b;
  --muted-foreground: #a1a1aa;
  --accent: #1c1c22;
  --accent-foreground: #ffffff;
  --border: rgba(255, 255, 255, 0.1);
  --input: rgba(255, 255, 255, 0.14);
  --ring: #a78bfa;

  display: flex;
  min-height: 100vh;
  min-height: 100svh;
  background: var(--background);
  color: var(--foreground);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.auth a,
.auth a:hover {
  opacity: 1;
}

/* ── Form side ── */
.auth-main {
  display: flex;
  flex-direction: column;
  width: min(640px, 46%);
  min-width: 440px;
  padding: 24px 48px;
}

.auth-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
}

.auth-home {
  display: inline-flex;
}

.auth-logo {
  display: block;
  height: 22px;
  width: auto;
  /* The wordmark ships dark slate; render it white on the dark page. */
  filter: brightness(0) invert(1);
}

.auth-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  transition: color 0.15s ease;
}

.auth-back:hover {
  color: var(--foreground);
}

.auth-back-icon {
  width: 16px;
  height: 16px;
}

.auth-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.auth-form-container {
  width: 100%;
  max-width: 420px;
}

.auth-form-header {
  margin-bottom: 32px;
}

.auth-title {
  color: var(--foreground);
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.auth-subtitle {
  margin-top: 10px;
  color: var(--muted-foreground);
  font-size: 16px;
}

.auth-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 18px;
  color: rgba(245, 245, 247, 0.42);
  font-size: 13px;
}

.auth-footer-link {
  color: inherit;
  font-weight: 400;
  transition: color 0.15s ease;
}

.auth-footer-link:hover {
  color: var(--foreground);
}

/* Internal backend build marker. Deliberately tiny and faint: it is
   for our own deploy tracking, not something users should notice. */
.auth-build {
  margin-left: auto;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.02em;
  opacity: 0.45;
  user-select: none;
}

/* ── Gradient side ── */
.auth-aside {
  flex: 1;
  display: flex;
  padding: 16px 16px 16px 0;
}

.auth-card {
  flex: 1;
}

.auth-card-inner {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 40px;
  height: 100%;
  padding: 48px;
}

.auth-card-pill {
  align-self: flex-start;
  padding: 7px 16px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.auth-card-title {
  max-width: 14ch;
  color: #ffffff;
  font-size: clamp(2.4rem, 4vw, 3.75rem);
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.auth-card-list {
  display: grid;
  gap: 14px;
  margin: 36px 0 0;
  padding: 0;
  list-style: none;
}

.auth-card-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 16px;
  font-weight: 500;
}

.auth-card-check {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #ffffff;
  color: #4b3bb4;
}

.auth-card-check svg {
  width: 14px;
  height: 14px;
  stroke-width: 3;
}

.auth-card-engines {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* ── Responsive ── */
@media (max-width: 1080px) {
  .auth-main {
    width: 100%;
    min-width: 0;
  }
  .auth-aside {
    display: none;
  }
}

@media (max-width: 560px) {
  .auth-main {
    padding: 16px 20px 20px;
  }
  .auth-body {
    padding: 32px 0;
  }
}
</style>
