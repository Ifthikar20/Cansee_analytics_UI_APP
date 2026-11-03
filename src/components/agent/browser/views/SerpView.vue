<template>
  <div class="ag-serp" :aria-busy="loading ? 'true' : 'false'">
    <header class="ag-serp-head">
      <div class="ag-serp-box">
        <Search class="ag-serp-box-icon" :size="16" aria-hidden="true" />
        <input
          class="ag-serp-query"
          type="search"
          readonly
          :value="query"
          :placeholder="query ? undefined : 'Google search'"
          aria-label="Google search query"
        />
      </div>
      <p class="ag-serp-meta">
        <span v-if="locationLabel" class="ag-serp-chip">
          <MapPin :size="12" aria-hidden="true" />
          {{ locationLabel }}
        </span>
        <span v-if="pageLabel" class="ag-tnum">{{ pageLabel }}</span>
        <span v-if="capturedLabel" class="ag-serp-captured">
          <time :datetime="capture.captured_at">Captured {{ capturedLabel }}</time> via SerpAPI
        </span>
      </p>
    </header>

    <div v-if="errorInfo" class="ag-serp-state is-error" role="alert">
      <CircleAlert :size="18" aria-hidden="true" />
      <div>
        <p class="ag-serp-state-title">{{ errorInfo.title }}</p>
        <p v-if="errorInfo.body" class="ag-serp-state-body">{{ errorInfo.body }}</p>
      </div>
    </div>

    <div v-else-if="tab.status === 'gone'" class="ag-serp-state" role="status">
      <Info :size="18" aria-hidden="true" />
      <div>
        <p class="ag-serp-state-title">These results are not part of this conversation anymore.</p>
        <p class="ag-serp-state-body">They may belong to another branch of the chat.</p>
      </div>
    </div>

    <div v-else-if="loading" class="ag-serp-loading" role="status">
      <p class="ag-serp-loading-label">
        <span class="ag-serp-spinner" aria-hidden="true" />
        {{ tab.status === 'missing' ? 'Loading saved results…' : 'Searching Google…' }}
      </p>
      <div v-for="n in 6" :key="n" class="ag-serp-skel" aria-hidden="true">
        <span class="ag-skel ag-skel-avatar" />
        <span class="ag-serp-skel-lines">
          <span class="ag-skel" style="width: 38%" />
          <span class="ag-skel ag-skel-title" :style="{ width: `${62 + ((n * 7) % 25)}%` }" />
          <span class="ag-skel" style="width: 92%" />
          <span class="ag-skel" style="width: 74%" />
        </span>
      </div>
    </div>

    <template v-else>
      <p v-if="brandLine" class="ag-serp-brand" :class="{ 'is-found': brandPositions.length > 0 }">
        <span class="ag-serp-brand-dot" aria-hidden="true" />
        {{ brandLine }}
      </p>

      <section v-if="overview && overview.shown" class="ag-serp-aio" aria-labelledby="ag-serp-aio-title">
        <h3 id="ag-serp-aio-title" class="ag-serp-aio-title">
          <Sparkles :size="14" aria-hidden="true" />
          AI Overview
        </h3>
        <div class="ag-serp-aio-chips">
          <span class="ag-serp-flag" :class="{ 'is-yes': overview.mentions_you }">
            Mentions you: {{ overview.mentions_you ? 'Yes' : 'No' }}
          </span>
          <span class="ag-serp-flag" :class="{ 'is-yes': overview.cites_you }">
            Cites you: {{ overview.cites_you ? 'Yes' : 'No' }}
          </span>
        </div>
        <template v-if="references.length">
          <p class="ag-serp-aio-sub">Sources Google cited</p>
          <ul class="ag-serp-refs">
            <li v-for="(ref, i) in references" :key="`${ref.url}-${i}`">
              <a
                class="ag-serp-ref"
                :href="safeHref(ref.url) || undefined"
                target="_blank"
                rel="noopener noreferrer nofollow"
                :title="ref.title || ref.url"
                @click="openInPane($event, ref.url)"
              >
                <span class="ag-serp-avatar is-small" aria-hidden="true">{{ firstLetter(ref.domain || hostOf(ref.url)) }}</span>
                <span class="ag-serp-ref-domain">{{ ref.domain || hostOf(ref.url) }}</span>
              </a>
            </li>
          </ul>
        </template>
      </section>
      <p v-else-if="overview && overview.shown === false" class="ag-serp-note">
        Google showed no AI Overview for this query.
      </p>

      <ol v-if="results.length" class="ag-serp-results" aria-label="Google results">
        <li
          v-for="r in results"
          :key="`${r.position}-${r.url}`"
          class="ag-serp-row"
          :class="{ 'is-you': r.is_yours, 'is-competitor': !r.is_yours && r.is_competitor }"
        >
          <span class="ag-serp-pos ag-tnum" aria-hidden="true">#{{ r.position }}</span>
          <div class="ag-serp-main">
            <div class="ag-serp-site">
              <span class="ag-serp-avatar" aria-hidden="true">{{ firstLetter(r.domain || hostOf(r.url)) }}</span>
              <span class="ag-serp-site-text">
                <span class="ag-serp-domain">{{ r.domain || hostOf(r.url) }}</span>
                <span v-if="r.display_url" class="ag-serp-url">{{ r.display_url }}</span>
              </span>
              <span v-if="r.is_yours" class="ag-serp-badge is-you ag-tnum">You · #{{ r.position }}</span>
              <span v-else-if="r.is_competitor" class="ag-serp-badge is-competitor">
                {{ r.competitor_name ? `Competitor · ${r.competitor_name}` : 'Competitor' }}
              </span>
            </div>
            <h3 class="ag-serp-title-wrap">
              <a
                class="ag-serp-title"
                :href="safeHref(r.url) || undefined"
                target="_blank"
                rel="noopener noreferrer nofollow"
                @click="openInPane($event, r.url)"
              >
                <span class="ag-sr-only">Position {{ r.position }}: </span>{{ r.title || r.url }}
              </a>
            </h3>
            <p v-if="r.snippet" class="ag-serp-snippet">{{ r.snippet }}</p>
          </div>
        </li>
      </ol>
      <p v-else class="ag-serp-note">Google returned no organic results on this page.</p>

      <section v-if="peopleAlsoAsk.length" class="ag-serp-paa" aria-labelledby="ag-serp-paa-title">
        <h3 id="ag-serp-paa-title" class="ag-serp-section-title">People also ask</h3>
        <ul class="ag-serp-paa-list">
          <li v-for="(q, i) in peopleAlsoAsk" :key="`${i}-${q}`">{{ q }}</li>
        </ul>
      </section>

      <p class="ag-serp-foot">Positions are Google organic results for this query, location and page.</p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CircleAlert, Info, MapPin, Search, Sparkles } from '@lucide/vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { firstLetter, hostOf } from '@/lib/agent/url'
import { safeHref } from '@/utils/safeHref'
import { formatCapturedAt, regionName } from '../format'

const props = defineProps({
  tab: { type: Object, required: true },
})

const pane = useAgentPaneStore()

const capture = computed(() => props.tab.data || {})
const query = computed(() => capture.value.query || '')
const results = computed(() => (Array.isArray(capture.value.results) ? capture.value.results : []))
const overview = computed(() => capture.value.ai_overview || null)
const references = computed(() =>
  Array.isArray(overview.value?.references) ? overview.value.references.slice(0, 5) : []
)
const peopleAlsoAsk = computed(() =>
  Array.isArray(capture.value.people_also_ask)
    ? capture.value.people_also_ask.filter((q) => typeof q === 'string' && q.trim())
    : []
)
const brandPositions = computed(() =>
  Array.isArray(capture.value.brand_positions) ? capture.value.brand_positions.filter(Number.isFinite) : []
)

const loading = computed(
  () =>
    !capture.value.error &&
    (props.tab.status === 'loading' || props.tab.status === 'missing' || props.tab.status === 'idle') &&
    !Array.isArray(capture.value.results)
)

const errorInfo = computed(() => {
  const error = capture.value.error
  if (!error) return null
  if (error.code === 'serp_not_configured') {
    return { title: "Google search isn't available yet.", body: 'No rankings are shown until Google search is set up.' }
  }
  return { title: 'Google search did not complete.', body: error.message || '' }
})

const page = computed(() => {
  const n = Number(capture.value.page)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
})

const pageLabel = computed(() => {
  if (!page.value) return ''
  const startRaw = Number(capture.value.start)
  const start = Number.isFinite(startRaw) && startRaw >= 0 ? startRaw : (page.value - 1) * 10
  if (!results.value.length) return `Page ${page.value}`
  const positions = results.value.map((r) => Number(r.position)).filter(Number.isFinite)
  const first = positions.length ? Math.min(...positions) : start + 1
  const last = positions.length ? Math.max(...positions) : start + results.value.length
  return `Page ${page.value} · results ${first}–${last}`
})

const locationLabel = computed(() => regionName(capture.value.location))
const capturedLabel = computed(() => formatCapturedAt(capture.value.captured_at))

const brandLine = computed(() => {
  const brand = capture.value.brand
  if (!brand || !results.value.length) return ''
  const name = brand.name || brand.domain || 'Your site'
  const list = brandPositions.value
  if (!list.length) return `${name} does not appear on this page.`
  if (list.length === 1) return `${name} ranks #${list[0]} on this page.`
  const tags = list.map((p) => `#${p}`)
  return `${name} appears at ${tags.slice(0, -1).join(', ')} and ${tags[tags.length - 1]} on this page.`
})

function openInPane(event, url) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (!safeHref(url)) return
  event.preventDefault()
  pane.openUrl(url, { activate: true })
}
</script>

<style scoped>
.ag-serp {
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  padding: 20px 24px 40px;
  color: var(--ag-fg-1);
}

.ag-serp-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ag-serp-box {
  position: relative;
  display: flex;
  align-items: center;
  height: 44px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 22px;
  background: var(--ag-composer-bg);
  box-shadow: var(--ag-composer-shadow);
}

.ag-serp-box-icon {
  position: absolute;
  left: 16px;
  color: var(--ag-fg-3);
  pointer-events: none;
}

.ag-serp-query {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0 18px 0 42px;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 15px;
  line-height: 24px;
  text-overflow: ellipsis;
  outline: none;
}

.ag-serp-query::-webkit-search-cancel-button {
  display: none;
}

.ag-serp-query:focus-visible {
  box-shadow: 0 0 0 2px var(--ag-ring);
}

.ag-serp-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin: 0;
  padding: 0 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-serp-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 6px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  font-weight: 500;
}

.ag-serp-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 20px;
}

.ag-serp-brand.is-found {
  color: var(--ag-you);
  font-weight: 500;
}

.ag-serp-brand-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
}

.ag-serp-aio {
  margin-top: 18px;
  padding: 14px 16px 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-serp-aio-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.ag-serp-aio-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.ag-serp-flag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 6px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  font-weight: 500;
}

.ag-serp-flag.is-yes {
  border-color: color-mix(in srgb, var(--ag-you) 32%, transparent);
  background: var(--ag-you-bg);
  color: var(--ag-you);
}

.ag-serp-aio-sub {
  margin: 14px 0 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-serp-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-serp-ref {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  height: 28px;
  padding: 0 10px 0 4px;
  border: 1px solid var(--ag-card-border);
  border-radius: 14px;
  color: var(--ag-fg-1b);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 120ms ease;
}

.ag-serp-ref:hover {
  background: var(--ag-ghost-hover);
  opacity: 1;
}

.ag-serp-ref:focus-visible {
  border-radius: 14px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-serp-ref-domain {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-serp-note {
  margin: 18px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-serp-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.ag-serp-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 8px;
  padding: 12px 12px 12px 8px;
  border-left: 2px solid transparent;
  border-radius: 10px;
}

.ag-serp-row.is-you {
  border-left-color: var(--ag-you);
  border-radius: 2px 10px 10px 2px;
  background: var(--ag-you-bg);
}

.ag-serp-pos {
  padding-top: 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-align: right;
}

.ag-serp-row.is-you .ag-serp-pos {
  color: var(--ag-you);
}

.ag-serp-main {
  min-width: 0;
}

.ag-serp-site {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ag-serp-avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 50%;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.ag-serp-avatar.is-small {
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.ag-serp-row.is-you .ag-serp-avatar {
  border-color: color-mix(in srgb, var(--ag-you) 35%, transparent);
  color: var(--ag-you);
}

.ag-serp-site-text {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  min-width: 0;
}

.ag-serp-domain {
  overflow: hidden;
  color: var(--ag-fg-1b);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-serp-url {
  overflow: hidden;
  color: var(--ag-serp-url);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-serp-badge {
  flex-shrink: 0;
  margin-left: auto;
  padding: 2px 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.ag-serp-badge.is-you {
  border-color: color-mix(in srgb, var(--ag-you) 32%, transparent);
  background: color-mix(in srgb, var(--ag-you) 12%, transparent);
  color: var(--ag-you);
}

.ag-serp-badge.is-competitor {
  border-color: color-mix(in srgb, var(--ag-competitor) 32%, transparent);
  background: color-mix(in srgb, var(--ag-competitor) 10%, transparent);
  color: var(--ag-competitor);
}

.ag-serp-title-wrap {
  margin: 6px 0 0;
  font-size: 16px;
  font-weight: 400;
  line-height: 22px;
}

.ag-serp-title {
  color: var(--ag-serp-title);
  font-weight: 400;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.ag-serp-title:hover {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-serp-title:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-serp-snippet {
  margin: 4px 0 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.ag-serp-section-title {
  margin: 0 0 8px;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.ag-serp-paa {
  margin-top: 24px;
}

.ag-serp-paa-list {
  margin: 0;
  padding: 0;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  list-style: none;
}

.ag-serp-paa-list li {
  padding: 11px 14px;
  color: var(--ag-fg-1b);
  font-size: 14px;
  line-height: 20px;
}

.ag-serp-paa-list li + li {
  border-top: 1px solid var(--ag-divider-subtle);
}

.ag-serp-foot {
  margin: 24px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--ag-divider-subtle);
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 18px;
}

.ag-serp-state {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding: 14px 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  color: var(--ag-fg-2);
}

.ag-serp-state.is-error {
  border-color: color-mix(in srgb, var(--ag-danger) 28%, transparent);
  background: var(--ag-danger-bg);
}

.ag-serp-state.is-error > svg {
  color: var(--ag-danger);
}

.ag-serp-state > svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.ag-serp-state-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-serp-state-body {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
}

.ag-serp-loading {
  margin-top: 18px;
}

.ag-serp-loading-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-serp-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--ag-fg-disabled);
  border-top-color: var(--ag-fg-2);
  border-radius: 50%;
  animation: ag-spin 0.8s linear infinite;
}

.ag-serp-skel {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 12px;
  padding: 14px 12px 14px 44px;
}

.ag-serp-skel-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ag-skel {
  display: block;
  height: 10px;
  border-radius: 5px;
  background: var(--ag-tab-bg);
  animation: ag-pulse 1.6s ease-in-out infinite;
}

.ag-skel-title {
  height: 14px;
}

.ag-skel-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
}

@media (prefers-reduced-motion: reduce) {
  .ag-skel,
  .ag-serp-spinner {
    animation: none;
  }
}
</style>
