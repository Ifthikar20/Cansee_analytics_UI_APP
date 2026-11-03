<template>
  <section class="ob-step ob-step--competitors">
    <div class="ob-stagger">
      <span class="ob-eyebrow">Competitors</span>
      <h1 class="ob-title" tabindex="-1">Who should we benchmark you against?</h1>
      <p class="ob-sub">
        We found these from your space. Uncheck any that aren't real
        competitors, or add your own below — they shape which brands
        your prompt runs track.
      </p>

      <div class="ob-card">
        <!-- TransitionGroup: custom competitors pop in, removals shrink
             away, and the grid reflows with a FLIP glide. Rows are keyed
             by domain-or-name, which the add path dedupes on. -->
        <TransitionGroup
          v-if="form.competitors.length"
          name="ob-list"
          tag="div"
          class="ob-competitors"
        >
          <div
            v-for="(c, i) in form.competitors"
            :key="c.domain || c.name"
            class="ob-competitor"
            :class="{ 'is-selected': c.selected, 'is-custom': c.custom }"
          >
            <label class="ob-competitor-label">
              <input
                type="checkbox"
                v-model="c.selected"
                class="ob-competitor-check"
              />
              <!-- Logo lookup: Clearbit returns the brand mark for
                   most known companies; on 404 the @error handler
                   swaps to Google's favicon service; if that also
                   fails we fall back to a circled initial. -->
              <span class="ob-competitor-logo" v-if="c.domain || c.name">
                <img
                  v-if="c.domain && !c._logoErr"
                  :src="`https://logo.clearbit.com/${c.domain}`"
                  :alt="`${c.name} logo`"
                  loading="lazy"
                  width="24"
                  height="24"
                  @error="onLogoError(c)"
                />
                <img
                  v-else-if="c.domain && c._logoErr === 'clearbit'"
                  :src="`https://www.google.com/s2/favicons?domain=${c.domain}&sz=64`"
                  :alt="`${c.name} favicon`"
                  loading="lazy"
                  width="24"
                  height="24"
                  @error="onLogoError(c)"
                />
                <span v-else class="ob-competitor-logo-fallback">
                  {{ (c.name || '?').trim().charAt(0).toUpperCase() }}
                </span>
              </span>
              <div class="ob-competitor-body">
                <div class="ob-competitor-name">{{ c.name }}</div>
                <div v-if="c.domain" class="ob-competitor-domain">{{ c.domain }}</div>
              </div>
            </label>
            <button
              v-if="c.custom"
              type="button"
              class="ob-competitor-remove"
              @click="removeCompetitor(i)"
              aria-label="Remove competitor"
            >×</button>
          </div>
        </TransitionGroup>
        <p v-else class="ob-sub" style="margin: 0;">
          We didn't find any competitors automatically. Add your own below.
        </p>

        <!-- Add-your-own row -->
        <div class="ob-add-competitor">
          <input
            v-model="newCompetitorName"
            placeholder="Competitor name"
            class="ob-text-input ob-add-input"
            @keydown.enter.prevent="addCustomCompetitor"
          />
          <input
            v-model="newCompetitorDomain"
            placeholder="domain.com (optional)"
            class="ob-text-input ob-add-input ob-add-input--narrow"
            @keydown.enter.prevent="addCustomCompetitor"
          />
          <button
            type="button"
            class="ob-add-btn"
            :disabled="!newCompetitorName.trim()"
            @click="addCustomCompetitor"
          >Add</button>
        </div>
      </div>

      <div class="ob-step-actions">
        <button class="ob-link-btn" @click="back">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 8H3M7 4L3 8l4 4"/>
          </svg>
          <span>Back</span>
        </button>
        <button class="ob-cta" :disabled="saving" @click="finish">
          <span v-if="!saving">Finish setup</span>
          <span v-else class="ob-spinner" aria-hidden="true"></span>
          <svg v-if="!saving" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useOnboardingFlow } from '../useOnboardingFlow'

const {
  form,
  saving,
  newCompetitorName,
  newCompetitorDomain,
  addCustomCompetitor,
  removeCompetitor,
  onLogoError,
  back,
  finish,
} = useOnboardingFlow()
</script>
