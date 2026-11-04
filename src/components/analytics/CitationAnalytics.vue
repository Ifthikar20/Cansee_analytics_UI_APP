<script setup>
// Citation analytics (contract 4b), the first section of the Citations page:
// which sources the engines list, how often the answer text points to them,
// and where you and your competitors are cited. It has its own period and
// engine filters; the rest of the page keeps its own.
//
// Here one source an answer lists counts once; the Sources table below
// calls that row a retrieval and counts its citations in the answer text,
// so the section says which is which.
import { computed, ref, watch } from 'vue'
import { CircleX, ExternalLink } from '@lucide/vue'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { citationClasses, citationEngines, citationTiles } from '@/lib/analytics/benchmarkSpecs'
import { engineMeta } from '@/lib/engines'
import { timeAgo } from '@/utils/timeAgo'
import { safeHref } from '@/utils/safeHref'
import AskAgentButton from './AskAgentButton.vue'
import EngineSelect from './EngineSelect.vue'
import FilterRow from './FilterRow.vue'
import PeriodSelect from './PeriodSelect.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const integer = new Intl.NumberFormat('en-US')

const period = ref('30d')
const engine = ref('')

const params = computed(() => {
  const p = { period: period.value }
  if (engine.value) p.engine = engine.value
  return p
})

const { data, error, failure, loading, stale, reload } = useAnalyticsQuery(
  () => insightsApi.citations(props.websiteId, params.value).then((res) => res.data),
  () => [props.websiteId, params.value],
  { resetOn: () => props.websiteId },
)

const disabled = computed(() => failure.value?.code === 'insights_disabled')

// The engine filter offers the engines an unfiltered load listed, so
// choosing one never hides the others from the filter.
const engineOptions = ref([])
watch(data, (d) => {
  if (d && !d.filters?.engine) {
    engineOptions.value = (d.by_engine || []).map((r) => ({ key: r.key, label: r.label, configured: true }))
  }
})
watch(
  () => props.websiteId,
  () => {
    engineOptions.value = []
    engine.value = ''
  },
)

const tiles = computed(() => citationTiles(data.value))
const classesSpec = computed(() => citationClasses(data.value))
const enginesSpec = computed(() => citationEngines(data.value))

const EMPTY = {
  kind: 'empty',
  title: 'No cited sources were recorded for these answers.',
  body: 'Engines list sources when they search the web: Perplexity always, ChatGPT and Claude when web search is on.',
}
const empty = computed(() => (data.value && data.value.has_data === false ? EMPTY : null))

function count(value) {
  return typeof value === 'number' ? integer.format(value) : ''
}

function engineNames(keys) {
  return (keys || []).map((k) => engineMeta(k).label).join(', ')
}

// "notion.so/pricing": the page without its scheme, for reading.
function shortUrl(url) {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    return `${u.hostname.replace(/^www\./, '')}${path}`
  } catch {
    return String(url || '')
  }
}

const yourPages = computed(() => data.value?.your_pages || [])
const competitorPages = computed(() => data.value?.competitor_pages || [])
const gaps = computed(() =>
  (data.value?.gaps || []).map((g) => ({
    ...g,
    domainsText: (g.top_domains || [])
      .map((d) => `${d.domain} (${integer.format(d.citations)})`)
      .join(', '),
    ask: {
      prompt: g.text,
      competitor_citations: g.competitor_citations,
      domains: (g.top_domains || []).map((d) => d.domain),
    },
  })),
)
</script>

<template>
  <section class="ca" aria-labelledby="ca-title">
    <header class="ca-head">
      <h2 id="ca-title" class="ca-title">Citation analytics</h2>
      <p class="ca-sub">Which sources the engines rely on, and where you and your competitors are cited.</p>
    </header>

    <FilterRow label="Citation analytics filters">
      <PeriodSelect v-model="period" />
      <EngineSelect v-model="engine" :engines="engineOptions" />
    </FilterRow>

    <div v-if="!data && !error" class="ca-skeleton" aria-busy="true" aria-label="Loading citation analytics">
      <div class="ca-kpis">
        <Skeleton v-for="n in 4" :key="n" class="h-24 rounded-2xl" />
      </div>
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load citation analytics."
      :action="{ label: 'Try again' }"
      @action="reload"
    />

    <template v-else>
      <Alert v-if="stale" variant="destructive" class="ca-alert">
        <CircleX />
        <AlertTitle>We couldn't refresh this page. Showing the last loaded numbers.</AlertTitle>
        <AlertDescription>
          <button type="button" class="ca-retry" @click="reload">Try again</button>
        </AlertDescription>
      </Alert>

      <VizState v-if="empty" v-bind="empty" />

      <template v-else>
        <div class="ca-kpis" role="group" aria-label="Citation numbers">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :kind="tile.kind || 'number'"
            :state-text="tile.stateText"
          />
        </div>
        <p class="ca-note">
          Here every source an answer lists counts once. The table below calls that a retrieval and counts a citation each time the answer text points to the source.
        </p>

        <div class="ca-two">
          <VizChart :spec="classesSpec" :loading="loading" :heading-level="3" />
          <VizChart :spec="enginesSpec" :loading="loading" :heading-level="3" />
        </div>

        <section v-if="yourPages.length" class="ca-card" aria-labelledby="ca-yours-title">
          <h3 id="ca-yours-title" class="ca-card-title">Your cited pages</h3>
          <div class="ca-scroll" role="region" aria-label="Your cited pages, scrolls sideways" tabindex="0">
            <table class="ca-table">
              <caption class="sr-only">Your cited pages</caption>
              <thead>
                <tr>
                  <th scope="col">URL</th>
                  <th scope="col" class="is-num">Citations</th>
                  <th scope="col" class="is-num">In answer text</th>
                  <th scope="col" class="is-num">Answers</th>
                  <th scope="col">Engines</th>
                  <th scope="col">Last cited</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in yourPages" :key="row.url">
                  <th scope="row" class="ca-url">
                    <a v-if="safeHref(row.url)" :href="safeHref(row.url)" target="_blank" rel="noopener noreferrer" :title="row.url">
                      {{ shortUrl(row.url) }}
                      <ExternalLink class="ca-url-icon" aria-hidden="true" />
                    </a>
                    <span v-else>{{ shortUrl(row.url) }}</span>
                  </th>
                  <td class="is-num">{{ count(row.citations) }}</td>
                  <td class="is-num">
                    {{ count(row.cited_in_text) }}
                    <span v-if="row.cited_in_text === 0 && row.citations > 0" class="ca-badge">Retrieved only</span>
                  </td>
                  <td class="is-num">{{ count(row.answers) }}</td>
                  <td class="ca-nowrap">{{ engineNames(row.engines) }}</td>
                  <td class="ca-nowrap">
                    <span v-if="row.last_cited_at" :title="row.last_cited_at">{{ timeAgo(row.last_cited_at) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="competitorPages.length" class="ca-card" aria-labelledby="ca-theirs-title">
          <h3 id="ca-theirs-title" class="ca-card-title">Competitor pages cited</h3>
          <div class="ca-scroll" role="region" aria-label="Competitor pages cited, scrolls sideways" tabindex="0">
            <table class="ca-table">
              <caption class="sr-only">Competitor pages cited</caption>
              <thead>
                <tr>
                  <th scope="col">URL</th>
                  <th scope="col">Competitor</th>
                  <th scope="col" class="is-num">Citations</th>
                  <th scope="col" class="is-num">Answers</th>
                  <th scope="col">Engines</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in competitorPages" :key="row.url">
                  <th scope="row" class="ca-url">
                    <a v-if="safeHref(row.url)" :href="safeHref(row.url)" target="_blank" rel="noopener noreferrer" :title="row.url">
                      {{ shortUrl(row.url) }}
                      <ExternalLink class="ca-url-icon" aria-hidden="true" />
                    </a>
                    <span v-else>{{ shortUrl(row.url) }}</span>
                  </th>
                  <td class="ca-nowrap">{{ row.brand_name }}</td>
                  <td class="is-num">{{ count(row.citations) }}</td>
                  <td class="is-num">{{ count(row.answers) }}</td>
                  <td class="ca-nowrap">{{ engineNames(row.engines) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="gaps.length" class="ca-card" aria-labelledby="ca-gaps-title">
          <h3 id="ca-gaps-title" class="ca-card-title">Prompts where only competitors are cited</h3>
          <div class="ca-scroll" role="region" aria-label="Prompts where only competitors are cited, scrolls sideways" tabindex="0">
            <table class="ca-table">
              <caption class="sr-only">Prompts where only competitors are cited</caption>
              <thead>
                <tr>
                  <th scope="col">Prompt</th>
                  <th scope="col" class="is-num">Competitor citations</th>
                  <th scope="col">Top domains</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in gaps" :key="row.prompt_id">
                  <th scope="row" class="ca-prompt">
                    <router-link :to="{ name: 'prompt', params: { websiteId, promptId: String(row.prompt_id) } }">
                      {{ row.text }}
                    </router-link>
                  </th>
                  <td class="is-num">{{ count(row.competitor_citations) }}</td>
                  <td>{{ row.domainsText }}</td>
                  <td class="ca-actions">
                    <AskAgentButton :website-id="websiteId" template="citation_gap" :values="row.ask" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p class="ca-foot">Retrieved only: the engine fetched the page while answering, but its answer text never pointed to it.</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.ca {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.ca-title {
  color: var(--foreground);
  font-size: 1.125rem;
  font-weight: 700;
}

.ca-sub {
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.ca-skeleton {
  display: grid;
  gap: 16px;
}

.ca-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.ca-note,
.ca-foot {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

.ca-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ca-alert {
  border-radius: 14px;
}

.ca-retry {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.ca-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.ca-card-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.ca-scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.ca-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.ca-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.ca-table th,
.ca-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.ca-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.ca-table tbody tr:last-child > * {
  border-bottom: 0;
}

.ca-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.ca-url,
.ca-prompt {
  max-width: 360px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.ca-url a,
.ca-prompt a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground);
  text-decoration: underline;
  text-decoration-color: var(--border);
  text-underline-offset: 3px;
}

.ca-url a:hover,
.ca-prompt a:hover {
  text-decoration-color: currentColor;
}

.ca-url-icon {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  color: var(--muted-foreground);
}

.ca-nowrap {
  white-space: nowrap;
}

.ca-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-weight: 500;
}

.ca-actions {
  text-align: right !important;
}

@container bd-panel (max-width: 760px) {
  .ca-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ca-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container bd-panel (max-width: 480px) {
  .ca-card {
    padding: 16px;
  }
}
</style>
