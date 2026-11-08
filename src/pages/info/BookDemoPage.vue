<template>
  <InfoPage
    title="Book a demo"
    eyebrow="Talk to Cansee"
    intro="A 30-minute call with the team. We run a live AI visibility check on your brand and walk through what ChatGPT, Claude, Gemini and Perplexity say about you and your competitors."
  >
    <div class="demo-cta">
      <a
        :href="DEMO_BOOKING_HREF"
        class="demo-btn"
        :target="DEMO_BOOKING_EXTERNAL ? '_blank' : null"
        :rel="DEMO_BOOKING_EXTERNAL ? 'noopener noreferrer' : null"
      >
        {{ DEMO_BOOKING_EXTERNAL ? 'Pick a time' : 'Request a demo by email' }}
      </a>
      <p class="demo-note">
        <template v-if="DEMO_BOOKING_EXTERNAL">
          Opens our scheduling page in a new tab. Prefer email? Write to
          <a :href="mailto">{{ DEMO_SALES_EMAIL }}</a>.
        </template>
        <template v-else>
          Send us your company name and website and we will reply with a few
          times that work.
        </template>
      </p>
    </div>

    <h2>What we cover</h2>
    <ul>
      <li>A live prompt run on your brand across the major AI assistants.</li>
      <li>Where competitors are recommended instead of you, and why.</li>
      <li>Which sources the models cite, and which ones you can influence.</li>
      <li>Plans for teams, agencies and white-label reporting.</li>
    </ul>

    <h2>Before the call</h2>
    <p>
      Have your website URL and two or three competitors ready. That is all we
      need to prepare a sample report.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
import {
  DEMO_BOOKING_HREF,
  DEMO_BOOKING_EXTERNAL,
  DEMO_SALES_EMAIL,
  demoMailtoHref,
} from '@/constants/demo'

const mailto = demoMailtoHref()
</script>

<style scoped>
.demo-cta {
  margin: 28px 0 8px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
}
.demo-btn {
  display: inline-block;
  padding: 12px 22px;
  border-radius: 999px;
  background: #1a1a2e;
  color: #ffffff;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  transition: opacity 0.2s ease;
}
.demo-btn:hover { opacity: 0.85; }
.demo-btn:focus-visible { outline: 2px solid #1a1a2e; outline-offset: 3px; }
.demo-note {
  margin: 14px 0 0;
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
