<template>
  <section class="ob-step ob-step--website">
    <div v-if="scanState === 'idle'" class="ob-stagger">
      <span class="ob-eyebrow">Step 1 of 5 &middot; Website</span>
      <h1 class="ob-title" tabindex="-1">Which site should we measure?</h1>
      <p class="ob-sub">
        We read your homepage to draft your brand, competitors and buyer
        prompts. Nothing is saved until the last step.
      </p>

      <form class="ob-input-wrap" :class="{ 'is-error': shaking }" novalidate @submit.prevent="startScan">
        <span class="ob-input-prefix" aria-hidden="true">https://</span>
        <input
          ref="inputEl"
          v-model="urlInput"
          class="ob-input"
          type="text"
          inputmode="url"
          autocomplete="url"
          spellcheck="false"
          placeholder="yourcompany.com"
          aria-label="Your website"
          data-autofocus
          :aria-invalid="urlError ? 'true' : undefined"
          :aria-describedby="message ? 'ob-website-error' : undefined"
        />
        <button type="submit" class="ob-cta" :disabled="!urlInput.trim()">
          <span>Continue</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </button>
      </form>

      <div v-if="message" class="ob-error-block">
        <p id="ob-website-error" class="ob-error" role="alert">{{ message }}</p>
        <div v-if="scanError" class="ob-error-actions">
          <button type="button" class="ob-link-btn" @click="startScan">Try again</button>
          <button type="button" class="ob-link-btn" @click="fillByHand">Fill in by hand</button>
        </div>
      </div>
    </div>

    <div v-else class="ob-scan">
      <span class="ob-eyebrow">Step 1 of 5 &middot; Website</span>
      <div class="ob-scan-head">
        <h1 ref="scanTitleEl" class="ob-title" tabindex="-1">Reading {{ scanHost }}</h1>
        <span v-if="scanState === 'scanning'" class="ob-spinner ob-scan-spinner" aria-hidden="true"></span>
      </div>
      <p class="ob-sub">This takes 10 to 30 seconds.</p>

      <ul class="ob-scan-rows" :aria-busy="scanState === 'scanning' ? 'true' : 'false'">
        <li v-for="row in scanRows" :key="row.key" class="ob-scan-row" :class="`is-${row.state}`">
          <span class="ob-scan-mark" aria-hidden="true">
            <svg v-if="row.state === 'found'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <svg v-else-if="row.state === 'missing'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M6 12h12"/>
            </svg>
            <span v-else class="ob-scan-ring"></span>
          </span>
          <span class="ob-scan-label">{{ row.label }}</span>
          <span class="ob-scan-result">{{ row.text }}</span>
        </li>
      </ul>
      <p class="ob-sr-only" aria-live="polite">{{ liveText }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

import { useOnboardingFlow } from '../useOnboardingFlow'

const { urlInput, scanState, scanHost, scanRows, urlError, scanError, startScan, fillByHand } = useOnboardingFlow()

const inputEl = ref(null)
const scanTitleEl = ref(null)

const message = computed(() => urlError.value || scanError.value)

// Read out once when the rows resolve, not row by row.
const liveText = computed(() =>
  scanState.value === 'resolved' ? scanRows.value.map((r) => `${r.label}: ${r.text}`).join('. ') : '',
)

// The scan view replaces the address field inside the same step, so the
// step transition's focus handling does not run: move focus here.
watch(scanState, async (state, before) => {
  await nextTick()
  if (state === 'scanning') scanTitleEl.value?.focus({ preventScroll: true })
  else if (state === 'idle' && before === 'scanning') inputEl.value?.focus({ preventScroll: true })
})

// Shake the input pill whenever an error lands. The rAF hop restarts the
// animation when the same step gets a second error in place.
const shaking = ref(false)
watch(
  message,
  (v) => {
    if (!v) return
    shaking.value = false
    requestAnimationFrame(() => {
      shaking.value = true
    })
  },
  { immediate: true },
)
</script>
