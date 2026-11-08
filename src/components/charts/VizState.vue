<template>
  <div class="viz-state" :class="[`is-${kind}`, { 'is-compact': compact }]">
    <span class="viz-state-icon" aria-hidden="true">
      <component :is="icon" :size="compact ? 16 : 18" />
    </span>
    <p class="viz-state-title">{{ title }}</p>
    <p v-if="body" class="viz-state-body">{{ body }}</p>
    <template v-if="action && action.label">
      <Button v-if="action.to" size="sm" :variant="kind === 'error' ? 'outline' : 'default'" class="viz-state-btn" as-child>
        <RouterLink :to="action.to">{{ action.label }}</RouterLink>
      </Button>
      <Button
        v-else
        type="button"
        size="sm"
        :variant="kind === 'error' ? 'outline' : 'default'"
        class="viz-state-btn"
        @click="emit('action')"
      >
        {{ action.label }}
      </Button>
    </template>
  </div>
</template>

<script setup>
// What a chart or section shows instead of numbers: nothing recorded yet,
// a source that isn't connected, something this plan or server can't
// measure, a load error, or a feature that is turned off. It never shows
// sample figures; it says what is missing and, when there is one, the
// action that would fill it.
import { computed } from 'vue'
import { CircleAlert, CircleSlash, Inbox, PlugZap, Power } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  // 'empty' | 'not_connected' | 'not_available' | 'error' | 'disabled'
  kind: { type: String, default: 'empty' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  // { label, to? }: a link when `to` is set, else a button that emits `action`.
  action: { type: Object, default: null },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['action'])

const ICONS = { empty: Inbox, not_connected: PlugZap, not_available: CircleSlash, error: CircleAlert, disabled: Power }
const icon = computed(() => ICONS[props.kind] || Inbox)
</script>

<style scoped>
.viz-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 36px 24px;
  border: 1px dashed var(--border);
  border-radius: 16px;
  background: var(--viz-surface);
  text-align: center;
}

.viz-state.is-compact {
  padding: 20px 16px;
  border-radius: 12px;
}

.viz-state-icon {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: 4px;
  border-radius: 999px;
  background: var(--viz-nodata);
  color: var(--viz-ink-2);
}

.is-compact .viz-state-icon {
  width: 30px;
  height: 30px;
}

.viz-state-title {
  max-width: 34rem;
  color: var(--viz-ink-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.viz-state-body {
  max-width: 30rem;
  color: var(--viz-ink-2);
  font-size: 13px;
  line-height: 1.5;
}

.viz-state-btn {
  margin-top: 8px;
  border-radius: 999px;
}

/* A link styled as a button: the global `a` rule (base.css) is unlayered,
   so it beats the button's layered text utilities and would paint the
   label in the button's own fill colour. */
a.viz-state-btn {
  color: var(--primary-foreground);
}

a.viz-state-btn:hover {
  opacity: 1;
}

.is-error a.viz-state-btn {
  color: var(--foreground);
}
</style>
