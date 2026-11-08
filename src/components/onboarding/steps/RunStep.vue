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
          <dd>
            <ul v-if="selectedCompetitors.length" class="ob-summary-plain">
              <li v-for="c in selectedCompetitors" :key="c.domain || c.name">
                <span>{{ c.name }}</span>
                <span v-if="sourceShort(c)" class="ob-summary-muted"> &middot; {{ sourceShort(c) }}</span>
              </li>
            </ul>
            <span v-else>None</span>
          </dd>
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
            <dd>
              <span>{{ google.text }}</span>
              <span v-if="google.staff" class="ob-summary-muted">{{ google.staff }}</span>
            </dd>
          </div>
          <div v-if="engineRows.length" class="ob-summary-row">
            <dt>
              AI engines
              <HelpTip :text="TIPS.onboarding.engines" label="About choosing AI engines" />
            </dt>
            <dd>
              <fieldset class="ob-engines">
                <legend class="ob-sr-only">AI engines for the first research</legend>
                <div v-for="e in engineRows" :key="e.key" class="ob-engine" :class="{ 'is-off': !e.configured }">
                  <label class="ob-engine-label">
                    <input
                      type="checkbox"
                      class="ob-check"
                      :checked="e.configured && form.engines.includes(e.key)"
                      :disabled="!e.configured || saving"
                      :aria-describedby="e.configured ? undefined : `ob-engine-why-${e.key}`"
                      @change="onEngine(e.key, $event)"
                    />
                    <span>{{ e.label }}</span>
                  </label>
                  <span v-if="!e.configured" :id="`ob-engine-why-${e.key}`" class="ob-engine-why">
                    {{ e.label }} isn't set up on this workspace.<template v-if="e.setting"> Setting: {{ e.setting }}.</template>
                  </span>
                </div>
              </fieldset>
              <span v-if="configuredEngines.length" class="ob-summary-muted ob-engines-note">
                Your choice applies to this first research only.
              </span>
            </dd>
          </div>
          <div v-if="promptRuns" class="ob-summary-row">
            <dt>
              Prompt runs
              <HelpTip :text="TIPS.onboarding.promptRuns" label="About free prompt runs" />
            </dt>
            <dd class="ob-tnum">
              <span>{{ runsLeft }}</span>
              <span v-if="runsUseText" class="ob-summary-muted">{{ runsUseText }}</span>
            </dd>
          </div>
          <div v-else-if="allowanceText" class="ob-summary-row">
            <dt>
              AI allowance
              <HelpTip :text="TIPS.onboarding.allowance" label="About the AI allowance" />
            </dt>
            <dd class="ob-tnum">{{ allowanceText }}</dd>
          </div>
        </template>
      </dl>

      <p v-if="availability === 'unavailable'" class="ob-notice" role="status">
        The research agent isn't available on this workspace yet. Your project will still be set up.
      </p>
      <p v-else-if="availability === 'allowance'" class="ob-notice" role="status">
        {{ hideUsd ? "You've used this month's free AI allowance, so research can't start now." : "You've used this month's AI allowance, so research can't start now." }}
      </p>
      <p v-else-if="availability === 'no_engines'" class="ob-notice" role="status">
        No AI engine is set up on this workspace, so research can't run. Your project will still be set up.
      </p>
      <p v-else-if="availability === 'unknown'" class="ob-notice" role="status">
        <span>We couldn't check whether the research agent is available.</span>
        <button type="button" class="ob-link-btn ob-link-btn--tight" :disabled="saving" @click="loadAgentStatus">
          Try again
        </button>
      </p>
      <p v-else-if="blockText" id="ob-run-block" class="ob-notice" role="status">{{ blockText }}</p>

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
              :disabled="saving || availability === 'checking' || Boolean(researchBlock)"
              :aria-busy="availability === 'checking' || finishing === 'research' ? 'true' : undefined"
              :aria-describedby="researchBlock ? 'ob-run-block' : undefined"
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
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { TIPS } from '@/lib/help/tips'
import { runsLeftText } from '@/lib/promptRuns'

import { SOURCE, useOnboardingFlow } from '../useOnboardingFlow'

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
  showSettings,
  engineRows,
  configuredEngines,
  chosenEngines,
  setEngineSelected,
  promptRuns,
  hideUsd,
  runsNeeded,
  runsCheck,
  researchBlock,
} = useOnboardingFlow()

const status = computed(() => agentStatus.value || null)

// Research can start when the agent is there, or when its status could
// not be read (the agent chat then reports any failure itself).
const canResearch = computed(() => ['available', 'checking', 'unknown'].includes(availability.value))

function sourceShort(c) {
  if (c.custom) return 'added by you'
  if (c.source === SOURCE.search) return 'from Google'
  if (c.source === SOURCE.both) return 'from Google and AI'
  if (c.source === SOURCE.ai) return 'AI suggestion'
  return ''
}

// GET status/ google, or the older serp_configured flag.
const google = computed(() => {
  const g = status.value?.google
  const configured = g && typeof g === 'object' ? g.configured === true : Boolean(status.value?.serp_configured)
  if (configured) {
    const pageOne = g?.reliable_pages === 1
    return { text: pageOne ? 'Available (page one of Google only)' : 'Available', staff: '' }
  }
  const keys = showSettings.value && Array.isArray(g?.key_settings) ? g.key_settings : []
  return {
    text: "Google results aren't set up on this workspace, so rankings on Google are skipped.",
    staff: keys.length ? `Setting to add: ${keys.join(' or ')}.` : '',
  }
})

function onEngine(key, event) {
  const ok = setEngineSelected(key, event.target.checked)
  if (!ok) event.target.checked = form.value.engines.includes(key)
}

const runsLeft = computed(() => runsLeftText(promptRuns.value))

// "Your first research uses 6 (3 prompts x 2 engines)." while it fits.
const runsUseText = computed(() => {
  if (!promptRuns.value || !runsNeeded.value || availability.value !== 'available') return ''
  if (runsCheck.value && !runsCheck.value.enough) return ''
  const p = selectedPrompts.value.length
  const e = chosenEngines.value.length
  const n = runsNeeded.value
  return `Your first research uses ${n} ${n === 1 ? 'run' : 'runs'} (${p} ${p === 1 ? 'prompt' : 'prompts'} × ${e} ${e === 1 ? 'engine' : 'engines'}).`
})

// Why Start research is off while the agent is there.
const blockText = computed(() => {
  if (researchBlock.value === 'no_engine') return 'Pick at least one AI engine to run research.'
  if (researchBlock.value === 'runs') return runsCheck.value?.text || ''
  return ''
})

function usd(value) {
  return `$${value.toFixed(2)}`
}

// Paid plans keep their dollar allowance; free accounts never see dollars.
const allowanceText = computed(() => {
  if (hideUsd.value) return ''
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
