<script setup>
// A Page Optimizer draft (p2_contract.md 12d page_revision): the page as it
// was read, its title, description and H1 now and proposed, and one card
// per change with the measurements behind it. Page text and the model's
// words render as text only.
import { computed } from 'vue'
import { ExternalLink, Minus, Plus } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { relativeTime } from '@/components/agent/common/agentText'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/agent/download'
import { pathOf } from '@/lib/agent/contextSections'
import { pageRevision } from '@/lib/agent/structured'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  data: { type: Object, default: null },
  live: { type: Boolean, default: false },
})

const toast = useToast()
const count = new Intl.NumberFormat('en-US')

const view = computed(() => pageRevision(props.data))
const drafting = computed(() => props.live || view.value.drafting)
const source = computed(() => view.value.source)
const pageHref = computed(() => safeHref(source.value.final_url || source.value.url || ''))

const sourceLine = computed(() => {
  const s = source.value
  const bits = []
  const path = pathOf(s.final_url || s.url)
  if (path) bits.push(path)
  const when = relativeTime(s.read_at)
  if (when) bits.push(`read ${when}`)
  if (s.words !== null) bits.push(`${count.format(s.words)} words`)
  return bits.join(' · ')
})

const META_ROWS = [
  { key: 'title', label: 'Title' },
  { key: 'meta_description', label: 'Meta description' },
  { key: 'h1', label: 'H1' },
]

async function copyProposed(change) {
  if (await copyText(change.after)) toast.success('Copied')
}
</script>

<template>
  <div class="ag-prv">
    <div v-if="sourceLine || pageHref" class="ag-prv-source">
      <span class="ag-prv-source-text ag-tnum">{{ sourceLine }}</span>
      <a v-if="pageHref" :href="pageHref" class="ag-prv-open" target="_blank" rel="noopener noreferrer nofollow">
        Open page
        <ExternalLink :size="13" aria-hidden="true" />
      </a>
    </div>

    <table class="ag-prv-meta">
      <thead>
        <tr>
          <th scope="col"><span class="ag-sr-only">Field</span></th>
          <th scope="col">Now</th>
          <th scope="col">Proposed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in META_ROWS" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td :class="{ 'is-muted': !view.current[row.key] }">{{ view.current[row.key] || 'Not set' }}</td>
          <td :class="{ 'is-muted': !view.proposed[row.key] }">{{ view.proposed[row.key] || 'Not set' }}</td>
        </tr>
      </tbody>
    </table>

    <ol v-if="view.changes.length" class="ag-prv-changes" aria-label="Changes">
      <li v-for="change in view.changes" :key="change.id" class="ag-prv-change">
        <p class="ag-prv-kind">
          <span class="ag-prv-word">{{ change.word }}</span>
          <span v-if="change.section" class="ag-prv-section">{{ change.section }}</span>
        </p>
        <div v-if="change.before" class="ag-prv-block is-now">
          <p class="ag-prv-block-head"><Minus :size="13" aria-hidden="true" /> Now</p>
          <p class="ag-prv-text">{{ change.before }}</p>
        </div>
        <div v-if="change.after" class="ag-prv-block is-proposed">
          <p class="ag-prv-block-head"><Plus :size="13" aria-hidden="true" /> Proposed</p>
          <p class="ag-prv-text">{{ change.after }}</p>
        </div>
        <p v-if="change.reason" class="ag-prv-why">Why: {{ change.reason }}</p>
        <ul v-if="change.signals.length" class="ag-prv-signals" role="list" aria-label="Measurements">
          <li v-for="s in change.signals" :key="s.id" class="ag-prv-signal">{{ s.text }}</li>
        </ul>
        <div v-if="change.after && !drafting" class="ag-prv-actions">
          <AgButton size="xs" variant="ghost" @click="copyProposed(change)">Copy proposed text</AgButton>
        </div>
      </li>
    </ol>
    <p v-else-if="!drafting" class="ag-prv-none">No changes were proposed.</p>

    <p v-if="drafting" class="ag-prv-drafting" role="status"><AgSpinner :size="12" /> Drafting…</p>
  </div>
</template>

<style scoped>
.ag-prv {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px 32px;
  color: var(--ag-fg-1);
}

.ag-prv-source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-prv-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ag-fg-1);
  font-weight: 500;
  text-decoration: none;
}

.ag-prv-open:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 1;
}

.ag-prv-open:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-prv-meta {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 19px;
  table-layout: fixed;
}

.ag-prv-meta th,
.ag-prv-meta td {
  padding: 8px 10px;
  border-top: 1px solid var(--ag-divider-subtle);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.ag-prv-meta thead th {
  border-top: 0;
  color: var(--ag-fg-3);
  font-weight: 500;
}

.ag-prv-meta tbody th {
  width: 132px;
  color: var(--ag-fg-2);
  font-weight: 500;
}

.ag-prv-meta .is-muted {
  color: var(--ag-fg-4);
}

.ag-prv-changes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-prv-change {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.ag-prv-kind {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.ag-prv-word {
  font-size: 13px;
  font-weight: 600;
}

.ag-prv-section {
  color: var(--ag-fg-3);
  font-size: 13px;
}

.ag-prv-block {
  padding: 8px 10px;
  border-radius: var(--radius);
}

.ag-prv-block.is-now {
  background: var(--ag-danger-bg);
}

.ag-prv-block.is-proposed {
  background: var(--ag-you-bg);
}

.ag-prv-block-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 2px;
  color: var(--ag-fg-2);
  font-size: 12px;
  font-weight: 500;
}

.ag-prv-text {
  margin: 0;
  font-size: 13.5px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-prv-why {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
}

.ag-prv-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-prv-signal {
  padding: 2px 8px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 17px;
}

.ag-prv-actions {
  display: flex;
  justify-content: flex-end;
}

.ag-prv-none,
.ag-prv-drafting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
}

@media (max-width: 560px) {
  .ag-prv {
    padding: 16px;
  }

  .ag-prv-meta tbody th {
    width: 96px;
  }
}
</style>
