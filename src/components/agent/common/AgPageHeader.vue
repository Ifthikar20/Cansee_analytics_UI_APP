<script setup>
// 48px header for agent pages other than the chat: sidebar button when the
// sidebar is hidden, the page title (the page's h1), right-aligned actions.
import AgSidebarToggle from './AgSidebarToggle.vue'

defineProps({
  title: { type: String, required: true },
  titleId: { type: String, default: undefined },
})
</script>

<template>
  <header class="ag-page-header">
    <AgSidebarToggle />
    <h1 :id="titleId" class="ag-page-header-title">{{ title }}</h1>
    <div v-if="$slots.actions" class="ag-page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.ag-page-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 48px;
  padding: 0 16px;
}

.ag-page-header > :deep(.ag-icon-btn) {
  margin-left: -8px;
}

.ag-page-header-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
</style>
