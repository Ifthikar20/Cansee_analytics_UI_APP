<template>
  <InfoPage title="About Cansee" eyebrow="Company" intro="Cansee shows where your brand stands on Google and in AI answers for the questions your buyers ask.">
    <h2>What Cansee does</h2>
    <p>
      You track prompts: the questions your buyers ask. For each prompt, Cansee checks where your
      site ranks on Google and asks five AI engines (ChatGPT, Claude, Gemini, Grok and Perplexity)
      the same question. It shows where Google and the AI answers disagree about you, which brands
      the answers recommend, which pages they cite, and what to change for each prompt.
    </p>

    <h2>Company</h2>
    <p>Cansee is operated by Alicorr LLC.</p>

    <h2>Get in touch</h2>
    <p>
      Email <a :href="`mailto:${GENERAL_EMAIL}`">{{ GENERAL_EMAIL }}</a>, or find the address for
      support, sales, privacy and security on the <router-link to="/contact">contact page</router-link>.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
import { GENERAL_EMAIL } from '@/constants/support'
</script>
