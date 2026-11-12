<script setup>
// The Visibility score block's tile in the catalog: a large number with
// the block's real unit (a percent of answers) over a thin line that ends
// in the accent dot. A sketch with a made-up number; the catalog marks it
// "Sample data".
</script>

<template>
  <svg class="wd-score-preview" viewBox="0 0 160 100" aria-hidden="true" focusable="false">
    <text class="is-figure" x="10" y="52" font-size="50">38</text>
    <text class="is-unit" x="150" y="52" font-size="6.5" text-anchor="end">% OF ANSWERS</text>
    <polyline class="is-line" points="12,88 28,86 44,89 60,82 76,84 92,76 108,78 124,70 146,66" />
    <circle class="is-you" cx="146" cy="66" r="3" />
  </svg>
</template>

<style scoped>
.wd-score-preview {
  display: block;
  width: 100%;
  height: auto;
}

.is-figure {
  fill: var(--foreground);
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.05em;
}

.is-unit {
  fill: var(--subtle-foreground);
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}

.is-line {
  fill: none;
  stroke: var(--foreground);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.is-you {
  fill: var(--signal);
}
</style>
