<template>
  <div class="gt">
    <div class="gt-filters">
      <div class="gt-chips" role="group" aria-label="Filter prompts by gap">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          class="gt-chip"
          :class="{ 'is-active': filter === chip.key }"
          :aria-pressed="filter === chip.key ? 'true' : 'false'"
          @click="filter = chip.key"
        >
          <span v-if="chip.color" class="gt-chip-dot" :style="{ background: chip.color }" aria-hidden="true"></span>
          {{ chip.label }}
          <span class="gt-chip-count">{{ chip.count }}</span>
        </button>
      </div>
      <label class="gt-search">
        <Search class="gt-search-icon" aria-hidden="true" />
        <span class="sr-only">Search prompts</span>
        <input v-model="search" type="search" class="gt-search-input" placeholder="Search prompts" />
      </label>
      <label class="gt-select">
        <span class="sr-only">Country</span>
        <select v-model="country" class="gt-select-input">
          <option value="">All countries</option>
          <option v-for="c in countries" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <ChevronDown class="gt-select-caret" aria-hidden="true" />
      </label>
      <label class="gt-select">
        <span class="sr-only">Sort</span>
        <select v-model="sort" class="gt-select-input">
          <option v-for="s in SORTS" :key="s.value" :value="s.value" :disabled="s.value === 'newest' && !order.length">
            {{ s.label }}
          </option>
        </select>
        <ChevronDown class="gt-select-caret" aria-hidden="true" />
      </label>
    </div>

    <div class="gt-scroll">
      <table class="gt-table">
        <thead>
          <tr>
            <th class="gt-prompt" scope="col">Prompt</th>
            <th scope="col">Google</th>
            <th v-for="e in engineColumns" :key="e.key" scope="col">
              <span class="gt-engine-head">
                <span class="gt-engine-dot" :style="{ background: e.color }" aria-hidden="true"></span>
                {{ e.label }}
              </span>
            </th>
            <th scope="col">Gap</th>
            <th class="gt-fix" scope="col">Top fix</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filtered"
            :key="row.prompt_id"
            tabindex="0"
            class="gt-row"
            @click="emit('open', row)"
            @keydown.enter="emit('open', row)"
          >
            <td class="gt-prompt">
              <span class="gt-prompt-text">{{ row.text }}</span>
              <span v-if="row.location" class="gt-loc">{{ row.location.toUpperCase() }}</span>
            </td>
            <td>
              <span v-if="row.google.status === 'ok' && row.google.position" class="gt-google">
                <strong>#{{ row.google.position }}</strong>
                <span class="gt-page">p{{ row.google.page }}</span>
              </span>
              <span v-else class="gt-muted">{{ googleLabel(row.google) }}</span>
            </td>
            <td v-for="e in engineColumns" :key="e.key">
              <span
                v-if="cell(row, e.key).answers"
                class="gt-rank"
                :class="{ 'is-missing': !cell(row, e.key).mentioned }"
                :title="cellTitle(row, e)"
              >
                <span class="gt-rank-dot" :style="{ background: gapMeta(cell(row, e.key).class).color }" aria-hidden="true"></span>
                {{ rankText(cell(row, e.key)) }}
              </span>
              <span v-else class="gt-muted" :title="cell(row, e.key).configured ? 'No answers yet' : 'Not available yet'">—</span>
            </td>
            <td><GapBadge :gap="row.gap" show-value /></td>
            <td class="gt-fix" :title="row.top_action?.title || ''">
              <span class="gt-fix-inner">
                <span class="gt-fix-text">{{ fixLabel(row.top_action) }}</span>
                <ChevronRight class="gt-chevron" aria-hidden="true" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length" class="gt-empty">
        <p>No prompts match these filters.</p>
        <button type="button" class="gt-clear" @click="clearFilters">Clear filters</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight, Search } from '@lucide/vue'
import GapBadge from '@/components/gap/GapBadge.vue'
import { countryName } from '@/lib/charts/format'
import { engineMeta } from '@/lib/engines'
import { ACTION_LABELS, GAP_ORDER, gapKey, gapMeta, googleLabel } from '@/lib/gap'

const props = defineProps({
  rows: { type: Array, required: true },
  engines: { type: Array, required: true },
  // Prompt ids in the order they were added (oldest first), for "Newest";
  // the overview rows carry no creation time.
  order: { type: Array, default: () => [] },
})
const emit = defineEmits(['open'])
const filter = defineModel('filter', { type: String, default: 'all' })

const SORTS = [
  { value: 'gap', label: 'Biggest gap' },
  { value: 'google', label: 'Best Google position' },
  { value: 'ai', label: 'Highest AI score' },
  { value: 'newest', label: 'Newest' },
]

const GLOBAL = '__global'

const search = ref('')
const country = ref('')
const sort = ref('gap')

// The prompts' locations as country names, Global (no location) last.
const countries = computed(() => {
  const codes = new Set(props.rows.map((r) => String(r.location || '').toLowerCase()))
  const named = [...codes]
    .filter(Boolean)
    .map((code) => ({ value: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return codes.has('') ? [...named, { value: GLOBAL, label: 'Global' }] : named
})

function matches(row) {
  if (filter.value !== 'all' && gapKey(row.gap) !== filter.value) return false
  if (country.value) {
    const loc = String(row.location || '').toLowerCase()
    if (country.value === GLOBAL ? loc !== '' : loc !== country.value) return false
  }
  const q = search.value.trim().toLowerCase()
  return !q || String(row.text || '').toLowerCase().includes(q)
}

// The gap's size for sorting: its value, else the lower bound of a range.
function gapSize(gap) {
  if (gap.value !== null && gap.value !== undefined) return gap.value
  return gap.value_min ?? null
}

// Sort keys: smaller first; rows without the measure go last.
const LAST = Number.POSITIVE_INFINITY

function googleKey(row) {
  const g = row.google || {}
  if (g.status !== 'ok') return LAST
  return g.position || 1000
}

function sortKey(row) {
  switch (sort.value) {
    case 'google':
      return googleKey(row)
    case 'ai':
      return row.gap.ai_score === null || row.gap.ai_score === undefined ? LAST : -row.gap.ai_score
    case 'newest': {
      const at = props.order.indexOf(row.prompt_id)
      return at === -1 ? LAST : -at
    }
    default:
      return gapSize(row.gap) === null ? LAST : -Math.abs(gapSize(row.gap))
  }
}

function clearFilters() {
  search.value = ''
  country.value = ''
  filter.value = 'all'
}

const engineColumns = computed(() => props.engines.map((e) => ({ ...engineMeta(e.key), ...e })))

const chips = computed(() => {
  const counts = {}
  for (const row of props.rows) counts[gapKey(row.gap)] = (counts[gapKey(row.gap)] || 0) + 1
  return [
    { key: 'all', label: 'All', count: props.rows.length },
    ...GAP_ORDER.filter((cls) => counts[cls]).map((cls) => ({
      key: cls,
      label: gapMeta(cls).label,
      color: gapMeta(cls).color,
      count: counts[cls],
    })),
  ]
})

const filtered = computed(() =>
  props.rows
    .filter(matches)
    .map((row) => ({ row, key: sortKey(row) }))
    .sort((a, b) => (a.key === b.key ? 0 : a.key < b.key ? -1 : 1))
    .map((r) => r.row),
)

const EMPTY_CELL = { answers: 0, configured: false, mentioned: false, rank: null, class: 'no_data' }

function cell(row, key) {
  return row.engines[key] || EMPTY_CELL
}

function fixLabel(action) {
  if (!action) return 'Nothing to change'
  return ACTION_LABELS[action.kind] || action.title
}

function rankText(c) {
  if (!c.mentioned) return 'Not named'
  return c.rank ? `#${c.rank}` : 'Named'
}

function cellTitle(row, engine) {
  const c = cell(row, engine.key)
  const vis = c.visibility_pct === null ? '' : `, in ${c.visibility_pct}% of recent answers`
  return `${engine.label}: ${rankText(c)}${vis}. ${gapMeta(c.class).label}.`
}
</script>

<style scoped>
.gt-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.gt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gt-search {
  position: relative;
  display: inline-flex;
  flex: 1 1 200px;
  min-width: 0;
  max-width: 320px;
}

.gt-search-icon {
  position: absolute;
  top: 50%;
  left: 11px;
  width: 15px;
  height: 15px;
  color: var(--muted-foreground);
  transform: translateY(-50%);
  pointer-events: none;
}

.gt-search-input,
.gt-select-input {
  width: 100%;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s ease;
}

.gt-search-input {
  padding: 0 12px 0 32px;
}

.gt-search-input::placeholder {
  color: var(--muted-foreground);
}

.gt-select {
  position: relative;
  display: inline-flex;
}

.gt-select-input {
  max-width: 220px;
  padding: 0 30px 0 12px;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.gt-search-input:hover,
.gt-select-input:hover {
  border-color: var(--input);
}

.gt-search-input:focus-visible,
.gt-select-input:focus-visible {
  border-color: var(--ring);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.gt-select-input option {
  background: var(--popover);
  color: var(--popover-foreground);
}

.gt-select-caret {
  position: absolute;
  top: 50%;
  right: 10px;
  width: 14px;
  height: 14px;
  color: var(--muted-foreground);
  transform: translateY(-50%);
  pointer-events: none;
}

.gt-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.gt-chip:hover {
  border-color: var(--input);
}

.gt-chip:focus-visible {
  border-radius: 999px;
}

.gt-chip.is-active {
  border-color: var(--foreground);
  background: var(--accent);
}

.gt-chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.gt-chip-count {
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.gt-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}

.gt-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.gt-table th {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.gt-table td {
  padding: 13px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  vertical-align: middle;
  white-space: nowrap;
}

.gt-row:last-child td {
  border-bottom: 0;
}

.gt-row {
  cursor: pointer;
  transition: background 0.12s ease;
}

.gt-row:hover,
.gt-row:focus-visible {
  outline: none;
  background: var(--muted);
}

.gt-prompt {
  width: 34%;
  min-width: 240px;
  white-space: normal !important;
}

.gt-prompt-text {
  font-weight: 500;
}

.gt-loc {
  margin-left: 8px;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted-foreground);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.gt-engine-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gt-engine-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.gt-google strong,
.gt-rank {
  font-variant-numeric: tabular-nums;
}

.gt-google strong {
  font-weight: 600;
}

.gt-page {
  margin-left: 5px;
  color: var(--muted-foreground);
  font-size: 12px;
}

.gt-rank {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.gt-rank.is-missing {
  color: var(--muted-foreground);
  font-weight: 400;
}

.gt-rank-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.gt-muted {
  color: var(--muted-foreground);
}

.gt-fix-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.gt-fix-text {
  overflow: hidden;
  color: var(--muted-foreground);
  text-overflow: ellipsis;
}

.gt-row:hover .gt-fix-text {
  color: var(--foreground);
}

.gt-chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.gt-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 28px;
  color: var(--muted-foreground);
  font-size: 13px;
  text-align: center;
}

.gt-clear {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.gt-clear:hover {
  border-color: var(--input);
}

.gt-clear:focus-visible {
  border-radius: 999px;
}
</style>
