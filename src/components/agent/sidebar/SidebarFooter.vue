<script setup>
// Settings, the Help menu (shortcuts, docs, support), feedback when the
// server offers it, and the sidebar collapse toggle.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookOpen, CircleHelp, Keyboard, LifeBuoy, Settings } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { useAgentUiStore } from '@/stores/agentUi'
import { IconPanelLeft } from '@/components/agent/icons'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgKbd from '@/components/agent/common/AgKbd.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import FeedbackWidget from '@/components/feedback/FeedbackWidget.vue'
import { FEEDBACK_ENABLED } from '@/api/feedbackClient'

const props = defineProps({
  // 'docked' collapses the sidebar; 'drawer' closes the drawer.
  variant: { type: String, default: 'docked' },
})

const route = useRoute()
const router = useRouter()
const ui = useAgentUiStore()

const docsHref = computed(() => router.resolve({ name: 'docs' }).href)
const supportHref = computed(() => router.resolve({ name: 'support' }).href)
const toggleLabel = computed(() => (props.variant === 'drawer' ? 'Close sidebar' : 'Collapse sidebar'))
const onSettings = computed(() => Boolean(route.meta?.settings))

function toggle() {
  if (props.variant === 'drawer') ui.closeDrawer()
  else ui.toggleSidebar()
}
</script>

<template>
  <div class="ag-sb-footer">
    <div class="ag-sb-footer-start">
      <AgTooltip text="Settings" side="top">
        <router-link
          :to="{ name: 'settings' }"
          class="ag-sb-settings"
          :class="{ 'is-active': onSettings }"
          aria-label="Settings"
          :aria-current="onSettings ? 'page' : undefined"
        >
          <Settings :size="16" aria-hidden="true" />
        </router-link>
      </AgTooltip>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <AgIconButton label="Help" tooltip-side="top">
            <CircleHelp />
          </AgIconButton>
        </DropdownMenuTrigger>
        <AgMenuContent side="top" align="start" :width="240">
          <AgMenuItem @select="ui.openShortcuts()">
            <Keyboard aria-hidden="true" />
            <span class="ag-menu-text">Keyboard shortcuts</span>
            <template #trail><AgKbd keys="mod+/" /></template>
          </AgMenuItem>
          <AgMenuItem as-child>
            <a :href="docsHref" target="_blank" rel="noopener">
              <BookOpen aria-hidden="true" />
              <span class="ag-menu-text">Docs</span>
            </a>
          </AgMenuItem>
          <AgMenuItem as-child>
            <a :href="supportHref" target="_blank" rel="noopener">
              <LifeBuoy aria-hidden="true" />
              <span class="ag-menu-text">Support</span>
            </a>
          </AgMenuItem>
        </AgMenuContent>
      </DropdownMenuRoot>

      <FeedbackWidget v-if="FEEDBACK_ENABLED" />
    </div>

    <AgIconButton :label="toggleLabel" shortcut="mod+b" tooltip-side="top" @click="toggle">
      <IconPanelLeft />
    </AgIconButton>
  </div>
</template>

<style scoped>
.ag-sb-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  margin-top: 8px;
}

.ag-sb-footer-start {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* The AgIconButton look, as a link. */
.ag-sb-settings {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--ag-fg-2);
  line-height: 0;
  transition: background-color 120ms ease, color 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.ag-sb-settings:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-sb-settings.is-active {
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-sb-settings:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-sb-settings svg {
  width: 16px;
  height: 16px;
}
</style>
