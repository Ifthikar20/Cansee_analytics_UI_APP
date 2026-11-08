<script setup>
// Renders a shortcut ('mod+shift+o') as key caps for this platform.
import { computed } from 'vue'
import { formatShortcut, shortcutLabels } from '@/composables/agent/usePlatform'

const props = defineProps({
  keys: { type: [String, Array], required: true },
})

const labels = computed(() => shortcutLabels(props.keys))
const spoken = computed(() => formatShortcut(props.keys))
</script>

<template>
  <span class="ag-kbd-group" :aria-label="spoken" role="img">
    <kbd v-for="(label, i) in labels" :key="i" class="ag-kbd" aria-hidden="true">{{ label }}</kbd>
  </span>
</template>

<style scoped>
.ag-kbd-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
