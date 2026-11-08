<template>
  <div v-if="count > 1" class="ag-branch" role="group" :aria-label="`Version ${index} of ${count}`">
    <AgIconButton
      label="Previous version"
      :icon="ChevronLeft"
      :size="24"
      :icon-size="14"
      muted
      :disabled="disabled || index <= 1"
      @click="emit('prev')"
    />
    <span class="ag-branch-count ag-tnum" aria-hidden="true">{{ index }}/{{ count }}</span>
    <AgIconButton
      label="Next version"
      :icon="ChevronRight"
      :size="24"
      :icon-size="14"
      muted
      :disabled="disabled || index >= count"
      @click="emit('next')"
    />
  </div>
</template>

<script setup>
// "‹ 1/2 ›" between sibling versions of a message (regenerate or edit).
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'

defineProps({
  // 1-based
  index: { type: Number, default: 1 },
  count: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['prev', 'next'])
</script>

<style scoped>
.ag-branch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.ag-branch-count {
  min-width: 28px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}
</style>
