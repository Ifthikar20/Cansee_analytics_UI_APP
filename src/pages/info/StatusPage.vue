<template>
  <InfoPage title="System status" eyebrow="Live" intro="Real-time health of the Cansee platform. Detailed incident history available on request.">
    <h2>Components</h2>
    <div class="status-row">
      <span><strong>API</strong> &middot; api.cansee.ai</span>
      <span class="status-pill">Operational</span>
    </div>
    <div class="status-row">
      <span><strong>Web app</strong> &middot; cansee.ai</span>
      <span class="status-pill">Operational</span>
    </div>
    <div class="status-row">
      <span><strong>LLM probing</strong> &middot; ChatGPT / Claude / Gemini / Perplexity</span>
      <span class="status-pill">Operational</span>
    </div>
    <div class="status-row">
      <span><strong>Background workers</strong> &middot; Celery</span>
      <span class="status-pill">Operational</span>
    </div>

    <h2>Recent incidents</h2>
    <p>No incidents reported in the last 30 days.</p>

    <h2>Subscribe</h2>
    <p>
      For proactive notifications, email
      <a href="mailto:status@cansee.ai?subject=Subscribe%20to%20status%20updates">status@cansee.ai</a>
      and we'll add you to the alert list.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
</script>
