<script setup>
// "Where this came from" (attribution_contract.md 1): the findings for one
// answer, numbered like the marks in the answer. A row selects its finding;
// "View on page" opens the source viewer. Loading, failed, timed-out and
// empty states live here too.
import { computed, useId } from 'vue'
import { FileSearch, Loader2, RefreshCw } from '@lucide/vue'
import { confidenceMeta, sourceStyle } from '@/lib/attribution/sourceTypes'
import './attribution.css'

const props = defineProps({
  // {phase, data, error} from useAttribution.
  state: { type: Object, required: true },
  // layoutFindings(...).items: [{finding, n, span}].
  items: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
})
const emit = defineEmits(['select', 'open', 'retry'])

const titleId = useId()
const phase = computed(() => props.state.phase)
const byType = computed(() =>
  (props.state.data?.summary?.by_type || []).filter((t) => t && t.label && t.count > 0),
)

const rows = computed(() =>
  props.items.map(({ finding, n, span }) => ({
    id: String(finding.id ?? n),
    n,
    finding,
    placed: Boolean(span),
    style: sourceStyle(finding.source),
    confidence: confidenceMeta(finding.confidence),
    where: finding.source?.title || finding.source?.domain || '',
    domain: finding.source?.domain || '',
  })),
)

const RETRY_COPY = {
  failed: { text: "We couldn't work out where this answer came from.", action: 'Try again' },
  timeout: { text: 'This is taking longer than usual.', action: 'Check again' },
  error: { text: "We couldn't load the sources for this answer.", action: 'Try again' },
}
const retryCopy = computed(() => RETRY_COPY[phase.value] || null)
</script>

<template>
  <section class="att-list" :aria-labelledby="titleId">
    <div class="att-list-head">
      <h3 :id="titleId" class="att-list-title">Where this came from</h3>
      <div v-if="phase === 'ready' && byType.length" class="att-types">
        <span v-for="t in byType" :key="t.type || t.label" class="att-type-chip">{{ t.label }} {{ t.count }}</span>
      </div>
    </div>

    <p v-if="phase === 'loading' || phase === 'pending'" class="att-state" role="status">
      <Loader2 :size="14" class="animate-spin" aria-hidden="true" />
      Finding the pages this answer drew on. This can take up to a minute.
    </p>

    <div v-else-if="retryCopy" class="att-state att-state--error" role="alert">
      <span>{{ retryCopy.text }}</span>
      <button type="button" class="att-retry" @click="emit('retry')">
        <RefreshCw :size="13" aria-hidden="true" /> {{ retryCopy.action }}
      </button>
    </div>

    <p v-else-if="phase === 'ready' && !rows.length" class="att-state">
      <FileSearch :size="14" aria-hidden="true" />
      We found no web pages behind this answer. It may come from what the engine already knows.
    </p>

    <template v-else-if="phase === 'ready'">
      <p class="att-legend">
        <span class="att-conf att-conf--confirmed">Confirmed</span> the engine cited the page.
        <span class="att-conf">Likely</span> the same words appear on the page.
      </p>
      <ol class="att-rows">
        <li
          v-for="r in rows"
          :key="r.id"
          :data-finding-row="r.id"
          class="att-row"
          :class="{ 'att-row--active': r.id === selectedId }"
          @click="emit('select', r.id)"
        >
          <button
            type="button"
            class="att-row-head"
            :aria-pressed="r.id === selectedId"
            @click.stop="emit('select', r.id)"
          >
            <span class="att-num" :class="r.style.ownerClass">{{ r.n }}</span>
            <component :is="r.style.icon" :size="14" class="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span class="att-row-label">{{ r.style.label }}</span>
            <span v-if="r.where" class="att-row-where">{{ r.where }}</span>
          </button>
          <div class="att-badges">
            <span class="att-owner" :class="r.style.ownerClass">{{ r.style.ownerLabel }}</span>
            <span class="att-conf" :class="r.confidence.className" :title="r.confidence.hint">{{ r.confidence.label }}</span>
            <span v-if="r.domain && r.domain !== r.where" class="att-domain">{{ r.domain }}</span>
          </div>

          <div class="att-quote">
            <div class="att-quote-label">In the answer</div>
            <p>{{ r.finding.answer_quote }}</p>
          </div>
          <div class="att-quote">
            <div class="att-quote-label">On the page</div>
            <p v-if="r.finding.page_quote">{{ r.finding.page_quote }}</p>
            <p v-else class="att-muted">We couldn't read this page.</p>
          </div>
          <p v-if="r.finding.reason" class="att-reason">{{ r.finding.reason }}</p>

          <div class="att-row-foot">
            <span v-if="r.finding.suggestion" class="att-muted">Suggested edit available</span>
            <button type="button" class="att-open" @click.stop="emit('open', r.id)">View on page</button>
          </div>
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.att-list {
  margin-top: 1.75rem;
  border-top: 1px solid var(--border);
  padding-top: 1.25rem;
}
.att-list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.att-list-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--foreground);
}
.att-types {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.att-type-chip {
  border-radius: 9999px;
  background: var(--secondary);
  padding: 1px 8px;
  font-size: 11px;
  color: var(--muted-foreground);
}
.att-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.att-state--error {
  color: var(--destructive);
}
.att-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.att-legend {
  margin-bottom: 0.75rem;
  font-size: 11px;
  line-height: 1.8;
  color: var(--muted-foreground);
}
.att-legend .att-conf + .att-conf,
.att-legend .att-conf:not(:first-child) {
  margin-left: 0.5rem;
}
.att-rows {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.att-row {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 0.75rem 0.875rem;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.att-row:hover {
  background: var(--secondary);
}
.att-row--active {
  border-color: var(--ring);
  background: var(--secondary);
}
.att-row-head {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
  border-radius: 0.375rem;
}
.att-row-head:focus-visible,
.att-open:focus-visible,
.att-retry:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.att-num {
  display: inline-flex;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--att-c);
  background: color-mix(in srgb, var(--att-c) 14%, transparent);
}
.att-row-label {
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--foreground);
}
.att-row-where {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.att-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin: 0.375rem 0 0.5rem 1.75rem;
}
.att-domain {
  font-size: 11px;
  color: var(--muted-foreground);
}
.att-quote {
  margin: 0 0 0.5rem 1.75rem;
  border-left: 2px solid var(--border);
  padding-left: 0.625rem;
}
.att-quote-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.att-quote p {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--foreground);
}
.att-reason {
  margin-left: 1.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--muted-foreground);
}
.att-muted {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.att-row-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.att-open {
  border: 1px solid var(--border);
  border-radius: 9999px;
  background: var(--card);
  padding: 2px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--foreground);
}
.att-open:hover {
  background: var(--background);
}
</style>
