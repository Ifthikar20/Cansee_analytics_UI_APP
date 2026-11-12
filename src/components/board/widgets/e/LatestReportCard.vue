<script setup>
// The "latest-report" block's compact card. A placeholder for now: the block's own
// card replaces this body (the frame, the chip and the caption are
// BoardWidget's).
import ComingUp from '@/components/board/ComingUp.vue'
import { widgetMeta } from '@/lib/board/widgets'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const description = widgetMeta('latest-report')?.description || ''
</script>

<template>
  <ComingUp :text="description" />
</template>
