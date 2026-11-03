<script setup>
// The 48px bar above an analytics or settings page while the sidebar is out
// of view (a drawer below 1024px, or collapsed when docked): a button that
// brings the sidebar back and where the page sits ("Analytics · Pages").
import { useAgentUiStore } from '@/stores/agentUi'
import { IconPanelLeft } from '@/components/agent/icons'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'

defineProps({
  title: { type: String, required: true },
})

const ui = useAgentUiStore()

function openSidebar() {
  if (ui.docked) ui.setSidebarCollapsed(false)
  else ui.setDrawerOpen(true)
}
</script>

<template>
  <div class="ws-bar">
    <AgIconButton label="Open sidebar" shortcut="mod+b" @click="openSidebar">
      <IconPanelLeft :size="16" />
    </AgIconButton>
    <p class="ws-bar-title">{{ title }}</p>
  </div>
</template>

<style scoped>
.ws-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 48px;
  padding: 0 16px 0 8px;
  border-bottom: 1px solid var(--border);
  background: var(--background);
}

.ws-bar-title {
  min-width: 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
