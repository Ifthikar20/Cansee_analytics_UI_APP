<template>
  <div class="gt">
    <div class="gt-filters" role="group" aria-label="Filter prompts by gap">
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
            <td><GapBadge :cls="row.gap.class" :value="row.gap.value" show-value /></td>
            <td class="gt-fix" :title="row.top_action?.title || ''">
              <span class="gt-fix-inner">
                <span class="gt-fix-text">{{ fixLabel(row.top_action) }}</span>
                <ChevronRight class="gt-chevron" aria-hidden="true" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!filtered.length" class="gt-empty">No prompts in this group.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import GapBadge from '@/components/gap/GapBadge.vue'
import { engineMeta } from '@/lib/engines'
import { ACTION_LABELS, GAP_ORDER, gapMeta, googleLabel } from '@/lib/gap'

const props = defineProps({
  rows: { type: Array, required: true },
  engines: { type: Array, required: true },
})
const emit = defineEmits(['open'])
const filter = defineModel('filter', { type: String, default: 'all' })

const engineColumns = computed(() => props.engines.map((e) => ({ ...engineMeta(e.key), ...e })))

const chips = computed(() => {
  const counts = {}
  for (const row of props.rows) counts[row.gap.class] = (counts[row.gap.class] || 0) + 1
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
  filter.value === 'all' ? props.rows : props.rows.filter((r) => r.gap.class === filter.value),
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
  gap: 8px;
  margin-bottom: 14px;
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
  padding: 28px;
  color: var(--muted-foreground);
  font-size: 13px;
  text-align: center;
}
</style>
