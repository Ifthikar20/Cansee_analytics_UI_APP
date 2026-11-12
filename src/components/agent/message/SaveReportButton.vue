<template>
  <router-link v-if="savedId" class="ag-saved" :to="savedTo" :aria-label="`Saved to Reports. Open the report`">
    <Check class="ag-saved-icon" aria-hidden="true" />
    <span>Saved to Reports</span>
  </router-link>
  <AgTooltip v-else :text="TIPS.agent.saveReport">
    <AgButton
      class="ag-save"
      variant="ghost"
      size="xs"
      :icon="FilePlus2"
      :loading="saving"
      :disabled="disabled"
      @click="save"
    >
      {{ saving ? 'Saving' : 'Save report' }}
    </AgButton>
  </AgTooltip>
</template>

<script setup>
// Saves the reply to Reports (POST reports/). Once saved it links to the
// report; a second save answers 409 already_saved with the existing id,
// which is treated as saved.
import { computed, ref, watch } from 'vue'
import { Check, FilePlus2 } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { TIPS } from '@/lib/help/tips'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'
import { errorInfo } from './parts'

const props = defineProps({
  messageId: { type: [String, Number], required: true },
  websiteId: { type: [String, Number], required: true },
  savedReportId: { type: [String, Number], default: null },
  disabled: { type: Boolean, default: false },
})

const store = useAgentStore()
const ui = useAgentUiStore()
const toast = useToast()

const saving = ref(false)
const savedId = ref(props.savedReportId || null)

watch(
  () => props.savedReportId,
  (id) => {
    if (id) savedId.value = id
  }
)

const savedTo = computed(() => ({
  name: 'agent-artifact',
  params: { websiteId: String(props.websiteId), artifactId: String(savedId.value) },
}))

async function save() {
  if (saving.value || savedId.value) return
  saving.value = true
  try {
    const result = await store.saveReport(props.messageId)
    const id = result?.id ?? result?.artifact_id ?? result?.data?.id ?? null
    if (id) savedId.value = id
    ui.announce('Saved to Reports')
  } catch (error) {
    const info = errorInfo(error)
    const existing = info.details?.artifact_id
    if (info.code === 'already_saved' && existing) {
      savedId.value = existing
      ui.announce('Already saved to Reports')
    } else {
      toast.error(info.message || 'The report could not be saved. Try again.')
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ag-saved {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--radius);
  color: var(--ag-accent);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  transition: background 0.15s ease;
}

.ag-saved:hover {
  background: var(--ag-ghost-hover);
  opacity: 1;
}

.ag-saved:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
  border-radius: var(--radius);
}

.ag-saved-icon {
  width: 14px;
  height: 14px;
}

.ag-save {
  color: var(--ag-fg-2);
}
</style>
