<script setup>
// "Where you stand" (attribution_contract.md 1, summary): one line of facts
// above the answer. Words come from lib/attribution/summary.js.
import { computed } from 'vue'
import { Loader2 } from '@lucide/vue'
import { summaryFacts } from '@/lib/attribution/summary'

const props = defineProps({
  // {phase, data} from useAttribution.
  state: { type: Object, required: true },
})

const facts = computed(() => (props.state.phase === 'ready' ? summaryFacts(props.state.data?.summary) : []))
const busy = computed(() => ['loading', 'pending'].includes(props.state.phase))
</script>

<template>
  <section v-if="facts.length || busy" class="att-stand" aria-label="Where you stand">
    <div class="att-stand-title">Where you stand</div>
    <p v-if="busy" class="att-stand-busy" role="status">
      <Loader2 :size="13" class="animate-spin" aria-hidden="true" />
      Checking where this answer came from
    </p>
    <dl v-else class="att-stand-facts">
      <div v-for="f in facts" :key="f.key" class="att-stand-fact">
        <dt>{{ f.label }}</dt>
        <dd :class="`att-tone--${f.tone}`">{{ f.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.att-stand {
  margin-bottom: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--background);
  padding: 0.625rem 0.875rem;
}
.att-stand-title {
  margin-bottom: 0.375rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.att-stand-busy {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.att-stand-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.5rem 1rem;
}
.att-stand-fact dt {
  font-size: 11px;
  color: var(--muted-foreground);
}
.att-stand-fact dd {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--foreground);
}
.att-tone--good {
  color: #15803d;
}
.att-tone--warn {
  color: #b45309;
}
.att-tone--bad {
  color: var(--severity-high);
}
[data-theme='dark'] .att-tone--good {
  color: #86efac;
}
[data-theme='dark'] .att-tone--warn {
  color: #fcd34d;
}
</style>
