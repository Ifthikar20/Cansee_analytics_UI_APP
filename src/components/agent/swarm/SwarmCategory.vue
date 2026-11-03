<template>
  <section class="ag-swarm-cat" :class="{ 'is-open': open }">
    <h4 class="ag-swarm-cat-h">
      <button
        type="button"
        class="ag-swarm-cat-row"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="bodyId"
        :aria-label="name"
        @click="emit('toggle', group.key)"
      >
        <ChevronRight class="ag-swarm-cat-chev" :size="14" aria-hidden="true" />
        <component :is="icon" class="ag-swarm-cat-icon" :size="16" aria-hidden="true" />
        <span class="ag-swarm-cat-label">{{ group.label }}</span>
        <span class="ag-swarm-cat-sum">{{ summary }}</span>
        <span class="ag-swarm-cat-count ag-tnum">{{ countText }}</span>
        <span class="ag-swarm-cat-mark" aria-hidden="true">
          <LoaderCircle v-if="running" class="ag-swarm-cat-spin" :size="12" />
          <X v-else-if="counts.failed" class="ag-swarm-cat-x" :size="12" />
        </span>
      </button>
    </h4>
    <div :id="bodyId" class="ag-swarm-cat-body" :class="{ 'is-open': open }">
      <div class="ag-swarm-cat-inner">
        <p v-for="(note, i) in group.notes" :key="`${note.code || 'note'}-${i}`" class="ag-swarm-note" :class="`is-${note.level || 'info'}`">
          <Info class="ag-swarm-note-icon" :size="12" aria-hidden="true" />
          <span>{{ note.text }}</span>
        </p>
        <div v-for="sub in subcategories" :key="sub.key" class="ag-swarm-sub">
          <p class="ag-swarm-sub-row">
            <span class="ag-swarm-sub-label">“{{ sub.label || sub.key }}”</span>{{ ' ' }}<span class="ag-swarm-sub-count ag-tnum">{{ sub.counts.settled }}/{{ sub.counts.total }}</span>
          </p>
          <ul class="ag-swarm-tasks" :aria-label="`${group.label}: “${sub.label || sub.key}”`">
            <SwarmTaskRow
              v-for="task in sub.tasks"
              :key="task.id"
              :task="task"
              :detail-id="`${idBase}-t${indexOf(task.id)}`"
              :waiting="task.status === 'queued' ? waiting(task.id) : ''"
            />
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
// One category of the research agents tree: a disclosure row (icon, label,
// one-line summary when collapsed, count, status), its notes, and its agents
// grouped by prompt.
import { computed, inject } from 'vue'
import { Building2, ChevronRight, FileText, Info, Link2, LoaderCircle, Search, Sparkles, X } from '@lucide/vue'
import SwarmTaskRow from './SwarmTaskRow.vue'
import { SWARM_TREE, categorySummary, defaultTree, swarmCounts } from './swarmView'

const ICONS = { google: Search, engines: Sparkles, competitors: Building2, site: FileText, sources: Link2 }

const props = defineProps({
  // {key, label, notes, subcategories: [{key, label, tasks}], tasks} (groupTasks)
  group: { type: Object, required: true },
  open: { type: Boolean, default: false },
  // `ag-swarm-{messageId}-{partId}`: the prefix of every DOM id in the block.
  idBase: { type: String, required: true },
  // task id -> its index in the part, for the detail ids.
  indexById: { type: Object, default: () => ({}) },
  // task id -> "Waiting for ..." for queued tasks.
  waitingById: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['toggle'])

const tree = inject(SWARM_TREE, defaultTree())

const icon = computed(() => ICONS[props.group.key] || Search)
const bodyId = computed(() => `${props.idBase}-c-${props.group.key}`)
const counts = computed(() => swarmCounts(props.group.tasks))
const swarmLive = computed(() => Boolean(tree.swarmLive))
const running = computed(() => swarmLive.value && counts.value.running > 0)
const settled = computed(() => counts.value.total > 0 && counts.value.settled === counts.value.total)

const subcategories = computed(() =>
  (props.group.subcategories || []).map((sub) => ({ ...sub, counts: swarmCounts(sub.tasks) }))
)

const countText = computed(() =>
  counts.value.total ? `${counts.value.settled}/${counts.value.total}` : 'No agents'
)

// The one-line summary shows on a collapsed category once its agents are
// done (or the research stopped).
const summary = computed(() => {
  if (props.open || !counts.value.total) return ''
  if (swarmLive.value && !settled.value) return ''
  return categorySummary(props.group.key, props.group.tasks)
})

const name = computed(() => {
  const parts = [props.group.label]
  parts.push(counts.value.total ? `${counts.value.settled} of ${counts.value.total} finished` : 'no agents')
  if (summary.value) parts.push(summary.value)
  return parts.join(', ')
})

function indexOf(taskId) {
  const index = props.indexById[taskId]
  return index === undefined ? String(taskId).replace(/[^a-zA-Z0-9_-]/g, '-') : index
}

function waiting(taskId) {
  return props.waitingById[taskId] || ''
}
</script>

<style scoped>
.ag-swarm-cat {
  min-width: 0;
}

.ag-swarm-cat-h {
  margin: 0;
  font: inherit;
}

.ag-swarm-cat-row {
  display: grid;
  grid-template-columns: 14px 16px auto minmax(0, 1fr) auto 14px;
  column-gap: 8px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ag-swarm-cat-row:hover {
  background: var(--ag-row-hover);
}

.ag-swarm-cat-row:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-swarm-cat-chev {
  color: var(--ag-fg-chevron);
  transition: transform 180ms var(--ag-ease);
}

.ag-swarm-cat.is-open .ag-swarm-cat-chev {
  transform: rotate(90deg);
}

.ag-swarm-cat-icon {
  color: var(--ag-fg-3);
}

.ag-swarm-cat-label {
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.ag-swarm-cat-sum {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-swarm-cat-count {
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.ag-swarm-cat-mark {
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
}

.ag-swarm-cat-spin {
  color: var(--ag-fg-3);
  animation: ag-swarm-cat-spin 0.9s linear infinite;
}

.ag-swarm-cat-x {
  color: var(--ag-danger);
}

.ag-swarm-cat-body {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows 200ms var(--ag-ease),
    visibility 0s linear 200ms;
}

.ag-swarm-cat-body.is-open {
  grid-template-rows: 1fr;
  visibility: visible;
  transition:
    grid-template-rows 200ms var(--ag-ease),
    visibility 0s;
}

.ag-swarm-cat-inner {
  min-height: 0;
  overflow: hidden;
}

.ag-swarm-note {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  padding: 0 8px 4px 52px;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
}

.ag-swarm-note.is-warning {
  color: var(--ag-warning);
}

.ag-swarm-note-icon {
  flex-shrink: 0;
  align-self: center;
}

.ag-swarm-sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 28px;
  margin: 0;
  padding: 0 8px 0 52px;
}

.ag-swarm-sub-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-swarm-sub-count {
  flex-shrink: 0;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
}

.ag-swarm-tasks {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-swarm.is-reduced .ag-swarm-cat-chev,
.ag-swarm.is-reduced .ag-swarm-cat-body {
  transition: none;
}

.ag-swarm.is-reduced .ag-swarm-cat-spin {
  animation: none;
}

@keyframes ag-swarm-cat-spin {
  to {
    transform: rotate(360deg);
  }
}

@container ag-swarm (max-width: 519px) {
  .ag-swarm-sub-row {
    padding-left: 32px;
  }

  .ag-swarm-note {
    padding-left: 32px;
  }
}
</style>
