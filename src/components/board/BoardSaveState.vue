<script setup>
// Whether the board's layout is saved (board_contract.md 9): "Saving..."
// once a save takes longer than 600ms, a failed save with Try again, and a
// failed load that fell back to the default board. The 409 toast is the
// store's. The board header shows every state; on a narrow board the long
// failure lines move to a row of their own (`failures-only`).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useBoardStore } from '@/stores/board'
import AgButton from '@/components/agent/common/AgButton.vue'

const SAVING_DELAY_MS = 600

const props = defineProps({
  websiteId: { type: String, required: true },
  failuresOnly: { type: Boolean, default: false },
})

const board = useBoardStore()
const entry = computed(() => board.layoutOf(props.websiteId))

// "Saving..." waits 600ms, so a quick save never flickers.
const savingShown = ref(false)
let timer = null
watch(
  () => entry.value?.save === 'saving',
  (saving) => {
    clearTimeout(timer)
    savingShown.value = false
    if (saving) timer = setTimeout(() => (savingShown.value = true), SAVING_DELAY_MS)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))

const state = computed(() => {
  const e = entry.value
  if (!e) return ''
  if (e.save === 'failed') return 'save-failed'
  if (e.status === 'error' && e.source === 'default') return 'load-failed'
  if (!props.failuresOnly && e.save === 'saving' && savingShown.value) return 'saving'
  return ''
})
</script>

<template>
  <div class="bd-save" role="status">
    <span v-if="state === 'saving'" class="bd-save-text">Saving...</span>
    <span v-else-if="state === 'save-failed'" class="bd-save-failure">
      <span class="bd-save-text">Couldn't save your board.</span>
      <AgButton size="xs" variant="ghost" @click="board.retrySave(websiteId)">Try again</AgButton>
    </span>
    <span v-else-if="state === 'load-failed'" class="bd-save-failure">
      <span class="bd-save-text">We couldn't load your saved board. Showing the default.</span>
      <AgButton size="xs" variant="ghost" @click="board.load(websiteId)">Try again</AgButton>
    </span>
  </div>
</template>

<style scoped>
.bd-save {
  display: flex;
  align-items: center;
  min-width: 0;
}

.bd-save-failure {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 0;
}

.bd-save-text {
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}
</style>
