<template>
  <TooltipProvider :delay-duration="400" :skip-delay-duration="200">
    <div class="ag-root" :class="{ 'is-docked': ui.docked, 'is-collapsed': ui.docked && ui.sidebarCollapsed }">
      <a href="#ag-main" class="ag-skip" @click.prevent="focusMain">Skip to content</a>

      <div
        v-if="ui.docked"
        class="ag-shell-rail"
        :inert="ui.sidebarCollapsed ? true : undefined"
        :aria-hidden="ui.sidebarCollapsed ? 'true' : undefined"
      >
        <AgentSidebar variant="docked" />
      </div>
      <AgDrawer
        v-else
        :open="ui.drawerOpen"
        title="Workspace"
        description="Projects, sections and recent chats."
        @update:open="ui.setDrawerOpen($event)"
      >
        <AgentSidebar variant="drawer" />
      </AgDrawer>

      <main id="ag-main" ref="mainEl" class="ag-shell-main" tabindex="-1">
        <router-view />
      </main>

      <AgentAnnouncer />
      <ShortcutsDialog :open="ui.shortcutsOpen" @update:open="ui.setShortcutsOpen($event)" />
      <ToastContainer />
      <AddProjectDialog :open="ui.addProjectOpen" @update:open="ui.setAddProjectOpen($event)" />
    </div>
  </TooltipProvider>
</template>

<script setup>
// The agent workspace frame: a fixed, full-viewport grid with the sidebar
// (docked or a drawer) and the routed page. The router-view is neither keyed
// nor wrapped in a transition, so a chat page survives /agent -> /agent/c/:id
// and its stream keeps running; streams live in the store either way.
import '@/assets/agent/tokens.css'
import '@/assets/agent/base.css'
import '@/assets/agent/portal.css'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import ToastContainer from '@/components/ToastContainer.vue'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'
import AgentSidebar from '@/components/agent/sidebar/AgentSidebar.vue'
import AgDrawer from '@/components/agent/common/AgDrawer.vue'
import AgentAnnouncer from '@/components/agent/common/AgentAnnouncer.vue'
import ShortcutsDialog from '@/components/agent/common/ShortcutsDialog.vue'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { useShellBootstrap } from '@/composables/useShellBootstrap'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useAgentHotkeys } from '@/composables/agent/useAgentHotkeys'
import { useVisualViewportInset } from '@/composables/agent/useVisualViewportInset'
import { ensureAgentFont } from '@/lib/agent/font'

const route = useRoute()
const app = useAppStore()
const agent = useAgentStore()
const ui = useAgentUiStore()
const mainEl = ref(null)

// fetchMe, the website list and plan limits on mount, shared with AppShell.
useShellBootstrap()
ensureAgentFont()
useAgentHotkeys()
useVisualViewportInset()
// The shell is a fixed viewport; the document behind it must not scroll
// (iOS rubber-banding, scroll chaining out of the panes).
useBodyScrollLock(() => true)

const wide = useMediaQuery('(min-width: 1024px)')
watch(wide, (value) => ui.setDocked(value), { immediate: true })

// The project in view: the URL when it names one, else the active project.
const websiteId = computed(() => {
  const fromRoute = route.params?.websiteId
  if (fromRoute) return String(fromRoute)
  const active = app.activeWebsite?.id
  return active === undefined || active === null ? null : String(active)
})

// init() is idempotent per project; a different project first resets the
// previous one's scope (transports detach, runs keep going server-side).
watch(
  websiteId,
  (wid) => {
    if (wid) Promise.resolve(agent.init(wid)).catch(() => {})
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    if (!ui.docked) ui.closeDrawer()
  },
)

// Tab title for pages that do not set their own (route meta.title); the chat
// and artifact pages title themselves.
const pageTitle = computed(() => {
  const title = route.meta?.title
  if (!title) return ''
  const wid = route.params?.websiteId
  const project = wid ? app.websites.find((w) => String(w.id) === String(wid))?.name : ''
  return [title, project, 'Cansee'].filter(Boolean).join(' — ')
})
watch(
  pageTitle,
  (value) => {
    if (value) document.title = value
  },
  { immediate: true },
)

function focusMain() {
  mainEl.value?.focus({ preventScroll: true })
}
</script>

<style scoped>
.ag-root {
  position: fixed;
  top: var(--ag-vv-top, 0px);
  right: 0;
  left: 0;
  z-index: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: var(--ag-vv-height, 100%);
  overflow: hidden;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
  overscroll-behavior: none;
}

.ag-root.is-docked {
  grid-template-columns: calc(var(--ag-sidebar-w) + 1px) minmax(0, 1fr);
  transition: grid-template-columns 240ms var(--ag-ease);
}

.ag-root.is-docked.is-collapsed {
  grid-template-columns: 0px minmax(0, 1fr);
}

.ag-shell-rail {
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  visibility: visible;
}

.ag-root.is-collapsed .ag-shell-rail {
  visibility: hidden;
  transition: visibility 0s linear 240ms;
}

.ag-shell-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--ag-pane-bg);
  outline: none;
}

.ag-shell-main > * {
  flex: 1 1 auto;
  min-height: 0;
}

.ag-skip {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 120;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--ag-send-bg);
  color: var(--ag-send-fg);
  font-size: 14px;
  font-weight: 500;
  transform: translateY(-200%);
}

.ag-skip:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .ag-root.is-docked {
    transition: none;
  }
}
</style>
