<template>
  <AgTooltip v-if="actions.length && disabled" :text="disabledReason">
    <button type="button" class="ag-export" aria-disabled="true">
      <Download :size="14" aria-hidden="true" />
      <span>Export</span>
    </button>
  </AgTooltip>
  <DropdownMenuRoot v-else-if="actions.length" :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="ag-export">
        <Download :size="14" aria-hidden="true" />
        <span>Export</span>
      </button>
    </DropdownMenuTrigger>
    <AgMenuContent align="end" :width="232">
      <AgMenuItem v-for="action in actions" :key="action.key" @select="run(action.key)">
        <component :is="action.icon" :size="16" aria-hidden="true" />
        <span class="ag-menu-text">{{ action.label }}</span>
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>

<script setup>
import { computed } from 'vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { Download } from '@lucide/vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { useToast } from '@/composables/useToast'
import { useAgentUiStore } from '@/stores/agentUi'
import { exportActions, runExport } from './exporters'

const props = defineProps({
  kind: { type: String, required: true },
  // () => {title, content, data, sheet, capture}
  context: { type: Function, required: true },
  disabled: { type: Boolean, default: false },
  disabledReason: { type: String, default: 'Export is available when the draft is finished.' },
})

const toast = useToast()
const ui = useAgentUiStore()

const actions = computed(() => exportActions(props.kind))

async function run(key) {
  if (props.disabled) return
  try {
    const message = await runExport(key, { kind: props.kind, ...props.context() })
    if (message) {
      toast.success(message)
      ui.announce(message)
    }
  } catch {
    toast.error("That export didn't work. Try again.")
  }
}
</script>

<style scoped>
.ag-export {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 32px;
  padding: 0 9px 0 8px;
  border: 1px solid var(--ag-export-border);
  border-radius: 8px;
  background: var(--ag-export-bg);
  color: var(--ag-fg-tab);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.ag-export:hover:not([aria-disabled='true']),
.ag-export[data-state='open'] {
  background: var(--ag-btn-hover);
}

.ag-export[aria-disabled='true'] {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-export:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
