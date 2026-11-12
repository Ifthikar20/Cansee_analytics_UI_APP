<template>
  <div class="sp">

    <header class="sp-top">
      <div class="sp-brand">
        <img src="/images/cansee-logo.png" alt="Cansee" class="sp-brand-mark" />
      </div>
      <button type="button" class="sp-back" @click="goBack">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 8H3M7 4L3 8l4 4"/>
        </svg>
        <span>Back</span>
      </button>
    </header>

    <main class="sp-main">
      <div class="sp-card">
        <div class="sp-stagger">
          <span class="sp-eyebrow">Support</span>
          <h1 class="sp-title">How can we help?</h1>
          <p class="sp-sub">
            Stuck during setup, a billing question, or something that just
            looks wrong? Search the help center, or write to us.
          </p>

          <div class="sp-actions">
            <a class="sp-cta" :href="mailHref">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="1.5" y="3" width="13" height="10" rx="1.8"/>
                <path d="M2 4l6 5 6-5"/>
              </svg>
              <span>{{ SUPPORT_EMAIL }}</span>
            </a>
            <button type="button" class="sp-secondary" aria-haspopup="dialog" @click="help.open()">
              Open help center
            </button>
          </div>

          <section class="sp-faq" aria-labelledby="sp-faq-title">
            <h2 id="sp-faq-title" class="sp-faq-title">Common questions</h2>
            <dl class="sp-faq-list">
              <div v-for="faq in faqs" :key="faq.id" class="sp-faq-item">
                <dt>{{ faq.q }}</dt>
                <dd>
                  <p v-for="(para, i) in faq.a" :key="i">{{ para }}</p>
                  <ul v-if="faq.list.length">
                    <li v-for="(line, i) in faq.list" :key="i">{{ line }}</li>
                  </ul>
                </dd>
              </div>
            </dl>
            <button type="button" class="sp-more" aria-haspopup="dialog" @click="help.open()">
              See all questions
            </button>
          </section>
        </div>
      </div>
    </main>

    <footer class="sp-footer">
      <span>© 2026 Cansee</span>
      <nav class="sp-footer-links" aria-label="Legal">
        <a href="/terms" target="_blank" rel="noopener">Terms</a>
        <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
      </nav>
    </footer>

    <HelpDrawer />
  </div>
</template>

<script setup>
// The public Support page (the login, onboarding and paywall funnel links
// here, and so does the help drawer): email, the help center, and the
// questions people ask most. It sits outside AppShell, so it mounts its own
// help drawer. ?faq=<id> opens the drawer at that question.
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '@/constants/support'
import { faqById, featuredFaqs } from '@/lib/help/faq'
import { useAuthStore } from '@/stores/auth'
import { useHelpStore } from '@/stores/help'
import { useHelpShortcut } from '@/composables/useHelpShortcut'
import HelpDrawer from '@/components/help/HelpDrawer.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const help = useHelpStore()

useHelpShortcut()

const faqs = featuredFaqs('support')
const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`

onMounted(() => {
  const id = Array.isArray(route.query.faq) ? route.query.faq[0] : route.query.faq
  if (id && faqById(id)) help.open({ faqId: id })
})

// The router records the in-app page before this one. Without one (a new
// tab from the app's help, a link from elsewhere) a signed-in user goes to
// the app and anyone else to the home page.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push(auth.isAuthenticated ? '/dashboard' : '/')
}
</script>

<style scoped>
.sp {
  /* The app's tokens, so the card follows the light and dark theme. */
  --sp-bg: var(--card);
  --sp-fg: var(--foreground);
  --sp-muted: var(--muted-foreground);
  --sp-border: var(--border);
  --sp-surface: var(--muted);
  --sp-accent: var(--signal-text);
  --sp-accent-soft: var(--signal-soft);
  --sp-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --sp-spring-strong: cubic-bezier(0.16, 1, 0.3, 1);
  --sp-spring-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
  --sp-label-font: var(--font-mono);

  position: relative;
  min-height: 100vh;
  color: var(--sp-fg);
  background: var(--background);
  font-feature-settings: 'cv11', 'ss01';
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
.sp :focus-visible { outline-color: var(--sp-accent); }

.sp-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px;
  color: var(--foreground);
  text-shadow: none;
  animation: sp-drop 450ms var(--sp-spring) 80ms both;
}
.sp-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.sp-brand-mark {
  width: auto;
  height: 17px;
  object-fit: contain;
  flex-shrink: 0;
  filter: var(--logo-filter);
}
.sp-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  font: inherit;
  color: var(--foreground);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius);
  transition: color 0.15s;
}
.sp-back:hover { color: var(--foreground); text-decoration: underline; }
@keyframes sp-drop {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.sp-main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px 16px;
}
.sp-card {
  width: min(560px, 100%);
  background: var(--sp-bg);
  color: var(--sp-fg);
  border-radius: var(--radius);
  box-shadow: none;
  padding: 40px 42px 34px;
  animation: sp-card-in 0.65s var(--sp-spring-pop) both;
}

.sp-stagger > * { animation: sp-rise 0.55s var(--sp-spring-strong) both; }
.sp-stagger > *:nth-child(2) { animation-delay: 0.07s; }
.sp-stagger > *:nth-child(3) { animation-delay: 0.14s; }
.sp-stagger > *:nth-child(4) { animation-delay: 0.21s; }
.sp-stagger > *:nth-child(5) { animation-delay: 0.28s; }

.sp-eyebrow {
  display: inline-block;
  font-family: var(--sp-label-font);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sp-muted);
  margin-bottom: 12px;
}
.sp-eyebrow::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: var(--sp-accent);
  margin-right: 9px;
  vertical-align: 3px;
}
.sp-title {
  font-size: clamp(24px, 3vw, 30px);
  line-height: 1.12;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
}
.sp-sub {
  font-size: 14px;
  line-height: 1.6;
  color: var(--sp-muted);
  margin: 0 0 22px;
  max-width: 46ch;
}

.sp-cta {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 12px 20px;
  border-radius: var(--radius);
  background: var(--sp-fg);
  color: var(--sp-bg);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  text-decoration: none;
  transition: transform 0.25s var(--sp-spring-pop), background 0.25s var(--sp-spring), box-shadow 0.25s ease;
}
.sp-cta:hover {
  transform: translateY(-2px);
  background: var(--sp-accent);
  box-shadow: none;
}

.sp-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.sp-secondary,
.sp-more {
  display: inline-flex;
  align-items: center;
  padding: 11px 18px;
  border: 1px solid var(--sp-border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--sp-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}
.sp-secondary:hover,
.sp-more:hover { background: var(--sp-surface); }
.sp-more {
  margin-top: 16px;
  padding: 8px 14px;
  font-size: 13px;
}
.sp-faq {
  margin: 26px 0 0;
  padding: 0;
}
.sp-faq-title {
  margin: 0 0 8px;
  font-family: var(--sp-label-font);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sp-muted);
}
.sp-faq-list {
  margin: 0;
  padding: 0;
}
.sp-faq-item {
  padding: 14px 2px;
  border-top: 1px solid var(--sp-border);
}
.sp-faq-item:last-child { border-bottom: 1px solid var(--sp-border); }
.sp-faq-item dt {
  font-size: 13.5px;
  font-weight: 600;
  margin: 0 0 4px;
}
.sp-faq-item dd {
  font-size: 13px;
  line-height: 1.55;
  color: var(--sp-muted);
  margin: 0;
}
.sp-faq-item dd p { margin: 0 0 6px; }
.sp-faq-item dd p:last-child { margin-bottom: 0; }
.sp-faq-item dd ul {
  margin: 4px 0 0;
  padding-left: 18px;
  list-style: disc;
}
.sp-faq-item dd li { margin: 0 0 3px; }

.sp-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px 18px;
  font-size: 12px;
  color: var(--muted-foreground);
  text-shadow: none;
  animation: sp-fade-in 0.8s ease 0.5s both;
}
.sp-footer-links { display: flex; gap: 20px; }
.sp-footer-links a {
  color: var(--foreground);
  text-decoration: none;
  transition: color 0.2s;
}
.sp-footer-links a:hover { color: var(--foreground); text-decoration: underline; }

@keyframes sp-card-in {
  from { opacity: 0; transform: translateY(26px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes sp-rise {
  from { opacity: 0; transform: translateY(12px) scale(0.995); filter: blur(5px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes sp-fade-in { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .sp *,
  .sp *::before,
  .sp *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .sp-stagger > *, .sp-card, .sp-footer {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 640px) {
  .sp-top { padding: 14px 16px; }
  .sp-main { padding: 8px 12px 12px; }
  .sp-card { padding: 26px 20px 24px; border-radius: var(--radius); }
  .sp-footer { padding: 12px 16px 14px; }
}
</style>
