<template>
  <InfoPage title="Responsible AI Use" eyebrow="Policy" intro="Cansee uses large language models throughout its product. This policy explains how we use them, what we won't do with them, and the controls customers can rely on." updated="May 19, 2026">
    <h2>How we use AI</h2>
    <ul>
      <li><strong>Probing.</strong> We send customer-defined prompts to multiple LLM providers and capture the answers and citations.</li>
      <li><strong>Extraction.</strong> Smaller models pull structured facts and citations from raw model output.</li>
    </ul>

    <h2>What we won't do</h2>
    <ul>
      <li>We do not train any third-party model on customer Brand Vault content or generated drafts.</li>
      <li>We do not impersonate humans, create fake reviews, or generate content designed to manipulate review platforms.</li>
      <li>We do not generate content that targets protected classes, promotes self-harm, or otherwise violates provider acceptable-use policies.</li>
    </ul>

    <h2>Provider transparency</h2>
    <p>
      We disclose which provider produced any AI-generated output. Provider-side logging
      (request IDs, model version, safety classifications) is retained for incident review.
    </p>

    <h2>Contact</h2>
    <p>
      Report a concern, abuse, or model failure to
      <a :href="`mailto:${AI_SAFETY_EMAIL}`">{{ AI_SAFETY_EMAIL }}</a>.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
import { AI_SAFETY_EMAIL } from '@/constants/support'
</script>
