<script setup>
// A card whose component failed to load or to render (board_contract.md 9).
// Try again asks the board widget around it to load the card afresh.
import { inject } from 'vue'
import { CARD_RETRY } from '@/lib/board/context'
import AgButton from '@/components/agent/common/AgButton.vue'

const props = defineProps({
  // Given by defineAsyncComponent; not shown (people get the sentence below).
  error: { type: null, default: null },
  onRetry: { type: Function, default: null },
})

const injected = inject(CARD_RETRY, null)

function retry() {
  const fn = props.onRetry || injected
  if (typeof fn === 'function') fn()
}
</script>

<template>
  <div class="bd-load-error" role="alert">
    <p class="bd-load-error-text">This widget couldn't load.</p>
    <AgButton size="sm" @click="retry">Try again</AgButton>
  </div>
</template>

<style scoped>
.bd-load-error {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  min-height: 96px;
}

.bd-load-error-text {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}
</style>
