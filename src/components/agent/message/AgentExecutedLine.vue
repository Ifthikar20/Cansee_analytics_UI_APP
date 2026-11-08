<template>
  <p class="ag-exec" :class="`is-${state}`">
    <span class="ag-exec-verb">{{ verb }}</span>
    <component :is="meta.icon" class="ag-exec-icon" aria-hidden="true" />
    <span class="ag-exec-name">{{ name }}</span>
    <span v-if="stage" class="ag-exec-stage">{{ stage }}</span>
  </p>
</template>

<script setup>
// "Executed <icon> Landing Page Agent" under a reply that ran a sub-agent,
// with the live stage while it works.
import { computed } from 'vue'
import { agentMeta } from '@/lib/agent/agentsMeta'
import { isLiveStatus } from './parts'

const props = defineProps({
  agent: { type: String, default: '' },
  agentName: { type: String, default: '' },
  status: { type: String, default: '' },
  catalog: { type: Array, default: null },
  // The reply is still streaming; a stale live status reads as stopped.
  live: { type: Boolean, default: false },
})

const STAGES = {
  preparing: 'Preparing',
  planning: 'Planning',
  drafting: 'Drafting',
  validating: 'Checking',
}

const meta = computed(() => agentMeta(props.agent, props.catalog))
const name = computed(() => props.agentName || meta.value.name)

const state = computed(() => {
  if (props.status === 'error') return 'error'
  if (props.status === 'cancelled') return 'stopped'
  if (isLiveStatus(props.status)) return props.live ? 'live' : 'stopped'
  return 'done'
})

const verb = computed(
  () => ({ done: 'Executed', live: 'Running', error: 'Failed', stopped: 'Stopped' })[state.value] || 'Executed'
)

const stage = computed(() => (state.value === 'live' ? STAGES[props.status] || '' : ''))
</script>

<style scoped>
.ag-exec {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.ag-exec-verb {
  color: var(--ag-fg-3);
}

.ag-exec-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ag-accent);
}

.ag-exec-name {
  color: var(--ag-accent);
}

.ag-exec-stage {
  color: var(--ag-fg-4);
}

.ag-exec.is-error .ag-exec-verb {
  color: var(--ag-danger);
}

.ag-exec.is-live .ag-exec-verb {
  background: linear-gradient(90deg, var(--ag-fg-3) 0%, var(--ag-fg-3) 35%, var(--ag-fg-1) 50%, var(--ag-fg-3) 65%, var(--ag-fg-3) 100%);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ag-exec-shimmer 2.2s linear infinite;
}

@keyframes ag-exec-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -150% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-exec.is-live .ag-exec-verb {
    animation: none;
    background: none;
    color: var(--ag-fg-3);
  }
}
</style>
