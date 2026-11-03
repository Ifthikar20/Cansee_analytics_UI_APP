<template>
  <!-- Tooltips anywhere in the app need one provider above them (the old
       sidebar layout supplied it implicitly). -->
  <TooltipProvider :delay-duration="150">
  <div class="shell">
    <header class="shell-bar">
      <div class="shell-bar-inner">
        <router-link :to="{ name: 'dashboard' }" class="shell-home" aria-label="Cansee overview">
          <img src="/images/cansee-logo.png" alt="Cansee" class="shell-logo" />
        </router-link>

        <div class="shell-context">
          <!-- Organization context. B2B accounts only: session.org is null
               for individual (B2C) users, who never see this. -->
          <span v-if="org" class="shell-org">
            <span class="shell-sep" aria-hidden="true">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button type="button" class="shell-chip" aria-label="Organization menu">
                  <span class="shell-org-mark" aria-hidden="true">{{ (org.name || 'O').charAt(0).toUpperCase() }}</span>
                  <span class="shell-chip-text">{{ org.name }}</span>
                  <span v-if="roleLabel" class="shell-role">{{ roleLabel }}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" :side-offset="6" class="min-w-56 rounded-xl">
                <DropdownMenuLabel class="text-xs text-muted-foreground">{{ org.name }}</DropdownMenuLabel>
                <DropdownMenuItem @select="goSettings('team')">
                  <Users class="size-4" /> Team members
                </DropdownMenuItem>
                <DropdownMenuItem v-if="authStore.isOrgAdmin" @select="goSettings('domains')">
                  <ShieldCheck class="size-4" /> Domains and SSO
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>

          <span class="shell-sep" aria-hidden="true">/</span>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button type="button" class="shell-chip" aria-label="Project menu">
                <span class="shell-chip-text">{{ activeWebsite?.name || 'Select a project' }}</span>
                <ChevronsUpDown class="shell-chip-caret" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="6" class="min-w-64 rounded-xl">
              <DropdownMenuLabel class="text-xs text-muted-foreground">Projects</DropdownMenuLabel>
              <DropdownMenuItem v-for="w in appStore.websites" :key="w.id" @select="switchWebsite(w.id)">
                <span class="truncate">{{ w.name }}</span>
                <Check v-if="w.id === activeWebsite?.id" class="ml-auto size-4" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="showAddProject = true">
                <Plus class="size-4" /> Add project
              </DropdownMenuItem>
              <DropdownMenuItem v-if="activeWebsite" @select="router.push({ name: 'settings-project' })">
                <SlidersHorizontal class="size-4" /> Project settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav class="shell-nav" aria-label="Main">
          <router-link
            v-for="item in navItems"
            :key="item.label"
            :to="item.to"
            class="shell-link"
            :class="{ 'is-active': item.active }"
            :aria-current="item.active ? 'page' : null"
          >{{ item.label }}</router-link>
        </nav>

        <div class="shell-actions">
          <span class="shell-tools">
            <FeedbackWidget v-if="FEEDBACK_ENABLED" />
            <HelpButton />
          </span>
          <button
            type="button"
            class="shell-icon"
            :aria-label="appStore.isDark ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="appStore.toggleTheme()"
          >
            <Sun v-if="appStore.isDark" aria-hidden="true" />
            <Moon v-else aria-hidden="true" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button type="button" class="shell-avatar" aria-label="Account menu">{{ authStore.userInitials }}</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" :side-offset="6" class="min-w-56 rounded-xl">
              <DropdownMenuLabel class="font-normal">
                <div class="grid text-sm leading-tight">
                  <span class="truncate font-semibold">{{ authStore.user?.full_name || 'Account' }}</span>
                  <span class="truncate text-xs text-muted-foreground">{{ authStore.user?.email }}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="router.push('/settings')">
                <UserRound class="size-4" /> Account
              </DropdownMenuItem>
              <DropdownMenuItem @select="router.push('/billing')">
                <CreditCard class="size-4" /> Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="handleLogout">
                <LogOut class="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            class="shell-icon shell-burger"
            :aria-expanded="navOpen ? 'true' : 'false'"
            aria-controls="shell-sheet"
            :aria-label="navOpen ? 'Close menu' : 'Open menu'"
            @click="navOpen = !navOpen"
          >
            <X v-if="navOpen" aria-hidden="true" />
            <Menu v-else aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav v-show="navOpen" id="shell-sheet" class="shell-sheet" aria-label="Main">
        <router-link
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="shell-sheet-link"
          :class="{ 'is-active': item.active }"
          @click="navOpen = false"
        >{{ item.label }}</router-link>
      </nav>
    </header>
    <div class="shell-rule" aria-hidden="true"></div>

    <main class="shell-main">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>

    <ToastContainer />
    <AddProjectDialog v-model:open="showAddProject" />
  </div>
  </TooltipProvider>
</template>

<script setup>
// The signed-in app frame: one top bar, three destinations. Replaces the
// old sidebar layout and its eleven entries; everything else now lives
// inside Overview, a prompt's page, Sources, or Settings.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Check, ChevronsUpDown, CreditCard, LogOut, Menu, Moon, Plus, ShieldCheck,
  SlidersHorizontal, Sun, UserRound, Users, X,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useShellBootstrap } from '@/composables/useShellBootstrap'
import HelpButton from '@/components/HelpButton.vue'
import FeedbackWidget from '@/components/feedback/FeedbackWidget.vue'
import { FEEDBACK_ENABLED } from '@/api/feedbackClient'
import ToastContainer from '@/components/ToastContainer.vue'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()

const showAddProject = ref(false)
const navOpen = ref(false)

const org = computed(() => authStore.org)
const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
const roleLabel = computed(() => ROLE_LABELS[authStore.orgRole] || authStore.orgRole || '')
const activeWebsite = computed(() => appStore.activeWebsite)

const navItems = computed(() => {
  const name = String(route.name || '')
  const wid = activeWebsite.value?.id
  return [
    { label: 'Overview', to: { name: 'dashboard' }, active: name === 'dashboard' || name === 'prompt' },
    {
      label: 'Sources',
      to: wid ? { name: 'sources-urls', params: { websiteId: wid } } : { name: 'dashboard' },
      active: name.startsWith('sources'),
    },
    {
      // The workspace has its own shell; /agent picks a project when none is active.
      label: 'Agent',
      to: wid ? { name: 'agent-home', params: { websiteId: wid } } : { name: 'agent' },
      active: name.startsWith('agent'),
    },
    {
      label: 'Settings',
      to: { path: '/settings' },
      active: route.path.startsWith('/settings') || route.path.startsWith('/billing'),
    },
  ]
})

function goSettings(section) {
  router.push({ path: '/settings', query: { section } })
}

// Keep the user on the same section, re-pointed at the new project. A
// prompt page belongs to the old project's records, so it falls back to
// the overview rather than 404ing on a foreign id.
function switchWebsite(id) {
  const website = appStore.websites.find((w) => w.id === id)
  if (!website) return
  appStore.setActiveWebsite(website)
  const name = String(route.name || '')
  if (name === 'prompt') router.push({ name: 'dashboard' })
  else if (name.startsWith('sources')) router.push({ name: 'sources-urls', params: { websiteId: id } })
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

watch(() => route.fullPath, () => { navOpen.value = false })

// User, website list and plan limits (shared with AgentShell).
useShellBootstrap()
</script>

<style scoped>
.shell {
  min-height: 100vh;
  min-height: 100svh;
  background: var(--background);
}

.shell-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--background) 88%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.shell-bar-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1360px;
  height: 64px;
  margin: 0 auto;
  padding: 0 24px;
}

.shell-home {
  display: inline-flex;
  flex-shrink: 0;
}

.shell-home:hover {
  opacity: 1;
}

.shell-logo {
  display: block;
  height: 19px;
  width: auto;
}

/* The wordmark ships dark slate; flip it to white on the dark theme.
   Plain descendant selector on purpose: scoped CSS only tags the last
   compound (.shell-logo), so the theme attribute on <html> still matches.
   (:global() here would compile to a bare [data-theme='dark'] rule and
   invert the whole page.) */
[data-theme='dark'] .shell-logo {
  filter: brightness(0) invert(1);
}

.shell-context {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.shell-org {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.shell-sep {
  color: var(--input);
  font-size: 18px;
  font-weight: 300;
}

.shell-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 240px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.shell-chip:hover,
.shell-chip[data-state='open'] {
  background: var(--accent);
}

.shell-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-chip-caret {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.shell-org-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: var(--foreground);
  color: var(--background);
  font-size: 11px;
  font-weight: 700;
}

.shell-role {
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 600;
}

.shell-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 12px;
}

.shell-link {
  padding: 7px 12px;
  border-radius: 999px;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  transition: color 0.15s ease, background 0.15s ease;
}

.shell-link:hover {
  color: var(--foreground);
  opacity: 1;
}

.shell-link.is-active {
  background: var(--accent);
  color: var(--foreground);
}

.shell-link:focus-visible,
.shell-icon:focus-visible,
.shell-avatar:focus-visible {
  border-radius: 999px;
}

.shell-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.shell-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.shell-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.shell-icon:hover {
  background: var(--accent);
  color: var(--foreground);
}

.shell-icon svg {
  width: 17px;
  height: 17px;
}

.shell-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: 4px;
  border: 0;
  border-radius: 999px;
  background: var(--foreground);
  color: var(--background);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.shell-burger {
  display: none;
}

.shell-sheet {
  display: grid;
  gap: 2px;
  margin: 0 16px 12px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--popover);
}

.shell-sheet-link {
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--foreground);
  font-size: 15px;
  font-weight: 500;
}

.shell-sheet-link.is-active {
  background: var(--accent);
}

/* Dashed hairline under the bar, as on the landing page. */
.shell-rule {
  height: 1px;
  background-image: linear-gradient(90deg, var(--border) 0 12px, transparent 12px 32px);
  background-size: 32px 1px;
}

.shell-main {
  max-width: 1360px;
  margin: 0 auto;
  padding: 28px 24px 80px;
}

@media (max-width: 900px) {
  .shell-nav,
  .shell-tools {
    display: none;
  }
  .shell-burger {
    display: grid;
  }
}

@media (max-width: 640px) {
  .shell-bar-inner,
  .shell-main {
    padding-left: 16px;
    padding-right: 16px;
  }
  /* Phones: the project is the one switcher that matters; the org lives
     in Settings > Team. */
  .shell-org {
    display: none;
  }
  .shell-chip {
    max-width: 170px;
  }
}
</style>

<!-- Page transition. Unscoped on purpose: <transition> puts these classes on
     the routed page's root, which carries the page's own scope hash. -->
<style>
.page-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.page-fade-enter-active {
  transition: opacity 280ms cubic-bezier(0.23, 1, 0.32, 1), transform 280ms cubic-bezier(0.23, 1, 0.32, 1);
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: none;
  }
}
</style>
