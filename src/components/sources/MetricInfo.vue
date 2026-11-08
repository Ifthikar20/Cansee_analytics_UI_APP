<script setup>
/**
 * Info icon carrying a metric definition. Replaces the page's bare,
 * handler-less Info icons: an unexplained metric is the reason this page
 * confused people. A HelpTip, so it opens on hover, keyboard focus and a
 * tap, and works with or without the TooltipProvider AppShell renders.
 */
import { Info } from '@lucide/vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'

defineProps({
  text: { type: String, required: true },
  side: { type: String, default: 'top' },
})
</script>

<template>
  <HelpTip :text="text" :side="side" :icon="Info" label="What does this metric mean?" />
</template>
