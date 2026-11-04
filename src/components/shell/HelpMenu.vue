<script setup>
// The header's help menu: the keyboard shortcuts, and Docs and Support in a
// new tab. Styled by AppHeader.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, CircleHelp, Keyboard, LifeBuoy } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { useAgentUiStore } from '@/stores/agentUi'
import { HELP_LINKS } from '@/lib/shell/nav'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgKbd from '@/components/agent/common/AgKbd.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'

const ICONS = { docs: BookOpen, support: LifeBuoy }

const router = useRouter()
const ui = useAgentUiStore()

const links = computed(() =>
  HELP_LINKS.map((link) => ({ ...link, icon: ICONS[link.key], href: router.resolve({ name: link.name }).href })),
)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <AgIconButton label="Help" shape="circle" :size="34" :icon-size="17">
        <CircleHelp />
      </AgIconButton>
    </DropdownMenuTrigger>

    <!-- 280: "Keyboard shortcuts" and its key caps need the room, with some
         to spare. At 260 the label came up a fraction of a pixel short and
         ended in an ellipsis. -->
    <AgMenuContent align="end" :width="280">
      <AgMenuItem @select="ui.openShortcuts()">
        <Keyboard aria-hidden="true" />
        <span class="ag-menu-text">Keyboard shortcuts</span>
        <template #trail><AgKbd keys="mod+/" /></template>
      </AgMenuItem>
      <AgMenuItem v-for="link in links" :key="link.key" as-child>
        <a :href="link.href" target="_blank" rel="noopener">
          <component :is="link.icon" aria-hidden="true" />
          <span class="ag-menu-text">{{ link.label }}</span>
        </a>
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>
