<template>
  <InfoPage title="Changelog" eyebrow="Product updates" intro="Everything we ship — bug fixes, model upgrades, new modules — in one timeline.">
    <h2>v2.1 · May 2026</h2>
    <ul>
      <li><strong>Source Influence</strong> — per-provider source-mix breakdown with citation confidence scoring.</li>
      <li><strong>Auth screens</strong> — refreshed sidebar, light-only theme for sign-in flows.</li>
      <li><strong>Performance</strong> — landing page no longer scrolls horizontally on wide displays.</li>
    </ul>

    <h2>v2.0 · March 2026</h2>
    <ul>
      <li><strong>Brand Vault</strong> (now Brand Ingestion) — a verified-fact knowledge base that every AI answer is checked against.</li>
      <li><strong>Multi-LLM Probing</strong> — added Perplexity and Gemini providers alongside Claude and GPT-4.</li>
      <li><strong>Prompt Library</strong> — typewriter previews, intent buckets, and saved-prompt re-runs.</li>
    </ul>

    <h2>v1.4 · January 2026</h2>
    <ul>
      <li>SOC 2 Type I observation period started — audit logging hardened across every API route.</li>
      <li>Daily-brief email opt-in surfaced from Settings.</li>
    </ul>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
</script>
