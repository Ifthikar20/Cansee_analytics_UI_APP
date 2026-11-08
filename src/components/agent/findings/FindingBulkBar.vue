<script setup>
// The bar under the Findings list while rows are checked: how many, Mark
// done, Dismiss, Clear, and Reopen when the selection holds rows that are
// done or dismissed. The page does the work; `pending` names the status
// being applied so its button shows the spinner.
import { Check, RotateCcw, X } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import { FINDING_STATUS } from '@/lib/agent/types'

defineProps({
  count: { type: Number, required: true },
  // '' | 'done' | 'dismissed' | 'open'
  pending: { type: String, default: '' },
  canDone: { type: Boolean, default: true },
  canDismiss: { type: Boolean, default: true },
  canReopen: { type: Boolean, default: false },
})

const emit = defineEmits(['status', 'clear'])
</script>

<template>
  <div class="ag-fbb" role="group" aria-label="Selected findings">
    <p class="ag-fbb-count ag-tnum" aria-live="polite">{{ count }} selected</p>
    <div class="ag-fbb-actions">
      <AgButton
        size="sm"
        :icon="Check"
        :loading="pending === FINDING_STATUS.DONE"
        :disabled="Boolean(pending) || !canDone"
        @click="emit('status', FINDING_STATUS.DONE)"
      >
        Mark done
      </AgButton>
      <AgButton
        size="sm"
        :icon="X"
        :loading="pending === FINDING_STATUS.DISMISSED"
        :disabled="Boolean(pending) || !canDismiss"
        @click="emit('status', FINDING_STATUS.DISMISSED)"
      >
        Dismiss
      </AgButton>
      <AgButton
        v-if="canReopen"
        size="sm"
        :icon="RotateCcw"
        :loading="pending === FINDING_STATUS.OPEN"
        :disabled="Boolean(pending)"
        @click="emit('status', FINDING_STATUS.OPEN)"
      >
        Reopen
      </AgButton>
      <AgButton size="sm" variant="ghost" :disabled="Boolean(pending)" @click="emit('clear')">Clear</AgButton>
    </div>
  </div>
</template>

<style scoped>
.ag-fbb {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  box-sizing: border-box;
  min-height: 56px;
  padding: 10px max(16px, calc((100% - 720px) / 2));
  border-top: 1px solid var(--ag-divider-subtle);
  background: var(--ag-pane-bg);
}

.ag-fbb-count {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.ag-fbb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
