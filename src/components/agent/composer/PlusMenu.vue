<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <AgIconButton
        label="Add an agent or a page"
        :tooltip="'Agents and pages'"
        tooltip-side="top"
        :icon="Plus"
        :size="30"
        :icon-size="16"
        shape="circle"
        variant="outline"
        class="ag-plus"
        :disabled="disabled"
      />
    </DropdownMenuTrigger>
    <AgMenuContent side="top" align="start" :side-offset="8" :width="240">
      <DropdownMenuSub>
        <DropdownMenuSubTrigger class="ag-menu-item ag-plus-sub">
          <IconAgents aria-hidden="true" />
          <span class="ag-menu-text">Use an agent</span>
          <ChevronRight class="ag-plus-sub-chevron" aria-hidden="true" />
        </DropdownMenuSubTrigger>
        <AgMenuSubContent>
          <AgMenuItem v-for="a in agents" :key="a.key" @select="emit('select-agent', a.key)">
            <component :is="a.icon" aria-hidden="true" />
            <span class="ag-menu-text">{{ a.name }}</span>
            <template v-if="a.key === agent" #trail><Check aria-hidden="true" /></template>
          </AgMenuItem>
        </AgMenuSubContent>
      </DropdownMenuSub>
      <AgMenuItem @select="emit('open-page')">
        <Globe aria-hidden="true" />
        <span class="ag-menu-text">Open a web page</span>
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>

<script setup>
// The composer's "+": pick an agent for the next message, or open a new tab
// in the browser pane to visit a page.
import { DropdownMenuRoot, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuTrigger } from 'reka-ui'
import { Check, ChevronRight, Globe, Plus } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuSubContent from '@/components/agent/common/AgMenuSubContent.vue'
import { IconAgents } from '@/components/agent/icons'

defineProps({
  agents: { type: Array, default: () => [] },
  agent: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['select-agent', 'open-page'])
</script>

<style scoped>
.ag-plus-sub .ag-plus-sub-chevron {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--ag-fg-3);
}
</style>
