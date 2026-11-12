<script setup>
// The themes the analyzed answers repeat (contract 3c `themes`): how the
// engines describe you, in what tone, how often in this window and the one
// before, and an example quote that appears word for word in the answer.
// Each row can hand its theme to the agent as a drafted message.
import { computed, ref } from 'vue'
import { TONES } from '@/lib/analytics/insightWords'
import { engineMeta } from '@/lib/engines'
import AnSelect from './AnSelect.vue'
import AskAgentButton from './AskAgentButton.vue'

const props = defineProps({
  websiteId: { type: String, required: true },
  themes: { type: Array, default: () => [] },
  // The window's length, for the previous window's column.
  days: { type: Number, default: 30 },
})
const emit = defineEmits(['open-answer'])

const integer = new Intl.NumberFormat('en-US')

const tone = ref('')
const toneOptions = [
  { value: '', label: 'All tones' },
  ...Object.entries(TONES).map(([value, label]) => ({ value, label })),
]

const rows = computed(() =>
  props.themes
    .filter((t) => !tone.value || t.tone === tone.value)
    .map((t) => {
      const quote = (t.quotes || [])[0] || null
      return {
        key: t.key,
        label: t.label,
        tone: TONES[t.tone] || t.tone,
        answers: typeof t.answers === 'number' ? integer.format(t.answers) : '',
        previous: typeof t.prev_answers === 'number' ? integer.format(t.prev_answers) : null,
        engines: (t.engines || []).map((k) => engineMeta(k).label).join(', '),
        quote,
        ask: {
          theme: t.label,
          tone: String(TONES[t.tone] || t.tone || '').toLowerCase(),
          answers: t.answers,
          engines: t.engines || [],
          quote: quote?.quote || '',
        },
      }
    }),
)
</script>

<template>
  <section class="tt" aria-labelledby="tt-title">
    <header class="tt-head">
      <h2 id="tt-title" class="tt-title">Themes</h2>
      <AnSelect v-model="tone" label="Tone" :options="toneOptions" />
    </header>

    <p v-if="!rows.length" class="tt-empty">No themes match this filter.</p>
    <div v-else class="tt-scroll" role="region" aria-label="Themes, scrolls sideways" tabindex="0">
      <table class="tt-table">
        <caption class="sr-only">Themes</caption>
        <thead>
          <tr>
            <th scope="col">Theme</th>
            <th scope="col">Tone</th>
            <th scope="col" class="is-num">Answers</th>
            <th scope="col" class="is-num">Previous {{ days }} days</th>
            <th scope="col">Engines</th>
            <th scope="col">Example</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row" class="tt-theme">{{ row.label }}</th>
            <td>{{ row.tone }}</td>
            <td class="is-num">{{ row.answers }}</td>
            <td class="is-num" :class="{ 'is-word': row.previous === null }">{{ row.previous ?? 'Not analyzed' }}</td>
            <td class="tt-engines">{{ row.engines }}</td>
            <td class="tt-example">
              <template v-if="row.quote">
                <span class="tt-quote">"{{ row.quote.quote }}"</span>
                <button
                  v-if="row.quote.result_id"
                  type="button"
                  class="tt-link"
                  @click="emit('open-answer', row.quote.result_id)"
                >Open answer</button>
              </template>
            </td>
            <td class="tt-actions">
              <AskAgentButton :website-id="websiteId" template="theme" :values="row.ask" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.tt {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.tt-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.tt-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.tt-empty {
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.tt-scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.tt-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.tt-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.tt-table th,
.tt-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.tt-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.tt-table tbody tr:last-child > * {
  border-bottom: 0;
}

.tt-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.tt-table .is-word {
  color: var(--muted-foreground);
}

.tt-theme {
  min-width: 160px;
  font-weight: 600;
}

.tt-engines {
  white-space: nowrap;
}

.tt-example {
  min-width: 220px;
  max-width: 320px;
}

.tt-quote {
  display: block;
  overflow-wrap: anywhere;
}

.tt-link {
  margin-top: 4px;
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

.tt-link:hover {
  color: var(--foreground);
}

.tt-actions {
  text-align: right !important;
}

@container bd-panel (max-width: 480px) {
  .tt {
    padding: 16px;
  }
}
</style>
