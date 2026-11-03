<template>
  <AgSpinner v-if="busy" class="ag-tabicon" :size="12" />
  <CircleAlert v-else-if="failed" class="ag-tabicon is-error" :size="14" aria-hidden="true" />
  <component :is="glyph.icon" v-else class="ag-tabicon" :class="glyph.tone" :size="14" aria-hidden="true" />
</template>

<script setup>
import { computed } from 'vue'
import { CircleAlert, FileChartColumn, FileText, Globe, Search, SquareTerminal, Table } from '@lucide/vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { useAgentPaneStore } from '@/stores/agentPane'

// Favicons by kind. Third-party favicons are never loaded.

const props = defineProps({
  tab: { type: Object, required: true },
})

const pane = useAgentPaneStore()

const artifact = computed(() => (props.tab.kind === 'artifact' ? pane.artifactOf(props.tab.artifactId) : null))
const artifactKind = computed(() => artifact.value?.kind || artifact.value?.draft?.kind || '')

const busy = computed(() => {
  if (props.tab.kind === 'artifact') return artifact.value?.draft?.status === 'drafting'
  return props.tab.status === 'loading'
})

const failed = computed(() => {
  if (props.tab.kind === 'artifact') return artifact.value?.draft?.status === 'failed'
  return props.tab.status === 'error'
})

const glyph = computed(() => {
  switch (props.tab.kind) {
    case 'serp':
      return { icon: Search, tone: '' }
    case 'artifact':
      if (artifactKind.value === 'document') return { icon: FileText, tone: 'is-doc' }
      if (artifactKind.value === 'sheet') return { icon: Table, tone: 'is-sheet' }
      if (artifactKind.value === 'report') return { icon: FileChartColumn, tone: 'is-report' }
      return { icon: SquareTerminal, tone: 'is-accent' }
    case 'newtab':
      return { icon: Globe, tone: 'is-muted' }
    default:
      return { icon: Globe, tone: '' }
  }
})
</script>

<style scoped>
.ag-tabicon {
  flex-shrink: 0;
  color: var(--ag-fg-2);
}

.ag-tabicon.is-accent {
  color: var(--ag-accent);
}

.ag-tabicon.is-doc {
  color: var(--ag-kind-doc);
}

.ag-tabicon.is-sheet {
  color: var(--ag-kind-sheet);
}

.ag-tabicon.is-report {
  color: var(--ag-kind-report);
}

.ag-tabicon.is-muted {
  color: var(--ag-fg-4);
}

.ag-tabicon.is-error {
  color: var(--ag-danger);
}
</style>
