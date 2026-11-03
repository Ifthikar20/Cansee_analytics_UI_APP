<template>
  <section class="ob-step ob-step--competitors">
    <form class="ob-stagger" novalidate @submit.prevent="next">
      <span class="ob-eyebrow">Step 3 of 5 &middot; Competitors</span>
      <h1 class="ob-title" tabindex="-1">Who do you compete with?</h1>
      <p class="ob-sub">
        We check whether Google and the AI engines put them above you. Keep up to 5.
      </p>

      <div class="ob-card">
        <p v-if="showCapNote" id="ob-competitor-cap" class="ob-note">Unselect one to add another.</p>

        <!-- Rows are keyed by domain-or-name, which the add path dedupes on.
             A monogram, never a third-party logo request. -->
        <TransitionGroup
          v-if="form.competitors.length"
          name="ob-list"
          tag="ul"
          class="ob-competitors"
          aria-label="Competitors"
        >
          <li
            v-for="(c, i) in form.competitors"
            :key="c.domain || c.name"
            class="ob-competitor"
            :class="{ 'is-selected': c.selected, 'is-custom': c.custom, 'is-locked': locked(c) }"
          >
            <label class="ob-competitor-label">
              <input
                type="checkbox"
                class="ob-check"
                :checked="c.selected"
                :disabled="locked(c)"
                :aria-describedby="locked(c) ? 'ob-competitor-cap' : undefined"
                @change="onToggle(i, $event)"
              />
              <span class="ob-monogram" aria-hidden="true">{{ initial(c) }}</span>
              <span class="ob-competitor-body">
                <span class="ob-competitor-name">{{ c.name }}</span>
                <span v-if="c.domain" class="ob-competitor-domain">{{ c.domain }}</span>
              </span>
            </label>
            <button
              v-if="c.custom"
              type="button"
              class="ob-row-remove"
              :aria-label="`Remove ${c.name}`"
              @click="removeCompetitor(i)"
            >&times;</button>
          </li>
        </TransitionGroup>
        <p v-else class="ob-label-hint ob-empty-note">
          We couldn't find competitors automatically. Add the companies you lose deals to.
        </p>

        <div class="ob-field">
          <span id="ob-competitor-add-label" class="ob-label">Add a competitor</span>
          <div class="ob-add-row" role="group" aria-labelledby="ob-competitor-add-label">
            <input
              v-model="newCompetitorName"
              class="ob-text-input ob-add-input"
              type="text"
              placeholder="Competitor name"
              aria-label="Competitor name"
              :maxlength="LIMITS.competitorName"
              @keydown.enter.prevent="addCompetitor"
            />
            <input
              v-model="newCompetitorDomain"
              class="ob-text-input ob-add-input ob-add-input--narrow"
              type="text"
              inputmode="url"
              spellcheck="false"
              placeholder="domain.com (optional)"
              aria-label="Competitor domain (optional)"
              :maxlength="LIMITS.competitorDomain"
              @keydown.enter.prevent="addCompetitor"
            />
            <button type="button" class="ob-add-btn" :disabled="!newCompetitorName.trim()" @click="addCompetitor">
              Add
            </button>
          </div>
        </div>
      </div>

      <div class="ob-step-actions">
        <button type="button" class="ob-link-btn" @click="back">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M13 8H3M7 4L3 8l4 4"/>
          </svg>
          <span>Back</span>
        </button>
        <button type="submit" class="ob-cta">
          <span>{{ selectedCompetitors.length ? 'Continue' : 'Skip competitors' }}</span>
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

import { LIMITS, useOnboardingFlow } from '../useOnboardingFlow'

const {
  form,
  newCompetitorName,
  newCompetitorDomain,
  selectedCompetitors,
  competitorCapReached,
  setCompetitorSelected,
  addCompetitor,
  removeCompetitor,
  next,
  back,
} = useOnboardingFlow()

const showCapNote = computed(
  () => competitorCapReached.value && form.value.competitors.some((c) => !c.selected),
)

function locked(c) {
  return !c.selected && competitorCapReached.value
}

function initial(c) {
  return (String(c.name || c.domain || '').trim().charAt(0) || '?').toUpperCase()
}

function onToggle(index, event) {
  const ok = setCompetitorSelected(index, event.target.checked)
  // Refused at the cap: put the box back the way the row says.
  if (!ok) event.target.checked = Boolean(form.value.competitors[index]?.selected)
}
</script>
