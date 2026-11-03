<script setup>
// Prompt ideas (contract 7 `ideas`): each question with where it came from,
// how widely Cansee saw it and when. A row opens to its evidence. Actions:
// Track (the page's dialog confirms the cost), Dismiss or Restore, and Ask
// the agent for an answer page. There is no volume column: Cansee has no
// data on how often people ask.
import { computed, ref } from 'vue'
import { ChevronDown, ExternalLink } from '@lucide/vue'
import { IDEA_SOURCES } from '@/lib/analytics/insightWords'
import { evidenceText, ideaSourceLabel, seenText } from '@/lib/analytics/researchSpecs'
import { timeAgo } from '@/utils/timeAgo'
import { safeHref } from '@/utils/safeHref'
import AnSelect from './AnSelect.vue'
import AskAgentButton from './AskAgentButton.vue'

const props = defineProps({
  websiteId: { type: String, required: true },
  ideas: { type: Array, default: () => [] },
  // Ideas whose Dismiss or Restore is on its way.
  busy: { type: Array, default: () => [] },
})
// track(idea), dismiss(idea), restore(idea), open-answer(result_id)
const emit = defineEmits(['track', 'dismiss', 'restore', 'open-answer'])

// Both filters live in the page's route query and go to the API.
const source = defineModel('source', { type: String, default: '' })
const status = defineModel('status', { type: String, default: 'new' })

const sourceOptions = [
  { value: '', label: 'All sources' },
  ...Object.entries(IDEA_SOURCES).map(([value, label]) => ({ value, label })),
]
const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'tracked', label: 'Tracked' },
  { value: 'dismissed', label: 'Dismissed' },
]

function promptTexts(idea) {
  const seen = new Set()
  for (const e of idea.evidence || []) if (e.prompt_text) seen.add(e.prompt_text)
  return [...seen]
}

const rows = computed(() =>
  props.ideas.map((idea) => ({
    ...idea,
    sourceLabels: (idea.sources || []).map(ideaSourceLabel),
    seenLine: seenText(idea.seen),
    ask: {
      idea: idea.text,
      sources: (idea.sources || []).map(ideaSourceLabel),
      prompts: promptTexts(idea).map((t) => `"${t}"`),
    },
  })),
)

// "example.com/page": a link's address without its scheme, for reading.
function shortUrl(url) {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return String(url || '')
  }
}

const expanded = ref(new Set())

function toggle(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
</script>

<template>
  <section class="it" aria-labelledby="it-title">
    <header class="it-head">
      <h2 id="it-title" class="it-title">Ideas</h2>
      <div class="it-filters" role="group" aria-label="Idea filters">
        <AnSelect v-model="source" label="Source" :options="sourceOptions" />
        <AnSelect v-model="status" label="Status" :options="statusOptions" />
      </div>
    </header>

    <slot v-if="!rows.length" name="empty" />
    <div v-else class="it-scroll" role="region" aria-label="Ideas, scrolls sideways" tabindex="0">
      <table class="it-table">
        <caption class="sr-only">Prompt ideas</caption>
        <thead>
          <tr>
            <th scope="col">Idea</th>
            <th scope="col">Sources</th>
            <th scope="col">Seen</th>
            <th scope="col">Last seen</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, i) in rows" :key="row.id">
            <tr class="it-row" :class="{ 'is-open': expanded.has(row.id) }">
              <th scope="row" class="it-idea">
                <span class="it-idea-text">{{ row.text }}</span>
                <button
                  v-if="(row.evidence || []).length"
                  type="button"
                  class="it-toggle"
                  :aria-expanded="expanded.has(row.id) ? 'true' : 'false'"
                  :aria-controls="`it-evidence-${i}`"
                  @click="toggle(row.id)"
                >
                  Show where it came from
                  <ChevronDown class="it-toggle-icon" aria-hidden="true" />
                </button>
              </th>
              <td>
                <span class="it-chips">
                  <span v-for="label in row.sourceLabels" :key="label" class="it-chip">{{ label }}</span>
                </span>
              </td>
              <td class="it-nowrap">{{ row.seenLine }}</td>
              <td class="it-nowrap">
                <span v-if="row.last_seen_at" :title="row.last_seen_at">{{ timeAgo(row.last_seen_at) }}</span>
              </td>
              <td class="it-actions">
                <span class="it-action-row">
                  <template v-if="row.status === 'tracked'">
                    <router-link
                      v-if="row.tracked_prompt_id"
                      :to="{ name: 'prompt', params: { websiteId, promptId: String(row.tracked_prompt_id) } }"
                      class="it-state is-link"
                    >Tracked</router-link>
                    <span v-else class="it-state">Tracked</span>
                  </template>
                  <button
                    v-else-if="row.status === 'new'"
                    type="button"
                    class="it-btn"
                    @click="emit('track', row)"
                  >Track</button>
                  <button
                    v-if="row.status === 'new'"
                    type="button"
                    class="it-btn is-quiet"
                    :disabled="busy.includes(row.id)"
                    @click="emit('dismiss', row)"
                  >Dismiss</button>
                  <button
                    v-else-if="row.status === 'dismissed'"
                    type="button"
                    class="it-btn is-quiet"
                    :disabled="busy.includes(row.id)"
                    @click="emit('restore', row)"
                  >Restore</button>
                  <AskAgentButton :website-id="websiteId" template="idea" :values="row.ask" />
                </span>
              </td>
            </tr>
            <tr v-if="expanded.has(row.id)" :id="`it-evidence-${i}`" class="it-evidence-row">
              <td colspan="5">
                <ul class="it-evidence" :aria-label="`Where it came from: ${row.text}`">
                  <li v-for="(e, j) in row.evidence" :key="j" class="it-evidence-item">
                    <span>{{ evidenceText(e) }}</span>
                    <a
                      v-if="e.source === 'paa' && safeHref(e.url)"
                      :href="safeHref(e.url)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="it-link"
                      :title="e.url"
                    >
                      {{ shortUrl(e.url) }}
                      <ExternalLink class="it-link-icon" aria-hidden="true" />
                    </a>
                    <button
                      v-if="e.source === 'fanout' && e.result_id"
                      type="button"
                      class="it-link"
                      @click="emit('open-answer', e.result_id)"
                    >Open answer</button>
                  </li>
                </ul>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p class="it-note">
      Cansee has no data on how often people ask these questions, so each idea shows where it came from instead of a volume.
    </p>
  </section>
</template>

<style scoped>
.it {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.it-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.it-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.it-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.it-scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.it-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.it-table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.it-table th,
.it-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.it-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.it-table tbody tr:last-child > * {
  border-bottom: 0;
}

.it-idea {
  min-width: 240px;
  font-weight: 500;
}

.it-idea-text {
  display: block;
  overflow-wrap: anywhere;
}

.it-toggle {
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

.it-toggle:hover {
  color: var(--foreground);
}

.it-toggle-icon {
  width: 13px;
  height: 13px;
  transition: transform 0.15s ease;
}

.it-row.is-open .it-toggle-icon {
  transform: rotate(180deg);
}

.it-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.it-chip {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.it-nowrap {
  white-space: nowrap;
}

.it-actions {
  text-align: right !important;
}

.it-action-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.it-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.it-btn:hover {
  background: var(--accent);
}

.it-btn.is-quiet {
  border-color: transparent;
  background: transparent;
}

.it-btn.is-quiet:hover {
  background: var(--accent);
}

.it-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}

.it-state {
  padding: 0 8px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.it-state.is-link {
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.it-evidence-row > td {
  background: var(--muted);
}

.it-evidence {
  display: grid;
  gap: 6px;
  list-style: none;
  font-size: 13px;
}

.it-evidence-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}

.it-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.it-link:hover {
  color: var(--foreground);
}

.it-link-icon {
  width: 12px;
  height: 12px;
}

.it-note {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .it {
    padding: 16px;
  }
}
</style>
