<script setup>
// A card body that is still loading: a quiet block at the body's height.
// It pulses, and holds still for people who ask for reduced motion.
defineProps({
  // The block's height in px; the default fits a card's lead and body.
  height: { type: Number, default: 132 },
})
</script>

<template>
  <div class="bd-skel" :style="{ minHeight: `${height}px` }" aria-hidden="true" />
</template>

<style scoped>
.bd-skel {
  flex: 1 1 auto;
  box-sizing: border-box;
  width: 100%;
  border-radius: 8px;
  background: var(--viz-nodata);
  animation: bd-skel-pulse 1.6s ease-in-out infinite;
}

@keyframes bd-skel-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bd-skel {
    animation: none;
  }
}
</style>
