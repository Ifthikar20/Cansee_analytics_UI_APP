<template>
  <button
    v-if="expandable"
    type="button"
    class="ag-worked ag-worked-toggle ag-tnum"
    :class="{ 'is-live': running, 'is-open': expanded }"
    :aria-expanded="expanded ? 'true' : 'false'"
    :aria-controls="controls || undefined"
    @click="emit('toggle')"
  >
    <span class="ag-worked-text">{{ label }}</span>
    <span v-if="note" class="ag-worked-note">{{ note }}</span>
    <ChevronRight class="ag-worked-chevron" aria-hidden="true" />
  </button>
  <p v-else class="ag-worked ag-tnum" :class="{ 'is-live': running }">
    <span class="ag-worked-text">{{ label }}</span>
    <span v-if="note" class="ag-worked-note">{{ note }}</span>
  </p>
</template>

<script setup>
// "Working" (shimmer) while the run is live, then "Worked for 10s". It is the
// disclosure button for the step list when there are steps to show.
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useElapsed } from '@/composables/agent/useElapsed'

const props = defineProps({
  running: { type: Boolean, default: false },
  // Message status: complete, truncated, refused, cancelled, failed, interrupted.
  status: { type: String, default: '' },
  // Run phase while live: queued, running, cancelling.
  phase: { type: String, default: '' },
  // Transport state while live: reconnecting, offline...
  transport: { type: String, default: '' },
  // The server is retrying a model request (run.retrying).
  retrying: { type: Boolean, default: false },
  startedAt: { type: [String, Number], default: null },
  endedAt: { type: [String, Number], default: null },
  durationMs: { type: Number, default: null },
  expandable: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  controls: { type: String, default: '' },
})

const emit = defineEmits(['toggle'])

const elapsed = useElapsed(
  () => props.startedAt,
  () => props.running,
  () => props.durationMs,
  () => props.endedAt
)

const known = computed(
  () => props.running || Number.isFinite(props.durationMs) || (props.startedAt !== null && props.endedAt !== null)
)

const label = computed(() => {
  if (props.running) {
    if (props.phase === 'cancelling') return 'Stopping'
    if (props.phase === 'queued') return 'Starting'
    return elapsed.ms.value >= 1000 ? `Working for ${elapsed.label.value}` : 'Working'
  }
  if (props.status === 'cancelled') return known.value ? `Stopped after ${elapsed.label.value}` : 'Stopped'
  return known.value ? `Worked for ${elapsed.label.value}` : 'Finished'
})

const note = computed(() => {
  if (!props.running) return ''
  if (props.transport === 'reconnecting') return 'Reconnecting'
  if (props.transport === 'offline') return 'Connection lost, retrying'
  if (props.retrying) return 'Retrying'
  return ''
})
</script>

<style scoped>
.ag-worked {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
}

.ag-tnum {
  font-variant-numeric: tabular-nums;
}

.ag-worked-toggle {
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s ease;
}

.ag-worked-toggle:hover {
  color: var(--ag-fg-2);
}

.ag-worked-toggle:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 6px;
}

.ag-worked-note {
  color: var(--ag-fg-4);
  font-weight: 400;
}

.ag-worked-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.2s var(--ag-ease);
}

.ag-worked-toggle:hover .ag-worked-chevron,
.ag-worked-toggle:focus-visible .ag-worked-chevron,
.ag-worked-toggle.is-open .ag-worked-chevron {
  opacity: 1;
}

.ag-worked-toggle.is-open .ag-worked-chevron {
  transform: rotate(90deg);
}

/* Shimmer on the live label. */
.ag-worked.is-live .ag-worked-text {
  background: linear-gradient(
    90deg,
    var(--ag-fg-3) 0%,
    var(--ag-fg-3) 35%,
    var(--ag-fg-1) 50%,
    var(--ag-fg-3) 65%,
    var(--ag-fg-3) 100%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ag-worked-shimmer 2.2s linear infinite;
}

@keyframes ag-worked-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -150% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-worked.is-live .ag-worked-text {
    animation: none;
    background: none;
    color: var(--ag-fg-3);
  }
  .ag-worked-chevron {
    transition: none;
  }
}
</style>
