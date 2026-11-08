<script setup>
// The head of an Analytics page: eyebrow, title, one-line subtitle and
// actions on the right. In the board's side panel, whose own header already
// names the widget, only the subtitle and the actions show.
import { useInPanel } from '@/lib/board/context'

defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})

const inPanel = useInPanel()
</script>

<template>
  <header class="an-head" :class="{ 'is-panel': inPanel }">
    <div v-if="!inPanel || subtitle" class="an-head-text">
      <template v-if="!inPanel">
        <p v-if="eyebrow" class="an-eyebrow">{{ eyebrow }}</p>
        <h1 class="an-title">{{ title }}</h1>
      </template>
      <p v-if="subtitle" class="an-sub">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="an-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.an-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.an-head.is-panel {
  align-items: center;
}

.an-head-text {
  min-width: 0;
  max-width: 760px;
}

.an-eyebrow {
  color: var(--gap-ai);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.an-title {
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: var(--foreground);
  font-size: clamp(1.6rem, 2.4vw, 2.1rem);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.1;
}

.an-sub {
  margin-top: 8px;
  color: var(--muted-foreground);
  font-size: 14.5px;
  line-height: 1.5;
}

.an-head.is-panel .an-sub {
  margin-top: 0;
}

.an-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
