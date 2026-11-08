<script setup>
// Layout for agent list and form pages: the 48px header, a scrolling body
// centred at 720px with an optional intro line, and an optional footer slot
// that stays below the scroller (sticky save bars).
import AgPageHeader from './AgPageHeader.vue'

defineProps({
  title: { type: String, required: true },
  intro: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})
</script>

<template>
  <section class="ag-page" aria-labelledby="ag-page-title" :aria-busy="busy ? 'true' : undefined">
    <AgPageHeader :title="title" title-id="ag-page-title">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </AgPageHeader>
    <div class="ag-page-scroll">
      <div class="ag-page-body">
        <p v-if="intro" class="ag-page-intro">{{ intro }}</p>
        <slot name="intro" />
        <slot />
      </div>
    </div>
    <slot name="footer" />
  </section>
</template>

<style scoped>
.ag-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  min-height: 0;
  background: var(--ag-pane-bg);
}

.ag-page-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ag-page-body {
  box-sizing: border-box;
  width: 100%;
  max-width: 776px;
  margin: 0 auto;
  padding: 8px 28px 64px;
}

.ag-page-intro {
  max-width: 600px;
  margin: 0 0 20px;
  color: var(--ag-fg-3);
  font-size: 14px;
  line-height: 21px;
}

@media (max-width: 640px) {
  .ag-page-body {
    padding: 4px 16px 48px;
  }
}
</style>
