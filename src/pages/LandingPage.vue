<template>
  <div class="lp">
    <!-- ═══ Nav ═══ -->
    <header class="lp-nav lp-wrap">
      <router-link to="/" class="lp-home" aria-label="Cansee home" @click="closeAll">
        <img src="/images/cansee-logo.png" alt="Cansee" class="lp-logo" />
      </router-link>

      <nav class="lp-links" aria-label="Primary">
        <div
          v-for="menu in menus"
          :key="menu.key"
          class="lp-dd"
          @pointerenter="hoverMenu(menu.key, $event)"
          @pointerleave="leaveMenu($event)"
        >
          <button
            type="button"
            class="lp-link"
            :aria-expanded="openMenu === menu.key ? 'true' : 'false'"
            :aria-controls="`lp-menu-${menu.key}`"
            @click="toggleMenu(menu.key)"
          >
            {{ menu.label }}
            <ChevronsUpDown class="lp-link-caret" aria-hidden="true" />
          </button>
          <Transition name="lp-pop">
            <div v-show="openMenu === menu.key" :id="`lp-menu-${menu.key}`" class="lp-dd-panel">
              <router-link
                v-for="item in menu.items"
                :key="item.label"
                :to="item.to"
                class="lp-dd-item"
                @click="closeAll"
              >
                <span class="lp-dd-label">{{ item.label }}</span>
                <span class="lp-dd-blurb">{{ item.blurb }}</span>
              </router-link>
            </div>
          </Transition>
        </div>
      </nav>

      <div class="lp-actions">
        <router-link to="/pricing" class="lp-pricing">Pricing</router-link>
        <router-link to="/login" class="lp-start">Sign in</router-link>
        <button
          type="button"
          class="lp-burger"
          :aria-expanded="navOpen ? 'true' : 'false'"
          aria-controls="lp-sheet"
          :aria-label="navOpen ? 'Close menu' : 'Open menu'"
          @click="navOpen = !navOpen"
        >
          <X v-if="navOpen" aria-hidden="true" />
          <Menu v-else aria-hidden="true" />
        </button>
      </div>

      <Transition name="lp-pop">
        <div v-show="navOpen" id="lp-sheet" class="lp-sheet">
          <div v-for="menu in menus" :key="menu.key" class="lp-sheet-group">
            <span class="lp-sheet-label">{{ menu.label }}</span>
            <router-link v-for="item in menu.items" :key="item.label" :to="item.to" @click="closeAll">
              {{ item.label }}
            </router-link>
          </div>
          <div class="lp-sheet-group">
            <router-link to="/pricing" @click="closeAll">Pricing</router-link>
            <router-link to="/login" @click="closeAll">Sign in</router-link>
          </div>
        </div>
      </Transition>
    </header>

    <div class="lp-wrap"><div class="lp-rule" aria-hidden="true"></div></div>

    <main class="lp-main lp-wrap">
      <!-- ═══ Hero ═══ -->
      <div class="lp-hero cs-card cs-contrast">
        <div class="lp-hero-inner">
          <router-link to="/docs#engines" class="lp-pill">
            <span class="lp-pill-long">ChatGPT · Claude · Gemini · Grok · Perplexity</span>
            <span class="lp-pill-short">Five AI engines, one dashboard</span>
            <span class="lp-pill-go" aria-hidden="true"><ArrowRight /></span>
          </router-link>

          <h1 class="lp-title">
            See your brand the way AI sees it,<br class="lp-br" />
            then shape what it says
          </h1>

          <p class="lp-sub">
            Your buyers ask ChatGPT, Claude, Gemini, Grok, and Perplexity before they
            ever reach your site. Cansee shows you what those answers say about you,
            who they recommend instead, and what to publish to change it.
          </p>

          <div class="lp-ctas">
            <router-link to="/login" class="lp-btn lp-btn--solid">
              Sign in
              <ArrowRight class="lp-btn-icon" aria-hidden="true" />
            </router-link>
            <router-link to="/docs" class="lp-btn lp-btn--ghost">Read the docs</router-link>
          </div>
        </div>
      </div>

      <div class="lp-rule lp-rule--hero" aria-hidden="true"></div>

      <!-- ═══ The whole pitch ═══ -->
      <section class="lp-pitch" aria-labelledby="lp-pitch-title">
        <div class="lp-pitch-head">
          <span class="lp-dots lp-dots--left" aria-hidden="true"></span>
          <div class="lp-pitch-copy">
            <span class="lp-eyebrow">The one-page rule</span>
            <h2 id="lp-pitch-title" class="lp-pitch-title">
              If you can't explain your business on a single page, something's wrong.
              <span>Here's ours.</span>
            </h2>
          </div>
          <span class="lp-dots lp-dots--right" aria-hidden="true"></span>
        </div>

        <ol class="lp-steps">
          <li v-for="(step, i) in steps" :key="step.title" class="lp-step">
            <span class="lp-step-num">{{ String(i + 1).padStart(2, '0') }}</span>
            <h3 class="lp-step-title">{{ step.title }}</h3>
            <p class="lp-step-desc">{{ step.desc }}</p>
          </li>
        </ol>
      </section>
    </main>

    <!-- ═══ Footer ═══ -->
    <footer class="lp-foot lp-wrap">
      <span>© 2026 Cansee, Inc.</span>
      <nav class="lp-foot-links" aria-label="Legal">
        <router-link v-for="l in footerLinks" :key="l.to" :to="l.to">{{ l.label }}</router-link>
        <!-- Reopens the Cookiebot consent dialog. Only rendered when a
             Cookiebot domain ID is configured (see index.html). -->
        <button
          v-if="cookiebotConfigured"
          type="button"
          class="lp-foot-btn"
          @click="renewCookieConsent"
        >Cookie settings</button>
      </nav>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ArrowRight, ChevronsUpDown, Menu, X } from '@lucide/vue'
import { useForcedTheme } from '@/composables/useForcedTheme'

useForcedTheme('dark')

// Nav menus. Product and Docs deep-link into the matching /docs sections,
// so the landing page itself stays one screen.
const menus = [
  {
    key: 'product',
    label: 'Product',
    items: [
      { label: 'Analytics', blurb: 'One board: your Google rank against five AI engines, prompt by prompt.', to: '/docs#overview' },
      { label: 'Prompt detail', blurb: 'Each engine next to Google, and what to change.', to: '/docs#prompt' },
      { label: 'Citations', blurb: 'The pages AI pulls up while answering.', to: '/docs#sources' },
      { label: 'Brand facts', blurb: 'What is true about you, checked against the answers.', to: '/docs#brand-facts' },
    ],
  },
  {
    key: 'docs',
    label: 'Docs',
    items: [
      { label: 'What Cansee does', blurb: 'The short version.', to: '/docs#welcome' },
      { label: 'Quick start', blurb: 'From your website to your first comparison.', to: '/docs#quickstart' },
      { label: 'How the gap is scored', blurb: 'Search score, AI score and the gap between them.', to: '/docs#scoring' },
      { label: 'Glossary', blurb: 'Every term, in plain words.', to: '/docs#glossary' },
    ],
  },
  {
    key: 'resources',
    label: 'Resources',
    items: [
      { label: 'Blog', blurb: 'Guides on AI search visibility and GEO.', to: '/blog' },
      { label: 'About', blurb: 'What Cansee does and who runs it.', to: '/about' },
      { label: 'Contact', blurb: 'The right address for your question.', to: '/contact' },
    ],
  },
]

// The whole product in four lines. If it stops fitting here, the product
// got less clear, not the page too small.
const steps = [
  { title: 'Ask', desc: 'Cansee puts the questions your customers ask to five AI engines, on a schedule, without ever naming you.' },
  { title: 'Measure', desc: 'Visibility, position, sentiment, and share of voice, plus the brands recommended instead of you.' },
  { title: 'Trace', desc: 'The domains and pages each engine cites, so you know where a mention would move you most.' },
  { title: 'Act', desc: 'What to change for each prompt and which pages to work on, plus a flag when an AI answer gets your facts wrong.' },
]

const footerLinks = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Cookies', to: '/cookies' },
  { label: 'DPA', to: '/dpa' },
  { label: 'Responsible AI', to: '/ai-policy' },
  { label: 'Support', to: '/support' },
]

/* ── Menus ──
   Mouse users get hover; touch and keyboard users toggle with a click.
   Escape or a click anywhere else closes everything. */
const openMenu = ref(null)
const navOpen = ref(false)

function toggleMenu(key) {
  openMenu.value = openMenu.value === key ? null : key
}
function hoverMenu(key, ev) {
  if (ev.pointerType === 'mouse') openMenu.value = key
}
function leaveMenu(ev) {
  if (ev.pointerType === 'mouse') openMenu.value = null
}
function closeAll() {
  openMenu.value = null
  navOpen.value = false
}

function onKeydown(ev) {
  if (ev.key === 'Escape') closeAll()
}
function onPointerDown(ev) {
  if (!ev.target.closest('.lp-dd, .lp-burger, .lp-sheet')) closeAll()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})

/* ── Cookie consent (Cookiebot / Usercentrics) ──
   The banner itself loads from index.html when VITE_COOKIEBOT_CBID is set. */
const cookiebotConfigured = Boolean(import.meta.env.VITE_COOKIEBOT_CBID)
function renewCookieConsent() {
  if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') {
    window.Cookiebot.renew()
  }
}
</script>

<style scoped>
.lp {
  /* The page wears the app tokens (it is forced dark): black page, a
     light hero card, ink and grays, the accent on the eyebrows only. */
  --lp-bg: var(--background);
  --lp-ink: var(--foreground);
  --lp-muted: var(--muted-foreground);
  --lp-faint: var(--subtle-foreground);
  --lp-line: var(--border);
  --lp-panel: var(--card);
  --lp-accent: var(--signal-text);

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  background: var(--lp-bg);
  color: var(--lp-ink);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.lp a,
.lp a:hover {
  opacity: 1;
}

/* base.css's unlayered *:focus-visible rule also forces a small
   border-radius; keep each control's own shape when it takes focus. */
.lp-link:focus-visible,
.lp-start:focus-visible,
.lp-burger:focus-visible,
.lp-pill:focus-visible,
.lp-btn:focus-visible {
  border-radius: var(--radius);
}

.lp-dd-item:focus-visible {
  border-radius: var(--radius);
}

.lp-wrap {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ── Nav ── */
.lp-nav {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 76px;
}

.lp-home {
  display: inline-flex;
  padding: 4px 0;
}

.lp-logo {
  display: block;
  height: 22px;
  width: auto;
  /* The wordmark ships dark slate; the token renders it in the page ink. */
  filter: var(--logo-filter);
}

.lp-links {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
}

.lp-dd {
  position: relative;
}

.lp-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: var(--lp-ink);
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.lp-link:hover,
.lp-link[aria-expanded='true'] {
  background: var(--muted);
  color: var(--foreground);
}

.lp-link-caret {
  width: 14px;
  height: 14px;
  opacity: 0.55;
}

/* Sits flush under the trigger (padding-top bridges the gap) so the
   pointer can travel from trigger to panel without closing it. */
.lp-dd-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  width: 340px;
  padding-top: 10px;
}

.lp-dd-panel::before {
  content: '';
  position: absolute;
  inset: 10px 0 0;
  z-index: -1;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--lp-panel);
  box-shadow: none;
}

.lp-dd-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px;
  padding: 10px 12px;
  border-radius: var(--radius);
  transition: background 0.15s ease;
}

.lp-dd-item:hover,
.lp-dd-item:focus-visible {
  background: var(--muted);
}

.lp-dd-label {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.lp-dd-blurb {
  color: var(--lp-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
}

.lp-actions {
  display: flex;
  align-items: center;
  gap: 22px;
}

.lp-start {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.lp-start:hover {
  background: var(--muted);
  border-color: var(--input);
}

/* Pricing, beside Sign in: a plain text link. */
.lp-pricing {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 4px;
  color: var(--lp-ink);
  font-size: 15px;
  font-weight: 500;
  transition: color 0.15s ease;
}

.lp-pricing:hover {
  color: var(--foreground);
}

.lp-pricing:focus-visible {
  border-radius: var(--radius);
}

.lp-burger {
  display: none;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
}

.lp-burger svg {
  width: 18px;
  height: 18px;
}

.lp-sheet {
  position: absolute;
  top: 72px;
  left: 16px;
  right: 16px;
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--lp-panel);
  box-shadow: none;
}

.lp-sheet-group {
  display: grid;
  padding: 6px 0;
}

.lp-sheet-group + .lp-sheet-group {
  border-top: 1px solid var(--border);
}

.lp-sheet-label {
  padding: 6px 12px 4px;
  color: var(--lp-faint);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  font-family: var(--font-mono);
  text-transform: uppercase;
}

.lp-sheet a {
  padding: 9px 12px;
  border-radius: var(--radius);
  color: var(--lp-ink);
  font-size: 15px;
}

.lp-sheet a:hover {
  background: var(--muted);
}

/* Hairline rule. */
.lp-rule {
  height: 1px;
  background: var(--lp-line);
}

/* ── Hero ── */
.lp-main {
  flex: 1;
}

.lp-hero {
  margin-top: 12px;
}

.lp-hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: clamp(420px, 52vh, 600px);
  padding: 44px 32px;
  text-align: center;
}

.lp-pill {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 5px 5px 5px 20px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--foreground);
  font-size: 15px;
  font-weight: 500;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.lp-pill:hover {
  background: var(--muted);
  border-color: var(--input);
}

.lp-pill-short {
  display: none;
}

.lp-pill-go {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 0;
  background: var(--signal);
  color: var(--signal-foreground);
  transition: transform 0.2s ease;
}

.lp-pill:hover .lp-pill-go {
  transform: translateX(2px);
}

.lp-pill-go svg {
  width: 16px;
  height: 16px;
}

.lp-title {
  max-width: 1120px;
  margin: 28px auto 0;
  color: var(--foreground);
  font-size: clamp(2.3rem, 4.5vw, 4.25rem);
  font-family: var(--font-display);
  font-weight: 500;
  line-height: 1.04;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.lp-sub {
  max-width: 47rem;
  margin: 20px auto 0;
  color: var(--foreground);
  font-size: clamp(1.02rem, 1.3vw, 1.2rem);
  line-height: 1.65;
  text-wrap: pretty;
}

.lp-ctas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 32px;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 54px;
  padding: 0 28px;
  border-radius: var(--radius);
  font-size: 17px;
  font-weight: 600;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.lp-btn:active {
  transform: scale(0.98);
}

.lp-btn--solid {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.lp-btn--solid:hover {
  background: transparent;
  color: var(--primary);
}

.lp-btn--ghost {
  border: 1px solid var(--input);
  color: var(--foreground);
}

.lp-btn--ghost:hover {
  border-color: var(--foreground);
  background: var(--muted);
  color: var(--foreground);
}

.lp-btn-icon {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}

.lp-btn--solid:hover .lp-btn-icon {
  transform: translateX(2px);
}

/* ── The whole pitch ── */
.lp-rule--hero {
  margin-top: 16px;
}

.lp-pitch-head {
  display: grid;
  grid-template-columns: 168px 1fr 168px;
  align-items: start;
  gap: 24px;
  padding-top: 18px;
}

/* Empty gutters either side of the pitch copy. */
.lp-dots {
  height: 56px;
}

.lp-pitch-copy {
  text-align: center;
}

.lp-eyebrow {
  color: var(--lp-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lp-pitch-title {
  max-width: 1000px;
  margin: 10px auto 0;
  color: var(--lp-ink);
  font-size: clamp(1.1rem, 1.45vw, 1.35rem);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.lp-pitch-title span {
  color: var(--lp-muted);
}

.lp-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.lp-step {
  position: relative;
  padding: 12px 26px 6px;
}

.lp-step + .lp-step::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 6px;
  left: 0;
  width: 1px;
  background: var(--lp-line);
}

.lp-step-num {
  color: var(--lp-faint);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.lp-step-title {
  margin-top: 8px;
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.lp-step-desc {
  margin-top: 6px;
  color: var(--lp-muted);
  font-size: 14.5px;
  line-height: 1.6;
}

/* ── Footer ── */
.lp-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding-top: 14px;
  padding-bottom: 18px;
  color: var(--lp-faint);
  font-size: 13px;
}

.lp-foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
}

.lp-foot-links a,
.lp-foot-btn {
  color: var(--lp-faint);
  font: inherit;
  font-weight: 400;
  transition: color 0.15s ease;
}

.lp-foot-btn {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.lp-foot-links a:hover,
.lp-foot-btn:hover {
  color: var(--foreground);
}

/* ── Motion ── */
.lp-pop-enter-active,
.lp-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.lp-pop-enter-from,
.lp-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .lp-pop-enter-active,
  .lp-pop-leave-active {
    transition: none;
  }
}

/* ── Responsive ── */
@media (max-width: 1080px) {
  .lp-links {
    display: none;
  }
  .lp-burger {
    display: grid;
  }
  .lp-actions {
    gap: 10px;
  }
  .lp-pitch-head {
    grid-template-columns: 1fr;
  }
  .lp-dots {
    display: none;
  }
  .lp-steps {
    grid-template-columns: repeat(2, 1fr);
  }
  .lp-step:nth-child(3)::before {
    display: none;
  }
}

@media (max-width: 720px) {
  .lp-wrap {
    padding: 0 16px;
  }
  .lp-hero-inner {
    min-height: 0;
    padding: 56px 20px;
  }
  .lp-br {
    display: none;
  }
  .lp-pill-long {
    display: none;
  }
  .lp-pill-short {
    display: inline;
  }
  .lp-ctas {
    flex-direction: column;
    align-self: stretch;
  }
  .lp-steps {
    grid-template-columns: 1fr;
  }
  .lp-step {
    padding: 16px 4px 8px;
  }
  .lp-step + .lp-step::before {
    display: none;
  }
  .lp-step + .lp-step {
    border-top: 1px dashed var(--lp-line);
  }
  .lp-foot {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 420px) {
  .lp-start,
  .lp-pricing {
    display: none;
  }
}
</style>
