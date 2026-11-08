<template>
  <div
    v-if="block"
    class="prm"
    :class="{ 'is-warn': low && !exhausted, 'is-exceeded': exhausted }"
    role="group"
    aria-labelledby="prm-title"
  >
    <div class="prm-head">
      <span id="prm-title" class="prm-title">Free prompt runs<template v-if="planLabel"> · {{ planLabel }}</template></span>
      <span class="prm-amt">{{ usedText }}</span>
    </div>
    <div
      v-if="block.limit"
      class="prm-bar"
      role="progressbar"
      :aria-valuenow="usedShown"
      aria-valuemin="0"
      :aria-valuemax="block.limit"
      :aria-valuetext="usedText"
      aria-labelledby="prm-title"
    >
      <div class="prm-bar-fill" :style="{ width: pct + '%' }"></div>
    </div>
    <p class="prm-note">{{ note }}</p>
    <p v-if="engines.length" class="prm-note">Used by engine: {{ engines.join(', ') }}.</p>
    <p v-if="exhausted" class="prm-flag is-exceeded">
      All free prompt runs are used. The AI engines are asked again once they renew; Google results still work.
    </p>
    <p v-else-if="low" class="prm-flag is-warn">Few free prompt runs are left this month.</p>
  </div>
</template>

<script setup>
// The Free plan's monthly prompt runs, for Settings, Usage: "7 of 20 free
// prompt runs used", what is left and when they renew. Takes the runs block
// of GET auth/me/ai-usage/ as is; shows nothing for paid (unlimited)
// accounts or a block it cannot read.
import { computed } from 'vue'
import { engineMeta } from '@/lib/engines'
import { meteredRuns, renewSentence, runsLeftText, runsUsedText } from '@/lib/promptRuns'

const props = defineProps({
  runs: { type: Object, default: null },
  planLabel: { type: String, default: '' },
})

const block = computed(() => meteredRuns(props.runs))
const usedText = computed(() => runsUsedText(block.value) || runsLeftText(block.value))
const note = computed(() =>
  [`${runsLeftText(block.value)}.`, renewSentence(block.value), 'One prompt run is one prompt answered by one AI engine, shared by all your projects.']
    .filter(Boolean)
    .join(' '),
)
const usedShown = computed(() => Math.min(block.value?.used ?? 0, block.value?.limit ?? 0))
const pct = computed(() => {
  const limit = block.value?.limit
  return limit ? Math.min(100, Math.round(((limit - block.value.remaining) / limit) * 100)) : 0
})
const exhausted = computed(() => Boolean(block.value) && block.value.remaining <= 0)
// A quarter or less left, as the server's prompt_runs_low issue counts it.
const low = computed(() => {
  const b = block.value
  return Boolean(b && b.limit) && b.remaining <= Math.max(1, Math.floor(b.limit / 4))
})
const engines = computed(() => {
  const by = props.runs?.by_engine
  if (!by || typeof by !== 'object') return []
  return Object.entries(by)
    .map(([key, n]) => [engineMeta(key).label, Number(n)])
    .filter(([, n]) => Number.isFinite(n) && n > 0)
    .map(([label, n]) => `${label} ${n}`)
})
</script>

<style scoped>
.prm {
  margin-bottom: 16px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--muted);
}
.prm-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 10px;
}
.prm-title { font-size: 13px; font-weight: 600; color: var(--foreground); }
.prm-amt { font-size: 13px; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
.prm-bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--border); }
.prm-bar-fill { height: 100%; border-radius: inherit; background: var(--chart-2); transition: width 200ms ease; }
.is-warn .prm-bar-fill { background: var(--chart-5); }
.is-exceeded .prm-bar-fill { background: var(--destructive); }
.prm-note { margin: 10px 0 0; font-size: 12px; color: var(--muted-foreground); }
.prm-note + .prm-note { margin-top: 4px; }
.prm-flag { margin: 8px 0 0; font-size: 12px; font-weight: 600; }
.prm-flag.is-warn { color: #b25e09; }
.prm-flag.is-exceeded { color: var(--destructive); }
:global([data-theme='dark']) .prm-flag.is-warn { color: #f0a54a; }
@media (prefers-reduced-motion: reduce) {
  .prm-bar-fill { transition: none; }
}
</style>
