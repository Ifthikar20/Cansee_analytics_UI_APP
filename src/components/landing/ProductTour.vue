<template>
  <section class="tour" aria-labelledby="tour-heading">
    <!-- Hash targets for the nav's use-case links (#tour-sources etc.).
         They all sit at the top of the section, so following one lands on
         the whole tour rather than on a single tab, and the hashchange
         handler below opens the matching step. -->
    <span id="tour" class="tour-anchor" aria-hidden="true"></span>
    <span
      v-for="s in steps"
      :id="'tour-' + s.key"
      :key="'anchor-' + s.key"
      class="tour-anchor"
      aria-hidden="true"
    ></span>

    <div class="tour-wrap">
      <header class="tour-head">
        <span class="tour-eyebrow">Product tour</span>
        <h2 id="tour-heading" class="tour-h">Watch one question<br /><em>go through Cansee.</em></h2>
        <p class="tour-sub">
          Pick a question a buyer might ask about {{ brand.name }}, a sample brand, then step
          through what Cansee does with it: from the answers each engine gives, to the fix
          that moves the number.
        </p>
      </header>

      <div class="tour-picker" role="group" aria-labelledby="tour-picker-label">
        <span id="tour-picker-label" class="tour-picker-label">Pick a question</span>
        <div class="tour-picker-list">
          <button
            v-for="p in prompts"
            :key="p.id"
            type="button"
            class="tour-chip"
            :aria-pressed="p.id === promptId ? 'true' : 'false'"
            @click="promptId = p.id"
          >
            <span class="tour-chip-tag">{{ p.group }}</span>
            <span class="tour-chip-text">{{ p.text }}</span>
          </button>
        </div>
      </div>

      <div class="tour-frame">
        <div class="tour-rail" role="tablist" aria-label="Tour steps" @keydown="onRailKeydown">
          <button
            v-for="(s, i) in steps"
            :id="'tour-tab-' + s.key"
            :key="s.key"
            type="button"
            role="tab"
            class="tour-tab"
            :class="{ 'is-active': i === stepIndex, 'is-done': i < stepIndex }"
            :aria-selected="i === stepIndex ? 'true' : 'false'"
            aria-controls="tour-panel"
            :tabindex="i === stepIndex ? 0 : -1"
            @click="go(i)"
          >
            <span class="tour-tab-num" aria-hidden="true">{{ i + 1 }}</span>
            <span class="tour-tab-txt">
              <span class="tour-tab-label">{{ s.label }}</span>
              <span class="tour-tab-feature">{{ s.feature }}</span>
            </span>
          </button>
        </div>

        <div
          id="tour-panel"
          class="tour-stage"
          role="tabpanel"
          :aria-labelledby="'tour-tab-' + step.key"
        >
          <div class="tour-stage-head">
            <span class="tour-stage-count">Step {{ stepIndex + 1 }} of {{ steps.length }} · {{ step.feature }}</span>
            <h3 class="tour-stage-h">{{ step.title }}</h3>
            <p class="tour-stage-cap">{{ step.caption }}</p>
          </div>

          <div class="tour-card">
            <div class="tour-card-bar">
              <span class="tour-card-q">“{{ prompt.text }}”</span>
              <span class="tour-sample">Sample brand · illustrative data</span>
            </div>
            <Transition name="tour-swap" mode="out-in">
              <component
                :is="panels[step.key]"
                :key="prompt.id + ':' + step.key"
                :prompt="prompt"
                :summary="summary"
                :engines="engines"
                :motion="motion"
              />
            </Transition>
          </div>

          <div class="tour-nav">
            <button
              type="button"
              class="tour-btn is-ghost"
              :disabled="stepIndex === 0"
              @click="go(stepIndex - 1)"
            >Back</button>
            <button
              v-if="stepIndex < steps.length - 1"
              type="button"
              class="tour-btn"
              @click="go(stepIndex + 1)"
            >Next: {{ steps[stepIndex + 1].label }}</button>
            <router-link v-else to="/login" class="tour-btn">Run this on your brand</router-link>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import {
  TOUR_BRAND,
  TOUR_ENGINES,
  TOUR_PROMPTS,
  TOUR_STEPS,
  summarizeRuns,
} from '@/data/productTour'
import TourAsk from './tour/TourAsk.vue'
import TourAnswers from './tour/TourAnswers.vue'
import TourScore from './tour/TourScore.vue'
import TourSources from './tour/TourSources.vue'
import TourRisks from './tour/TourRisks.vue'
import TourAct from './tour/TourAct.vue'
import './tour/tour.css'

const brand = TOUR_BRAND
const engines = TOUR_ENGINES
const prompts = TOUR_PROMPTS
const steps = TOUR_STEPS

const panels = {
  ask: TourAsk,
  answers: TourAnswers,
  score: TourScore,
  sources: TourSources,
  risks: TourRisks,
  act: TourAct,
}

const promptId = ref(prompts[0].id)
const stepIndex = ref(0)

const prompt = computed(() => prompts.find((p) => p.id === promptId.value) || prompts[0])
const step = computed(() => steps[stepIndex.value])
const summary = computed(() => summarizeRuns(prompt.value.runs))

const reducedMotion = usePreferredReducedMotion()
const motion = computed(() => reducedMotion.value !== 'reduce')

function go(i, { focus = false } = {}) {
  if (i < 0 || i >= steps.length) return
  stepIndex.value = i
  // By id rather than a v-for ref array, whose order Vue does not guarantee.
  if (focus) nextTick(() => document.getElementById('tour-tab-' + steps[i].key)?.focus())
}

// Roving tabindex: arrows move between steps, Home/End jump to the ends.
function onRailKeydown(e) {
  const last = steps.length - 1
  const moves = {
    ArrowRight: stepIndex.value + 1,
    ArrowDown: stepIndex.value + 1,
    ArrowLeft: stepIndex.value - 1,
    ArrowUp: stepIndex.value - 1,
    Home: 0,
    End: last,
  }
  if (!(e.key in moves)) return
  e.preventDefault()
  go(Math.min(last, Math.max(0, moves[e.key])), { focus: true })
}

function syncFromHash() {
  const m = /^#tour-([a-z]+)$/.exec(window.location.hash)
  if (!m) return
  const i = steps.findIndex((s) => s.key === m[1])
  if (i !== -1) stepIndex.value = i
}

onMounted(() => {
  syncFromHash()
  window.addEventListener('hashchange', syncFromHash)
})
onUnmounted(() => window.removeEventListener('hashchange', syncFromHash))
</script>
