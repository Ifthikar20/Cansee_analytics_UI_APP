<template>
  <div class="ag-pempty">
    <div class="ag-pempty-head">
      <AgIconButton class="ag-pempty-close" label="Hide browser" :size="28" muted shortcut="mod+\" @click="emit('close-pane')">
        <IconPanelRight :size="16" />
      </AgIconButton>
    </div>
    <div class="ag-pempty-body">
      <AgEmptyState
        :icon="Globe"
        title="Nothing open yet"
        body="Google results the agent captures, pages it inspects and the drafts it writes open here."
      >
        <AgButton size="sm" :icon="Plus" @click="pane.openNewTab()">Open a web page</AgButton>
      </AgEmptyState>
    </div>
  </div>
</template>

<script setup>
import { Globe, Plus } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import { IconPanelRight } from '@/components/agent/icons'
import { useAgentPaneStore } from '@/stores/agentPane'

const emit = defineEmits(['close-pane'])

const pane = useAgentPaneStore()
</script>

<style scoped>
.ag-pempty {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ag-pempty-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  height: 48px;
  padding: 0 10px;
}

.ag-pempty-body {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.ag-pempty-body > :deep(.ag-empty) {
  width: 100%;
  max-width: 420px;
}
</style>
