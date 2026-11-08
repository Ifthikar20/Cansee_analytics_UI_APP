<template>
  <TooltipProvider :delay-duration="400" :skip-delay-duration="200">
    <div class="ag-root app-frame">
      <a
        :href="`#${mainId}`"
        class="app-skip"
        :inert="takeover || undefined"
        :aria-hidden="takeover ? 'true' : undefined"
        @click.prevent="focusMain"
      >Skip to content</a>

      <AppHeader
        :website-id="websiteId"
        :inert="takeover || undefined"
        :aria-hidden="takeover ? 'true' : undefined"
      />

      <div
        v-if="isAgent"
        class="ag-shell"
        :class="{ 'is-docked': ui.docked, 'is-collapsed': ui.docked && ui.sidebarCollapsed }"
      >
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
          description="Agent sections, recent chats and activity."
          @update:open="ui.setDrawerOpen($event)"
        >
          <AgentSidebar variant="drawer" />
        </AgDrawer>
        <main id="ag-main" ref="mainEl" class="ag-shell-main" tabindex="-1">
          <router-view />
        </main>
      </div>

      <main
        v-else
        id="app-main"
        ref="mainEl"
        class="app-main"
        :class="{ 'is-settings': section === 'settings' }"
        tabindex="-1"
      >
        <router-view v-slot="{ Component, route: viewRoute }">
          <component :is="Component" :key="viewRoute.path" />
        </router-view>
      </main>

      <AgentAnnouncer />
      <ShortcutsDialog :open="ui.shortcutsOpen" @update:open="ui.setShortcutsOpen($event)" />
      <HelpDrawer :open-shortcuts="ui.openShortcuts" />
      <ToastContainer />
      <AddProjectDialog :open="ui.addProjectOpen" @update:open="ui.setAddProjectOpen($event)" />
    </div>
  </TooltipProvider>
</template>

<script setup>
// The frame of every signed-in page: the header (logo, project, Analytics /
// Agent / Settings, help, theme, account) over the body. Agent routes get
// the workspace: the sidebar, docked or a drawer, beside the routed page.
// That router-view is neither keyed nor wrapped in a transition, so a chat page
// survives /agent -> /agent/c/:id and its stream keeps running. Every other
// route renders full width in <main id="app-main">, which scrolls; those pages
// are keyed by path. The document itself never scrolls.
import '@/assets/agent/tokens.css'
import '@/assets/agent/base.css'
import '@/assets/agent/portal.css'
import { computed, nextTick, provide, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import ToastContainer from '@/components/ToastContainer.vue'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import AgentSidebar from '@/components/agent/sidebar/AgentSidebar.vue'
import AgDrawer from '@/components/agent/common/AgDrawer.vue'
import AgentAnnouncer from '@/components/agent/common/AgentAnnouncer.vue'
import ShortcutsDialog from '@/components/agent/common/ShortcutsDialog.vue'
import HelpDrawer from '@/components/help/HelpDrawer.vue'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { useShellBootstrap } from '@/composables/useShellBootstrap'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useAgentHotkeys } from '@/composables/agent/useAgentHotkeys'
import { useHelpShortcut } from '@/composables/useHelpShortcut'
import { useVisualViewportInset } from '@/composables/agent/useVisualViewportInset'
import { ensureAgentFont } from '@/lib/agent/font'
import { sectionOf } from '@/lib/shell/nav'
import { SHELL_TAKEOVER } from '@/lib/shell/takeover'

const route = useRoute()
const app = useAppStore()
const agent = useAgentStore()
const ui = useAgentUiStore()
const mainEl = ref(null)

// A page covering the whole screen (first-run onboarding) hides the header
// and skip link from focus and assistive technology (lib/shell/takeover.js).
const takeovers = reactive(new Set())
const takeover = computed(() => takeovers.size > 0)
provide(SHELL_TAKEOVER, {
  set(token, on) {
    if (on) takeovers.add(token)
    else takeovers.delete(token)
  },
})

// fetchMe, the website list and plan limits on mount.
useShellBootstrap()
ensureAgentFont()
useAgentHotkeys()
useHelpShortcut()
useVisualViewportInset()
// The shell is a fixed viewport; the document behind it must not scroll
// (iOS rubber-banding, scroll chaining out of the panes).
useBodyScrollLock(() => true)

const wide = useMediaQuery('(min-width: 1024px)')
watch(wide, (value) => ui.setDocked(value), { immediate: true })

const section = computed(() => sectionOf(route))
const isAgent = computed(() => section.value === 'agent')
const mainId = computed(() => (isAgent.value ? 'ag-main' : 'app-main'))

// Only the agent routes have the workspace sidebar; elsewhere every sidebar
// toggle hides and does nothing.
watch(isAgent, (value) => ui.setSidebarAvailable(value), { immediate: true })

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

// Tab title for pages that do not set their own (route meta.title); the
// chat, artifact and board pages title themselves.
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

function scrollToHash(hash) {
  let target = null
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    // Not a valid anchor: nothing to scroll to.
  }
  if (target && mainEl.value?.contains(target)) target.scrollIntoView({ block: 'start' })
}

// The document never scrolls (the body is locked) and <main id="app-main"> is
// kept across pages, so it would carry one page's scroll into the next: a new
// page starts at the top and takes focus, a hash scrolls its target into view,
// a filter (query) change keeps the place. Agent routes manage their own
// scrolling and focus (the chat's composer).
watch(
  () => [route.path, route.hash],
  ([path, hash], before) => {
    if (isAgent.value) return
    const [prevPath, prevHash] = before || []
    if (path === prevPath && hash === prevHash) return
    nextTick(() => {
      const main = mainEl.value
      if (!main) return
      if (hash) scrollToHash(hash)
      else if (path !== prevPath) main.scrollTop = 0
      if (path !== prevPath) focusNewPage(main)
    })
  },
)

// A page that put focus inside itself on mount keeps it.
function focusNewPage(main) {
  const active = document.activeElement
  if (active && active !== document.body && main.contains(active)) return
  main.focus({ preventScroll: true })
}

function focusMain() {
  mainEl.value?.focus({ preventScroll: true })
}
</script>

<style scoped>
.app-frame {
  --app-header-h: 64px;
  --app-gutter: 24px;
  --app-body-h: calc(var(--ag-vv-height, 100dvh) - var(--app-header-h) - 1px);
  position: fixed;
  top: var(--ag-vv-top, 0px);
  right: 0;
  left: 0;
  z-index: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  height: var(--ag-vv-height, 100%);
  overflow: hidden;
  background: var(--background);
  overscroll-behavior: none;
}

@media (max-width: 640px) {
  .app-frame {
    --app-header-h: 56px;
    --app-gutter: 16px;
  }
}

/* Agent routes: the sidebar (docked or a drawer) beside the chat area. Its
   own stacking context: the browser pane's overlay (z 30, the bar's own
   level) and every other agent layer stay under the header and its menu
   sheet. What must cover the header (the drawer, dialogs, menus) is
   teleported to <body>. */
.ag-shell {
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.ag-shell.is-docked {
  grid-template-columns: calc(var(--ag-sidebar-w) + 1px) minmax(0, 1fr);
  transition: grid-template-columns 240ms var(--ag-ease);
}

.ag-shell.is-docked.is-collapsed {
  grid-template-columns: 0px minmax(0, 1fr);
}

.ag-shell-rail {
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  visibility: visible;
}

.ag-shell.is-collapsed .ag-shell-rail {
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

/* Analytics, Settings and Billing: one full-width region that scrolls. While
   a board panel is open the board hides its overflow and swaps the gutter
   for as much right padding, inline, and puts both back on close
   (AnalyticsBoardPage, lockScroll). */
.app-main {
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
  outline: none;
}

/* Settings and Billing: the main app's look, as the page area had. */
.app-main.is-settings {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-family);
  font-feature-settings: normal;
  line-height: 1.6;
}

.app-skip {
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

.app-skip:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .ag-shell.is-docked {
    transition: none;
  }
}
</style>

<!-- Unscoped on purpose: the agent base layer (assets/agent/base.css) gives
     every link and focus ring inside the frame the agent look; Settings and
     Billing keep the main app's (assets/css/base.css). :where() keeps these
     at the specificity of the rules they replace, so a page's own classes
     still win. -->
<style>
:where(.app-main.is-settings) a {
  color: var(--text-primary);
  font-weight: 500;
}

:where(.app-main.is-settings) a:hover {
  opacity: 0.7;
}

:where(.app-main.is-settings) :focus-visible {
  outline-color: var(--brand-accent, #7232e0);
}
</style>
