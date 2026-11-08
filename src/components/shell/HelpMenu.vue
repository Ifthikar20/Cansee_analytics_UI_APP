<script setup>
// The header's help button: opens the help drawer (questions, docs, support,
// shortcuts) in one click. Styled by AppHeader.
import { CircleHelp } from '@lucide/vue'
import { useHelpStore } from '@/stores/help'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'

const help = useHelpStore()
</script>

<template>
  <AgIconButton
    label="Help"
    tooltip="Help, docs and shortcuts"
    shortcut="shift+?"
    shape="circle"
    :size="34"
    :icon-size="17"
    aria-haspopup="dialog"
    :aria-expanded="help.isOpen ? 'true' : 'false'"
    :data-state="help.isOpen ? 'open' : 'closed'"
    @click="help.toggle()"
  >
    <CircleHelp />
  </AgIconButton>
</template>
