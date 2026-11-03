<template>
  <section class="ob-step ob-step--prompts">
    <form class="ob-stagger" novalidate @submit.prevent="next">
      <span class="ob-eyebrow">Step 4 of 5 &middot; Prompts</span>
      <h1 class="ob-title" tabindex="-1">What would a buyer ask?</h1>
      <p class="ob-sub">
        We'll track these questions on Google and in ChatGPT, Claude, Gemini,
        Grok and Perplexity. Choose up to 5.
      </p>

      <div class="ob-card">
        <p v-if="noDrafts" class="ob-label-hint ob-empty-note">{{ noDraftsCopy }}</p>
        <p v-if="showCapNote" id="ob-prompt-cap" class="ob-note">Unselect one to add another.</p>

        <TransitionGroup v-if="form.prompts.length" name="ob-list" tag="ul" class="ob-prompts" aria-label="Prompts">
          <li
            v-for="(p, i) in form.prompts"
            :key="p.text"
            class="ob-prompt"
            :class="{ 'is-selected': p.selected, 'is-custom': p.custom, 'is-locked': locked(p) }"
          >
            <label class="ob-prompt-label">
              <input
                type="checkbox"
                class="ob-check"
                :checked="p.selected"
                :disabled="locked(p)"
                :aria-describedby="locked(p) ? 'ob-prompt-cap' : undefined"
                @change="onToggle(i, $event)"
              />
              <span class="ob-prompt-text">{{ p.text }}</span>
            </label>
            <button
              v-if="p.custom"
              type="button"
              class="ob-row-remove"
              :aria-label="`Remove ${p.text}`"
              @click="removePrompt(i)"
            >&times;</button>
          </li>
        </TransitionGroup>

        <div class="ob-add-row">
          <input
            v-model="newPrompt"
            class="ob-text-input ob-add-input"
            type="text"
            placeholder="Add your own"
            aria-label="Add your own prompt"
            :maxlength="LIMITS.prompt"
            @keydown.enter.prevent="addPrompt"
          />
          <button type="button" class="ob-add-btn" :disabled="newPrompt.trim().length < LIMITS.promptMin" @click="addPrompt">
            Add
          </button>
        </div>

        <div class="ob-field ob-field--inline">
          <label class="ob-label" for="ob-prompt-location">Search from</label>
          <span class="ob-select">
            <select id="ob-prompt-location" v-model="form.location" class="ob-text-input ob-select-input">
              <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">{{ c.label }}</option>
            </select>
            <svg class="ob-select-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
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
import { computed } from 'vue'

import { COUNTRIES } from '@/lib/countries'
import { LIMITS, useOnboardingFlow } from '../useOnboardingFlow'

const {
  form,
  newPrompt,
  promptCapReached,
  setPromptSelected,
  addPrompt,
  removePrompt,
  canContinue,
  next,
  back,
} = useOnboardingFlow()

// No drafted prompt (the scan found none, or the user filled in by hand):
// say why, and that the user writes them.
const noDrafts = computed(() => !form.value.prompts.some((p) => !p.custom))
const noDraftsCopy = computed(() =>
  form.value.scan?.topics_source === 'unavailable'
    ? "Drafting prompts needs the AI service, which isn't configured here. Write 1 to 5 questions your buyers ask."
    : "We couldn't draft prompts from your homepage. Write 1 to 5 questions your buyers ask.",
)

const showCapNote = computed(() => promptCapReached.value && form.value.prompts.some((p) => !p.selected))

function locked(p) {
  return !p.selected && promptCapReached.value
}

function onToggle(index, event) {
  const ok = setPromptSelected(index, event.target.checked)
  if (!ok) event.target.checked = Boolean(form.value.prompts[index]?.selected)
}
</script>
