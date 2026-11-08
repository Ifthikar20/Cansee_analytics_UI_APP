<template>
  <InfoPage title="Contact us" eyebrow="Talk to Cansee" intro="Cansee is a small, invite-only team. A public contact form is on the way — until then, requests come through the channels below.">
    <h2>Book a demo</h2>
    <p>
      Want to see Cansee on your own brand? <router-link to="/demo">Book a demo</router-link>
      and we will run a live AI visibility check with you.
    </p>

    <h2>Request access</h2>
    <p>
      Access to Cansee is currently invite-only. If you'd like an account, a working
      integration, or a private beta invite, hold tight — we'll open a request form on this
      page soon.
    </p>

    <h2>Security &amp; privacy</h2>
    <p>
      Security researchers and privacy inquiries can reach the team through the process
      described on the <router-link to="/privacy">Privacy</router-link> page.
    </p>

    <h2>Press</h2>
    <p>
      For interviews, quotes, or media kits, watch this page — press contact details will
      be published alongside our first public release.
    </p>

    <h2>Company</h2>
    <p>
      Cansee is operated by Alicorr LLC. Mailing address available on request once the
      contact form is live.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
</script>
