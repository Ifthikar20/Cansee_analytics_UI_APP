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
      <p v-if="!swarm && !gaps.length && !serp.length && !engines.length && !pages.length" class="ag-apx-empty">
        This report was saved without research data.
      </p>

      <section v-if="swarm" class="ag-apx-section ag-apx-swarm">
        <h3 class="ag-apx-sub">Research agents</h3>
        <p class="ag-apx-line">{{ swarmSummary }}</p>
        <ul v-if="swarmCategories.length" class="ag-apx-list">
          <li v-for="c in swarmCategories" :key="c.key">{{ c.text }}</li>
        </ul>
        <div v-if="!expanded && swarmSheets.length" class="ag-apx-actions">
          <AgButton
            v-for="sheet in swarmSheets"
            :key="sheet.key"
            size="xs"
            :icon="Download"
            @click="downloadSheet(sheet)"
          >
            Download {{ sheet.title || sheet.key }} CSV
          </AgButton>
        </div>
      </section>

      <section v-if="gaps.length" class="ag-apx-section">
        <h3 class="ag-apx-sub">Prompt gaps</h3>
        <div class="ag-apx-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Prompt</th>
                <th scope="col">Google</th>
                <th scope="col">AI engines</th>
                <th scope="col">Gap</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(g, i) in gaps" :key="g.prompt?.id || i">
                <td class="is-wide">
                  {{ g.prompt?.text || 'Prompt' }}
                  <span v-if="regionName(g.prompt?.location)" class="ag-apx-muted">· {{ regionName(g.prompt.location) }}</span>
                </td>
                <td>{{ googleLabel(g.google) }}</td>
                <td :class="{ 'is-muted': !answered(g).length }">{{ enginesLine(g) }}</td>
                <td>{{ gapLine(g) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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
import { ChevronRight, Download } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import { csvFilename, csvRows, tableSheets } from '@/components/agent/swarm/tableModel'
import { formatDuration } from '@/composables/agent/useElapsed'
import { engineMeta } from '@/lib/engines'
import { aiOverviewUnread, gapDisplay, gapValueText, googleLabel } from '@/lib/gap'
import { toCsv } from '@/lib/agent/csv'
import { downloadText } from '@/lib/agent/download'
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
// The prompt gaps the reply read (get_prompt_gap, one per prompt).
const gaps = computed(() => list(props.data?.gaps))

// The research agents behind the report (data.swarm, null without one).
// The results table itself is in the report's Markdown, so only the run's
// summary and the CSV downloads show here.
const swarm = computed(() => {
  const value = props.data?.swarm
  return value && typeof value === 'object' ? value : null
})

const swarmSummary = computed(() => {
  const s = swarm.value
  const counts = (s && s.counts) || {}
  const total = Number(counts.total) || 0
  const parts = [`${Number(counts.done) || 0} done`]
  for (const key of ['failed', 'skipped', 'stopped']) {
    if (Number(counts[key]) > 0) parts.push(`${Number(counts[key])} ${key}`)
  }
  const ms = s && s.duration_ms !== null && s.duration_ms !== undefined ? Number(s.duration_ms) : NaN
  const took = Number.isFinite(ms) ? ` in ${formatDuration(ms)}` : ''
  return `Ran ${total} ${total === 1 ? 'agent' : 'agents'}${took}: ${parts.join(', ')}.`
})

const swarmCategories = computed(() =>
  list(swarm.value?.categories)
    .filter((c) => c.key && c.counts && Number(c.counts.total) > 0)
    .map((c) => ({
      key: c.key,
      text: `${c.label || c.key}: ${Number(c.counts.done) || 0} of ${Number(c.counts.total)} done`,
    }))
)

const swarmSheets = computed(() => tableSheets(swarm.value?.table))

function downloadSheet(sheet) {
  const table = swarm.value?.table
  if (!table || !sheet) return
  downloadText(toCsv(csvRows(sheet)), csvFilename(table, sheet), 'text/csv;charset=utf-8')
}

const summary = computed(() => {
  const parts = []
  if (swarm.value) {
    const total = Number(swarm.value.counts?.total) || 0
    parts.push(`${total} research ${total === 1 ? 'agent' : 'agents'}`)
  }
  if (gaps.value.length) parts.push(`${gaps.value.length} prompt ${gaps.value.length === 1 ? 'gap' : 'gaps'}`)
  if (serp.value.length) parts.push(`${serp.value.length} Google ${serp.value.length === 1 ? 'page' : 'pages'}`)
  if (engines.value.length) parts.push(`${engines.value.length} engine ${engines.value.length === 1 ? 'check' : 'checks'}`)
  if (pages.value.length) parts.push(`${pages.value.length} ${pages.value.length === 1 ? 'page' : 'pages'} inspected`)
  return parts.join(' · ') || 'None'
})

// Engines with answers in the window; `mentioned` is null without one.
function answered(gap) {
  return list(gap.engines).filter((e) => Number(e.answers) > 0)
}

function enginesLine(gap) {
  const asked = answered(gap)
  if (!asked.length) return 'No answers yet'
  const named = asked.filter((e) => e.mentioned === true).length
  return `Named by ${named} of ${asked.length}`
}

function gapLine(gap) {
  const value = gapValueText(gap.gap)
  const label = gapDisplay(gap.gap).label
  return value ? `${label} ${value}` : label
}

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
  border-radius: var(--radius);
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

.ag-apx-list {
  margin: 0 0 6px;
  padding-left: 18px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 20px;
}

.ag-apx-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 10px;
}

.ag-apx-table {
  overflow-x: auto;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
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

.ag-apx-muted {
  color: var(--ag-fg-3);
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
