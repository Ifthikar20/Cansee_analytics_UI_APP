<template>
  <section class="ob-step ob-step--scanning" aria-busy="true">
    <div class="ob-stagger">
      <!-- The user's own site in the scanner: favicon in a white core,
           two slow rings, one sweeping radar beam. Falls back to the
           original pulsing dot when the favicon 404s. -->
      <div class="ob-scanner" aria-hidden="true">
        <span class="ob-orbit-ring ob-orbit-r1"></span>
        <span class="ob-orbit-ring ob-orbit-r2"></span>
        <span class="ob-scan-sweep"></span>
        <span class="ob-scan-core">
          <img
            v-if="urlHostname && !faviconErr"
            :src="`https://www.google.com/s2/favicons?domain=${urlHostname}&sz=64`"
            alt=""
            width="28"
            height="28"
            @error="faviconErr = true"
          />
          <span v-else class="ob-scan-dot"></span>
        </span>
      </div>

      <h1 class="ob-title" tabindex="-1">Reading {{ urlHostname }}</h1>
      <p class="ob-sub" aria-live="polite">This usually takes under a minute.</p>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

import { useOnboardingFlow } from '../useOnboardingFlow'

const { urlHostname } = useOnboardingFlow()
const faviconErr = ref(false)
</script>
