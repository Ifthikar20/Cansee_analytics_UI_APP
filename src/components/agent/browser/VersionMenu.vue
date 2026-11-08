<template>
  <DropdownMenuRoot :modal="false" @update:open="onOpen">
    <DropdownMenuTrigger as-child :disabled="disabled">
      <button
        type="button"
        class="ag-ver"
        :aria-label="`Version ${shown ?? latest}${isLatest ? ', latest' : ''}. Choose a version`"
        :aria-disabled="disabled ? 'true' : undefined"
      >
        <span class="ag-tnum">v{{ shown ?? latest }}</span>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <AgMenuContent align="end" :width="320">
      <AgMenuLabel>Versions</AgMenuLabel>
      <template v-if="versions && versions.length">
        <AgMenuItem v-for="v in versions" :key="v.version" @select="choose(v.version)">
          <History :size="16" aria-hidden="true" />
          <span class="ag-menu-text">
            Version {{ v.version }}<template v-if="v.created_at"> · {{ formatCapturedAt(v.created_at) }}</template>
          </span>
          <template #trail>
            <span v-if="v.version === latest">Latest</span>
            <Check v-if="v.version === (shown ?? latest)" :size="16" aria-hidden="true" />
          </template>
        </AgMenuItem>
      </template>
      <AgMenuItem v-else-if="versions" disabled>
        <span class="ag-menu-text">No saved versions yet.</span>
      </AgMenuItem>
      <AgMenuItem v-else disabled>
        <span class="ag-menu-text">Loading versions…</span>
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>

<script setup>
import { computed } from 'vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { Check, ChevronDown, History } from '@lucide/vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'
import { formatCapturedAt } from './format'

const props = defineProps({
  source: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const latest = computed(() => props.source.latestVersion.value)
const shown = computed(() => props.source.shownVersion.value)
const isLatest = computed(() => (shown.value ?? latest.value) === latest.value)
const versions = computed(() => props.source.versions.value)

function onOpen(open) {
  if (open) props.source.loadVersions({ force: true })
}

function choose(version) {
  emit('select', version === latest.value ? null : version)
}
</script>

<style scoped>
.ag-ver {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 32px;
  padding: 0 6px 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-ver:hover:not([aria-disabled='true']),
.ag-ver[data-state='open'] {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-ver[aria-disabled='true'] {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-ver:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
