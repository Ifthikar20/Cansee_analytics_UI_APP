<template>
  <div class="ag-notice" :class="`is-${tone}`" :role="tone === 'error' ? 'alert' : 'note'">
    <component :is="icon" class="ag-notice-icon" aria-hidden="true" />
    <p class="ag-notice-text">{{ message || fallback }}</p>
  </div>
</template>

<script setup>
// An inline `notice` part (fallback model used, refusal, a skipped step).
import { computed } from 'vue'
import { CircleAlert, Info, TriangleAlert } from '@lucide/vue'

const props = defineProps({
  level: { type: String, default: 'info' },
  code: { type: String, default: '' },
  message: { type: String, default: '' },
})

const tone = computed(() => (['info', 'warning', 'error'].includes(props.level) ? props.level : 'info'))
const icon = computed(() => ({ info: Info, warning: TriangleAlert, error: CircleAlert })[tone.value])
const fallback = computed(() => (tone.value === 'error' ? 'Something went wrong in this step.' : 'Note from the agent.'))
</script>

<style scoped>
.ag-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.ag-notice-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--ag-fg-3);
}

.ag-notice.is-warning .ag-notice-icon {
  color: var(--ag-warning);
}

.ag-notice.is-error {
  border-color: color-mix(in srgb, var(--ag-danger) 28%, transparent);
  background: var(--ag-danger-bg);
}

.ag-notice.is-error .ag-notice-icon {
  color: var(--ag-danger);
}

.ag-notice-text {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
</style>
