<script setup>
// The foot of a board card: one line naming the source and its notes
// (default slot), set as a small monospace label, with an optional link or
// action on the right (`link`).
</script>

<template>
  <footer class="bd-foot">
    <div class="bd-foot-text"><slot /></div>
    <div v-if="$slots.link" class="bd-foot-link"><slot name="link" /></div>
  </footer>
</template>

<style scoped>
.bd-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin-top: auto;
  padding-top: 4px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.bd-foot-text {
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bd-foot-text:empty {
  display: none;
}

.bd-foot-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
</style>
