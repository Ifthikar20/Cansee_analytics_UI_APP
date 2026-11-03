<script setup>
// Help menu (shortcuts, docs, support) and the sidebar collapse toggle.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, CircleHelp, Keyboard, LifeBuoy } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { useAgentUiStore } from '@/stores/agentUi'
import { IconPanelLeft } from '@/components/agent/icons'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgKbd from '@/components/agent/common/AgKbd.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'

const props = defineProps({
  // 'docked' collapses the sidebar; 'drawer' closes the drawer.
  variant: { type: String, default: 'docked' },
})

const router = useRouter()
const ui = useAgentUiStore()

const docsHref = computed(() => router.resolve({ name: 'docs' }).href)
const supportHref = computed(() => router.resolve({ name: 'support' }).href)
const toggleLabel = computed(() => (props.variant === 'drawer' ? 'Close sidebar' : 'Collapse sidebar'))

function toggle() {
  if (props.variant === 'drawer') ui.closeDrawer()
  else ui.toggleSidebar()
}
</script>

<template>
  <div class="ag-sb-footer">
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
</style>
