<template>
  <li class="ag-swarm-task" :class="[`is-${status}`, { 'is-open': open }]">
    <button
      ref="rowEl"
      type="button"
      class="ag-swarm-row"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="open ? detailId : undefined"
      :aria-label="name"
      @click="toggle"
    >
      <SwarmStatusMark :status="status" />
      <span class="ag-swarm-row-label">{{ task.label }}</span>
      <span
        class="ag-swarm-row-text"
        :class="[line.tone ? `is-${line.tone}` : '', { 'is-shimmer': line.shimmer, 'is-fresh': fresh }]"
      >{{ line.text }}</span>
      <span class="ag-swarm-row-time ag-tnum">{{ time }}</span>
    </button>
    <SwarmTaskDetail v-if="open" :id="detailId" :task="task" :waiting="waiting" @close="close" />
  </li>
</template>

<script setup>
// One research agent: its status mark, label, live line and time. The row
// toggles the agent's detail; opening the detail of an agent with a capture
// (a Google page or a page it read) also shows that capture in the pane.
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import SwarmStatusMark from './SwarmStatusMark.vue'
import SwarmTaskDetail from './SwarmTaskDetail.vue'
import { useSwarmClock } from './useSwarmClock'
import { SWARM_TREE, defaultTree, displayStatus, taskLine, taskName, taskTime } from './swarmView'
import { TERMINAL_TASK_STATUSES } from '@/lib/agent/types'

const props = defineProps({
  task: { type: Object, required: true },
  // DOM id of the detail panel (it includes the message and part ids).
  detailId: { type: String, required: true },
  // The precomputed "Waiting for ..." line while the task is queued.
  waiting: { type: String, default: '' },
})

const tree = inject(SWARM_TREE, defaultTree())

const open = ref(false)
const rowEl = ref(null)
const fresh = ref(false)
let freshTimer = 0

const swarmLive = computed(() => Boolean(tree.swarmLive))
const status = computed(() => displayStatus(props.task, swarmLive.value))
const running = computed(() => swarmLive.value && props.task.status === 'running')
const line = computed(() => taskLine(props.task, { swarmLive: swarmLive.value, waiting: props.waiting }))
const name = computed(() => taskName(props.task, line.value, status.value))

// Only a running row reads the shared clock, so the others do not re-render
// on its tick.
const now = useSwarmClock(running)
const time = computed(() =>
  running.value ? taskTime(props.task, now.value) : taskTime(props.task, 0, { swarmLive: swarmLive.value })
)

// A row whose agent just finished fades its line in.
watch(
  () => props.task.status,
  (next, previous) => {
    if (!TERMINAL_TASK_STATUSES.has(next) || TERMINAL_TASK_STATUSES.has(previous)) return
    fresh.value = true
    clearTimeout(freshTimer)
    freshTimer = setTimeout(() => {
      fresh.value = false
    }, 200)
  }
)

onBeforeUnmount(() => clearTimeout(freshTimer))

function toggle() {
  open.value = !open.value
  tree.noteToggle()
  const tabId = props.task.pane && props.task.pane.tab_id
  if (open.value && tabId && props.task.status === 'done') tree.openCapture(tabId, rowEl.value)
}

function close() {
  open.value = false
  if (rowEl.value) rowEl.value.focus()
}
</script>

<style scoped>
.ag-swarm-task {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-swarm-row {
  display: grid;
  grid-template-columns: 16px minmax(84px, max-content) minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: baseline;
  box-sizing: border-box;
  width: 100%;
  min-height: 30px;
  padding: 5px 8px 5px 68px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ag-swarm-row:hover {
  background: var(--ag-row-hover);
}

.ag-swarm-row:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

/* The mark sits on the text baseline of a 20px line. */
.ag-swarm-row :deep(.ag-swarm-mark) {
  align-self: center;
}

.ag-swarm-row-label {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-swarm-row-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-swarm-row-text.is-good {
  color: var(--ag-accent);
}

.ag-swarm-row-text.is-warn {
  color: var(--ag-warning);
}

.ag-swarm-row-text.is-bad {
  color: var(--ag-danger);
}

.ag-swarm-row-text.is-muted {
  color: var(--ag-fg-4);
}

.ag-swarm-row-text.is-shimmer {
  background: linear-gradient(90deg, var(--ag-fg-3) 0%, var(--ag-fg-1) 50%, var(--ag-fg-3) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ag-swarm-shimmer 1.8s linear infinite;
}

.ag-swarm-row-text.is-fresh {
  animation: ag-swarm-fade 160ms ease-out;
}

.ag-swarm-row-time {
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 20px;
  text-align: right;
  white-space: nowrap;
}

.ag-swarm.is-reduced .ag-swarm-row-text.is-shimmer {
  background: none;
  color: var(--ag-fg-1);
  animation: none;
}

.ag-swarm.is-reduced .ag-swarm-row-text.is-fresh {
  animation: none;
}

@keyframes ag-swarm-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@keyframes ag-swarm-fade {
  from {
    opacity: 0.4;
  }
  to {
    opacity: 1;
  }
}

@container ag-swarm (max-width: 519px) {
  .ag-swarm-row {
    grid-template-columns: 16px minmax(0, 1fr) auto;
    padding-left: 40px;
  }

  .ag-swarm-row-text {
    grid-row: 2;
    grid-column: 2 / 4;
  }
}
</style>
