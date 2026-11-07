<template>
  <!-- Full-page takeover, not a dialog: during first-run onboarding the
       AppLayout renders a bare router-view, so this is the only content
       on screen. Escape intentionally does nothing — the escape hatch
       is the always-visible Sign out. -->
  <main class="ob-root" aria-label="Set up your Cansee">
    <WatercolorBackdrop />

    <header class="ob-topbar">
      <div class="ob-topbar-left">
        <img src="/images/cansee-logo.png" alt="Cansee" class="ob-brand-mark" />
        <span class="ob-topbar-divider" aria-hidden="true"></span>
        <span v-if="email" class="ob-topbar-email">{{ email }}</span>
        <button type="button" class="ob-signout" @click="signOut">Sign out</button>
      </div>

      <div
        class="ob-progress"
        role="progressbar"
        aria-valuemin="1"
        :aria-valuemax="totalSteps"
        :aria-valuenow="displayStep"
        :aria-valuetext="`Step ${displayStep} of ${totalSteps}`"
      >
        <span class="ob-progress-label">{{ displayStep }} / {{ totalSteps }}</span>
        <div class="ob-progress-track">
          <span v-for="i in totalSteps" :key="i" class="ob-seg">
            <i class="ob-seg-fill" :class="{ 'is-on': i <= displayStep }" />
          </span>
        </div>
      </div>
    </header>

    <div class="ob-stage">
      <div ref="cardShell" class="ob-card-shell">
        <!-- Height morph: the observer measures the inner (natural
             height, never written to); the inline height lands on the
             outer and transitions between steps. out-in keeps the old
             pixel height during the swap so nothing collapses. -->
        <div class="ob-morph" :class="{ 'is-animated': morphAnimated }" :style="morphStyle">
          <div ref="morphInner" class="ob-morph-inner">
            <Transition
              :name="direction === 'back' ? 'ob-step-back' : 'ob-step'"
              mode="out-in"
              @after-enter="focusStep"
            >
              <WebsiteStep v-if="step === 0" key="website" />
              <BrandStep v-else-if="step === 1" key="brand" />
              <CompetitorsStep v-else-if="step === 2" key="competitors" />
              <PromptsStep v-else-if="step === 3" key="prompts" />
              <RunStep v-else-if="step === 4" key="run" />
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <footer class="ob-footer">
      <span>© 2026 Cansee</span>
      <nav class="ob-footer-links" aria-label="Legal and support">
        <!-- New tab on purpose: an in-flow navigation would throw away
             the wizard state. -->
        <a href="/support" target="_blank" rel="noopener">Support</a>
        <a href="/terms" target="_blank" rel="noopener">Terms</a>
        <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
      </nav>
    </footer>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useResizeObserver } from '@vueuse/core'

import { useAuthStore } from '@/stores/auth'
import { provideOnboardingFlow } from './useOnboardingFlow'
import WatercolorBackdrop from './WatercolorBackdrop.vue'
import WebsiteStep from './steps/WebsiteStep.vue'
import BrandStep from './steps/BrandStep.vue'
import CompetitorsStep from './steps/CompetitorsStep.vue'
import PromptsStep from './steps/PromptsStep.vue'
import RunStep from './steps/RunStep.vue'

const emit = defineEmits(['complete'])

const router = useRouter()
const auth = useAuthStore()

const flow = provideOnboardingFlow({ onComplete: () => emit('complete') })
const { step, direction, displayStep, totalSteps } = flow

const email = computed(() => auth.user?.email || '')

async function signOut() {
  try {
    await auth.logout()
  } catch (_) { /* clear locally regardless */ }
  router.replace('/login')
}

// ── Card height morph ────────────────────────────────────────────────
const cardShell = ref(null)
const morphInner = ref(null)
const morphHeight = ref(null)
const morphAnimated = ref(false)

useResizeObserver(morphInner, entries => {
  const entry = entries[0]
  if (!entry) return
  morphHeight.value = Math.ceil(entry.contentRect.height)
  if (!morphAnimated.value) {
    // Enable the transition only AFTER the first height has been
    // committed, so the card never animates up from 0 on mount. Two
    // rAFs: the first can fire before the inline style paints.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { morphAnimated.value = true })
    })
  }
})

const morphStyle = computed(() =>
  morphHeight.value == null ? {} : { height: `${morphHeight.value}px` },
)

// ── Focus management ─────────────────────────────────────────────────
// After each step's enter transition, move focus to its natural start:
// the marked input if the step has one, else the heading. preventScroll
// pairs with `overflow: clip` on the morph so focus can't yank the
// card mid-animation.
function focusStep() {
  const rootEl = cardShell.value
  if (!rootEl) return
  const target =
    rootEl.querySelector('[data-autofocus]') ||
    rootEl.querySelector('h1[tabindex="-1"]')
  target?.focus?.({ preventScroll: true })
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  // No enter transition on first render, so focus the initial step here.
  nextTick(focusStep)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<!-- Unscoped on purpose: the step components are children, and their
     shared design system lives here. Every class is .ob-prefixed and
     the custom properties are set on .ob-root, so nothing leaks. -->
<style>
.ob-root {
  --ob-bg: #ffffff;
  --ob-fg: #0a0a0a;
  /* A step darker than the old #6b6b6b: secondary copy stays clearly
     readable at a glance. */
  --ob-muted: #5d5d5d;
  --ob-border: rgba(10, 10, 10, 0.10);
  --ob-surface: #fafafa;
  --ob-accent: #ff6a2c;
  --ob-accent-soft: rgba(255, 106, 44, 0.10);
  --ob-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --ob-spring-strong: cubic-bezier(0.16, 1, 0.3, 1);
  /* Framer-style back-out: transforms overshoot a touch, then settle.
     Use for entrances and pops, never for opacity alone. */
  --ob-spring-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ob-label-font: 'Geist', 'Inter', system-ui, sans-serif;

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ob-root :focus-visible { outline-color: var(--ob-accent); }

/* ── Topbar (white on video) ─────────────────────────────────────── */
.ob-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px;
  color: #fff;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
  animation: ob-drop 450ms var(--ob-spring) 80ms both;
}
.ob-topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ob-brand-mark {
  width: auto; height: 17px; object-fit: contain; flex-shrink: 0;
  filter: brightness(0) invert(1);
}
.ob-brand-name { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
.ob-topbar-divider {
  width: 1px; height: 16px; background: rgba(255, 255, 255, 0.3);
  margin: 0 4px; flex-shrink: 0;
}
.ob-topbar-email {
  font-size: 12.5px; color: rgba(255, 255, 255, 0.65);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ob-signout {
  background: transparent; border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12.5px; font-weight: 600;
  cursor: pointer; padding: 4px 6px; border-radius: 6px;
  flex-shrink: 0;
  transition: color 0.2s;
}
.ob-signout:hover { color: #fff; text-decoration: underline; }

/* Segmented progress, Treasury-style. */
.ob-progress { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.ob-progress-label {
  font-family: var(--ob-label-font);
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.85);
}
.ob-progress-track { display: flex; gap: 6px; }
.ob-seg {
  display: block; width: 34px; height: 3px; border-radius: 999px;
  overflow: hidden; background: rgba(255, 255, 255, 0.28);
}
.ob-seg-fill {
  display: block; height: 100%; background: #fff;
  transform: scaleX(0); transform-origin: left;
  transition: transform 480ms var(--ob-spring-pop), box-shadow 480ms ease;
}
.ob-seg-fill.is-on {
  transform: scaleX(1);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.55);
}

/* ── Stage + card shell ──────────────────────────────────────────── */
.ob-stage {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px 16px;
}
.ob-card-shell {
  width: min(680px, calc(100vw - 32px));
  max-height: calc(100dvh - 140px);
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--ob-bg);
  color: var(--ob-fg);
  border-radius: 24px;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.35),
    0 8px 24px rgba(0, 0, 0, 0.18);
  font-feature-settings: 'cv11', 'ss01';
  animation: ob-card-in 650ms var(--ob-spring-pop) 140ms both;
}

/* ── Footer (legal links over the video) ─────────────────────────── */
.ob-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px 18px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  animation: ob-fade-in 0.8s ease 0.5s both;
}
.ob-footer-links { display: flex; gap: 20px; }
.ob-footer-links a {
  color: rgba(255, 255, 255, 0.78);
  text-decoration: none;
  transition: color 0.2s;
}
.ob-footer-links a:hover { color: #fff; text-decoration: underline; }
@keyframes ob-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* Height morph wrapper (see OnboardingFlow.vue script for the rules). */
.ob-morph { overflow: clip; }
.ob-morph.is-animated { transition: height 480ms var(--ob-spring); }
.ob-morph-inner { display: flow-root; }

/* ── Steps: shared layout + typography ───────────────────────────── */
.ob-step { padding: 44px 48px 40px; text-align: left; }

/* Blur-in reveal: each child materializes — rises, sharpens, and
   settles with a hint of scale. The blur is what sells the "rendered,
   not toggled" feel. */
.ob-stagger > * { animation: ob-rise 0.55s var(--ob-spring-strong) both; }
.ob-stagger > *:nth-child(2) { animation-delay: 0.07s; }
.ob-stagger > *:nth-child(3) { animation-delay: 0.14s; }
.ob-stagger > *:nth-child(4) { animation-delay: 0.21s; }
.ob-stagger > *:nth-child(5) { animation-delay: 0.28s; }
.ob-stagger > *:nth-child(6) { animation-delay: 0.35s; }
.ob-stagger > *:nth-child(7) { animation-delay: 0.42s; }

.ob-eyebrow {
  display: inline-block;
  font-family: var(--ob-label-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ob-muted);
  margin-bottom: 16px;
}
.ob-eyebrow::before {
  content: '';
  display: inline-block;
  width: 20px;
  height: 2px;
  border-radius: 1px;
  background: var(--ob-accent);
  margin-right: 10px;
  vertical-align: 3px;
}
.ob-title {
  /* App-standard face (Inter), bold and tightly tracked — matches the
     headline voice used across the product. */
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.1;
  font-weight: 600;
  letter-spacing: -0.025em;
  margin: 0 0 12px;
  outline: none;
}
.ob-sub {
  font-size: 15px;
  line-height: 1.6;
  color: var(--ob-muted);
  margin: 0 0 24px;
  max-width: 46ch;
}
.ob-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.ob-tnum { font-variant-numeric: tabular-nums; }

/* ── URL input pill ──────────────────────────────────────────────── */
.ob-input-wrap {
  display: flex;
  align-items: center;
  background: var(--ob-bg);
  border: 1px solid var(--ob-border);
  border-radius: 999px;
  padding: 6px 6px 6px 22px;
  transition: border-color 0.25s var(--ob-spring), box-shadow 0.25s var(--ob-spring), transform 0.25s var(--ob-spring);
}
.ob-input-wrap:focus-within {
  border-color: var(--ob-accent);
  box-shadow: 0 0 0 4px var(--ob-accent-soft);
  transform: translateY(-1px);
}
.ob-input-wrap.is-error {
  border-color: var(--ob-accent);
  animation: ob-shake 320ms ease;
}
.ob-input-prefix {
  color: var(--ob-muted);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
}
.ob-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  padding: 12px 12px;
  font-size: 16px;
  color: var(--ob-fg);
  font-family: inherit;
  min-width: 0;
}

/* ── CTA + links ─────────────────────────────────────────────────── */
.ob-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 999px;
  background: var(--ob-fg);
  color: var(--ob-bg);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: transform 0.25s var(--ob-spring-pop), background 0.25s var(--ob-spring), box-shadow 0.25s ease, opacity 0.2s;
}
.ob-cta svg { transition: transform 0.25s var(--ob-spring-pop); }
.ob-cta:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--ob-accent);
  box-shadow: 0 10px 24px rgba(255, 106, 44, 0.35);
}
.ob-cta:hover:not(:disabled) svg { transform: translateX(3px); }
.ob-cta:active:not(:disabled) { transform: translateY(0) scale(0.97); box-shadow: 0 4px 12px rgba(255, 106, 44, 0.25); }
.ob-cta:disabled { opacity: 0.5; cursor: not-allowed; }

.ob-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--ob-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}
.ob-link-btn:hover:not(:disabled) { color: var(--ob-fg); background: var(--ob-surface); }
.ob-link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ob-link-btn--tight {
  padding: 2px 6px;
  margin: -2px 0;
  font-size: 13px;
  color: var(--ob-fg);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ob-error { margin: 0; color: var(--ob-accent); font-size: 14px; line-height: 1.5; }
.ob-error-block { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.ob-error-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-left: -12px; }

/* ── Scan (step 1, while the homepage is read) ───────────────────── */
.ob-scan-head { display: flex; align-items: center; gap: 14px; }
.ob-scan-head .ob-title { min-width: 0; overflow-wrap: anywhere; }
.ob-scan-spinner { flex-shrink: 0; width: 18px; height: 18px; margin-bottom: 10px; color: var(--ob-accent); }
.ob-scan-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--ob-border);
}
.ob-scan-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px 2px;
  border-bottom: 1px solid var(--ob-border);
  font-size: 14px;
}
.ob-scan-mark { display: inline-grid; place-items: center; width: 20px; height: 20px; }
.ob-scan-ring {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid var(--ob-border);
}
.ob-scan-row.is-found .ob-scan-mark { color: var(--ob-accent); animation: ob-pop 320ms var(--ob-spring-pop) both; }
.ob-scan-row.is-missing .ob-scan-mark { color: var(--ob-muted); }
.ob-scan-label { font-weight: 500; }
.ob-scan-result { color: var(--ob-muted); text-align: right; animation: ob-fade-in 240ms ease both; }
.ob-scan-row.is-pending .ob-scan-result { animation: none; }

/* ── Inner surface card ──────────────────────────────────────────── */
.ob-card {
  margin-top: 6px;
  background: var(--ob-surface);
  border: 1px solid var(--ob-border);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.ob-field { display: flex; flex-direction: column; gap: 6px; position: relative; }
.ob-field--inline { flex-direction: row; align-items: center; gap: 12px; flex-wrap: wrap; }
.ob-label-row { display: flex; align-items: center; gap: 8px; }
.ob-label {
  font-family: var(--ob-label-font);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ob-muted);
}
/* An empty optional field: said, never filled in for the user. */
.ob-missing {
  font-size: 11px;
  line-height: 16px;
  color: var(--ob-muted);
  border: 1px solid var(--ob-border);
  border-radius: 999px;
  padding: 0 7px;
}
.ob-label-hint {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ob-muted);
  margin: -2px 0 0;
}
.ob-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ob-fg);
}
.ob-empty-note { margin: 0; font-size: 14px; }
.ob-field-error { margin: 0; font-size: 12.5px; color: var(--ob-accent); }
.ob-text-input {
  border: 1px solid var(--ob-border);
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 15px;
  color: var(--ob-fg);
  background: var(--ob-bg);
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s var(--ob-spring), box-shadow 0.2s var(--ob-spring);
}
.ob-text-input:focus {
  border-color: var(--ob-accent);
  box-shadow: 0 0 0 3px var(--ob-accent-soft);
}
.ob-text-input[aria-invalid='true'] { border-color: var(--ob-accent); }
.ob-text-input:disabled { opacity: 0.55; cursor: not-allowed; }
.ob-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
.ob-counter {
  position: absolute;
  right: 8px;
  bottom: -18px;
  font-size: 11px;
  color: var(--ob-muted);
}
.ob-readonly {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px dashed var(--ob-border);
  border-radius: 10px;
  font-size: 15px;
}
.ob-readonly-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Brand name with the site's logo beside it (brand step). */
.ob-name-row { display: flex; align-items: center; gap: 10px; }
.ob-name-input { flex: 1; min-width: 0; }
.ob-brand-logo {
  /* BrandLogo paints a loaded image on --muted; keep it on the tile. */
  --muted: var(--ob-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 1px solid var(--ob-border);
  border-radius: 10px;
  background: var(--ob-bg);
  overflow: hidden;
}

.ob-select { position: relative; display: inline-flex; }
.ob-select-input {
  padding-right: 36px;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}
.ob-select-icon {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  color: var(--ob-muted);
  pointer-events: none;
}

/* ── Chips (offerings) ───────────────────────────────────────────── */
.ob-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.ob-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 4px 4px 10px;
  border-radius: 999px;
  background: var(--ob-bg);
  border: 1px solid var(--ob-border);
  font-size: 13px;
  transition: transform 0.2s var(--ob-spring), border-color 0.2s;
}
.ob-chip:hover { border-color: var(--ob-accent); }
.ob-chip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-chip-x {
  background: transparent;
  border: none;
  color: var(--ob-muted);
  cursor: pointer;
  padding: 0 6px;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
  transition: background 0.15s, color 0.15s;
}
.ob-chip-x:hover { background: var(--ob-accent-soft); color: var(--ob-accent); }

/* ── Checkable rows (competitors + prompts) ──────────────────────── */
.ob-competitors,
.ob-prompts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 641px) {
  .ob-competitors { grid-template-columns: 1fr 1fr; }
}
.ob-competitor,
.ob-prompt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 8px 10px 12px;
  border: 1px solid var(--ob-border);
  border-radius: 10px;
  background: var(--ob-bg);
  transition: border-color 160ms var(--ob-spring), background 160ms var(--ob-spring), opacity 160ms ease;
}
.ob-competitor:hover:not(.is-locked),
.ob-prompt:hover:not(.is-locked) { border-color: var(--ob-accent); }
.ob-competitor.is-selected,
.ob-prompt.is-selected { background: var(--ob-accent-soft); border-color: var(--ob-accent); }
.ob-competitor.is-custom,
.ob-prompt.is-custom { border-style: dashed; }
.ob-competitor.is-locked,
.ob-prompt.is-locked { opacity: 0.55; }
.ob-check { width: 16px; height: 16px; margin: 0; accent-color: var(--ob-accent); flex-shrink: 0; cursor: pointer; }
.ob-check:disabled { cursor: not-allowed; }
.ob-competitor-label,
.ob-prompt-label {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.is-locked .ob-competitor-label,
.is-locked .ob-prompt-label { cursor: not-allowed; }

/* A first-letter monogram: no third-party logo requests. */
.ob-monogram {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ob-surface);
  border: 1px solid var(--ob-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--ob-fg);
}
.ob-competitor-body { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.ob-competitor-name {
  font-size: 14px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ob-competitor-domain {
  font-size: 12px; color: var(--ob-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ob-prompt-text { font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
.ob-row-remove {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--ob-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}
.ob-row-remove:hover { background: var(--ob-accent-soft); color: var(--ob-accent); }

/* "Add your own" rows */
.ob-add-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
  flex-wrap: wrap;
}
.ob-add-input { flex: 1; min-width: 0; }
.ob-add-input--narrow { max-width: 200px; }
.ob-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid var(--ob-border);
  background: var(--ob-bg);
  color: var(--ob-fg);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s var(--ob-spring), background 0.2s var(--ob-spring), color 0.2s;
}
.ob-add-btn:hover:not(:disabled) {
  border-color: var(--ob-accent);
  background: var(--ob-accent);
  color: var(--ob-bg);
}
.ob-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── First research summary ──────────────────────────────────────── */
.ob-summary {
  margin: 6px 0 0;
  border: 1px solid var(--ob-border);
  border-radius: 14px;
  background: var(--ob-surface);
  padding: 4px 20px;
}
.ob-summary-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ob-border);
  font-size: 14px;
  line-height: 1.5;
}
.ob-summary-row:first-child { border-top: 0; }
.ob-summary-row dt {
  font-family: var(--ob-label-font);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ob-muted);
  padding-top: 3px;
}
.ob-summary-row dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.ob-summary-row dd > span { display: block; }
.ob-summary-muted { color: var(--ob-muted); }
.ob-summary-list { margin: 0; padding-left: 18px; }
.ob-summary-list li + li { margin-top: 4px; }
.ob-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 106, 44, 0.35);
  background: var(--ob-accent-soft);
  font-size: 14px;
  line-height: 1.5;
}
.ob-run-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.ob-run-note { margin: 14px 0 0; font-size: 12.5px; color: var(--ob-muted); text-align: right; }

/* ── Step footer actions ─────────────────────────────────────────── */
.ob-step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.ob-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: ob-spin-cw 0.7s linear infinite;
  display: inline-block;
}

/* ── Step transitions (direction-aware, with depth) ──────────────── */
/* Leaving content recedes — shrinks a touch and softens — while the
   entering step slides in on a spring. Fast out, springy in. */
.ob-step-enter-active {
  transition: opacity 0.34s ease, transform 0.42s var(--ob-spring-pop), filter 0.34s ease;
}
.ob-step-leave-active {
  transition: opacity 0.16s ease, transform 0.2s ease, filter 0.16s ease;
}
.ob-step-enter-from { opacity: 0; transform: translateX(32px) scale(0.99); filter: blur(5px); }
.ob-step-leave-to   { opacity: 0; transform: translateX(-22px) scale(0.985); filter: blur(4px); }

.ob-step-back-enter-active {
  transition: opacity 0.34s ease, transform 0.42s var(--ob-spring-pop), filter 0.34s ease;
}
.ob-step-back-leave-active {
  transition: opacity 0.16s ease, transform 0.2s ease, filter 0.16s ease;
}
.ob-step-back-enter-from { opacity: 0; transform: translateX(-32px) scale(0.99); filter: blur(5px); }
.ob-step-back-leave-to   { opacity: 0; transform: translateX(22px) scale(0.985); filter: blur(4px); }

/* ── List add/remove/reflow (chips, competitors, prompts) ──────── */
/* TransitionGroup: new rows pop in on a spring, removed rows shrink
   away, and siblings glide (FLIP) into their new spots. */
.ob-list-enter-active {
  transition: opacity 0.28s ease, transform 0.38s var(--ob-spring-pop);
}
.ob-list-leave-active {
  transition: opacity 0.15s ease, transform 0.18s ease;
}
.ob-list-enter-from { opacity: 0; transform: scale(0.88) translateY(8px); }
.ob-list-leave-to   { opacity: 0; transform: scale(0.92); }
.ob-list-move { transition: transform 0.4s var(--ob-spring); }

/* ── Keyframes ───────────────────────────────────────────────────── */
@keyframes ob-drop {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ob-card-in {
  from { opacity: 0; transform: translateY(30px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ob-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.99); filter: blur(6px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes ob-pop {
  from { transform: scale(0.4); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes ob-spin-cw { to { transform: rotate(360deg); } }
@keyframes ob-shake {
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

/* ── Reduced motion: kill everything, show everything ────────────── */
@media (prefers-reduced-motion: reduce) {
  .ob-root *,
  .ob-root *::before,
  .ob-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .ob-stagger > * { animation: none; opacity: 1; transform: none; }
  .ob-morph.is-animated { transition: none; }
}

/* ── Mobile ──────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .ob-topbar { padding: 14px 16px; }
  .ob-topbar-email { display: none; }
  .ob-topbar-divider { display: none; }
  .ob-seg { width: 22px; }
  .ob-stage { padding: 8px 12px 20px; }
  .ob-card-shell {
    width: calc(100vw - 24px);
    border-radius: 18px;
    max-height: calc(100dvh - 96px);
  }
  .ob-step { padding: 28px 22px 30px; }
  .ob-input-wrap { border-radius: 16px; flex-wrap: wrap; padding: 6px; }
  .ob-input-prefix { padding-left: 12px; }
  .ob-input { padding: 12px 8px; }
  .ob-add-input--narrow { max-width: none; }
  .ob-summary { padding: 4px 16px; }
  .ob-summary-row { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .ob-step-actions { flex-wrap: wrap; }
  .ob-run-actions { flex: 1 1 auto; }
  .ob-run-note { text-align: left; }
}
</style>
