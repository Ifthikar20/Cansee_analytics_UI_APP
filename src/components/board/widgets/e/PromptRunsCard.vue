<script setup>
// The "prompt-runs" block: the account's prompt runs of this month. A Free
// account reads how many are left as one large number over the allowance
// drawn as marks (spent, out right now, left), with the day they renew. A
// paid account has no limit, so it reads how many it used. Both list the
// runs by engine at full size. The figures are the server's runs block
// (agent status, else the session); there is no dollar amount here.
import { computed, onMounted, ref } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import BarList from '@/components/board/BarList.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import CardState from '@/components/board/widgets/a/CardState.vue'
import { useCardStatus } from '@/lib/board/context'
import { runsModel, runsSource } from '@/lib/board/e/runs'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

// The engines a compact card lists for an account without a limit.
const COMPACT_ENGINES = 3

const agent = useAgentStore()
const auth = useAuthStore()

// Whether the status was asked for at all (AppShell loads it with the
// project; a card mounted without it asks once itself).
const asked = ref(Boolean(agent.status || agent.statusLoading || agent.statusError))

function check() {
  asked.value = true
  Promise.resolve(agent.loadStatus()).catch(() => {})
}

onMounted(() => {
  if (!asked.value) check()
})

const source = computed(() =>
  runsSource({
    status: agent.status,
    loading: Boolean(agent.statusLoading),
    failed: Boolean(agent.statusError),
    asked: asked.value,
    session: auth.session?.limits?.prompt_runs,
  }),
)
const model = computed(() =>
  source.value.phase === 'ready' ? runsModel(source.value.raw) : null,
)
const phase = computed(() => (source.value.phase === 'ready' && !model.value ? 'none' : source.value.phase))

useCardStatus(() => {
  if (phase.value === 'loading') return 'loading'
  if (phase.value === 'failed') return 'error'
  if (phase.value === 'none') return 'empty'
  return source.value.stale ? 'stale' : 'live'
})

const full = computed(() => props.size === 'full')
const free = computed(() => model.value?.mode === 'free')
// A long figure is set smaller so it stays on one line.
const figureSize = computed(() => {
  const n = model.value?.numeral.length || 0
  return n > 5 ? 'is-xs' : n > 3 ? 'is-sm' : ''
})
const engineItems = computed(() => {
  const rows = model.value?.engines || []
  const shown = full.value ? rows : rows.slice(0, COMPACT_ENGINES)
  // Every row is this account's own runs, so every bar is ink (BarList).
  return shown.map((e) => ({ key: e.key, label: e.label, value: e.count, text: e.text, emphasis: true }))
})
// A compact card of an account without a limit lists its engines; a Free
// one keeps the room for the allowance.
const compactEngines = computed(() => !full.value && !free.value && engineItems.value.length > 0)
// Runs out right now sit where the other mode has nothing to say: beside
// the label on Free, at the end of the foot line without a limit.
const axisLeft = computed(() => (free.value ? model.value.usedText : model.value?.renews || ''))
const axisRight = computed(() => (free.value ? model.value.renews : ''))
const hint = computed(() => {
  const m = model.value
  if (!m || full.value || !free.value) return ''
  if (m.exhausted) return 'The AI engines are asked again once the runs renew.'
  return m.low ? 'Few runs are left this month.' : ''
})
const link = computed(() =>
  free.value ? { label: 'See plans', to: { name: 'billing' } } : { label: 'Usage', to: { name: 'settings', query: { section: 'usage' } } },
)
</script>

<template>
  <CardSkeleton v-if="phase === 'loading'" />
  <CardState
    v-else-if="phase === 'failed'"
    kind="error"
    title="Prompt runs couldn't load."
    :action="{ label: 'Try again' }"
    @action="check"
  />
  <CardState
    v-else-if="phase === 'none'"
    title="This account doesn't report prompt runs yet."
    body="Your plan page says what is included."
    :action="{ label: 'See plans', to: { name: 'billing' } }"
  />
  <div v-else class="pr" :class="[`is-${model.mode}`, { 'is-full': full, 'is-spent': model.exhausted }]">
    <p class="pr-sr">{{ model.sentence }}</p>

    <div class="pr-lead" aria-hidden="true">
      <div class="pr-head">
        <span class="cs-label">{{ model.label }}</span>
        <span v-if="model.cap" class="cs-label">{{ model.cap }}</span>
        <span v-else-if="model.outText" class="pr-out cs-label"><span class="cs-dot"></span>{{ model.outText }}</span>
      </div>
      <p class="pr-figure" :class="figureSize">
        <span class="pr-numeral">{{ model.numeral }}</span>
        <span v-if="model.unit" class="pr-unit cs-numeral__unit">{{ model.unit }}</span>
      </p>
      <p v-if="hint" class="pr-hint">{{ hint }}</p>

      <div class="pr-base">
        <div v-if="model.segments.length" class="pr-bar" :style="{ '--pr-n': model.segments.length }" data-meter>
          <span
            v-for="(seg, i) in model.segments"
            :key="i"
            class="pr-seg"
            :class="[`is-${seg.state}`, { 'is-next': seg.next }]"
          ></span>
        </div>
        <BarList v-if="compactEngines" class="pr-engines" :items="engineItems" />
        <div v-if="axisLeft || axisRight || (!free && model.outText)" class="pr-axis">
          <span v-if="axisLeft" class="cs-label">{{ axisLeft }}</span>
          <span v-if="axisRight" class="cs-label">{{ axisRight }}</span>
          <span v-else-if="!free && model.outText" class="pr-out cs-label"><span class="cs-dot"></span>{{ model.outText }}</span>
        </div>
      </div>
    </div>

    <div v-if="full" class="pr-more">
      <template v-if="engineItems.length">
        <p class="cs-label">{{ free ? 'Used by engine' : 'By engine' }}</p>
        <BarList :items="engineItems" label="Prompt runs by engine this month" />
      </template>
      <p v-else class="pr-note">No engine has answered a run yet this month.</p>
      <p v-for="note in model.notes" :key="note" class="pr-note">{{ note }}</p>
      <p v-if="model.perMark" class="pr-note">Each mark of the bar stands for about {{ Math.round(model.perMark) }} runs.</p>
      <div class="pr-actions">
        <AgButton size="sm" :to="link.to">{{ link.label }}</AgButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.pr-sr {
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

.pr-lead {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.pr-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

/* The one number: as large as the card allows, tight, on the grid's left
   edge, with its unit on the baseline beside it. */
.pr-figure {
  display: flex;
  align-items: baseline;
  gap: 0.12em;
  margin: 18px 0 0;
  font-size: clamp(72px, 34cqi, 152px);
}

.pr-figure.is-sm {
  font-size: clamp(56px, 24cqi, 120px);
}

.pr-figure.is-xs {
  font-size: clamp(44px, 17cqi, 96px);
}

.pr-numeral {
  margin-left: -0.04em;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: 1em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 0.84;
  letter-spacing: -0.06em;
}

.pr.is-spent .pr-numeral {
  color: var(--muted-foreground);
}

.pr-unit {
  text-transform: uppercase;
  white-space: nowrap;
}

.pr-hint {
  max-width: 30ch;
  margin: 14px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 18px;
}

/* The allowance as marks: spent ones recede, the ones left are ink and the
   next one to be spent is the accent. */
.pr-base {
  margin-top: auto;
  padding-top: 24px;
}

.pr-bar {
  display: grid;
  grid-template-columns: repeat(var(--pr-n, 1), minmax(0, 1fr));
  gap: 2px;
  height: clamp(18px, 7cqi, 28px);
  margin-bottom: 12px;
}

.pr-seg {
  background: var(--foreground);
}

.pr-seg.is-used {
  background: var(--bar);
}

.pr-seg.is-out {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--muted-foreground);
}

.pr-seg.is-next {
  background: var(--signal);
}

.pr-engines {
  margin-bottom: 14px;
}

.pr-axis {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

.pr-out {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--foreground);
  white-space: nowrap;
}

.pr-more {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.pr-note {
  max-width: 62ch;
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 19px;
}

.pr-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

/* At full size the figure keeps the left column and the breakdown sits
   beside it once there is room. */
.pr.is-full {
  gap: 28px;
}

.pr.is-full .pr-lead {
  flex: 0 0 auto;
}

.pr.is-full .pr-figure {
  font-size: clamp(88px, 20cqi, 152px);
}

.pr.is-full .pr-figure.is-sm {
  font-size: clamp(64px, 14cqi, 108px);
}

.pr.is-full .pr-figure.is-xs {
  font-size: clamp(44px, 9cqi, 70px);
}

.pr.is-full .pr-base {
  margin-top: 0;
  padding-top: 28px;
}

@container (min-width: 640px) {
  .pr.is-full {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 4fr);
    align-items: start;
    gap: 40px;
  }
}
</style>
