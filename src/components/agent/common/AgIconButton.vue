<script setup>
// Square or round icon-only button with an accessible name and a tooltip.
// Attributes and listeners land on the <button>, so it works as an as-child
// trigger for reka menus and popovers:
//   <DropdownMenuTrigger as-child><AgIconButton label="More"><Ellipsis /></AgIconButton></DropdownMenuTrigger>
// Sizes: 24 | 28 | 30 | 32 | 36 (or xs | sm | md | lg). `muted` uses the
// quieter glyph colour (tab close, header kebab); `pressed` makes it a toggle.
import { computed } from 'vue'
import AgTooltip from './AgTooltip.vue'
import { ariaShortcut } from '@/composables/agent/usePlatform'

defineOptions({ inheritAttrs: false })

const NAMED_SIZES = { xs: 24, sm: 28, md: 32, lg: 36 }

const props = defineProps({
  label: { type: String, required: true },
  icon: { type: [Object, Function], default: null },
  size: { type: [Number, String], default: 32 },
  iconSize: { type: [Number, String], default: 16 },
  variant: { type: String, default: 'ghost' },
  shape: { type: String, default: 'rounded' },
  muted: { type: Boolean, default: false },
  pressed: { type: Boolean, default: undefined },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  // true shows the label, a string overrides it, false hides the tooltip.
  tooltip: { type: [Boolean, String], default: true },
  tooltipSide: { type: String, default: 'bottom' },
  shortcut: { type: [String, Array], default: '' },
  type: { type: String, default: 'button' },
})

const px = computed(() => {
  const n = NAMED_SIZES[props.size] ?? Number(props.size)
  return Number.isFinite(n) && n > 0 ? n : 32
})

const tooltipText = computed(() => {
  if (props.tooltip === false) return ''
  return typeof props.tooltip === 'string' && props.tooltip ? props.tooltip : props.label
})

const keyshortcuts = computed(() => (props.shortcut ? ariaShortcut(props.shortcut) : undefined))

const style = computed(() => ({
  '--ag-ib-size': `${px.value}px`,
  '--ag-ib-icon': `${Number(props.iconSize) || 16}px`,
  '--ag-ib-radius': props.shape === 'circle' ? '999px' : px.value <= 28 ? '6px' : '8px',
}))
</script>

<template>
  <AgTooltip :text="tooltipText" :shortcut="shortcut" :side="tooltipSide" :disabled="!tooltipText || disabled">
    <button
      v-bind="$attrs"
      :type="type"
      class="ag-icon-btn"
      :class="[`is-${variant}`, { 'is-muted': muted, 'is-active': active || pressed }]"
      :style="style"
      :aria-label="label"
      :aria-pressed="pressed === undefined ? undefined : String(pressed)"
      :aria-keyshortcuts="keyshortcuts"
      :disabled="disabled"
    >
      <slot>
        <component :is="icon" v-if="icon" :size="iconSize" aria-hidden="true" />
      </slot>
    </button>
  </AgTooltip>
</template>

<style scoped>
.ag-icon-btn {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: var(--ag-ib-size);
  height: var(--ag-ib-size);
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--ag-ib-radius);
  background: transparent;
  color: var(--ag-fg-2);
  line-height: 0;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.ag-icon-btn.is-muted {
  color: var(--ag-fg-4);
}

.ag-icon-btn.is-outline {
  border-color: var(--ag-plus-border);
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
}

.ag-icon-btn:hover:not(:disabled),
.ag-icon-btn[data-state='open'] {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-icon-btn.is-outline:hover:not(:disabled) {
  background: var(--ag-btn-hover);
}

.ag-icon-btn.is-active {
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-icon-btn:disabled {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-icon-btn:focus-visible {
  border-radius: var(--ag-ib-radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-icon-btn :deep(svg) {
  flex-shrink: 0;
  width: var(--ag-ib-icon);
  height: var(--ag-ib-icon);
}
</style>
