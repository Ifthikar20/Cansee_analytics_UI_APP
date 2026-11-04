<script setup>
// The workspace sidebar: project switcher and inbox, the Agent | Analytics
// switch, the workspace sections, recent chats and the footer. It is the
// same on both tabs: the switch changes the main area, never the
// navigation. Docked at >= 1024px, otherwise rendered inside the shell's
// drawer (variant="drawer").
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import ActivityButton from './ActivityButton.vue'
import ProductSwitch from './ProductSwitch.vue'
import SidebarFooter from './SidebarFooter.vue'
import SidebarNav from './SidebarNav.vue'
import SidebarRecents from './SidebarRecents.vue'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

defineProps({
  variant: { type: String, default: 'docked' },
})

const route = useRoute()
const app = useAppStore()

const websiteId = computed(() => {
  const fromRoute = route.params?.websiteId
  if (fromRoute) return String(fromRoute)
  const active = app.activeWebsite?.id
  return active === undefined || active === null ? null : String(active)
})

const website = computed(
  () => app.websites.find((w) => String(w.id) === websiteId.value) || (websiteId.value ? app.activeWebsite : null) || null,
)
</script>

<template>
  <nav class="ag-sb" :class="`is-${variant}`" aria-label="Workspace">
    <div class="ag-sb-workspace">
      <WorkspaceSwitcher :website="website" />
      <ActivityButton :website-id="websiteId" />
    </div>
    <ProductSwitch :website-id="websiteId" />
    <!-- The same sidebar on both tabs: the switch changes the main area,
         never the navigation. Analytics has no list of tabs. -->
    <SidebarNav :website-id="websiteId" />
    <SidebarRecents :website-id="websiteId" />
    <SidebarFooter :variant="variant" />
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

.ag-sb-workspace {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 36px;
}
</style>
