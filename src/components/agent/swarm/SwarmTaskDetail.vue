<template>
  <div :id="id" class="ag-swarm-detail" @keydown.esc.stop.prevent="emit('close')">
    <dl class="ag-swarm-kv">
      <dt>Target</dt>
      <dd>{{ task.target || '—' }}</dd>
      <dt>Status</dt>
      <dd :class="{ 'is-bad': task.status === 'failed' }">{{ statusText }}</dd>
      <template v-if="started">
        <dt>Started</dt>
        <dd class="ag-tnum">{{ started }}</dd>
      </template>
      <template v-if="reason">
        <dt>Reason</dt>
        <dd>{{ reason }}</dd>
      </template>

      <template v-if="measured && worker === 'serp_page'">
        <dt>Query</dt>
        <dd>{{ d.query || '—' }}</dd>
        <dt>Location</dt>
        <dd>{{ locationText(d.location) }}</dd>
        <dt>Your position</dt>
        <dd class="ag-tnum">{{ positionsText(d.brand_positions) }}</dd>
        <dt>AI Overview</dt>
        <dd>{{ overviewText(d.ai_overview) }}</dd>
        <template v-if="top.length">
          <dt>Top results</dt>
          <dd>
            <ol class="ag-swarm-lines">
              <li v-for="(r, i) in top" :key="`${r.position}-${i}`" class="ag-swarm-top">
                <span class="ag-swarm-top-pos ag-tnum">#{{ r.position }}</span>{{ ' ' }}
                <span class="ag-swarm-top-domain">{{ r.domain || hostOf(r.url) }}</span>{{ ' ' }}
                <span class="ag-swarm-top-title">{{ r.title }}</span>{{ ' ' }}
                <span v-if="r.is_yours" class="ag-swarm-badge is-you">You</span>
                <span v-else-if="r.is_competitor" class="ag-swarm-badge is-competitor">Competitor</span>
              </li>
            </ol>
          </dd>
        </template>
        <template v-if="questions.length">
          <dt>People also ask</dt>
          <dd>
            <ul class="ag-swarm-lines">
              <li v-for="(q, i) in questions" :key="i">{{ q }}</li>
            </ul>
          </dd>
        </template>
        <dt>Captured</dt>
        <dd>{{ capturedText(d, task.started_at) }}</dd>
      </template>

      <template v-else-if="measured && worker === 'engine_answer'">
        <dt>Engine</dt>
        <dd>{{ engineText }}</dd>
        <dt>Named</dt>
        <dd>{{ namedText(d) }}</dd>
        <template v-if="d.mentioned && d.sentiment">
          <dt>Sentiment</dt>
          <dd>{{ d.sentiment }}</dd>
        </template>
        <template v-if="brands.length">
          <dt>Brands listed</dt>
          <dd>
            <ul class="ag-swarm-chips">
              <li v-for="(b, i) in brands" :key="`${b.name}-${i}`" class="ag-swarm-chip" :class="{ 'is-above': b.above }">
                {{ b.name }}<template v-if="b.position"> #{{ b.position }}</template>
              </li>
            </ul>
          </dd>
        </template>
        <template v-if="d.snippet">
          <dt>Mention</dt>
          <dd class="ag-swarm-quote">“{{ d.snippet }}”</dd>
        </template>
        <dt>Analysis</dt>
        <dd v-if="analysis">
          <p v-if="analysis.summary" class="ag-swarm-para">{{ analysis.summary }}</p>
          <ul v-if="reasons.length" class="ag-swarm-bullets">
            <li v-for="(r, i) in reasons" :key="i">{{ r }}</li>
          </ul>
          <p v-if="analysis.opportunity" class="ag-swarm-para">Opportunity: {{ analysis.opportunity }}</p>
        </dd>
        <dd v-else class="is-muted">{{ analysisErrorText(d.analysis_error) || 'Analysis not available.' }}</dd>
        <template v-if="cited.length">
          <dt>Cited</dt>
          <dd>
            <ul class="ag-swarm-chips">
              <li v-for="(c, i) in cited" :key="`${c.domain}-${i}`" class="ag-swarm-chip" :class="{ 'is-you': c.is_yours }">
                {{ c.domain || hostOf(c.url) }}
              </li>
            </ul>
          </dd>
        </template>
      </template>

      <template v-else-if="measured && worker === 'page_inspect'">
        <dt>Page</dt>
        <dd>
          <button v-if="task.pane && task.pane.tab_id" type="button" class="ag-swarm-link" @click="openCapture(task.pane.tab_id, $event)">
            {{ pageLabel }}
          </button>
          <span v-else>{{ pageLabel }}</span>
        </dd>
        <template v-if="d.chosen_because">
          <dt>Why this page</dt>
          <dd>{{ d.chosen_because }}</dd>
        </template>
        <dt>Title</dt>
        <dd>{{ lengthText(seo.title || d.title, seo.title_length) }}</dd>
        <dt>Meta description</dt>
        <dd>{{ lengthText(seo.meta_description, seo.meta_description_length) }}</dd>
        <dt>H1</dt>
        <dd>
          <ul v-if="h1.length" class="ag-swarm-lines">
            <li v-for="(h, i) in h1" :key="i">{{ h }}</li>
          </ul>
          <span v-else>Missing</span>
        </dd>
        <template v-if="h2.length">
          <dt>H2</dt>
          <dd>
            <ul class="ag-swarm-lines">
              <li v-for="(h, i) in h2" :key="i">{{ h }}</li>
            </ul>
          </dd>
        </template>
        <template v-if="words">
          <dt>Words</dt>
          <dd class="ag-tnum">{{ words }}</dd>
        </template>
        <dt>Structured data</dt>
        <dd>{{ schema }}</dd>
        <template v-if="links">
          <dt>Links</dt>
          <dd class="ag-tnum">{{ links }}</dd>
        </template>
        <template v-if="images">
          <dt>Images</dt>
          <dd class="ag-tnum">{{ images }}</dd>
        </template>
        <template v-if="d.reused_from">
          <dt>Reused</dt>
          <dd>Same page as {{ reusedLabel }}</dd>
        </template>
      </template>

      <template v-else-if="measured && worker === 'content_gap'">
        <template v-if="compared.length">
          <dt>Compared</dt>
          <dd>
            <ul class="ag-swarm-lines">
              <li v-for="(c, i) in compared" :key="`${c.url}-${i}`">
                <span class="ag-swarm-role">{{ c.role === 'own' ? 'Your page' : 'Competitor' }}</span>{{ ' ' }}
                <button v-if="c.tabId" type="button" class="ag-swarm-link" @click="openCapture(c.tabId, $event)">
                  {{ c.label }}
                </button>
                <span v-else>{{ c.label }}</span>
              </li>
            </ul>
          </dd>
        </template>
        <template v-if="d.headline">
          <dt>Headline</dt>
          <dd>{{ d.headline }}</dd>
        </template>
        <template v-if="d.analysis_error">
          <dt>Analysis</dt>
          <dd class="is-muted">{{ analysisErrorText(d.analysis_error) }}</dd>
        </template>
      </template>

      <template v-else-if="measured && worker === 'citations'">
        <template v-if="sourcesHeadline">
          <dt>Headline</dt>
          <dd>{{ sourcesHeadline }}</dd>
        </template>
        <template v-if="d.analysis_error">
          <dt>Analysis</dt>
          <dd class="is-muted">{{ analysisErrorText(d.analysis_error) }}</dd>
        </template>
      </template>
    </dl>

    <ol v-if="measured && worker === 'content_gap' && gaps.length" class="ag-swarm-gaps">
      <li v-for="(g, i) in gaps" :key="i" class="ag-swarm-gap">
        <p class="ag-swarm-gap-head">
          <span class="ag-swarm-sev" :class="`is-${g.severity}`">{{ g.severityLabel }}</span>{{ ' ' }}
          <span class="ag-swarm-gap-issue">{{ g.issue }}</span>
        </p>
        <p v-if="g.evidence" class="ag-swarm-gap-line">Evidence: {{ g.evidence }}</p>
        <p v-if="g.fix" class="ag-swarm-gap-line">Fix: {{ g.fix }}</p>
        <p v-if="g.target" class="ag-swarm-gap-line">
          <button v-if="g.tabId" type="button" class="ag-swarm-link" @click="openCapture(g.tabId, $event)">{{ g.label }}</button>
          <a
            v-else-if="safeHref(g.target)"
            class="ag-swarm-link"
            :href="safeHref(g.target)"
            target="_blank"
            rel="noopener noreferrer nofollow"
            @click="openInPane($event, g.target)"
          >{{ g.label }}</a>
          <span v-else>{{ g.label }}</span>
        </p>
      </li>
    </ol>
    <p v-else-if="measured && worker === 'content_gap'" class="ag-swarm-detail-note">No gaps found.</p>

    <template v-if="measured && worker === 'citations'">
      <ul v-if="sources.length" class="ag-swarm-sources" aria-label="Cited sources">
        <li v-for="(s, i) in sources" :key="`${s.domain}-${i}`" class="ag-swarm-source">
          <span class="ag-swarm-source-domain">{{ s.domain }}</span>{{ ' ' }}
          <span class="ag-swarm-source-meta ag-tnum">{{ sourceMeta(s) }}</span>{{ ' ' }}
          <span v-if="s.is_yours" class="ag-swarm-badge is-you">You</span>
          <span v-else-if="s.is_competitor" class="ag-swarm-badge is-competitor">{{ s.competitor_name || 'Competitor' }}</span>
        </li>
      </ul>
      <section v-if="opportunities.length" class="ag-swarm-opps" aria-label="Opportunities">
        <h5 class="ag-swarm-opps-title">Opportunities</h5>
        <ul class="ag-swarm-lines">
          <li v-for="(o, i) in opportunities" :key="`${o.domain}-${i}`" class="ag-swarm-opp">
            <span class="ag-swarm-opp-domain">{{ o.domain }}</span>{{ ' ' }}
            <span v-if="o.why" class="ag-swarm-opp-why">{{ o.why }}</span>{{ ' ' }}
            <span v-if="o.action" class="ag-swarm-opp-action">{{ o.action }}</span>
          </li>
        </ul>
      </section>
    </template>

    <div v-if="canOpen || tree.rerun.visible" class="ag-swarm-detail-actions">
      <AgButton v-if="canOpen" size="xs" :icon="ArrowUpRight" @click="openCapture(task.pane.tab_id, $event)">
        Open in browser
      </AgButton>
      <!-- Off while the chat is busy, but focusable, so the reason can be read. -->
      <AgTooltip v-if="tree.rerun.visible" :text="tree.rerun.disabled ? tree.rerun.reason || '' : ''">
        <AgButton
          class="ag-swarm-detail-rerun"
          size="xs"
          :icon="RotateCw"
          :loading="rerunning"
          :aria-disabled="tree.rerun.disabled ? 'true' : undefined"
          @click="rerun"
        >
          Re-run this agent
        </AgButton>
      </AgTooltip>
    </div>
  </div>
</template>

<script setup>
// What one research agent did, per worker: its target, status and timing,
// then the measurement (Google page, engine answer, page facts, content gaps
// or cited sources) and the actions to open its capture or run it again.
// Third-party text (pages, answers, analyses) is rendered as text only.
import { computed, inject, ref } from 'vue'
import { ArrowUpRight, RotateCw } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { formatNumber } from '@/components/agent/browser/format'
import { engineMeta } from '@/lib/engines'
import { taskError } from '@/lib/agent/normalize'
import { displayUrl, hostOf } from '@/lib/agent/url'
import { safeHref } from '@/utils/safeHref'
import {
  SWARM_TREE,
  analysisErrorText,
  capturedText,
  citerLabel,
  clockTime,
  defaultTree,
  detailStatusText,
  lengthText,
  locationText,
  namedText,
  overviewText,
  positionsText,
} from './swarmView'

const props = defineProps({
  task: { type: Object, required: true },
  id: { type: String, default: '' },
  // The precomputed "Waiting for ..." line of a queued task.
  waiting: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const tree = inject(SWARM_TREE, defaultTree())

const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }

const list = (value) => (Array.isArray(value) ? value.filter((v) => v !== null && v !== undefined) : [])
const objects = (value) => list(value).filter((v) => typeof v === 'object')
const strings = (value) => list(value).filter((v) => typeof v === 'string' && v.trim())

const swarmLive = computed(() => Boolean(tree.swarmLive))
const worker = computed(() => props.task.worker || '')
const d = computed(() => (props.task.detail && typeof props.task.detail === 'object' ? props.task.detail : {}))
// The measurement shows for a finished agent only; a failed, skipped or
// stopped one shows its reason.
const measured = computed(() => props.task.status === 'done' && Boolean(props.task.detail))

const statusText = computed(() =>
  detailStatusText(props.task, { swarmLive: swarmLive.value, waiting: props.waiting })
)
const started = computed(() => clockTime(props.task.started_at))
const reason = computed(() => {
  if (props.task.status !== 'failed') return ''
  const error = taskError(props.task.error)
  return (error && error.message) || ''
})

const canOpen = computed(() => Boolean(props.task.pane && props.task.pane.tab_id) && props.task.status === 'done')

// ── serp_page ──
const top = computed(() => objects(d.value.top).slice(0, 5))
const questions = computed(() => strings(d.value.people_also_ask).slice(0, 5))

// ── engine_answer ──
const engineText = computed(() => {
  const label = d.value.engine_label || engineMeta(d.value.engine).label
  return d.value.model_id ? `${label} · ${d.value.model_id}` : label
})
const brands = computed(() => {
  const above = new Set(objects(d.value.brands_above).map((b) => String(b.name || '').toLowerCase()))
  return objects(d.value.brands)
    .filter((b) => typeof b.name === 'string' && b.name)
    .slice(0, 10)
    .map((b) => ({
      name: b.name,
      position: Number(b.position) > 0 ? Number(b.position) : null,
      above: above.has(b.name.toLowerCase()),
    }))
})
const analysis = computed(() => {
  const a = d.value.analysis
  return a && typeof a === 'object' && (a.summary || a.opportunity || list(a.reasons).length) ? a : null
})
const reasons = computed(() => strings(analysis.value && analysis.value.reasons).slice(0, 3))
const cited = computed(() => objects(d.value.citations).slice(0, 8))

// ── page_inspect ──
const seo = computed(() => (d.value.seo && typeof d.value.seo === 'object' ? d.value.seo : {}))
const pageLabel = computed(() => displayUrl(d.value.final_url || d.value.url) || props.task.target || '—')
const h1 = computed(() => strings(seo.value.h1))
const h2 = computed(() => strings(seo.value.h2).slice(0, 8))
const words = computed(() => (Number.isFinite(Number(seo.value.word_count)) && seo.value.word_count !== null ? formatNumber(seo.value.word_count) : ''))
const schema = computed(() => {
  const types = strings(seo.value.structured_data)
  return types.length ? types.join(', ') : 'None'
})
const links = computed(() => {
  const l = seo.value.links
  if (!l || typeof l !== 'object') return ''
  const internal = Number(l.internal)
  const external = Number(l.external)
  if (!Number.isFinite(internal) && !Number.isFinite(external)) return ''
  return `${Number.isFinite(internal) ? internal : 0} internal · ${Number.isFinite(external) ? external : 0} external`
})
const images = computed(() => {
  const img = seo.value.images
  if (!img || typeof img !== 'object' || !Number.isFinite(Number(img.count))) return ''
  const missing = Number(img.missing_alt)
  return Number.isFinite(missing) && missing > 0 ? `${img.count}, ${missing} missing alt text` : String(img.count)
})
const reusedLabel = computed(() => {
  const other = tree.findTask(d.value.reused_from)
  return (other && other.label) || String(d.value.reused_from)
})

// ── content_gap ──
// The page agents this analysis read, to open their captures.
const pageTasks = computed(() =>
  list(props.task.depends_on)
    .map((taskId) => tree.findTask(taskId))
    .filter((t) => t && t.worker === 'page_inspect' && t.pane && t.pane.tab_id)
)

function captureFor(url) {
  if (typeof url !== 'string' || !url) return null
  const page = pageTasks.value.find((t) => {
    const detail = t.detail || {}
    return detail.url === url || detail.final_url === url
  })
  return page ? page.pane.tab_id : null
}

const compared = computed(() =>
  objects(d.value.compared).map((c) => ({
    role: c.role,
    url: c.url || '',
    label: c.title ? `${c.title} (${displayUrl(c.url)})` : displayUrl(c.url),
    tabId: captureFor(c.url),
  }))
)
const gaps = computed(() =>
  objects(d.value.gaps)
    .slice(0, 4)
    .map((g) => ({
      issue: g.issue || '',
      evidence: g.evidence || '',
      fix: g.fix || '',
      severity: SEVERITY_LABELS[g.severity] ? g.severity : 'low',
      severityLabel: SEVERITY_LABELS[g.severity] || 'Low',
      target: typeof g.target === 'string' ? g.target : '',
      label: displayUrl(g.target),
      tabId: captureFor(g.target),
    }))
)

// ── citations ──
const sources = computed(() => objects(d.value.sources).slice(0, 15))
const sourcesHeadline = computed(() => {
  const a = d.value.analysis
  return a && typeof a === 'object' && typeof a.headline === 'string' ? a.headline : ''
})
const opportunities = computed(() => {
  const a = d.value.analysis
  return a && typeof a === 'object' ? objects(a.opportunities).slice(0, 3) : []
})

function sourceMeta(source) {
  const n = Number(source.citations) || 0
  const engines = strings(source.engines).map(citerLabel)
  const count = `${n} ${n === 1 ? 'citation' : 'citations'}`
  return engines.length ? `${count} · ${engines.join(', ')}` : count
}

// ── actions ──
function openCapture(tabId, event) {
  tree.openCapture(tabId, event && event.currentTarget)
}

function openInPane(event, url) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (!safeHref(url)) return
  event.preventDefault()
  tree.openUrl(url, event.currentTarget)
}

const rerunning = ref(false)

async function rerun() {
  if (tree.rerun.disabled || rerunning.value) return
  rerunning.value = true
  try {
    await tree.rerunTask(props.task.id)
  } finally {
    rerunning.value = false
  }
}
</script>

<style scoped>
.ag-swarm-detail {
  margin: 2px 8px 6px 68px;
  padding: 10px 12px;
  border: 1px solid var(--ag-code-border);
  border-radius: 8px;
  background: var(--ag-code-bg);
  color: var(--ag-fg-2);
}

.ag-swarm-kv {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
}

.ag-swarm-kv dt {
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 18px;
}

.ag-swarm-kv dd {
  min-width: 0;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.ag-swarm-kv dd.is-bad {
  color: var(--ag-danger);
}

.ag-swarm-kv dd.is-muted {
  color: var(--ag-fg-4);
}

.ag-swarm-lines,
.ag-swarm-bullets,
.ag-swarm-chips,
.ag-swarm-sources,
.ag-swarm-gaps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-swarm-lines > li + li {
  margin-top: 2px;
}

.ag-swarm-bullets {
  padding-left: 16px;
  list-style: disc;
}

.ag-swarm-para {
  margin: 0;
}

.ag-swarm-para + .ag-swarm-para,
.ag-swarm-bullets + .ag-swarm-para,
.ag-swarm-para + .ag-swarm-bullets {
  margin-top: 4px;
}

.ag-swarm-quote {
  color: var(--ag-fg-2);
  font-size: 13px;
}

.ag-swarm-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.ag-swarm-top-pos {
  min-width: 26px;
  color: var(--ag-fg-4);
}

.ag-swarm-top-domain {
  color: var(--ag-fg-1);
}

.ag-swarm-top-title {
  min-width: 0;
  color: var(--ag-fg-3);
}

.ag-swarm-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border: 1px solid currentColor;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.ag-swarm-badge.is-you {
  border-color: color-mix(in srgb, var(--ag-you) 40%, transparent);
  color: var(--ag-you);
}

.ag-swarm-badge.is-competitor {
  border-color: color-mix(in srgb, var(--ag-competitor) 40%, transparent);
  color: var(--ag-competitor);
}

.ag-swarm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}

.ag-swarm-chip {
  padding: 0 6px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 18px;
}

.ag-swarm-chip.is-above {
  color: var(--ag-fg-1);
}

.ag-swarm-chip.is-you {
  color: var(--ag-you);
}

.ag-swarm-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.ag-swarm-link:hover {
  color: var(--ag-fg-1);
  text-decoration-color: currentColor;
  opacity: 1;
}

.ag-swarm-link:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-swarm-role {
  margin-right: 6px;
  color: var(--ag-fg-4);
  font-size: 12px;
}

.ag-swarm-gaps {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.ag-swarm-gap-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.ag-swarm-sev {
  flex-shrink: 0;
  padding: 0 6px;
  border: 1px solid currentColor;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.ag-swarm-sev.is-high {
  border-color: color-mix(in srgb, var(--ag-danger) 40%, transparent);
  color: var(--ag-danger);
}

.ag-swarm-sev.is-medium {
  border-color: color-mix(in srgb, var(--ag-warning) 40%, transparent);
  color: var(--ag-warning);
}

.ag-swarm-sev.is-low {
  border-color: color-mix(in srgb, var(--ag-fg-4) 40%, transparent);
  color: var(--ag-fg-4);
}

.ag-swarm-gap-issue {
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-swarm-gap-line {
  margin: 2px 0 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.ag-swarm-detail-note {
  margin: 10px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-swarm-sources {
  display: grid;
  gap: 2px;
  margin-top: 10px;
}

.ag-swarm-source {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  font-size: 13px;
  line-height: 18px;
}

.ag-swarm-source-domain {
  color: var(--ag-fg-1);
}

.ag-swarm-source-meta {
  color: var(--ag-fg-3);
}

.ag-swarm-opps {
  margin-top: 10px;
}

.ag-swarm-opps-title {
  margin: 0 0 4px;
  color: var(--ag-fg-4);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.ag-swarm-opp {
  display: grid;
  font-size: 13px;
  line-height: 18px;
}

.ag-swarm-opp + .ag-swarm-opp {
  margin-top: 6px;
}

.ag-swarm-opp-domain {
  color: var(--ag-fg-1);
  font-weight: 500;
}

.ag-swarm-opp-why {
  color: var(--ag-fg-3);
}

.ag-swarm-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

@container ag-swarm (max-width: 519px) {
  .ag-swarm-detail {
    margin-left: 40px;
  }

  .ag-swarm-kv {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .ag-swarm-kv dd + dt {
    margin-top: 6px;
  }
}
</style>
