<template>
  <section class="ob-step ob-step--run">
    <div class="ob-stagger">
      <span class="ob-eyebrow">Step 5 of 5 &middot; First research</span>
      <h1 class="ob-title" tabindex="-1">Run your first research</h1>
      <p class="ob-sub">
        A team of research agents searches Google, asks the AI engines and
        reads your and your competitors' pages, then builds one results
        table. It usually takes 2 to 4 minutes.
      </p>

      <dl class="ob-summary">
        <div class="ob-summary-row">
          <dt>Website</dt>
          <dd>{{ host }}</dd>
        </div>
        <div class="ob-summary-row">
          <dt>Brand</dt>
          <dd>{{ form.business_name.trim() }}</dd>
        </div>
        <div class="ob-summary-row">
          <dt>Competitors</dt>
          <dd>{{ competitorNames || 'None' }}</dd>
        </div>
        <div class="ob-summary-row">
          <dt>Prompts</dt>
          <dd>
            <ol class="ob-summary-list">
              <li v-for="p in selectedPrompts" :key="p.text">{{ p.text }}</li>
            </ol>
          </dd>
        </div>
        <template v-if="status">
          <div class="ob-summary-row">
            <dt>Google results</dt>
            <dd>{{ status.serp_configured ? 'Available' : 'Not configured' }}</dd>
          </div>
          <div v-if="engines.configured.length || engines.missing.length" class="ob-summary-row">
            <dt>AI engines</dt>
            <dd>
              <span v-if="engines.configured.length">{{ engines.configured.join(', ') }}</span>
              <span v-if="engines.missing.length" class="ob-summary-muted">
                Not configured: {{ engines.missing.join(', ') }}
              </span>
            </dd>
          </div>
          <div v-if="allowanceText" class="ob-summary-row">
            <dt>AI allowance</dt>
            <dd class="ob-tnum">{{ allowanceText }}</dd>
          </div>
        </template>
      </dl>

      <p v-if="availability === 'unavailable'" class="ob-notice" role="status">
        The research agent isn't available on this workspace yet. Your project will still be set up.
      </p>
      <p v-else-if="availability === 'allowance'" class="ob-notice" role="status">
        You've used this month's AI allowance, so research can't start now.
      </p>
      <p v-else-if="availability === 'unknown'" class="ob-notice" role="status">
        <span>We couldn't check whether the research agent is available.</span>
        <button type="button" class="ob-link-btn ob-link-btn--tight" :disabled="saving" @click="loadAgentStatus">
          Try again
        </button>
      </p>

      <div class="ob-step-actions">
        <button type="button" class="ob-link-btn" :disabled="saving" @click="back">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M13 8H3M7 4L3 8l4 4"/>
          </svg>
          <span>Back</span>
        </button>

        <div class="ob-run-actions">
          <template v-if="canResearch">
            <button type="button" class="ob-link-btn" :disabled="saving" @click="skipResearch">
              <span v-if="finishing === 'skip'" class="ob-spinner" aria-hidden="true"></span>
              <span>{{ finishing === 'skip' ? 'Setting up your project' : 'Skip for now' }}</span>
            </button>
            <button
              type="button"
              class="ob-cta"
              :disabled="saving || availability === 'checking'"
              :aria-busy="availability === 'checking' || finishing === 'research' ? 'true' : undefined"
              @click="startResearch"
            >
              <span v-if="finishing === 'research'" class="ob-spinner" aria-hidden="true"></span>
              <span>{{ finishing === 'research' ? 'Setting up your project' : 'Start research' }}</span>
            </button>
          </template>
          <button v-else type="button" class="ob-cta" :disabled="saving" @click="skipResearch">
            <span v-if="finishing" class="ob-spinner" aria-hidden="true"></span>
            <span>{{ finishing ? 'Setting up your project' : 'Finish setup' }}</span>
          </button>
        </div>
      </div>

      <p v-if="canResearch" class="ob-run-note">You can run research any time from the Agent.</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import { useOnboardingFlow } from '../useOnboardingFlow'

const {
  form,
  host,
  selectedPrompts,
  selectedCompetitors,
  agentStatus,
  availability,
  loadAgentStatus,
  finishing,
  saving,
  startResearch,
  skipResearch,
  back,
} = useOnboardingFlow()

const status = computed(() => agentStatus.value || null)

// Research can start when the agent is there, or when its status could
// not be read (the agent chat then reports any failure itself).
const canResearch = computed(() => ['available', 'checking', 'unknown'].includes(availability.value))

const competitorNames = computed(() => selectedCompetitors.value.map((c) => c.name).join(', '))

const engines = computed(() => {
  const list = Array.isArray(status.value?.engines) ? status.value.engines : []
  const label = (e) => String(e?.label || e?.key || '').trim()
  return {
    configured: list.filter((e) => e?.configured).map(label).filter(Boolean),
    missing: list.filter((e) => e && !e.configured).map(label).filter(Boolean),
  }
})

function usd(value) {
  return `$${value.toFixed(2)}`
}

const allowanceText = computed(() => {
  const a = status.value?.allowance
  if (!a || typeof a !== 'object') return ''
  const cap = Number(a.cap_usd)
  if (!Number.isFinite(cap)) return ''
  if (cap <= 0) return 'No monthly limit'
  const spent = Number(a.spent_usd)
  const left = Math.max(0, cap - (Number.isFinite(spent) ? spent : 0))
  return `${usd(left)} of ${usd(cap)} left this month`
})
</script>
