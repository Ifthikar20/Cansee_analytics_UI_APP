<script setup>
// The agent workspace sidebar: sections, recent chats, and a footer with the
// inbox and the collapse button. Docked at 1024px and wider, otherwise
// inside the shell's drawer (variant="drawer"). The project switcher,
// Settings and Help are in the header.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useAgentUiStore } from '@/stores/agentUi'
import { IconPanelLeft } from '@/components/agent/icons'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import ActivityButton from './ActivityButton.vue'
import SidebarNav from './SidebarNav.vue'
import SidebarRecents from './SidebarRecents.vue'

const props = defineProps({
  // 'docked' collapses the sidebar; 'drawer' closes the drawer.
  variant: { type: String, default: 'docked' },
})

const route = useRoute()
const app = useAppStore()
const ui = useAgentUiStore()

const websiteId = computed(() => {
  const fromRoute = route.params?.websiteId
  if (fromRoute) return String(fromRoute)
  const active = app.activeWebsite?.id
  return active === undefined || active === null ? null : String(active)
})

const toggleLabel = computed(() => (props.variant === 'drawer' ? 'Close sidebar' : 'Collapse sidebar'))

function toggle() {
  if (props.variant === 'drawer') ui.closeDrawer()
  else ui.toggleSidebar()
}
</script>

<template>
  <nav class="ag-sb" :class="`is-${variant}`" aria-label="Workspace">
    <SidebarNav :website-id="websiteId" />
    <SidebarRecents :website-id="websiteId" />
    <div class="ag-sb-footer">
      <ActivityButton :website-id="websiteId" />
      <AgIconButton :label="toggleLabel" shortcut="mod+b" tooltip-side="top" @click="toggle">
        <IconPanelLeft />
      </AgIconButton>
    </div>
  </nav>
</template>

<style scoped>
/* 256 + 1px border; 12/13 side padding leaves 231px rows, as in the reference. */
.ag-sb {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: calc(var(--ag-sidebar-w) + 1px);
  height: 100%;
  min-height: 0;
  padding: 12px 13px 12px 12px;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid var(--ag-divider);
  background: var(--ag-sidebar-bg);
  overscroll-behavior: contain;
}

.ag-sb.is-drawer {
  width: 100%;
  border-right: 0;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.ag-sb-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  margin-top: 8px;
}
</style>
