<template>
  <section class="ag-apx" :class="{ 'is-static': expanded }" aria-label="Research data">
    <button
      v-if="!expanded"
      type="button"
      class="ag-apx-toggle"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <ChevronRight class="ag-apx-chevron" :size="16" aria-hidden="true" />
      <span class="ag-apx-title">Research data</span>
      <span class="ag-apx-count">{{ summary }}</span>
    </button>
    <h2 v-else class="ag-apx-heading">Research data</h2>

    <div v-show="open || expanded" :id="bodyId" class="ag-apx-body">
      <p v-if="!serp.length && !engines.length && !pages.length" class="ag-apx-empty">
        This report was saved without research data.
      </p>

      <section v-if="serp.length" class="ag-apx-section">
        <h3 class="ag-apx-sub">Google results</h3>
        <div v-for="(cap, i) in serp" :key="cap.capture_id || i" class="ag-apx-block">
          <p class="ag-apx-caption">
            <strong>{{ cap.query ? `"${cap.query}"` : 'Google search' }}</strong>
            <span v-for="(part, j) in serpMeta(cap)" :key="j"> · {{ part }}</span>
          </p>
          <p class="ag-apx-line">{{ brandLine(cap) }}</p>
          <p v-if="cap.ai_overview && cap.ai_overview.shown" class="ag-apx-line">{{ overviewLine(cap.ai_overview) }}</p>
          <p v-if="cap.error" class="ag-apx-line is-error">{{ serpError(cap.error) }}</p>
          <div v-if="results(cap).length" class="ag-apx-table">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="is-num">#</th>
                  <th scope="col">Result</th>
                  <th scope="col">Domain</th>
                  <th scope="col">Flag</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in results(cap)" :key="`${r.position}-${r.url}`" :class="{ 'is-you': r.is_yours }">
                  <td class="is-num">{{ r.position }}</td>
                  <td class="is-wide">{{ r.title || r.url }}</td>
                  <td>{{ r.domain || hostOf(r.url) }}</td>
                  <td>{{ r.is_yours ? 'You' : r.is_competitor ? r.competitor_name || 'Competitor' : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="engines.length" class="ag-apx-section">
        <h3 class="ag-apx-sub">AI engines</h3>
        <div class="ag-apx-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Prompt</th>
                <th scope="col">Engine</th>
                <th scope="col">Result</th>
                <th scope="col" class="is-num">Rank</th>
                <th scope="col">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e, i) in engines" :key="e.id || i">
                <td class="is-wide">{{ e.prompt_text || '' }}</td>
                <td>{{ engineLabel(e) }}</td>
                <td :class="{ 'is-muted': e.status !== 'done' }">{{ engineResult(e) }}</td>
                <td class="is-num">{{ e.status === 'done' && e.mentioned && e.rank ? `#${e.rank}` : '—' }}</td>
                <td>{{ e.status === 'done' && e.sentiment ? e.sentiment : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="pages.length" class="ag-apx-section">
        <h3 class="ag-apx-sub">Pages inspected</h3>
        <div class="ag-apx-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Page</th>
                <th scope="col" class="is-num">Status</th>
                <th scope="col" class="is-num">Title</th>
                <th scope="col" class="is-num">Description</th>
                <th scope="col" class="is-num">H1</th>
                <th scope="col" class="is-num">Words</th>
                <th scope="col">Structured data</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in pages" :key="p.capture_id || i">
                <td class="is-wide is-url">{{ displayUrl(p.final_url || p.url) }}</td>
                <td class="is-num">{{ p.error ? 'Error' : p.status_code ?? '—' }}</td>
                <td class="is-num">{{ chars(p.seo && p.seo.title_length) }}</td>
                <td class="is-num">{{ chars(p.seo && p.seo.meta_description_length) }}</td>
                <td class="is-num">{{ p.seo && Array.isArray(p.seo.h1) ? p.seo.h1.length : '—' }}</td>
                <td class="is-num">{{ p.seo && p.seo.word_count != null ? formatNumber(p.seo.word_count) : '—' }}</td>
                <td>{{ p.seo && Array.isArray(p.seo.structured_data) && p.seo.structured_data.length ? p.seo.structured_data.join(', ') : 'None' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { engineMeta } from '@/lib/engines'
import { aiOverviewUnread } from '@/lib/gap'
import { displayUrl, hostOf } from '@/lib/agent/url'
import { formatCapturedAt, formatNumber, regionName } from '../format'

const props = defineProps({
  data: { type: Object, default: null },
  // Always expanded and without the toggle (HTML export and print).
  expanded: { type: Boolean, default: false },
})

const open = ref(false)
const bodyId = `ag-apx-${useId()}`

const list = (value) => (Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : [])
const serp = computed(() => list(props.data?.serp))
const engines = computed(() => list(props.data?.engines))
const pages = computed(() => list(props.data?.pages))

const summary = computed(() => {
  const parts = []
  if (serp.value.length) parts.push(`${serp.value.length} Google ${serp.value.length === 1 ? 'page' : 'pages'}`)
  if (engines.value.length) parts.push(`${engines.value.length} engine ${engines.value.length === 1 ? 'check' : 'checks'}`)
  if (pages.value.length) parts.push(`${pages.value.length} ${pages.value.length === 1 ? 'page' : 'pages'} inspected`)
  return parts.join(' · ') || 'None'
})

function results(cap) {
  return Array.isArray(cap.results) ? cap.results : []
}

function serpMeta(cap) {
  return [
    cap.page ? `page ${cap.page}` : '',
    regionName(cap.location),
    cap.captured_at ? `captured ${formatCapturedAt(cap.captured_at)}` : '',
  ].filter(Boolean)
}

function brandLine(cap) {
  const name = cap.brand?.name || cap.brand?.domain || 'Your site'
  const positions = Array.isArray(cap.brand_positions) ? cap.brand_positions : []
  if (cap.error) return ''
  if (!positions.length) return `${name} was not on this page.`
  return `${name} ranked ${positions.map((p) => `#${p}`).join(', ')}.`
}

function serpError(error) {
  if (error.code === 'serp_not_configured') return "Google search wasn't available, so no rankings were captured."
  return error.message || 'This search did not complete.'
}

// mentions_you and cites_you are null when they were not measured.
function overviewLine(overview) {
  if (aiOverviewUnread(overview)) {
    return 'AI Overview: shown, but its content was not captured, so mentions and citations were not measured.'
  }
  const flag = (value) => (value === true ? 'yes' : value === false ? 'no' : 'not measured')
  return `AI Overview: mentions you ${flag(overview.mentions_you)}, cites you ${flag(overview.cites_you)}.`
}

function engineLabel(e) {
  return e.engine_label || engineMeta(e.engine).label
}

// engine_check parts carry their reason as a string ("OPENAI_API_KEY is not
// set", "Stopped"); older or other shapes as {message}.
function engineReason(e) {
  const reason = typeof e.error === 'string' ? e.error : e.error?.message
  return typeof reason === 'string' ? reason.trim() : ''
}

function engineResult(e) {
  const why = engineReason(e)
  if (e.status === 'unavailable') return why ? `Not available: ${why}` : 'Not available'
  if (e.status === 'error') return why ? `Error: ${why}` : 'Error'
  if (e.status !== 'done') return 'Not finished'
  return e.mentioned ? 'Named' : 'Not named'
}

function chars(n) {
  return Number.isFinite(Number(n)) && n !== null ? String(n) : '—'
}
</script>

<style scoped>
.ag-apx {
  max-width: 720px;
  margin: 32px auto 0;
  border-top: 1px solid var(--ag-divider);
  color: var(--ag-fg-1);
}

.ag-apx-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 14px 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.ag-apx-toggle:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-apx-chevron {
  flex-shrink: 0;
  color: var(--ag-fg-chevron);
  transition: transform 160ms var(--ag-ease);
}

.ag-apx-toggle[aria-expanded='true'] .ag-apx-chevron {
  transform: rotate(90deg);
}

.ag-apx-count {
  margin-left: auto;
  color: var(--ag-fg-3);
  font-size: 13px;
  font-weight: 400;
}

.ag-apx-heading {
  margin: 0;
  padding: 16px 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.ag-apx-body {
  padding-bottom: 8px;
}

.ag-apx-empty {
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-apx-section + .ag-apx-section {
  margin-top: 24px;
}

.ag-apx-sub {
  margin: 4px 0 10px;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.ag-apx-block + .ag-apx-block {
  margin-top: 18px;
}

.ag-apx-caption,
.ag-apx-line {
  margin: 0 0 6px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 20px;
}

.ag-apx-caption strong {
  color: var(--ag-fg-1);
  font-weight: 500;
}

.ag-apx-line:empty {
  display: none;
}

.ag-apx-line.is-error {
  color: var(--ag-danger);
}

.ag-apx-table {
  overflow-x: auto;
  border: 1px solid var(--ag-card-border);
  border-radius: 10px;
}

.ag-apx-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 18px;
}

.ag-apx-table :is(th, td) {
  padding: 7px 10px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  text-align: left;
  vertical-align: top;
}

.ag-apx-table th {
  background: var(--ag-code-bg);
  color: var(--ag-fg-2);
  font-weight: 500;
  white-space: nowrap;
}

.ag-apx-table tr:last-child td {
  border-bottom: 0;
}

.ag-apx-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.ag-apx-table .is-wide {
  min-width: 180px;
}

.ag-apx-table .is-url {
  font-family: var(--ag-font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.ag-apx-table .is-muted {
  color: var(--ag-fg-3);
}

.ag-apx-table tr.is-you td {
  background: var(--ag-you-bg);
}

@media (prefers-reduced-motion: reduce) {
  .ag-apx-chevron {
    transition: none;
  }
}
</style>
