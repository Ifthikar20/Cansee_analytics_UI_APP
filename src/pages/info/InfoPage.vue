<template>
  <div class="info-page">
    <header class="info-header">
      <router-link to="/" class="info-logo">
        <img src="/images/cansee-logo.png" alt="Cansee" style="height:22px;width:auto" />
      </router-link>
      <div class="info-nav">
        <router-link to="/">Home</router-link>
        <router-link to="/login" class="info-cta">Sign in</router-link>
      </div>
    </header>

    <main class="info-content">
      <div class="info-meta" v-if="eyebrow || updated">
        <span v-if="eyebrow" class="info-badge">{{ eyebrow }}</span>
        <span v-if="updated" class="info-date">Last updated: {{ updated }}</span>
      </div>
      <h1>{{ title }}</h1>
      <p v-if="intro" class="info-intro">{{ intro }}</p>
      <slot />
    </main>

    <footer class="info-footer">
      <span>© 2026 Cansee</span>
      <div class="info-footer-links">
        <router-link to="/terms">Terms</router-link>
        <router-link to="/privacy">Privacy</router-link>
        <a :href="`mailto:${GENERAL_EMAIL}`">{{ GENERAL_EMAIL }}</a>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { GENERAL_EMAIL } from '@/constants/support'

defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  intro: { type: String, default: '' },
  updated: { type: String, default: '' },
})
</script>

<style scoped>
.info-page {
  min-height: 100vh;
  background: #fafafa;
  color: #1a1a2e;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}
.info-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 1.1rem;
  color: #1a1a2e;
  text-decoration: none;
}
.info-nav { display: flex; align-items: center; gap: 20px; }
.info-nav a {
  font-size: 0.875rem;
  color: #6b7280;
  text-decoration: none;
  font-weight: 500;
}
.info-nav a:hover { color: #1a1a2e; }
.info-cta {
  padding: 8px 18px;
  border-radius: 8px;
  background: #1a1a2e;
  color: #ffffff !important;
}
.info-cta:hover { background: #2d2d44; color: #ffffff !important; }

.info-content {
  max-width: 780px;
  margin: 0 auto;
  padding: 48px 24px 80px;
  line-height: 1.75;
}

.info-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.info-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #ff6b35;
  background: rgba(255, 107, 53, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
}
.info-date { font-size: 0.875rem; color: #9ca3af; }

h1 {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 16px;
  letter-spacing: -0.02em;
}
.info-intro {
  font-size: 1.05rem;
  color: #4b5563;
  margin-bottom: 24px;
}

:slotted(h2) {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 36px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
  color: #1a1a2e;
}
:slotted(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 20px 0 8px;
  color: #1a1a2e;
}
:slotted(p) { margin-bottom: 12px; color: #4b5563; }
:slotted(ul), :slotted(ol) { padding-left: 24px; margin-bottom: 16px; }
:slotted(li) { margin-bottom: 6px; color: #4b5563; }
:slotted(a) { color: #ff6b35; text-decoration: underline; text-underline-offset: 2px; }
:slotted(strong) { color: #1a1a2e; }
:slotted(.info-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin: 16px 0 24px;
}
:slotted(.info-grid > div) {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
}
:slotted(.info-grid h4) {
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: #1a1a2e;
}
:slotted(.info-grid p) { font-size: 0.9rem; margin: 0; }
:slotted(.info-grid p + p) { margin-top: 6px; }

.info-footer {
  border-top: 1px solid #e5e7eb;
  padding: 24px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #9ca3af;
}
.info-footer-links { display: flex; gap: 20px; }
.info-footer-links a {
  color: #9ca3af;
  text-decoration: none;
  font-weight: 500;
}
.info-footer-links a:hover { color: #1a1a2e; }

@media (max-width: 640px) {
  .info-header { padding: 12px 16px; }
  .info-content { padding: 32px 16px 60px; }
  h1 { font-size: 1.6rem; }
  .info-footer { flex-direction: column; gap: 12px; text-align: center; }
}
</style>
