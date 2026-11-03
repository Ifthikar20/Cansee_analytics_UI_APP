<script setup>
// The project's pages (p2_contract.md 6), each with what Google, the AI
// engines, AI visitors, AI crawlers and the audit did with it, in words
// when a source is not on. Each row offers Ask the agent (page_optimize)
// with the measured facts of that page.
import { computed, useId } from 'vue'
import { ExternalLink } from '@lucide/vue'
import AskAgentButton from './AskAgentButton.vue'
import { pageFactLines } from '@/lib/analytics/askTemplates'
import { sitePageRows } from '@/lib/analytics/siteSpecs'

const props = defineProps({
  websiteId: { type: String, required: true },
  // The pages payload (contract 6).
  payload: { type: Object, default: null },
  // The period's length, for the AI visits fact.
  days: { type: Number, default: 30 },
  title: { type: String, default: 'Pages' },
})

const titleId = useId()
const rows = computed(() => sitePageRows(props.payload))
const sources = computed(() => props.payload?.sources || {})
const raw = computed(() => Object.fromEntries((props.payload?.pages || []).map((p) => [p.url, p])))

// Only the measured signals of sources that are on go into the draft.
function askValues(row) {
  const page = { ...(raw.value[row.url] || {}) }
  const s = sources.value
  for (const [field, source] of [
    ['google', s.google],
    ['citations', s.citations],
    ['ai_visits', s.ai_visits],
    ['crawler_requests', s.crawlers],
    ['audit', s.audit],
  ]) {
    if (source?.state !== 'ok') page[field] = null
  }
  return { url: row.url, facts: pageFactLines(page, { days: props.days }) }
}
</script>

<template>
  <section class="spt" :aria-labelledby="titleId">
    <h3 :id="titleId" class="sr-only">{{ title }}</h3>
    <div class="spt-scroll" tabindex="0" role="region" :aria-label="`${title}, scrolls sideways`">
      <table class="spt-table">
        <caption class="sr-only">{{ title }}</caption>
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Google</th>
            <th scope="col" class="is-num">AI citations</th>
            <th scope="col" class="is-num">AI visits</th>
            <th scope="col" class="is-num">Crawler requests</th>
            <th scope="col">Audit</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.url">
            <th scope="row" class="spt-page">
              <a :href="row.url" target="_blank" rel="noopener" class="spt-link" :title="row.url">
                <span>{{ row.path }}</span>
                <ExternalLink class="spt-ext" aria-hidden="true" />
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            </th>
            <td>
              <span class="spt-main">{{ row.google.text }}</span>
              <span v-if="row.google.sub" class="spt-sub">{{ row.google.sub }}</span>
            </td>
            <td class="is-num">
              <span class="spt-main">{{ row.citations.text }}</span>
              <span v-if="row.citations.sub" class="spt-sub">{{ row.citations.sub }}</span>
              <span v-if="row.citations.retrievedOnly" class="spt-badge">Retrieved, never cited</span>
            </td>
            <td class="is-num">{{ row.visits }}</td>
            <td class="is-num">{{ row.crawler }}</td>
            <td>
              <span class="spt-main">{{ row.audit.text }}</span>
              <ul v-if="row.audit.failing.length" class="spt-chips" aria-label="Failing checks">
                <li v-for="label in row.audit.failing" :key="label" class="spt-chip">{{ label }}</li>
              </ul>
            </td>
            <td class="spt-action">
              <AskAgentButton :website-id="websiteId" template="page_optimize" :values="askValues(row)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.spt {
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.spt-scroll {
  overflow-x: auto;
}

.spt-scroll:focus-visible {
  border-radius: 8px;
}

.spt-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 13px;
}

.spt-table th,
.spt-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.spt-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.spt-table tbody tr:last-child > * {
  border-bottom: 0;
}

.spt-page {
  max-width: 280px;
  font-weight: 500;
}

.spt-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.spt-ext {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  color: var(--muted-foreground);
}

.spt-main {
  display: block;
}

.spt-sub {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap;
}

.spt-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--foreground);
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

.spt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  list-style: none;
}

.spt-chip {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.spt-action {
  width: 1%;
  white-space: nowrap;
}

.is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.spt-table th.is-num {
  text-align: right;
}
</style>
