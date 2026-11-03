<template>
  <div class="sp">
    <WatercolorBackdrop />

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
            looks wrong? Write to us.
          </p>

          <a class="sp-cta" :href="`mailto:${SUPPORT_EMAIL}`">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1.5" y="3" width="13" height="10" rx="1.8"/>
              <path d="M2 4l6 5 6-5"/>
            </svg>
            <span>{{ SUPPORT_EMAIL }}</span>
          </a>

          <dl class="sp-faq">
            <div class="sp-faq-item">
              <dt>I paid, but I still see the plans screen.</dt>
              <dd>
                Press the trial button once more — we check your payment
                provider record and restore an already-active subscription
                automatically.
              </dd>
            </div>
            <div class="sp-faq-item">
              <dt>I want to change or cancel my plan.</dt>
              <dd>
                Go to Billing and open Manage billing — the secure customer
                portal handles plan changes, cancellation, and invoices.
              </dd>
            </div>
            <div class="sp-faq-item">
              <dt>The setup scan got my business details wrong.</dt>
              <dd>
                Everything from onboarding is editable afterwards: your
                description and competitors in Settings, and your prompts
                from the Overview.
              </dd>
            </div>
          </dl>
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
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { SUPPORT_EMAIL } from '@/constants/support'

import WatercolorBackdrop from '@/components/onboarding/WatercolorBackdrop.vue'

const router = useRouter()

function goBack() {
  // Came from somewhere in the app (funnel footer, auth page) — return
  // there; a cold direct visit falls back to the landing page.
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<style scoped>
.sp {
  --sp-bg: #ffffff;
  --sp-fg: #0a0a0a;
  --sp-muted: #5d5d5d;
  --sp-border: rgba(10, 10, 10, 0.10);
  --sp-surface: #fafafa;
  --sp-accent: #ff6a2c;
  --sp-accent-soft: rgba(255, 106, 44, 0.10);
  --sp-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --sp-spring-strong: cubic-bezier(0.16, 1, 0.3, 1);
  --sp-spring-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
  --sp-label-font: 'Geist', 'Inter', system-ui, sans-serif;

  position: relative;
  min-height: 100vh;
  color: var(--sp-fg);
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
  color: #fff;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
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
  filter: brightness(0) invert(1);
}
.sp-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  font: inherit;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: color 0.15s;
}
.sp-back:hover { color: #fff; text-decoration: underline; }
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
  border-radius: 24px;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.35),
    0 8px 24px rgba(0, 0, 0, 0.18);
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
  font-weight: 600;
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
  border-radius: 999px;
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
  box-shadow: 0 10px 24px rgba(255, 106, 44, 0.35);
}

.sp-faq {
  margin: 26px 0 0;
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

.sp-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px 18px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  animation: sp-fade-in 0.8s ease 0.5s both;
}
.sp-footer-links { display: flex; gap: 20px; }
.sp-footer-links a {
  color: rgba(255, 255, 255, 0.78);
  text-decoration: none;
  transition: color 0.2s;
}
.sp-footer-links a:hover { color: #fff; text-decoration: underline; }

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
  .sp-card { padding: 26px 20px 24px; border-radius: 18px; }
  .sp-footer { padding: 12px 16px 14px; }
}
</style>
