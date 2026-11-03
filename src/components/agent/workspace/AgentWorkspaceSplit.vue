<template>
  <div ref="root" class="ag-ws" :class="classes" :style="gridStyle">
    <section id="ag-ws-chat" class="ag-ws-chat" aria-label="Chat" :inert="chatInert || undefined">
      <slot name="chat" :layout="layout" />
    </section>

    <div
      v-if="showHandle"
      class="ag-ws-handle"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label="Resize chat and browser"
      aria-controls="ag-ws-chat"
      v-bind="{ ...aria, ...handlers }"
    >
      <span class="ag-ws-handle-line" aria-hidden="true" />
    </div>

    <div v-if="layout === 'overlay' && paneVisible" class="ag-ws-scrim" aria-hidden="true" @click="close" />

    <aside
      v-if="layout !== 'fullscreen'"
      v-show="paneVisible"
      id="ag-ws-pane"
      ref="paneEl"
      class="ag-ws-pane"
      aria-label="Browser"
      tabindex="-1"
      @keydown.esc="onEscape"
    >
      <slot name="pane" :layout="layout" />
    </aside>
    <MobilePaneDialog v-else :open="paneVisible" @update:open="setOpen">
      <slot name="pane" :layout="layout" />
    </MobilePaneDialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { HANDLE_WIDTH, MIN_CHAT, MIN_PANE, useSplitPane } from '@/composables/agent/useSplitPane'
import MobilePaneDialog from '@/components/agent/browser/MobilePaneDialog.vue'

// Chat | browser layout. split: two columns with a draggable 1px handle;
// overlay (less than 801px of width): the pane slides over the chat;
// fullscreen (phones, 767px and below): the pane is a full-screen dialog.
// The ratio and open state default to the pane store; pass v-model:ratio or
// v-model:open to control them from outside.

const props = defineProps({
  ratio: { type: Number, default: undefined },
  open: { type: Boolean, default: undefined },
})

const emit = defineEmits(['update:ratio', 'update:open'])

const pane = useAgentPaneStore()
const ui = useAgentUiStore()

const root = ref(null)
const paneEl = ref(null)
const phone = useMediaQuery('(max-width: 767px)')

const ratioValue = computed(() => (props.ratio === undefined ? pane.ratio : props.ratio))
const paneVisible = computed(() => (props.open === undefined ? pane.open : props.open))

const { width, dragging, current, aria, handlers } = useSplitPane({
  container: root,
  ratio: ratioValue,
  onCommit: (value) => {
    pane.setRatio(value)
    emit('update:ratio', value)
  },
  minStart: MIN_CHAT,
  minEnd: MIN_PANE,
})

const layout = computed(() => {
  if (phone.value) return 'fullscreen'
  if (width.value > 0 && width.value < MIN_CHAT + MIN_PANE + HANDLE_WIDTH) return 'overlay'
  return 'split'
})

provide('agWorkspaceLayout', layout)

// The store opens the pane for the agent only beside the chat, never over it,
// so it needs the layout once the width is measured.
watch(
  () => (phone.value || width.value > 0 ? layout.value : null),
  (value) => pane.setLayout(value),
  { immediate: true }
)
onBeforeUnmount(() => pane.setLayout(null))

const expanded = computed(() => layout.value === 'split' && paneVisible.value && pane.expanded)
const showHandle = computed(() => layout.value === 'split' && paneVisible.value && !expanded.value)
const chatInert = computed(() => layout.value === 'overlay' && paneVisible.value)

const classes = computed(() => [
  `is-${layout.value}`,
  {
    'has-pane': paneVisible.value,
    'is-expanded': expanded.value,
    'is-dragging': dragging.value,
  },
])

const gridStyle = computed(() => {
  if (layout.value !== 'split' || !paneVisible.value) return { gridTemplateColumns: 'minmax(0, 1fr)' }
  if (expanded.value) return { gridTemplateColumns: 'minmax(0, 1fr)' }
  const r = current.value
  return { gridTemplateColumns: `minmax(0, ${r}fr) ${HANDLE_WIDTH}px minmax(0, ${1 - r}fr)` }
})

function setOpen(value) {
  pane.setOpen(value)
  emit('update:open', value)
}

function close() {
  setOpen(false)
}

function onEscape(event) {
  if (layout.value !== 'overlay' || event.defaultPrevented) return
  event.stopPropagation()
  close()
}

function restoreFocus() {
  const el = pane.returnFocusEl
  if (el && el.isConnected && typeof el.focus === 'function') {
    el.focus()
    return
  }
  ui.focusComposer()
}

// Move focus into the overlay when it opens; when the pane closes while
// focus is inside it, give focus back to what opened it (or the composer).
watch(
  paneVisible,
  (visible, wasVisible) => {
    if (layout.value === 'fullscreen') return
    if (!visible && wasVisible) {
      const active = document.activeElement
      const inside = Boolean(paneEl.value && active && paneEl.value.contains(active))
      if (inside) nextTick(restoreFocus)
      return
    }
    if (visible && !wasVisible && layout.value === 'overlay') {
      nextTick(() => {
        const target = paneEl.value?.querySelector('[role="tab"][aria-selected="true"]') || paneEl.value
        target?.focus?.()
      })
    }
  },
  { flush: 'pre' }
)
</script>

<style scoped>
.ag-ws {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--ag-pane-bg);
}

.ag-ws-chat {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.ag-ws.is-expanded .ag-ws-chat {
  display: none;
}

.ag-ws-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  outline: none;
}

/* The visible line is 1px; the hit area is 9px. */
.ag-ws-handle {
  position: relative;
  z-index: 5;
  width: 1px;
  background: var(--ag-divider);
  cursor: col-resize;
  touch-action: none;
  outline: none;
}

.ag-ws-handle::before {
  position: absolute;
  inset: 0 -4px;
  content: '';
}

.ag-ws-handle-line {
  position: absolute;
  inset: 0 -1px;
  background: transparent;
  transition: background-color 120ms ease;
}

.ag-ws-handle:hover .ag-ws-handle-line,
.ag-ws.is-dragging .ag-ws-handle-line {
  background: var(--ag-ring);
  transition-delay: 80ms;
}

.ag-ws-handle:focus-visible .ag-ws-handle-line {
  inset: 0 -1px;
  background: var(--ag-ring);
}

.ag-ws.is-dragging {
  cursor: col-resize;
  user-select: none;
}

.ag-ws.is-dragging :deep(iframe) {
  pointer-events: none;
}

/* Overlay: the pane covers part of the chat. */
.ag-ws.is-overlay .ag-ws-pane {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  width: min(100%, max(var(--ag-min-pane), 64%));
  border-left: 1px solid var(--ag-divider);
  box-shadow: var(--ag-shadow-pop);
  animation: ag-ws-slide 220ms var(--ag-ease);
}

.ag-ws-scrim {
  position: absolute;
  inset: 0;
  z-index: 29;
  background: var(--ag-scrim);
  animation: ag-ws-fade 160ms ease-out;
}

@keyframes ag-ws-slide {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
}

@keyframes ag-ws-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-ws.is-overlay .ag-ws-pane,
  .ag-ws-scrim {
    animation: none;
  }

  .ag-ws-handle-line {
    transition: none;
  }
}
</style>
