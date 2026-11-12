<template>
  <span class="ag-swarm-mark" :class="`is-${kind}`" aria-hidden="true">
    <LoaderCircle v-if="kind === 'running'" class="ag-swarm-mark-spin" :size="14" />
    <X v-else-if="kind === 'failed'" class="ag-swarm-mark-icon is-failed" :size="14" />
    <Minus v-else-if="kind === 'skipped'" class="ag-swarm-mark-icon" :size="14" />
    <Square v-else-if="kind === 'stopped'" class="ag-swarm-mark-icon" :size="10" />
    <span v-else-if="kind === 'done'" class="ag-swarm-mark-dot"></span>
    <span v-else class="ag-swarm-mark-ring"></span>
  </span>
</template>

<script setup>
// The 16px status mark of a research agent (and of the block header). It is
// decorative: rows and headers carry the status in their accessible names.
import { computed } from 'vue'
import { LoaderCircle, Minus, Square, X } from '@lucide/vue'

const KINDS = new Set(['queued', 'running', 'done', 'failed', 'skipped', 'stopped'])

const props = defineProps({
  // queued | running | done | failed | skipped | stopped (stopped also
  // stands for "not finished").
  status: { type: String, default: 'queued' },
})

const kind = computed(() => (KINDS.has(props.status) ? props.status : 'queued'))
</script>

<style scoped>
.ag-swarm-mark {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--ag-fg-4);
}

.ag-swarm-mark-ring {
  box-sizing: border-box;
  width: 6px;
  height: 6px;
  border: 1px solid var(--ag-fg-disabled);
  border-radius: 50%;
}

.ag-swarm-mark-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ag-fg-4);
}

.ag-swarm-mark-spin {
  color: var(--ag-fg-3);
  animation: ag-swarm-spin 0.9s linear infinite;
}

.ag-swarm-mark-icon {
  color: var(--ag-fg-4);
}

.ag-swarm-mark-icon.is-failed {
  color: var(--ag-danger);
}

/* Reduced motion: the loader stays still (SwarmBlock sets is-reduced). */
.ag-swarm.is-reduced .ag-swarm-mark-spin {
  animation: none;
}

@keyframes ag-swarm-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
