<script setup>
// The bar over every signed-in page: the logo, the organization (B2B) and
// project chips, the Analytics / Agent / Settings links, then feedback (when
// the build has it), help, the theme and the account menu, with the dashed
// rule under it. At 900px and below the links, help and feedback move into
// a sheet behind a menu button; at 640px and below the theme toggle does
// too. The sheet floats under the bar, over the page, and closes on
// navigation, Escape, a click outside it, or a wider window. Every style of
// the bar is here; the menus' elements are reached through :deep().
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onClickOutside, useEventListener, useMediaQuery } from '@vueuse/core'
import { Menu, Moon, Sun, X } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAgentUiStore } from '@/stores/agentUi'
import { useHelpStore } from '@/stores/help'
import { HELP_LINKS, navItems } from '@/lib/shell/nav'
import { FEEDBACK_ENABLED } from '@/api/feedbackClient'
import FeedbackWidget from '@/components/feedback/FeedbackWidget.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { TIPS } from '@/lib/help/tips'
import AccountMenu from './AccountMenu.vue'
import HelpMenu from './HelpMenu.vue'
import OrgMenu from './OrgMenu.vue'
import ProjectMenu from './ProjectMenu.vue'

const props = defineProps({
  // The project in view: the URL's, else the active one (AppShell).
  websiteId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const auth = useAuthStore()
const ui = useAgentUiStore()
const help = useHelpStore()

const barEl = ref(null)
const sheetEl = ref(null)
const feedbackEl = ref(null)
const sheetOpen = ref(false)

// The last chat lives in localStorage, which is not reactive, so the links
// are read again on every navigation.
const items = computed(() => {
  void route.fullPath
  return navItems(route, { websiteId: props.websiteId, userId: auth.user?.id })
})

const website = computed(
  () =>
    app.websites.find((w) => String(w.id) === props.websiteId) || (props.websiteId ? app.activeWebsite : null) || null,
)

const helpLinks = computed(() => HELP_LINKS.map((link) => ({ ...link, href: router.resolve({ name: link.name }).href })))
const themeLabel = computed(() => (app.isDark ? 'Switch to light theme' : 'Switch to dark theme'))

function closeSheet() {
  sheetOpen.value = false
}

// Hiding the sheet would drop focus held in one of its rows, and a dialog
// opened from a row would hand focus back to that hidden row on close, so
// focus moves to the menu button first.
function leaveSheet() {
  if (sheetEl.value?.contains(document.activeElement)) {
    barEl.value?.querySelector('.shell-burger')?.focus({ preventScroll: true })
  }
  closeSheet()
}

function openShortcuts() {
  leaveSheet()
  ui.openShortcuts()
}

function openHelp() {
  leaveSheet()
  help.open()
}

// The widget has no API, and one is enough (it polls for replies): the row
// presses the bar's own button, which is hidden at these widths.
function openFeedback() {
  leaveSheet()
  feedbackEl.value?.querySelector('button')?.click()
}

watch(() => route.fullPath, leaveSheet)

const wide = useMediaQuery('(min-width: 901px)')
watch(wide, (value) => {
  if (value) closeSheet()
})

onClickOutside(sheetEl, closeSheet, { ignore: ['.shell-burger'] })

// A disclosure, not a modal: Escape closes it and, when focus was inside,
// hands it back to the menu button. data-ag-escape-ignore and
// preventDefault keep the same key from also stopping a running chat.
useEventListener(document, 'keydown', (event) => {
  if (!sheetOpen.value || event.defaultPrevented || event.key !== 'Escape') return
  event.preventDefault()
  leaveSheet()
})
</script>

<template>
  <header ref="barEl" class="shell-bar">
    <div class="shell-bar-inner">
      <!-- The current link is the section's pill, never the logo, even on
           the board it opens (RouterLink would mark it). -->
      <router-link :to="items[0].to" class="shell-home" aria-label="Cansee home" :aria-current="undefined">
        <img src="/images/cansee-logo.png" alt="" class="shell-logo" />
      </router-link>

      <div class="shell-context">
        <OrgMenu />
        <span class="shell-sep" aria-hidden="true">/</span>
        <ProjectMenu :website="website" />
      </div>

      <nav class="shell-nav" aria-label="Main">
        <AgTooltip v-for="item in items" :key="item.key" :text="TIPS.header.nav[item.key] || ''">
          <router-link
            :to="item.to"
            class="shell-link"
            :class="{ 'is-active': item.active }"
            :aria-current="item.active ? 'page' : undefined"
          >{{ item.label }}</router-link>
        </AgTooltip>
      </nav>

      <div class="shell-actions">
        <span class="shell-tools">
          <span v-if="FEEDBACK_ENABLED" ref="feedbackEl" class="shell-feedback">
            <FeedbackWidget />
          </span>
          <HelpMenu />
        </span>
        <AgIconButton
          class="shell-theme"
          :label="themeLabel"
          shape="circle"
          :size="34"
          :icon-size="17"
          @click="app.toggleTheme()"
        >
          <Sun v-if="app.isDark" />
          <Moon v-else />
        </AgIconButton>
        <AccountMenu />
        <AgIconButton
          class="shell-burger"
          :label="sheetOpen ? 'Close menu' : 'Open menu'"
          :tooltip="false"
          :aria-expanded="sheetOpen ? 'true' : 'false'"
          aria-controls="shell-sheet"
          shape="circle"
          :size="34"
          :icon-size="17"
          @click="sheetOpen = !sheetOpen"
        >
          <X v-if="sheetOpen" />
          <Menu v-else />
        </AgIconButton>
      </div>
    </div>

    <div class="shell-rule" aria-hidden="true" />

    <nav
      v-show="sheetOpen"
      id="shell-sheet"
      ref="sheetEl"
      class="shell-sheet"
      aria-label="Main"
      data-ag-escape-ignore
    >
      <router-link
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        class="shell-sheet-link"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="leaveSheet"
      >{{ item.label }}</router-link>
      <div class="shell-sheet-sep" aria-hidden="true" />
      <button type="button" class="shell-sheet-link is-quiet" aria-haspopup="dialog" @click="openHelp">
        Help center
      </button>
      <a
        v-for="link in helpLinks"
        :key="link.key"
        :href="link.href"
        target="_blank"
        rel="noopener"
        class="shell-sheet-link is-quiet"
        @click="leaveSheet"
      >{{ link.label }}</a>
      <button v-if="FEEDBACK_ENABLED" type="button" class="shell-sheet-link is-quiet" @click="openFeedback">
        Help &amp; feedback
      </button>
      <button type="button" class="shell-sheet-link is-quiet" @click="openShortcuts">Keyboard shortcuts</button>
      <button type="button" class="shell-sheet-link is-quiet shell-sheet-theme" @click="app.toggleTheme()">
        {{ themeLabel }}
      </button>
    </nav>
  </header>
</template>

<style scoped>
.shell-bar {
  position: relative;
  z-index: 30;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-family);
  font-feature-settings: normal;
  line-height: 1.5;
}

.shell-bar-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  height: var(--app-header-h, 64px);
  padding: 0 var(--app-gutter, 24px);
}

.shell-home {
  display: inline-flex;
  flex-shrink: 0;
  border-radius: var(--radius);
}

.shell-logo {
  display: block;
  width: auto;
  height: 19px;
}

/* The wordmark ships dark slate; flip it on the dark theme. Plain descendant
   selector on purpose: scoped CSS tags only .shell-logo, so the theme
   attribute on <html> still matches (:global() would invert the whole page). */
[data-theme='dark'] .shell-logo {
  filter: brightness(0) invert(1);
}

.shell-context {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* Rendered by OrgMenu and ProjectMenu. */
.shell-bar :deep(.shell-org) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.shell-bar :deep(.shell-sep) {
  color: var(--input);
  font-size: 18px;
  font-weight: 300;
}

.shell-bar :deep(.shell-chip) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 240px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.shell-bar :deep(.shell-chip:hover),
.shell-bar :deep(.shell-chip[data-state='open']) {
  background: var(--accent);
}

.shell-bar :deep(.shell-chip:focus-visible) {
  border-radius: var(--radius);
}

.shell-bar :deep(.shell-chip-text) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-bar :deep(.shell-chip-caret) {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--muted-foreground);
}

.shell-bar :deep(.shell-org-mark) {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius);
  background: var(--foreground);
  color: var(--background);
  font-size: 11px;
  font-weight: 700;
}

.shell-bar :deep(.shell-role) {
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
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
  border-radius: var(--radius);
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s ease, background 0.15s ease;
}

.shell-link:hover {
  color: var(--foreground);
}

.shell-link.is-active {
  background: var(--accent);
  color: var(--foreground);
}

.shell-link:focus-visible {
  border-radius: var(--radius);
}

.shell-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.shell-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* A handle for the sheet's Help & feedback row; it adds no box. */
.shell-feedback {
  display: contents;
}

/* Every AgIconButton in the bar (help, theme, menu): the old 34px round icon.
   None of them is ever disabled. :not(:disabled) keeps the hover rule above
   AgIconButton's own (0,4,0) one. */
.shell-bar :deep(.ag-icon-btn) {
  color: var(--muted-foreground);
}

.shell-bar :deep(.ag-icon-btn:hover:not(:disabled)),
.shell-bar :deep(.ag-icon-btn[data-state='open']) {
  background: var(--accent);
  color: var(--foreground);
}

.shell-bar :deep(.shell-burger) {
  display: none;
}

/* Rendered by AccountMenu. */
.shell-bar :deep(.shell-avatar) {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--foreground);
  color: var(--background);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.shell-bar :deep(.shell-avatar:focus-visible) {
  border-radius: 50%;
}

/* Hairline under the bar, as on the landing page. */
.shell-rule {
  height: 1px;
  background: var(--border);
}

.shell-sheet {
  position: absolute;
  top: 100%;
  right: 16px;
  left: 16px;
  z-index: 1;
  display: grid;
  gap: 2px;
  box-sizing: border-box;
  max-height: calc(var(--app-body-h, 100dvh) - 24px);
  margin-top: 8px;
  padding: 8px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--popover);
  box-shadow: var(--ag-shadow-pop);
}

.shell-sheet-link {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.shell-sheet-link.is-active {
  background: var(--accent);
}

.shell-sheet-link.is-quiet {
  color: var(--muted-foreground);
  font-size: 14px;
}

.shell-sheet-sep {
  height: 1px;
  margin: 4px 12px;
  background: var(--border);
}

.shell-sheet-theme {
  display: none;
}

@media (max-width: 900px) {
  .shell-nav,
  .shell-tools {
    display: none;
  }

  .shell-bar :deep(.shell-burger) {
    display: inline-grid;
  }
}

@media (max-width: 640px) {
  /* The side padding comes from --app-gutter, 16px here. */
  .shell-bar-inner {
    gap: 8px;
  }

  .shell-bar :deep(.shell-org) {
    display: none;
  }

  .shell-bar :deep(.shell-chip) {
    max-width: 170px;
  }

  .shell-bar :deep(.shell-theme) {
    display: none;
  }

  .shell-sheet-theme {
    display: flex;
  }
}
</style>
