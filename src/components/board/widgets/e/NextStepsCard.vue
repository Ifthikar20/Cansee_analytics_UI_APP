<script setup>
// The "next-steps" block: what is not set up for this project and what to
// do next, as numbered rows. What is not set up is the server's own words
// (the Setup panel's logic over the agent status); it is the workspace's to
// fix, so those rows have no link and the block offers Check again. Adding
// prompts and turning on Autopilot come from the ranking payload, and each
// is a link. With nothing left it says "All set" and lists what is in
// place, each line read from a payload.
import { computed, onMounted, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import AgButton from '@/components/agent/common/AgButton.vue'
import CardFoot from '@/components/board/CardFoot.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import CardState from '@/components/board/widgets/a/CardState.vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard, useCardStatus } from '@/lib/board/context'
import { setupFacts, stepsModel, unknownText, visibleSteps } from '@/lib/board/e/steps'
import { useAgentStore } from '@/stores/agent'

const props = defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

// The rows a compact card shows: four when that is all of them, else three
// and a link to the rest, in the panel.
const COMPACT_ROWS = 4
const COMPACT_ROWS_MORE = 3

const agent = useAgentStore()
const board = useBoard()
const ranking = useBoardSource('ranking')
const placeId = `ns-place-${useId()}`

const asked = ref(Boolean(agent.status || agent.statusLoading || agent.statusError))

function loadStatus() {
  asked.value = true
  Promise.resolve(agent.loadStatus()).catch(() => {})
}

// Check again and Try again (both are off while a check runs).
function check() {
  loadStatus()
  ranking.reload()
}

onMounted(() => {
  if (!asked.value) loadStatus()
})

const status = computed(() => (agent.status && typeof agent.status === 'object' ? agent.status : null))
const checking = computed(() => Boolean(agent.statusLoading))
const rankingData = computed(() => (ranking.data.value && typeof ranking.data.value === 'object' ? ranking.data.value : null))
const rankingPending = computed(() => !rankingData.value && !ranking.failure.value)

const phase = computed(() => {
  if (status.value) return rankingPending.value ? 'loading' : 'ready'
  if (checking.value || !asked.value) return 'loading'
  return 'failed'
})

const model = computed(() => stepsModel({ status: status.value, ranking: rankingData.value }))
const facts = computed(() => setupFacts(status.value, rankingData.value))
const missing = computed(() => unknownText(model.value.unknown))
// The status or the ranking kept from before a refresh that failed.
const stale = computed(() => Boolean(agent.statusError) || Boolean(ranking.stale.value) || model.value.unknown.length > 0)

useCardStatus(() => {
  if (phase.value === 'loading') return 'loading'
  if (phase.value === 'failed') return 'error'
  return stale.value ? 'stale' : 'live'
})

const full = computed(() => props.size === 'full')
const steps = computed(() => {
  const rows = model.value.rows
  if (full.value) return visibleSteps(rows)
  return visibleSteps(rows, rows.length > COMPACT_ROWS ? COMPACT_ROWS_MORE : COMPACT_ROWS)
})
// Few rows leave room for each one's second line.
const roomy = computed(() => full.value || steps.value.shown.length <= 2)
const footText = computed(() => [model.value.summary, missing.value].filter(Boolean).join('. '))

function run(row) {
  if (row.action === 'add-prompts') board.open('prompts', { add: '1' })
}
</script>

<template>
  <CardSkeleton v-if="phase === 'loading'" />
  <CardState
    v-else-if="phase === 'failed'"
    kind="error"
    title="We couldn't check your setup."
    :action="{ label: 'Try again' }"
    @action="check"
  />
  <div v-else class="ns" :class="{ 'is-full': full, 'is-roomy': roomy }">
    <template v-if="model.rows.length">
      <p class="ns-sr">{{ model.sentence }}</p>
      <ol class="ns-list" aria-label="Next steps">
        <li v-for="(row, i) in steps.shown" :key="row.key" class="ns-row" :class="[`is-${row.kind}`, { 'is-next': i === 0 }]">
          <span class="ns-index" aria-hidden="true">{{ row.index }}</span>
          <div class="ns-text">
            <p class="ns-title">
              <RouterLink v-if="row.to" class="ns-link" :to="row.to">{{ row.title }}</RouterLink>
              <button v-else-if="row.action" type="button" class="ns-link" @click="run(row)">{{ row.title }}</button>
              <template v-else>{{ row.title }}</template>
            </p>
            <p v-if="row.body" class="ns-body">{{ row.body }}</p>
            <p v-if="row.setting && full" class="ns-setting cs-label">Setting: {{ row.setting }}</p>
          </div>
          <svg v-if="row.to || row.action" class="ns-arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </li>
      </ol>
      <CardFoot>
        {{ footText }}
        <template v-if="steps.more || model.issues" #link>
          <AgButton v-if="steps.more" size="xs" @click="board.open('next-steps')">{{ steps.more }} more</AgButton>
          <AgButton v-else-if="model.issues" size="xs" :loading="checking" @click="check">Check again</AgButton>
        </template>
      </CardFoot>
      <section v-if="full && facts.length" class="ns-place" :aria-labelledby="placeId">
        <h3 :id="placeId" class="ns-place-title">In place</h3>
        <dl class="ns-facts">
          <div v-for="fact in facts" :key="fact.key" class="ns-fact">
            <dt class="cs-label">{{ fact.label }}</dt>
            <dd class="cs-label cs-label--ink">{{ fact.value }}</dd>
          </div>
        </dl>
      </section>
    </template>

    <template v-else>
      <div class="ns-done">
        <p class="ns-done-title">{{ model.allSet ? 'All set' : 'Nothing to fix in setup' }}</p>
        <p v-if="model.allSet" class="ns-done-body">Nothing is waiting on you for this project.</p>
        <p v-else class="ns-done-body">{{ missing }}</p>
        <div v-if="!model.allSet" class="ns-done-actions">
          <AgButton size="sm" :loading="checking" @click="check">Try again</AgButton>
        </div>
      </div>
      <dl v-if="facts.length" class="ns-facts">
        <div v-for="fact in facts" :key="fact.key" class="ns-fact">
          <dt class="cs-label">{{ fact.label }}</dt>
          <dd class="cs-label cs-label--ink">{{ fact.value }}</dd>
        </div>
      </dl>
    </template>
  </div>
</template>

<style scoped>
.ns {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.ns-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
  white-space: nowrap;
}

.ns-list {
  display: flex;
  flex-direction: column;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

/* A row: its number in the left column, the step, and an arrow when the
   step is a link. Hairlines separate the rows. */
.ns-row {
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 16px;
  align-items: start;
  gap: 0 8px;
  padding: 14px 0;
  border-top: 1px solid var(--rule);
}

.ns-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.ns-index {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 22px;
  letter-spacing: 0.04em;
}

/* The step to take first wears the accent. */
.ns-row.is-next .ns-index {
  color: var(--signal-text);
}

.ns-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ns-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: -0.01em;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.ns.is-full .ns-title {
  display: block;
  overflow: visible;
}

.ns-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

/* The whole row is the link's target. */
.ns-link::after {
  position: absolute;
  inset: 0;
  content: '';
}

.ns-link:focus-visible {
  outline: none;
}

.ns-link:focus-visible::after {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.ns-row:hover .ns-link {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.ns-body {
  display: none;
  max-width: 62ch;
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 19px;
}

.ns.is-roomy .ns-body {
  display: block;
}

.ns-setting {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.ns-arrow {
  width: 16px;
  height: 16px;
  margin-top: 3px;
  fill: none;
  stroke: var(--foreground);
  stroke-width: 1.25;
}

@media (prefers-reduced-motion: no-preference) {
  .ns-arrow {
    transition: transform 140ms ease;
  }

  .ns-row:hover .ns-arrow {
    transform: translateX(2px);
  }
}

@container (min-width: 520px) {
  .ns-body {
    display: block;
  }
}

/* All set: one line in the display type, then what is in place. */
.ns-done {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.ns-done-title {
  margin: 0;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: clamp(28px, 11cqi, 44px);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.ns.is-full .ns-done-title {
  font-size: 40px;
}

.ns-done-body {
  max-width: 44ch;
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 19px;
}

.ns-done-actions {
  margin-top: 4px;
}

.ns-facts {
  display: flex;
  flex-direction: column;
  margin: auto 0 0;
  padding-top: 24px;
}

.ns.is-full .ns-facts {
  margin-top: 8px;
}

/* At full size, under the steps: what is already in place. */
.ns-place {
  margin-top: 36px;
}

.ns-place .ns-facts {
  margin-top: 0;
  padding-top: 12px;
}

.ns-place-title {
  margin: 0;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ns-fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-top: 1px solid var(--rule);
}

.ns-fact dt,
.ns-fact dd {
  margin: 0;
}

.ns-fact dd {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
