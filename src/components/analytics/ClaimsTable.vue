<script setup>
// The claims the analyzed answers make about you (contract 3d `claims`),
// grouped by claim and verdict: what was said, what your evidence says and
// where it was said. Contradicted claims can go to the agent as a
// correction (or as requests to the publishers that repeat them); claims no
// evidence covers can go to the agent or become a brand fact.
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { TOPICS, VERDICTS } from '@/lib/analytics/insightWords'
import { engineMeta } from '@/lib/engines'
import { formatDateLabel } from '@/lib/charts/format'
import { timeAgo } from '@/utils/timeAgo'
import AnSelect from './AnSelect.vue'
import AskAgentButton from './AskAgentButton.vue'
import EvidenceQuote from './EvidenceQuote.vue'
import VerdictBadge from './VerdictBadge.vue'
import VizState from '@/components/charts/VizState.vue'

const props = defineProps({
  websiteId: { type: String, required: true },
  claims: { type: Array, default: () => [] },
  // Answers analyzed in the window, for the Answers hint.
  analyzed: { type: Number, default: null },
})
// clear-filters: the page drops both filters from its route query at once.
const emit = defineEmits(['open-answer', 'clear-filters'])

// Both filters live in the page's route query and go to the API.
const verdict = defineModel('verdict', { type: String, default: '' })
const topic = defineModel('topic', { type: String, default: '' })

const integer = new Intl.NumberFormat('en-US')

const VERDICT_ORDER = ['contradicted', 'not_verifiable', 'unchecked', 'supported']
const verdictOptions = [
  { value: '', label: 'All verdicts' },
  ...VERDICT_ORDER.map((key) => ({ value: key, label: VERDICTS[key].word })),
]
const topicOptions = [
  { value: '', label: 'All topics' },
  ...Object.entries(TOPICS).map(([value, label]) => ({ value, label })),
]

const analyzedHint = computed(() =>
  typeof props.analyzed === 'number' ? `of ${integer.format(props.analyzed)} analyzed` : '',
)

function evidenceValues(claim) {
  const evidence = claim.evidence || {}
  return {
    evidence_quote: evidence.quote || '',
    evidenceKind: evidence.kind || null,
    evidence_url: evidence.url || '',
  }
}

const rows = computed(() =>
  props.claims.map((c) => ({
    ...c,
    topicLabel: TOPICS[c.topic] || c.topic || '',
    answersText: typeof c.answers === 'number' ? integer.format(c.answers) : '',
    enginesText: (c.engines || []).map((k) => engineMeta(k).label).join(', '),
    ask: {
      claim: c.text,
      engines: c.engines || [],
      answers: c.answers,
      key: c.key,
      ...evidenceValues(c),
    },
  })),
)

// ── Rows that open to show where each claim was said ──
const expanded = ref(new Set())

function toggle(key) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function rowId(index) {
  return `cl-where-${index}`
}

</script>

<template>
  <section class="cl" aria-labelledby="cl-title">
    <header class="cl-head">
      <h2 id="cl-title" class="cl-title">Claims</h2>
      <div class="cl-filters" role="group" aria-label="Claim filters">
        <AnSelect v-model="verdict" label="Verdict" :options="verdictOptions" />
        <AnSelect v-model="topic" label="Topic" :options="topicOptions" />
      </div>
    </header>

    <VizState
      v-if="!rows.length"
      kind="empty"
      compact
      title="No claims match these filters."
      :action="verdict || topic ? { label: 'Clear filters' } : null"
      @action="emit('clear-filters')"
    />
    <div v-else class="cl-scroll" role="region" aria-label="Claims, scrolls sideways" tabindex="0">
      <table class="cl-table">
        <caption class="sr-only">Claims</caption>
        <thead>
          <tr>
            <th scope="col">Claim</th>
            <th scope="col">Topic</th>
            <th scope="col">Verdict</th>
            <th scope="col" class="is-num">Answers</th>
            <th scope="col">Engines</th>
            <th scope="col">Evidence</th>
            <th scope="col">Last seen</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, i) in rows" :key="row.key">
            <tr class="cl-row" :class="{ 'is-open': expanded.has(row.key) }">
              <th scope="row" class="cl-claim">
                <span class="cl-claim-text">{{ row.text }}</span>
                <button
                  v-if="(row.occurrences || []).length"
                  type="button"
                  class="cl-toggle"
                  :aria-expanded="expanded.has(row.key) ? 'true' : 'false'"
                  :aria-controls="rowId(i)"
                  @click="toggle(row.key)"
                >
                  Show where it was said
                  <ChevronDown class="cl-toggle-icon" aria-hidden="true" />
                </button>
              </th>
              <td class="cl-nowrap">{{ row.topicLabel }}</td>
              <td><VerdictBadge :verdict="row.verdict" help /></td>
              <td class="is-num">
                <span class="cl-count">{{ row.answersText }}</span>
                <span v-if="analyzedHint" class="cl-sub">{{ analyzedHint }}</span>
              </td>
              <td class="cl-nowrap">{{ row.enginesText }}</td>
              <td class="cl-evidence">
                <span v-if="row.verdict === 'not_verifiable'" class="cl-muted">No evidence covers this</span>
                <span v-else-if="row.verdict === 'unchecked'" class="cl-muted">Not checked</span>
                <EvidenceQuote v-else :evidence="row.evidence" :note="row.note || ''" />
              </td>
              <td class="cl-nowrap">
                <span v-if="row.last_seen_at" :title="row.last_seen_at">{{ timeAgo(row.last_seen_at) }}</span>
              </td>
              <td class="cl-actions">
                <template v-if="row.verdict === 'contradicted'">
                  <AskAgentButton :website-id="websiteId" template="fact_contradicted" :values="row.ask" />
                  <AskAgentButton
                    :website-id="websiteId"
                    template="fact_publishers"
                    :values="row.ask"
                    label="Ask publishers to correct it"
                  />
                </template>
                <template v-else-if="row.verdict === 'not_verifiable'">
                  <AskAgentButton :website-id="websiteId" template="fact_unverifiable" :values="row.ask" />
                  <router-link :to="{ name: 'settings-brand-facts' }" class="cl-link">Add a brand fact</router-link>
                </template>
              </td>
            </tr>
            <tr v-if="expanded.has(row.key)" :id="rowId(i)" class="cl-where-row">
              <td colspan="8">
                <ul class="cl-where" :aria-label="`Where it was said: ${row.text}`">
                  <li v-for="o in row.occurrences" :key="`${o.result_id}-${o.answered_at}`" class="cl-where-item">
                    <span class="cl-where-meta">
                      {{ engineMeta(o.engine).label }} · {{ formatDateLabel(o.answered_at, 'day') }}
                    </span>
                    <span class="cl-where-quote">"{{ o.quote }}"</span>
                    <button
                      v-if="o.result_id"
                      type="button"
                      class="cl-link-btn"
                      @click="emit('open-answer', o.result_id)"
                    >Open answer</button>
                  </li>
                </ul>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.cl {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.cl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.cl-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.cl-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.cl-scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.cl-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.cl-table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.cl-table th,
.cl-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.cl-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.cl-table tbody tr:last-child > * {
  border-bottom: 0;
}

.cl-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.cl-claim {
  min-width: 240px;
  max-width: 340px;
  font-weight: 500;
}

.cl-claim-text {
  display: block;
  overflow-wrap: anywhere;
}

.cl-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
}

.cl-toggle:hover {
  color: var(--foreground);
}

.cl-toggle-icon {
  width: 13px;
  height: 13px;
  transition: transform 0.15s ease;
}

.cl-row.is-open .cl-toggle-icon {
  transform: rotate(180deg);
}

.cl-nowrap {
  white-space: nowrap;
}

.cl-count {
  display: block;
  font-weight: 600;
}

.cl-sub {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
}

.cl-evidence {
  min-width: 220px;
  max-width: 320px;
}

.cl-muted {
  color: var(--muted-foreground);
}

.cl-actions {
  min-width: 200px;
}

.cl-actions > * + * {
  margin-top: 4px;
}

.cl-link {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cl-where-row > td {
  background: var(--muted);
}

.cl-where {
  display: grid;
  gap: 8px;
  list-style: none;
}

.cl-where-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 13px;
}

.cl-where-meta {
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap;
}

.cl-where-quote {
  min-width: 0;
  overflow-wrap: anywhere;
}

.cl-link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.cl-link-btn:hover {
  color: var(--foreground);
}

@media (max-width: 640px) {
  .cl {
    padding: 16px;
  }
}
</style>
