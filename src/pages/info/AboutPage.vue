<template>
  <InfoPage title="About Cansee" eyebrow="Company" intro="Cansee is a Generative Engine Optimization platform built for brands that want to be found by AI assistants — not just search engines.">
    <h2>What we do</h2>
    <p>
      Buyers have stopped Googling. They ask ChatGPT, Claude, Gemini, and Perplexity instead.
      Cansee measures how often those models mention your brand, shows you where competitors
      are winning, and helps you close the gap with grounded content.
    </p>

    <h2>How we got here</h2>
    <p>
      We started as an internal tool to track AI-citation share for a single B2B product. When
      every brand we showed it to said "I need this", we spun it out. Today Cansee is
      operated by Alicorr LLC and serves marketing teams across SaaS, e-commerce, and
      professional services.
    </p>

    <h2>What we believe</h2>
    <div class="info-grid">
      <div>
        <h4>Visibility is the new ranking.</h4>
        <p>If the AI doesn't mention you, the buyer never sees you.</p>
      </div>
      <div>
        <h4>Brand truth beats hallucination.</h4>
        <p>Every AI answer is checked against the brand facts you verify.</p>
      </div>
      <div>
        <h4>Measurement should be weekly, not quarterly.</h4>
        <p>AI answers change in days. Reports that lag by a month are noise.</p>
      </div>
    </div>

    <h2>Get in touch</h2>
    <p>
      Questions, partnerships, or press? Email <a href="mailto:hello@cansee.ai">hello@cansee.ai</a>
      or use the <router-link to="/contact">contact page</router-link>.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
</script>
