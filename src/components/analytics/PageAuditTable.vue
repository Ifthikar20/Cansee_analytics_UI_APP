<script setup>
// The pages the crawler audit read (p2_contract.md 5b, 5d), fewest checks
// passed first: status, the words readable without JavaScript, the checks
// that fail and the bots robots.txt keeps out. A page with a failing check
// offers Ask the agent (crawler_fix).
import { computed, useId } from 'vue'
import { ExternalLink } from '@lucide/vue'
import AskAgentButton from './AskAgentButton.vue'
import { pageAuditRows } from '@/lib/analytics/siteSpecs'

const props = defineProps({
  websiteId: { type: String, required: true },
  // The project's audit (contract 5d `you`).
  audit: { type: Object, default: null },
  // The payload's check and bot catalogs, for labels and bot names.
  checks: { type: Array, default: () => [] },
  bots: { type: Array, default: () => [] },
  title: { type: String, default: 'Pages audited' },
})

const titleId = useId()
const rows = computed(() => pageAuditRows(props.audit, { checks: props.checks, bots: props.bots }))
</script>

<template>
  <section class="pat" :aria-labelledby="titleId">
    <h3 :id="titleId" class="pat-title">{{ title }}</h3>
    <div class="pat-scroll" tabindex="0" role="region" :aria-label="`${title}, scrolls sideways`">
      <table class="pat-table">
        <caption class="sr-only">{{ title }}</caption>
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Status</th>
            <th scope="col" class="is-num">Words without JavaScript</th>
            <th scope="col" class="is-num">Checks</th>
            <th scope="col">Failing</th>
            <th scope="col">Blocked for</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.url">
            <th scope="row" class="pat-page">
              <a :href="row.url" target="_blank" rel="noopener" class="pat-link" :title="row.url">
                <span>{{ row.path }}</span>
                <ExternalLink class="pat-ext" aria-hidden="true" />
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            </th>
            <td :class="{ 'pat-error': row.error }">{{ row.status }}</td>
            <td class="is-num">
              <span :title="row.wordsText || undefined">{{ row.words }}</span>
              <span v-if="row.needsJs" class="pat-js">Content needs JavaScript</span>
            </td>
            <td class="is-num">{{ row.checks }}</td>
            <td>
              <ul v-if="row.failing.length" class="pat-chips" aria-label="Failing checks">
                <li v-for="f in row.failing" :key="f.key" class="pat-chip">{{ f.label }}</li>
              </ul>
            </td>
            <td class="pat-bots">{{ row.blockedFor.join(', ') }}</td>
            <td class="pat-action">
              <AskAgentButton
                v-if="row.failing.length"
                :website-id="websiteId"
                template="crawler_fix"
                :values="{ url: row.url, failed_checks: row.failedLabels }"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.pat {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.pat-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.pat-scroll {
  overflow-x: auto;
}

.pat-scroll:focus-visible {
  border-radius: var(--radius);
}

.pat-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13px;
}

.pat-table th,
.pat-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.pat-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.pat-table tbody tr:last-child > * {
  border-bottom: 0;
}

.pat-page {
  max-width: 260px;
  font-weight: 500;
}

.pat-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.pat-ext {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  color: var(--muted-foreground);
}

.pat-error {
  color: var(--destructive);
}

.pat-js {
  display: block;
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap;
}

.pat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  list-style: none;
}

.pat-chip {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: 12px;
  white-space: nowrap;
}

.pat-bots {
  color: var(--muted-foreground);
}

.pat-action {
  width: 1%;
  white-space: nowrap;
}

.is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pat-table th.is-num {
  text-align: right;
}
</style>
