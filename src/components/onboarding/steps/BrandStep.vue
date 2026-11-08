<template>
  <section class="ob-step ob-step--brand">
    <form class="ob-stagger" novalidate @submit.prevent="next">
      <span class="ob-eyebrow">Step 2 of 5 &middot; Brand</span>
      <h1 class="ob-title" tabindex="-1">Is this your brand?</h1>
      <p class="ob-sub">
        Fix anything that's wrong. The agents use these details in every
        report and draft.
      </p>

      <div class="ob-card">
        <div class="ob-field">
          <div class="ob-label-row">
            <label class="ob-label" for="ob-brand-name">Brand name</label>
          </div>
          <div class="ob-name-row">
            <span class="ob-brand-logo">
              <BrandLogo :name="logoName" :domain="host" :src="form.logo_url" :guess="false" :size="28" />
            </span>
            <input
              id="ob-brand-name"
              v-model="form.business_name"
              class="ob-text-input ob-name-input"
              type="text"
              autocomplete="organization"
              required
              :maxlength="LIMITS.name"
              :aria-invalid="nameMissing ? 'true' : undefined"
              :aria-describedby="nameMissing ? 'ob-brand-name-error' : undefined"
            />
          </div>
          <p v-if="nameMissing" id="ob-brand-name-error" class="ob-field-error">Add your brand name to continue.</p>
        </div>

        <div class="ob-field">
          <div class="ob-label-row">
            <span id="ob-brand-site-label" class="ob-label">Website</span>
          </div>
          <div class="ob-readonly" aria-labelledby="ob-brand-site-label" role="group">
            <span class="ob-readonly-value">{{ siteUrl }}</span>
            <button type="button" class="ob-link-btn ob-link-btn--tight" @click="goTo(0)">Change</button>
          </div>
        </div>

        <div class="ob-field">
          <div class="ob-label-row">
            <label class="ob-label" for="ob-brand-industry">Industry</label>
            <span v-if="!form.industry.trim()" class="ob-missing">Missing</span>
          </div>
          <input
            id="ob-brand-industry"
            v-model="form.industry"
            class="ob-text-input"
            type="text"
            :maxlength="LIMITS.industry"
          />
        </div>

        <div class="ob-field">
          <div class="ob-label-row">
            <label class="ob-label" for="ob-brand-description">What you do</label>
            <span v-if="!form.description.trim()" class="ob-missing">Missing</span>
          </div>
          <textarea
            id="ob-brand-description"
            v-model="form.description"
            rows="3"
            class="ob-text-input ob-textarea"
            :maxlength="LIMITS.description"
            aria-describedby="ob-brand-description-count"
          ></textarea>
          <span id="ob-brand-description-count" class="ob-counter">{{ form.description.length }}/{{ LIMITS.description }}</span>
        </div>

        <div class="ob-field">
          <div class="ob-label-row">
            <label class="ob-label" for="ob-brand-offering">Offerings</label>
            <HelpTip :text="TIPS.onboarding.offerings" label="About offerings" />
            <span v-if="!form.offerings.length" class="ob-missing">Missing</span>
          </div>
          <p v-if="!form.offerings.length" class="ob-label-hint">
            We didn't find product names on your homepage. Add what you sell.
          </p>
          <TransitionGroup v-else name="ob-list" tag="ul" class="ob-chips" aria-label="Offerings">
            <li v-for="(name, i) in form.offerings" :key="name" class="ob-chip">
              <span class="ob-chip-text">{{ name }}</span>
              <button type="button" class="ob-chip-x" :aria-label="`Remove ${name}`" @click="removeOffering(i)">&times;</button>
            </li>
          </TransitionGroup>
          <div class="ob-add-row">
            <input
              id="ob-brand-offering"
              v-model="newOffering"
              class="ob-text-input ob-add-input"
              type="text"
              placeholder="Add an offering"
              :maxlength="LIMITS.offering"
              :disabled="offeringsFull"
              @keydown.enter.prevent="addOffering"
            />
            <button type="button" class="ob-add-btn" :disabled="offeringsFull || !newOffering.trim()" @click="addOffering">
              Add
            </button>
          </div>
        </div>

        <div class="ob-field">
          <div class="ob-label-row">
            <label class="ob-label" for="ob-brand-audience">Who you sell to</label>
            <HelpTip :text="TIPS.onboarding.audience" label="About who you sell to" />
            <span v-if="!form.audience.trim()" class="ob-missing">Missing</span>
          </div>
          <p v-if="!form.scan.audience" id="ob-brand-audience-hint" class="ob-label-hint">
            We can't tell this from your homepage. Describe your buyers so the agents write for them.
          </p>
          <textarea
            id="ob-brand-audience"
            v-model="form.audience"
            rows="3"
            class="ob-text-input ob-textarea"
            :maxlength="LIMITS.audience"
            :aria-describedby="form.scan.audience ? undefined : 'ob-brand-audience-hint'"
          ></textarea>
        </div>

        <div class="ob-field">
          <div class="ob-label-row">
            <label class="ob-label" for="ob-brand-voice">Voice</label>
            <span v-if="!form.voice.trim()" class="ob-missing">Missing</span>
          </div>
          <p id="ob-brand-voice-hint" class="ob-label-hint">
            How should drafts sound? For example: plain, confident, no jargon.
          </p>
          <input
            id="ob-brand-voice"
            v-model="form.voice"
            class="ob-text-input"
            type="text"
            :maxlength="LIMITS.voice"
            aria-describedby="ob-brand-voice-hint"
          />
        </div>
      </div>

      <div class="ob-step-actions">
        <button type="button" class="ob-link-btn" @click="back">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M13 8H3M7 4L3 8l4 4"/>
          </svg>
          <span>Back</span>
        </button>
        <button type="submit" class="ob-cta" :disabled="!canContinue">
          <span>Continue</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import BrandLogo from '@/components/BrandLogo.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { TIPS } from '@/lib/help/tips'
import { LIMITS, useOnboardingFlow } from '../useOnboardingFlow'

const { form, host, newOffering, addOffering, removeOffering, canContinue, next, back, goTo } = useOnboardingFlow()

// The logo is the scan's, else the site's own (crawled from its domain),
// else the brand's initial: never a guess by name, which could be another
// company's logo.
const logoName = computed(() => form.value.business_name.trim() || host.value)

const offeringsFull = computed(() => form.value.offerings.length >= LIMITS.offerings)
// The address the project is saved with, as typed (path included), minus the scheme.
const siteUrl = computed(() => form.value.url.replace(/^https?:\/\//i, '').replace(/\/$/, ''))

// The name error shows once the field was emptied, not before anything was typed.
const nameTouched = ref(Boolean(form.value.business_name))
watch(
  () => form.value.business_name,
  () => {
    nameTouched.value = true
  },
)
const nameMissing = computed(() => nameTouched.value && !form.value.business_name.trim())
</script>
