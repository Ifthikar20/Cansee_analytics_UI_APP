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
        aria-valuemax="4"
        :aria-valuenow="displayStep"
        :aria-valuetext="`Step ${displayStep} of 4`"
      >
        <span class="ob-progress-label">{{ displayStep }} / 4</span>
        <div class="ob-progress-track">
          <span v-for="i in 4" :key="i" class="ob-seg">
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
              <WelcomeStep v-if="step === 0" key="welcome" />
              <UrlStep v-else-if="step === 1" key="url" />
              <ScanningStep v-else-if="step === 2" key="scanning" />
              <DescribeStep v-else-if="step === 3" key="describe" />
              <CompetitorsStep v-else-if="step === 4" key="competitors" />
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
import WelcomeStep from './steps/WelcomeStep.vue'
import UrlStep from './steps/UrlStep.vue'
import ScanningStep from './steps/ScanningStep.vue'
import DescribeStep from './steps/DescribeStep.vue'
import CompetitorsStep from './steps/CompetitorsStep.vue'

const emit = defineEmits(['complete'])

const router = useRouter()
const auth = useAuthStore()

const flow = provideOnboardingFlow({ onComplete: () => emit('complete') })
const { step, direction, displayStep } = flow

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
.ob-step--scanning { text-align: center; }

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
.ob-step--scanning .ob-sub { margin-left: auto; margin-right: auto; }

/* ── Welcome: editorial mini-index ───────────────────────────────── */
.ob-index { list-style: none; margin: 4px 0 28px; padding: 0; }
.ob-index-item {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 12px 6px 12px 2px;
  border-top: 1px solid var(--ob-border);
  font-size: 14px;
  transition: background 0.25s var(--ob-spring), padding-left 0.25s var(--ob-spring);
}
.ob-index-item:last-child { border-bottom: 1px solid var(--ob-border); }
.ob-index-item:hover { background: var(--ob-surface); padding-left: 8px; }
.ob-index-num {
  font-family: var(--ob-label-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ob-accent);
}
.ob-index-label { font-weight: 500; }

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
.ob-link-btn:hover { color: var(--ob-fg); background: var(--ob-surface); }

.ob-error { margin-top: 14px; color: var(--ob-accent); font-size: 14px; }
.ob-hints {
  margin-top: 22px;
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--ob-muted);
}
.ob-hints kbd {
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  border: 1px solid var(--ob-border);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--ob-surface);
}
.ob-dot-sep { opacity: 0.5; }

/* ── Scanning: favicon scanner ───────────────────────────────────── */
.ob-scanner { position: relative; width: 120px; height: 120px; margin: 0 auto 24px; }
.ob-orbit-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 1px solid var(--ob-border);
  transform: translate(-50%, -50%);
}
.ob-orbit-r1 { width: 76px; height: 76px; animation: ob-spin 6s linear infinite; }
.ob-orbit-r2 { width: 102px; height: 102px; animation: ob-spin 9s linear reverse infinite; border-color: rgba(255, 106, 44, 0.35); }
.ob-scan-sweep {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0 76%, rgba(255, 106, 44, 0.25) 90%, var(--ob-accent) 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  animation: ob-spin-cw 2.4s linear infinite;
}
.ob-scan-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--ob-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  animation: ob-core-float 3.6s ease-in-out infinite alternate;
}
@keyframes ob-core-float {
  from { transform: translate(-50%, -54%); }
  to   { transform: translate(-50%, -46%); }
}
.ob-scan-core img { width: 28px; height: 28px; object-fit: contain; }
.ob-scan-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ob-accent);
  box-shadow: 0 0 24px var(--ob-accent);
  animation: ob-pulse 1.6s ease-in-out infinite;
}

/* ── Inner surface card (describe + competitors) ─────────────────── */
.ob-card {
  margin-top: 6px;
  background: var(--ob-surface);
  border: 1px solid var(--ob-border);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ob-field { display: flex; flex-direction: column; gap: 6px; position: relative; }
.ob-label {
  font-family: var(--ob-label-font);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ob-muted);
}
.ob-label-hint {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--ob-muted);
  margin-top: -2px;
}
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
.ob-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
.ob-counter {
  position: absolute;
  right: 8px;
  bottom: -18px;
  font-size: 11px;
  color: var(--ob-muted);
}

/* ── Topics ──────────────────────────────────────────────────────── */
.ob-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  border-radius: 999px;
  background: var(--ob-bg);
  border: 1px solid var(--ob-border);
  font-size: 13px;
  transition: transform 0.2s var(--ob-spring), border-color 0.2s;
}
.ob-chip:hover { border-color: var(--ob-accent); }
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

/* Each topic row stacks the chip with a small "vs Brand1, Brand2"
   sub-label so the user can see who they're being benchmarked against
   per topic. */
.ob-topics { display: flex; flex-direction: column; gap: 8px; }
.ob-topic-row { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.ob-topic-vs {
  font-size: 11px;
  color: var(--ob-muted);
  letter-spacing: 0.01em;
  padding-left: 10px;
}

/* ── Competitors ─────────────────────────────────────────────────── */
.ob-competitors { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 641px) {
  .ob-competitors { grid-template-columns: 1fr 1fr; }
}
.ob-competitor {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--ob-border);
  border-radius: 10px;
  background: var(--ob-bg);
  cursor: pointer;
  transition: border-color 160ms var(--ob-spring), background 160ms var(--ob-spring);
}
.ob-competitor:hover { border-color: var(--ob-accent); }
.ob-competitor.is-selected { background: var(--ob-accent-soft); border-color: var(--ob-accent); }
.ob-competitor.is-custom { border-style: dashed; }
.ob-competitor-check { width: 16px; height: 16px; accent-color: var(--ob-accent); flex-shrink: 0; }
.ob-competitor-label {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

/* Logo block: fixed 24x24 round container. img fills; if both
   external sources fail we render a circled initial via the fallback
   span. */
.ob-competitor-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--ob-surface);
  border: 1px solid var(--ob-border);
  overflow: hidden;
  flex-shrink: 0;
}
.ob-competitor-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}
.ob-competitor-logo-fallback {
  font-size: 11px;
  font-weight: 600;
  color: var(--ob-fg);
}
.ob-competitor-body { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.ob-competitor-name {
  font-size: 14px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ob-competitor-domain {
  font-size: 12px; color: var(--ob-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ob-competitor-remove {
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
.ob-competitor-remove:hover { background: var(--ob-accent-soft); color: var(--ob-accent); }

/* "Add your own" rows */
.ob-add-competitor,
.ob-add-topic {
  margin-top: 12px;
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

/* ── Step footer actions ─────────────────────────────────────────── */
.ob-step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
}
.ob-step-actions--start { justify-content: flex-start; }

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

/* ── List add/remove/reflow (topics + competitors) ───────────────── */
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
@keyframes ob-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.25); opacity: 0.8; }
}
@keyframes ob-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
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
}
</style>
