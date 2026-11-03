<script setup>
// Opens the sidebar from a page header. Renders only when the sidebar is not
// in view: docked but collapsed, or narrow layouts where it is a drawer.
import { computed } from 'vue'
import { useAgentUiStore } from '@/stores/agentUi'
import { IconPanelLeft } from '@/components/agent/icons'
import AgIconButton from './AgIconButton.vue'

const props = defineProps({
  // Render even when the sidebar is visible (the sidebar's own footer).
  always: { type: Boolean, default: false },
  size: { type: [Number, String], default: 32 },
})

const ui = useAgentUiStore()
const visible = computed(() => props.always || ui.showSidebarToggle)
const label = computed(() => (ui.sidebarVisible ? 'Close sidebar' : 'Open sidebar'))
</script>

<template>
  <AgIconButton
    v-if="visible"
    :label="label"
    :size="size"
    shortcut="mod+b"
    :aria-expanded="ui.sidebarVisible ? 'true' : 'false'"
    @click="ui.toggleSidebar()"
  >
    <IconPanelLeft :size="16" />
  </AgIconButton>
</template>
