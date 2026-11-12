<script setup>
// A widget's expanded view, in a side panel on the board (board_frontend.md
// 6b, frame_board.md B7): a sheet that slides over the board from the
// right at every width, on a scrim, inside the board root and below the
// header. Widen lets it cover the board; on a phone it fills it. The layer
// is sticky at the top of the board's scroll container with no height, so
// the sheet covers what the container shows (--bd-view-h, set by the page)
// whatever the scroll. It is never a modal dialog: the reused pages open
// BaseModal dialogs (Add prompts, Schedule) that a focus trap would block.
// It renders inside .bd, so the board's surface tokens reach the page it
// shows.
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { Maximize2, Minimize2, Plus, X } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import { CARD_RETRY, IN_PANEL, useBoard } from '@/lib/board/context'
import { blockCode, panelTitle, widgetMeta } from '@/lib/board/widgets'
import { useAgentUiStore } from '@/stores/agentUi'
import { useBoardStore } from '@/stores/board'
import { WIDGET_COMPONENTS } from './widgetComponents'
import CardLoadError from './CardLoadError.vue'
import CardSkeleton from './CardSkeleton.vue'

const wide = defineModel('wide', { type: Boolean, default: false })

const props = defineProps({
  widgetKey: { type: String, required: true },
  websiteId: { type: String, required: true },
})

provide(IN_PANEL, true)

const route = useRoute()
const board = useBoard()
const store = useBoardStore()
const ui = useAgentUiStore()
const phone = useMediaQuery('(max-width: 767px)')
const layerEl = ref(null)
const titleEl = ref(null)
const bodyEl = ref(null)

const title = computed(() => panelTitle(props.widgetKey, route.query))
// The block's code, as under its card on the board.
const code = computed(() => blockCode(props.widgetKey))
const entry = computed(() => WIDGET_COMPONENTS[props.widgetKey] || null)
const panelProps = computed(() => entry.value?.panelProps || {})

// Add to board, while this widget is off the board (and the board is known).
const canAdd = computed(() => {
  const layout = store.layoutOf(props.websiteId)
  return Boolean(layout && layout.status !== 'loading' && !store.has(props.websiteId, props.widgetKey))
})

const attempt = ref(0)
const failed = ref(false)

const view = computed(() => {
  void attempt.value
  const loader = entry.value?.panel
  if (typeof loader !== 'function') return null
  return defineAsyncComponent({
    loader,
    loadingComponent: CardSkeleton,
    delay: 120,
    errorComponent: CardLoadError,
    timeout: 15000,
  })
})

function retry() {
  failed.value = false
  attempt.value += 1
}
provide(CARD_RETRY, retry)

onErrorCaptured(() => {
  failed.value = true
  return false
})

// A catalog key without a view has nothing to show.
watch(
  entry,
  (value) => {
    if (!value) board.close()
  },
  { immediate: true },
)

// The record a panel shows: a new one starts at the top like a new widget;
// a filter change keeps the place.
const record = computed(() => {
  const value = props.widgetKey === 'prompts' ? route.query.prompt : props.widgetKey === 'citations' ? route.query.url : ''
  return Array.isArray(value) ? value[0] || '' : value || ''
})

watch(
  () => [props.widgetKey, record.value, props.websiteId],
  (now, before) => {
    if (!before || now[0] !== before[0]) {
      failed.value = false
      ui.announce(`Opened ${title.value}.`)
    }
    if (bodyEl.value) bodyEl.value.scrollTop = 0
    nextTick(() => titleEl.value?.focus({ preventScroll: true }))
  },
  { immediate: true },
)

function addToBoard() {
  if (!store.add(props.websiteId, props.widgetKey)) return
  ui.announce(`Added ${widgetMeta(props.widgetKey)?.title || title.value} to your board.`)
  // The button goes away; keep focus in the panel.
  nextTick(() => titleEl.value?.focus({ preventScroll: true }))
}

function toggleWide() {
  wide.value = !wide.value
}

// Escape closes the panel from anywhere on the page: the sheet, the header
// above it (once its menu has closed), or nowhere. What lies over the page
// takes the key first: reka menus, popovers and dialogs close themselves, a
// page's own modal too, the header's phone sheet prevents it, and anything
// else teleported out of the app keeps it. A tooltip is a reka layer too,
// but only a hint: the one a menu's button shows when the menu gives focus
// back must not cost a second Escape.
function layerOpen() {
  if (document.querySelector('[aria-modal="true"]')) return true
  return [...document.querySelectorAll('[data-dismissable-layer]')].some((layer) => !layer.querySelector('[role="tooltip"]'))
}

// The app's root holds the frame, the board and this panel; layers are
// teleported beside it, to <body>.
function onPage(target) {
  if (!(target instanceof Node) || target === document.body || target === document.documentElement) return true
  let app = layerEl.value
  while (app?.parentElement && app.parentElement !== document.body) app = app.parentElement
  return !app || app.contains(target)
}

function onKeydown(event) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
  if (layerOpen() || !onPage(event.target)) return
  event.preventDefault()
  board.close()
}
// On the window, after the document's listeners (the phone sheet's).
useEventListener(window, 'keydown', onKeydown)
</script>

<template>
  <div ref="layerEl" class="bd-layer">
    <div class="bd-scrim" aria-hidden="true" @click="board.close()" />
    <aside
      class="bd-panel"
      :class="{ 'is-wide': wide && !phone, 'is-full': phone }"
      aria-labelledby="bd-panel-title"
    >
      <header class="bd-panel-head">
        <span v-if="code" class="bd-panel-code" aria-hidden="true">{{ code }}</span>
        <h2 id="bd-panel-title" ref="titleEl" class="bd-panel-title" tabindex="-1">{{ title }}</h2>
        <div class="bd-panel-actions">
          <AgButton v-if="canAdd" size="sm" :icon="Plus" @click="addToBoard">Add to board</AgButton>
          <AgIconButton
            v-if="!phone"
            :label="wide ? 'Narrow' : 'Widen'"
            :pressed="wide"
            :size="30"
            @click="toggleWide"
          >
            <Minimize2 v-if="wide" :size="16" aria-hidden="true" />
            <Maximize2 v-else :size="16" aria-hidden="true" />
          </AgIconButton>
          <AgIconButton :label="`Close ${title}`" :size="30" @click="board.close()">
            <X :size="16" aria-hidden="true" />
          </AgIconButton>
        </div>
      </header>
      <div ref="bodyEl" class="bd-panel-body">
        <CardLoadError v-if="failed || !view" :on-retry="retry" />
        <component
          :is="view"
          v-else
          v-bind="panelProps"
          :key="`${websiteId}|${widgetKey}|${attempt}`"
          :website-id="websiteId"
        />
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* Sticky at the top of the scroll container with no height: the scrim and
   the sheet below it cover what the container shows. While the board is
   locked, main pads its right side where its scrollbar gutter was
   (--bd-lock-gutter, set by the page), and the layer reaches over that too,
   so the sheet meets the window's edge. Under the header bar (z 30), whose
   phone menu hangs over the board. */
.bd-layer {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 0;
  margin-right: calc(-1 * var(--bd-lock-gutter, 0px));
}

.bd-scrim {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: var(--bd-view-h, 100dvh);
  background: var(--ag-scrim);
  animation: bd-scrim-in 160ms var(--ag-ease);
}

.bd-panel {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(var(--bd-sheet-w, 760px), 100%);
  min-width: 0;
  height: var(--bd-view-h, 100dvh);
  border-left: 1px solid var(--foreground);
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
  outline: none;
  animation: bd-panel-in 220ms var(--ag-ease);
}

.bd-panel.is-wide {
  width: 100%;
}

.bd-panel.is-full {
  width: 100%;
  border-left: 0;
}

@keyframes bd-panel-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
}

@keyframes bd-scrim-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bd-scrim,
  .bd-panel {
    animation: none;
  }
}

.bd-panel-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  height: 56px;
  padding: 0 12px 0 20px;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

/* The block's code, as in the line under its card. */
.bd-panel-code {
  flex: 0 0 auto;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: 0.05em;
}

.bd-panel-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Focus lands here only from script (tabindex -1), so a screen reader
     starts at the title. A ring around this full-width heading read as a
     text field, so it draws none, like the onboarding titles. */
  outline: none;
}

.bd-panel-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

/* Reused pages query this container (board_frontend.md 12). */
.bd-panel-body {
  flex: 1 1 auto;
  box-sizing: border-box;
  min-height: 0;
  padding: 16px 20px 40px;
  overflow-y: auto;
  overscroll-behavior: contain;
  container: bd-panel / inline-size;
  line-height: 1.6;
}

@media (max-width: 767px) {
  .bd-panel-head {
    padding: 0 8px 0 16px;
  }

  /* A phone's sheet keeps the room for the title. */
  .bd-panel-code {
    display: none;
  }

  .bd-panel-body {
    padding: 12px 16px 32px;
  }
}
</style>

<!-- Unscoped on purpose: the pages shown here were built for the page
     area, whose links wear the app's ink (AppShell); the agent base layer
     would make them inherit. :where() keeps a page's own classes winning. -->
<style>
:where(.bd-panel-body) a {
  color: var(--text-primary);
  font-weight: 500;
}

:where(.bd-panel-body) a:hover {
  opacity: 0.7;
}
</style>
