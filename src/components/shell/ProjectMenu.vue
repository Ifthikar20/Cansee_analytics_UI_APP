<script setup>
// The header's project chip: the project in view, and a menu to switch to
// another project, add one or open its settings. Switching keeps the page
// where it can (useProjectSwitch). Styled by AppHeader.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronsUpDown, Plus, SlidersHorizontal } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { useAppStore } from '@/stores/app'
import { useAgentUiStore } from '@/stores/agentUi'
import { useProjectSwitch } from '@/composables/agent/useProjectSwitch'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'
import AgMenuSeparator from '@/components/agent/common/AgMenuSeparator.vue'

const props = defineProps({
  website: { type: Object, default: null },
})

const router = useRouter()
const app = useAppStore()
const ui = useAgentUiStore()
const { switchProject } = useProjectSwitch()

const name = computed(() => props.website?.name || 'No project')

function isCurrent(w) {
  return Boolean(props.website) && String(w.id) === String(props.website.id)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button type="button" class="shell-chip" :aria-label="`Project: ${name}`">
        <span class="shell-chip-text">{{ name }}</span>
        <ChevronsUpDown class="shell-chip-caret" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>

    <AgMenuContent align="start" :width="260">
      <AgMenuLabel>Projects</AgMenuLabel>
      <AgMenuItem v-for="w in app.websites" :key="w.id" :text-value="w.name" @select="switchProject(w.id)">
        <span class="ag-menu-text">{{ w.name }}</span>
        <template v-if="isCurrent(w)" #trail>
          <Check :size="16" aria-hidden="true" />
          <span class="ag-sr-only">(current)</span>
        </template>
      </AgMenuItem>
      <AgMenuSeparator />
      <AgMenuItem @select="ui.openAddProject()">
        <Plus aria-hidden="true" />
        Add project
      </AgMenuItem>
      <AgMenuItem v-if="website" @select="router.push({ name: 'settings-project' })">
        <SlidersHorizontal aria-hidden="true" />
        Project settings
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>
