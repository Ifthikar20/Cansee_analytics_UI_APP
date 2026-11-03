<template>
  <section class="ob-step ob-step--describe">
    <div class="ob-stagger">
      <span class="ob-eyebrow">About you</span>
      <h1 class="ob-title" tabindex="-1">Does this sound right?</h1>
      <p class="ob-sub">
        We pulled this from your homepage. Tweak anything that's off —
        the more accurate, the better your prompt runs.
      </p>

      <div class="ob-card">
        <label class="ob-field">
          <span class="ob-label">Business name</span>
          <input v-model="form.business_name" class="ob-text-input" />
        </label>

        <label class="ob-field">
          <span class="ob-label">Industry</span>
          <input v-model="form.industry" class="ob-text-input" placeholder="SaaS, e-commerce, legal..." />
        </label>

        <label class="ob-field">
          <span class="ob-label">Description</span>
          <textarea
            v-model="form.description"
            rows="3"
            maxlength="600"
            class="ob-text-input ob-textarea"
          ></textarea>
          <span class="ob-counter">{{ form.description.length }}/600</span>
        </label>

        <div class="ob-field">
          <span class="ob-label">Starter prompts</span>
          <span v-if="noDraftedTopics" class="ob-label-hint">
            We couldn't draft prompts from your site. Add your own below.
          </span>
          <span v-else class="ob-label-hint">
            Drafted from your site. Add or change the prompts you track
            anytime from the Overview.
          </span>
          <!-- TransitionGroup: added topics pop in, removed ones shrink
               away, the rest glide into place. Keys are the topic text
               itself (deduped case-insensitively on add). -->
          <TransitionGroup
            v-if="form.keywords.length"
            name="ob-list"
            tag="div"
            class="ob-topics"
          >
            <div
              v-for="(k, i) in form.keywords"
              :key="k"
              class="ob-topic-row"
            >
              <span class="ob-chip">
                {{ k }}
                <button class="ob-chip-x" @click="removeKeyword(k)">×</button>
              </span>
              <span
                v-if="form.topic_brands[i] && form.topic_brands[i].length"
                class="ob-topic-vs"
              >vs {{ form.topic_brands[i].join(', ') }}</span>
            </div>
          </TransitionGroup>

          <!-- Add your own topic. Stays alongside the LLM picks so
               the audit measures both. -->
          <div class="ob-add-topic">
            <input
              v-model="newTopic"
              placeholder="Add your own prompt"
              class="ob-text-input ob-add-input"
              @keydown.enter.prevent="addCustomTopic"
            />
            <button
              type="button"
              class="ob-add-btn"
              :disabled="!newTopic.trim()"
              @click="addCustomTopic"
            >Add</button>
          </div>
        </div>
      </div>

      <div class="ob-step-actions">
        <button class="ob-link-btn" @click="back">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 8H3M7 4L3 8l4 4"/>
          </svg>
          <span>Back</span>
        </button>
        <button class="ob-cta" @click="goToCompetitors">
          <span>Continue</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
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
  noDraftedTopics,
  newTopic,
  addCustomTopic,
  removeKeyword,
  back,
  goToCompetitors,
} = useOnboardingFlow()
</script>
