<script setup>
// Text button in the agent look. Variants: secondary (the reference's Open
// and Export buttons), primary, ghost, danger. Sizes: sm (30px, 14/500),
// md (32px), xs (26px, 13/500). With `to` it renders a router-link, with
// `href` an <a>.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AgSpinner from './AgSpinner.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'md' },
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  icon: { type: [Object, Function], default: null },
  block: { type: Boolean, default: false },
})

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))
const tagProps = computed(() => {
  if (props.to) return { to: props.to }
  if (props.href) return { href: props.href }
  return { type: props.type, disabled: props.disabled || props.loading }
})
</script>

<template>
  <component
    :is="tag"
    v-bind="{ ...tagProps, ...$attrs }"
    class="ag-button"
    :class="[`is-${variant}`, `is-${size}`, { 'is-block': block, 'is-loading': loading }]"
    :aria-busy="loading ? 'true' : undefined"
    :aria-disabled="(to || href) && disabled ? 'true' : undefined"
  >
    <AgSpinner v-if="loading" :size="14" />
    <component :is="icon" v-else-if="icon" :size="size === 'xs' ? 14 : 16" aria-hidden="true" />
    <span class="ag-button-text"><slot /></span>
  </component>
</template>

<style scoped>
.ag-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.ag-button.is-sm {
  height: 30px;
  padding: 0 8px;
}

.ag-button.is-xs {
  height: 26px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 13px;
}

.ag-button.is-block {
  width: 100%;
}

.ag-button.is-secondary {
  border-color: var(--ag-btn-border);
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
}

.ag-button.is-secondary:hover:not(:disabled) {
  background: var(--ag-btn-hover);
  opacity: 1;
}

.ag-button.is-primary {
  border-color: var(--ag-send-bg);
  background: var(--ag-send-bg);
  color: var(--ag-send-fg);
}

.ag-button.is-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.ag-button.is-ghost {
  background: transparent;
  color: var(--ag-fg-2);
}

.ag-button.is-ghost:hover:not(:disabled) {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-button.is-danger {
  border-color: var(--ag-danger);
  background: var(--ag-danger);
  color: #ffffff;
}

.ag-button.is-danger:hover:not(:disabled) {
  opacity: 0.9;
}

.ag-button:disabled,
.ag-button[aria-disabled='true'] {
  opacity: 0.5;
  cursor: default;
  pointer-events: none;
}

.ag-button.is-loading {
  opacity: 0.8;
}

.ag-button:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-button-text:empty {
  display: none;
}
</style>
