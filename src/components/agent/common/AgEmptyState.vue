<script setup>
// Honest empty, error and first-run states for agent pages. Never filled
// with sample content: a title, one line on how data appears, an action.
defineProps({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  tone: { type: String, default: 'neutral' },
})
</script>

<template>
  <div class="ag-empty" :class="`is-${tone}`" :role="tone === 'error' ? 'alert' : undefined">
    <span v-if="icon" class="ag-empty-icon" aria-hidden="true">
      <component :is="icon" :size="18" />
    </span>
    <p class="ag-empty-title">{{ title }}</p>
    <p v-if="body" class="ag-empty-body">{{ body }}</p>
    <div v-if="$slots.default" class="ag-empty-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ag-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  border: 1px dashed var(--ag-card-border);
  border-radius: 12px;
  text-align: center;
}

.ag-empty-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: 6px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: 8px;
  color: var(--ag-fg-2);
}

.ag-empty.is-error .ag-empty-icon {
  color: var(--ag-danger);
}

.ag-empty-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-empty-body {
  max-width: 400px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
</style>
