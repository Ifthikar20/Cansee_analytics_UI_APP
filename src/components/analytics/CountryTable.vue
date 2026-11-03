<script setup>
// Every checked country in one table (contract 2g CountryMatrix): Google,
// each engine, AI visibility, gaps and when it was last checked. A row
// opens to list that country's prompts; each result opens its full detail
// (Google's top 10 or the engine's answer) in a dialog.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ChevronDown, CircleAlert, X } from '@lucide/vue'
import {
  DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle,
} from 'reka-ui'
import countriesApi from '@/api/countries'
import { engineMeta } from '@/lib/engines'
import { gapMeta } from '@/lib/gap'
import { timeAgo } from '@/utils/timeAgo'
import { safeHref } from '@/utils/safeHref'
import {
  aiOverviewText, aiVisibilityText, cellText, engineSummary, gapBadges, googleSummary, matrixEngines,
} from '@/lib/analytics/countrySpecs'
import MethodChip from './MethodChip.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
  matrix: { type: Object, required: true },
  // The page's engine filter: '' (all), 'google', or an engine key.
  engine: { type: String, default: '' },
  // A country code to bring into view (a tile picked on the map).
  highlight: { type: String, default: '' },
})

const showGoogle = computed(() => !props.engine || props.engine === 'google')
const showAi = computed(() => props.engine !== 'google')
const engines = computed(() => matrixEngines(props.matrix, { engine: props.engine }))
const cells = computed(() => props.matrix?.cells || [])
const prompts = computed(() => props.matrix?.prompts || [])
const columnCount = computed(
  () => 4 + (showGoogle.value ? 1 : 0) + engines.value.length + (showAi.value ? 1 : 0),
)

// ── Sorting: by name, AI visibility (highest first) or Google (best first) ──
const sort = ref({ key: 'name', dir: 'asc' })

function sortValue(country, key) {
  if (key === 'ai') return typeof country.ai_visibility_pct === 'number' ? country.ai_visibility_pct : null
  if (key === 'google') {
    const g = country.google
    return g?.state === 'ok' && typeof g.avg_position === 'number' ? g.avg_position : null
  }
  return country.name || country.country
}

const rows = computed(() => {
  const { key, dir } = sort.value
  const sign = dir === 'asc' ? 1 : -1
  return [...(props.matrix?.countries || [])].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    // Unmeasured rows stay last whichever way the column sorts.
    if (va === null || vb === null) {
      if (va === vb) return String(a.name).localeCompare(String(b.name))
      return va === null ? 1 : -1
    }
    if (typeof va === 'string') return va.localeCompare(vb) * sign
    return (va - vb) * sign
  })
})

function toggleSort(key) {
  if (sort.value.key === key) sort.value = { key, dir: sort.value.dir === 'asc' ? 'desc' : 'asc' }
  else sort.value = { key, dir: key === 'ai' ? 'desc' : 'asc' }
}

function ariaSort(key) {
  if (sort.value.key !== key) return 'none'
  return sort.value.dir === 'asc' ? 'ascending' : 'descending'
}

// ── Rows that open to list the country's prompts ──
const expanded = ref(new Set())

function toggleRow(cc) {
  const next = new Set(expanded.value)
  if (next.has(cc)) next.delete(cc)
  else next.add(cc)
  expanded.value = next
}

function promptRows(cc) {
  const mine = cells.value.filter((c) => c.country === cc)
  return prompts.value
    .filter((p) => mine.some((c) => String(c.prompt_id) === String(p.prompt_id)))
    .map((p) => {
      const of = (engine) => mine.find((c) => String(c.prompt_id) === String(p.prompt_id) && c.engine === engine) || null
      return {
        id: String(p.prompt_id),
        text: p.text,
        google: of('google'),
        engines: Object.fromEntries(engines.value.map((e) => [e.key, of(e.key)])),
      }
    })
}

function countryDepth(cc) {
  return props.matrix?.countries?.find((c) => c.country === cc)?.google?.depth || null
}

function gapsText(country) {
  const badges = gapBadges(country.gap_counts)
  if (badges.length) return badges
  return country.gap_counts ? 'No gap' : 'Not checked'
}

// ── A tile picked on the map: bring its row into view ──
const rowEls = new Map()
const flashed = ref('')
let flashTimer = null

function setRowEl(cc, el) {
  if (el) rowEls.set(cc, el)
  else rowEls.delete(cc)
}

watch(
  () => props.highlight,
  async (code) => {
    const cc = String(code || '').toLowerCase()
    clearTimeout(flashTimer)
    flashed.value = cc
    if (!cc) return
    await nextTick()
    rowEls.get(cc)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    flashTimer = setTimeout(() => {
      flashed.value = ''
    }, 2400)
  },
)

onBeforeUnmount(() => clearTimeout(flashTimer))

// ── Result detail ──
const detailOpen = ref(false)
const detailCell = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')

function engineLabel(key) {
  if (key === 'google') return 'Google'
  return props.matrix?.engines?.find((e) => e.key === key)?.label || engineMeta(key).label
}

function countryNameOf(cc) {
  return props.matrix?.countries?.find((c) => c.country === cc)?.name || String(cc).toUpperCase()
}

async function loadDetail() {
  const cell = detailCell.value
  if (!cell) return
  detailLoading.value = true
  detailError.value = ''
  try {
    const res = await countriesApi.result(props.websiteId, cell.id)
    if (detailCell.value?.id === cell.id) detail.value = res.data
  } catch {
    if (detailCell.value?.id === cell.id) detailError.value = "We couldn't load this result."
  } finally {
    if (detailCell.value?.id === cell.id) detailLoading.value = false
  }
}

function openDetail(cell) {
  detailCell.value = cell
  detail.value = null
  detailOpen.value = true
  loadDetail()
}

const shown = computed(() => detail.value || detailCell.value)
const detailTitle = computed(() => {
  const c = shown.value
  if (!c) return ''
  return `${engineLabel(c.engine)} in ${c.country_name || countryNameOf(c.country)}`
})
const detailPrompt = computed(() => {
  const c = shown.value
  if (!c) return ''
  return c.prompt_text || prompts.value.find((p) => String(p.prompt_id) === String(c.prompt_id))?.text || ''
})
</script>

<template>
  <div class="ct">
    <div class="ct-scroll">
      <table class="ct-table">
        <caption class="sr-only">Rankings by country</caption>
        <thead>
          <tr>
            <th scope="col" :aria-sort="ariaSort('name')">
              <button type="button" class="ct-sort" @click="toggleSort('name')">
                Country
                <component :is="sort.dir === 'asc' ? ArrowUp : ArrowDown" v-if="sort.key === 'name'" class="ct-sort-icon" aria-hidden="true" />
              </button>
            </th>
            <th v-if="showGoogle" scope="col" :aria-sort="ariaSort('google')">
              <button type="button" class="ct-sort" @click="toggleSort('google')">
                Google
                <component :is="sort.dir === 'asc' ? ArrowUp : ArrowDown" v-if="sort.key === 'google'" class="ct-sort-icon" aria-hidden="true" />
              </button>
            </th>
            <th v-for="e in engines" :key="e.key" scope="col">{{ e.label }}</th>
            <th v-if="showAi" scope="col" :aria-sort="ariaSort('ai')">
              <button type="button" class="ct-sort" @click="toggleSort('ai')">
                AI visibility
                <component :is="sort.dir === 'asc' ? ArrowUp : ArrowDown" v-if="sort.key === 'ai'" class="ct-sort-icon" aria-hidden="true" />
              </button>
            </th>
            <th scope="col">Gaps</th>
            <th scope="col">Last checked</th>
            <th scope="col"><span class="sr-only">Prompts</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="row.country">
            <tr
              :ref="(el) => setRowEl(row.country, el)"
              class="ct-row"
              :class="{ 'is-flash': flashed === row.country, 'is-open': expanded.has(row.country) }"
            >
              <th scope="row" class="ct-country">
                <span class="ct-country-name">{{ row.name }}</span>
                <span class="ct-code">{{ String(row.country).toUpperCase() }}</span>
              </th>
              <td v-if="showGoogle">
                <span class="ct-value" :class="{ 'is-state': !googleSummary(row.google).measured }">
                  {{ googleSummary(row.google).text }}
                </span>
                <span v-if="googleSummary(row.google).sub" class="ct-sub">{{ googleSummary(row.google).sub }}</span>
                <MethodChip
                  v-if="row.google?.method_label"
                  class="ct-chip"
                  :method="row.google.method"
                  :label="row.google.method_label"
                />
              </td>
              <td v-for="e in engines" :key="e.key">
                <span class="ct-value" :class="{ 'is-state': !engineSummary(row.engines?.[e.key]).measured }">
                  {{ engineSummary(row.engines?.[e.key]).text }}
                </span>
                <span v-if="engineSummary(row.engines?.[e.key]).sub" class="ct-sub">
                  {{ engineSummary(row.engines?.[e.key]).sub }}
                </span>
                <MethodChip
                  v-if="row.engines?.[e.key]?.method_label"
                  class="ct-chip"
                  :method="row.engines[e.key].method"
                  :label="row.engines[e.key].method_label"
                />
              </td>
              <td v-if="showAi">
                <span class="ct-value" :class="{ 'is-state': typeof row.ai_visibility_pct !== 'number' }">
                  {{ aiVisibilityText(row) }}
                </span>
              </td>
              <td>
                <span v-if="typeof gapsText(row) === 'string'" class="ct-muted">{{ gapsText(row) }}</span>
                <span v-else class="ct-gaps">
                  <span
                    v-for="b in gapsText(row)"
                    :key="b.cls"
                    class="ct-gap"
                    :style="{ '--tone': gapMeta(b.cls).color }"
                  >
                    <span class="ct-gap-dot" aria-hidden="true"></span>
                    {{ b.text }}
                  </span>
                </span>
              </td>
              <td>
                <span v-if="row.last_checked_at" :title="row.last_checked_at">{{ timeAgo(row.last_checked_at) }}</span>
                <span v-else class="ct-muted">Not checked</span>
              </td>
              <td class="ct-toggle-cell">
                <button
                  type="button"
                  class="ct-toggle"
                  :aria-expanded="expanded.has(row.country) ? 'true' : 'false'"
                  :aria-controls="`ct-prompts-${row.country}`"
                  @click="toggleRow(row.country)"
                >
                  {{ expanded.has(row.country) ? 'Hide prompts' : 'Show prompts' }}
                  <ChevronDown class="ct-toggle-icon" aria-hidden="true" />
                </button>
              </td>
            </tr>
            <tr v-if="expanded.has(row.country)" :id="`ct-prompts-${row.country}`" class="ct-detail-row">
              <td :colspan="columnCount">
                <p v-if="!promptRows(row.country).length" class="ct-muted">No prompt was checked in {{ row.name }}.</p>
                <table v-else class="ct-inner">
                  <caption class="sr-only">Prompts checked in {{ row.name }}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Prompt</th>
                      <th v-if="showGoogle" scope="col">Google</th>
                      <th v-for="e in engines" :key="e.key" scope="col">{{ e.label }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in promptRows(row.country)" :key="p.id">
                      <th scope="row" class="ct-inner-prompt">{{ p.text }}</th>
                      <td v-if="showGoogle">
                        <span class="ct-cell-text">{{ cellText(p.google, { depth: countryDepth(row.country) }) }}</span>
                        <button
                          v-if="p.google"
                          type="button"
                          class="ct-details"
                          :aria-label="`Details: Google, ${p.text}, ${row.name}`"
                          @click="openDetail(p.google)"
                        >Details</button>
                      </td>
                      <td v-for="e in engines" :key="e.key">
                        <span class="ct-cell-text">{{ cellText(p.engines[e.key]) }}</span>
                        <button
                          v-if="p.engines[e.key]"
                          type="button"
                          class="ct-details"
                          :aria-label="`Details: ${e.label}, ${p.text}, ${row.name}`"
                          @click="openDetail(p.engines[e.key])"
                        >Details</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <DialogRoot v-model:open="detailOpen">
      <DialogPortal>
        <DialogOverlay class="ct-overlay" />
        <DialogContent class="ct-dialog">
          <div class="ct-dialog-head">
            <div class="ct-dialog-heading">
              <DialogTitle class="ct-dialog-title">{{ detailTitle }}</DialogTitle>
              <DialogDescription class="ct-dialog-desc">{{ detailPrompt }}</DialogDescription>
            </div>
            <DialogClose class="ct-dialog-close" aria-label="Close">
              <X class="size-4" aria-hidden="true" />
            </DialogClose>
          </div>

          <div class="ct-dialog-body">
            <div v-if="shown" class="ct-dialog-meta">
              <span class="ct-dialog-result">{{ cellText(shown, { depth: countryDepth(shown.country) }) }}</span>
              <MethodChip :method="shown.method" :label="shown.method_label" />
              <span v-if="shown.checked_at" class="ct-muted">Checked {{ timeAgo(shown.checked_at) }}</span>
            </div>

            <p v-if="shown?.error?.message" class="ct-error">
              <CircleAlert class="ct-error-icon" aria-hidden="true" />
              <span>{{ shown.error.message }}</span>
            </p>

            <div v-if="detailLoading && !detail" class="ct-dialog-loading" aria-busy="true">
              <Skeleton class="h-4 w-2/3 rounded" />
              <Skeleton class="h-24 rounded-xl" />
            </div>

            <div v-else-if="detailError" class="ct-dialog-failed">
              <p class="ct-muted">{{ detailError }}</p>
              <Button variant="outline" size="sm" class="rounded-full" @click="loadDetail">Try again</Button>
            </div>

            <template v-else-if="detail && detail.engine === 'google'">
              <p v-if="safeHref(detail.url)" class="ct-dialog-line">
                Your page:
                <a :href="safeHref(detail.url)" target="_blank" rel="noopener noreferrer">{{ detail.url }}</a>
              </p>
              <p v-if="aiOverviewText(detail.ai_overview)" class="ct-dialog-line">{{ aiOverviewText(detail.ai_overview) }}</p>
              <section v-if="(detail.top_results || []).length" class="ct-dialog-section" aria-label="Google top 10">
                <h3 class="ct-dialog-subtitle">Google top 10</h3>
                <ol class="ct-results">
                  <li v-for="r in detail.top_results" :key="`${r.position}-${r.url}`" class="ct-result">
                    <span class="ct-result-pos">#{{ r.position }}</span>
                    <span class="ct-result-text">
                      <a
                        v-if="safeHref(r.url)"
                        :href="safeHref(r.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ct-result-title"
                      >{{ r.title || r.domain }}</a>
                      <span v-else class="ct-result-title">{{ r.title || r.domain }}</span>
                      <span class="ct-result-domain">{{ r.domain }}</span>
                    </span>
                    <span v-if="r.is_yours" class="ct-tag is-yours">Yours</span>
                    <span v-else-if="r.is_competitor" class="ct-tag">Competitor</span>
                  </li>
                </ol>
              </section>
            </template>

            <template v-else-if="detail">
              <section v-if="detail.answer_text" class="ct-dialog-section">
                <h3 class="ct-dialog-subtitle">
                  Answer from {{ engineLabel(detail.engine) }}<template v-if="detail.method_label"> · {{ detail.method_label }}</template>
                </h3>
                <p class="ct-answer">{{ detail.answer_text }}</p>
              </section>
              <section v-if="(detail.brands || []).length" class="ct-dialog-section">
                <h3 class="ct-dialog-subtitle">Brands named</h3>
                <ol class="ct-brands">
                  <li v-for="b in detail.brands" :key="`${b.position}-${b.name}`">
                    <span v-if="b.position" class="ct-result-pos">#{{ b.position }}</span>
                    {{ b.name }}
                  </li>
                </ol>
              </section>
              <section v-if="(detail.citations || []).length" class="ct-dialog-section">
                <h3 class="ct-dialog-subtitle">Sources</h3>
                <ul class="ct-sources">
                  <li v-for="url in detail.citations" :key="url">
                    <a v-if="safeHref(url)" :href="safeHref(url)" target="_blank" rel="noopener noreferrer">{{ url }}</a>
                    <span v-else>{{ url }}</span>
                  </li>
                </ul>
              </section>
              <p v-if="detail.model_id" class="ct-muted ct-model">Model: {{ detail.model_id }}</p>
            </template>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>

<style scoped>
.ct-scroll {
  /* The containing block of the visually hidden header text, so the text
     stays inside the scrolled table instead of widening the page. */
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}

.ct-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.ct-table > thead th {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.ct-table > tbody > tr > th,
.ct-table > tbody > tr > td {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.ct-table > tbody > tr:last-child > th,
.ct-table > tbody > tr:last-child > td {
  border-bottom: 0;
}

.ct-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.ct-sort:hover {
  color: var(--foreground);
}

.ct-sort-icon {
  width: 13px;
  height: 13px;
}

.ct-row {
  transition: background 0.4s ease;
}

.ct-row.is-flash {
  background: var(--accent);
}

.ct-country {
  min-width: 150px;
  font-weight: 600;
}

.ct-country-name {
  margin-right: 8px;
}

.ct-code {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted-foreground);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.ct-value {
  display: block;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ct-value.is-state {
  color: var(--muted-foreground);
  font-weight: 400;
}

.ct-sub {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap;
}

.ct-chip {
  margin-top: 6px;
}

.ct-muted {
  color: var(--muted-foreground);
}

.ct-gaps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ct-gap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tone) 13%, transparent);
  color: var(--foreground);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ct-gap-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tone);
}

.ct-toggle-cell {
  text-align: right !important;
}

.ct-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.ct-toggle:hover {
  background: var(--accent);
}

.ct-toggle-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.15s ease;
}

.ct-row.is-open .ct-toggle-icon {
  transform: rotate(180deg);
}

.ct-detail-row > td {
  background: var(--muted);
}

.ct-inner {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ct-inner th,
.ct-inner td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.ct-inner thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.ct-inner tbody tr:last-child > * {
  border-bottom: 0;
}

.ct-inner-prompt {
  min-width: 220px;
  color: var(--foreground);
  font-weight: 500;
}

.ct-cell-text {
  display: block;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ct-details {
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

.ct-details:hover {
  color: var(--foreground);
}

.ct-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 10, 12, 0.45);
}

.ct-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%);
  outline: none;
}

.ct-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 24px 0;
}

.ct-dialog-heading {
  min-width: 0;
}

.ct-dialog-title {
  color: var(--foreground);
  font-size: 17px;
  font-weight: 600;
}

.ct-dialog-desc {
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.ct-dialog-close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.ct-dialog-close:hover {
  background: var(--accent);
  color: var(--foreground);
}

.ct-dialog-body {
  display: grid;
  gap: 14px;
  min-height: 0;
  padding: 16px 24px 22px;
  overflow-y: auto;
  font-size: 13.5px;
}

.ct-dialog-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.ct-dialog-result {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
}

.ct-dialog-loading {
  display: grid;
  gap: 10px;
}

.ct-dialog-failed {
  display: grid;
  justify-items: start;
  gap: 8px;
}

.ct-dialog-line {
  color: var(--foreground);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ct-dialog-section {
  display: grid;
  gap: 8px;
}

.ct-dialog-subtitle {
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 600;
}

.ct-results,
.ct-brands,
.ct-sources {
  display: grid;
  gap: 6px;
  list-style: none;
}

.ct-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ct-result-pos {
  flex-shrink: 0;
  min-width: 28px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.ct-result-text {
  display: grid;
  flex: 1;
  min-width: 0;
}

.ct-result-title {
  overflow-wrap: anywhere;
  color: var(--foreground);
  font-weight: 500;
}

.ct-result-domain {
  color: var(--muted-foreground);
  font-size: 12px;
}

.ct-tag {
  flex-shrink: 0;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-weight: 600;
}

.ct-tag.is-yours {
  border-color: var(--foreground);
  color: var(--foreground);
}

.ct-answer {
  max-height: 320px;
  padding: 12px 14px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--muted);
  color: var(--foreground);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ct-sources a {
  overflow-wrap: anywhere;
}

.ct-model {
  font-size: 12px;
}

.ct-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--destructive);
}

.ct-error-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}
</style>
