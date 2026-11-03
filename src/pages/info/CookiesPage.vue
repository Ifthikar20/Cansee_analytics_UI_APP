<template>
  <InfoPage title="Cookie Policy" eyebrow="Legal" intro="This Cookie Policy explains how Cansee uses cookies and similar technologies on cansee.ai and inside the authenticated app." updated="May 19, 2026">
    <h2>What is a cookie?</h2>
    <p>
      A cookie is a small text file stored on your device by your browser. It lets a website
      recognise repeat visits, keep you signed in, and remember preferences.
    </p>

    <h2>Categories we use</h2>
    <div class="info-grid">
      <div>
        <h4>Strictly necessary</h4>
        <p>Session and refresh-token cookies that keep you logged in. Cannot be disabled without breaking the app.</p>
      </div>
      <div>
        <h4>Preferences</h4>
        <p>Theme choice, dismissed onboarding tooltips, last-viewed website.</p>
      </div>
      <div>
        <h4>Analytics</h4>
        <p>Aggregated, IP-truncated usage signals so we know which features actually get used.</p>
      </div>
      <div>
        <h4>Security</h4>
        <p>CSRF tokens, suspicious-login flags, rate-limit fingerprints.</p>
      </div>
    </div>

    <h2>Third parties</h2>
    <p>
      Cansee does not embed third-party advertising or tracking cookies. Sub-processors that
      receive event data (e.g. error monitoring) do so server-side and never set cookies on
      your browser via cansee.ai.
    </p>

    <h2>Managing cookies</h2>
    <p>
      You can clear cookies any time from your browser settings. Doing so will sign you out
      of the Cansee app and reset your preferences.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about this policy: <a :href="`mailto:${PRIVACY_EMAIL}`">{{ PRIVACY_EMAIL }}</a>.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
import { PRIVACY_EMAIL } from '@/constants/support'
</script>
