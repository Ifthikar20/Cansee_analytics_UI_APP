<template>
  <section class="ob-step ob-step--url">
    <div class="ob-stagger">
      <span class="ob-eyebrow">Your website</span>
      <h1 class="ob-title" tabindex="-1">What's your website?</h1>
      <p class="ob-sub">
        We'll read your homepage, draft a description, and find the
        competitors you'll be measured against.
      </p>

      <div class="ob-input-wrap" :class="{ 'is-error': shaking }">
        <span class="ob-input-prefix">https://</span>
        <input
          v-model="urlInput"
          class="ob-input"
          placeholder="yourcompany.com"
          data-autofocus
          :disabled="loading"
          @keydown.enter.prevent="startScan"
        />
        <button
          class="ob-cta"
          :disabled="loading || !urlInput.trim()"
          @click="startScan"
        >
          <span v-if="!loading">Continue</span>
          <span v-else class="ob-spinner" aria-hidden="true"></span>
          <svg v-if="!loading" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </button>
      </div>

      <p v-if="error" class="ob-error" role="alert">{{ error }}</p>

      <div class="ob-hints">
        <span>Press <kbd>Enter</kbd> to continue</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'

import { useOnboardingFlow } from '../useOnboardingFlow'

const { urlInput, loading, error, startScan } = useOnboardingFlow()

// Shake the input pill whenever an error lands. The step remounts on
// the scan-failure return, so `immediate` catches the error that is
// already set at mount; the rAF hop restarts the animation when the
// same step gets a second error in place.
const shaking = ref(false)
watch(
  error,
  v => {
    if (!v) return
    shaking.value = false
    requestAnimationFrame(() => { shaking.value = true })
  },
  { immediate: true },
)
</script>
