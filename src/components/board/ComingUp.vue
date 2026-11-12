<script setup>
// The body of a block whose card is not built yet: one honest line, no
// numbers and no drawing that could pass for data. It reports "No data" to
// the card's frame. A block's own card replaces it.
import { useCardStatus } from '@/lib/board/context'

defineProps({
  // What the block will show, in a sentence (its catalog description).
  text: { type: String, default: '' },
})

useCardStatus('empty')
</script>

<template>
  <div class="bd-soon">
    <p class="bd-soon-label cs-label">Coming up</p>
    <p v-if="text" class="bd-soon-text">{{ text }}</p>
  </div>
</template>

<style scoped>
.bd-soon {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.bd-soon-label {
  margin: 0;
}

.bd-soon-text {
  max-width: 32ch;
  margin: 0;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -0.01em;
}
</style>
