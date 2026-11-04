<script setup>
// A widget's expanded view, in a side panel on the board (board_frontend.md
// 6b). Docked (a column beside the board, which Widen lets cover it) on a
// board of 1100px or more; below that the same aside lies over the board on
// a scrim, and on a phone it fills the screen. It is never a modal dialog:
// the reused pages open BaseModal dialogs (Add prompts, Schedule) that a
// focus trap would block. It renders inside .bd in every mode, so the
// board's surface tokens reach the page it shows.
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { Maximize2, Minimize2, Plus, X } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import { CARD_RETRY, IN_PANEL, useBoard } from '@/lib/board/context'
import { panelTitle, widgetMeta } from '@/lib/board/widgets'
import { useAgentUiStore } from '@/stores/agentUi'
import { useBoardStore } from '@/stores/board'
import { WIDGET_COMPONENTS } from './widgetComponents'
import CardLoadError from './CardLoadError.vue'
import CardSkeleton from './CardSkeleton.vue'

const wide = defineModel('wide', { type: Boolean, default: false })

const props = defineProps({
  widgetKey: { type: String, required: true },
  websiteId: { type: String, required: true },
  // 'docked' | 'sheet'
  mode: { type: String, default: 'sheet' },
})

provide(IN_PANEL, true)

const route = useRoute()
const board = useBoard()
const store = useBoardStore()
const ui = useAgentUiStore()
const phone = useMediaQuery('(max-width: 767px)')
const titleEl = ref(null)
const bodyEl = ref(null)

const docked = computed(() => props.mode === 'docked' && !phone.value)
const title = computed(() => panelTitle(props.widgetKey, route.query))
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

// Reka menus and popovers close themselves on Escape.
function layerOpen() {
  return Boolean(document.querySelector('[data-dismissable-layer]'))
}

function onKeydown(event) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
  if (layerOpen()) return
  event.preventDefault()
  board.close()
}
</script>

<template>
  <div v-if="!docked" class="bd-scrim" aria-hidden="true" @click="board.close()" />
  <aside
    class="bd-panel"
    :class="[docked ? 'is-docked' : 'is-sheet', { 'is-full': phone }]"
    aria-labelledby="bd-panel-title"
    @keydown="onKeydown"
  >
    <header class="bd-panel-head">
      <h2 id="bd-panel-title" ref="titleEl" class="bd-panel-title" tabindex="-1">{{ title }}</h2>
      <div class="bd-panel-actions">
        <AgButton v-if="canAdd" size="sm" :icon="Plus" @click="addToBoard">Add to board</AgButton>
        <AgIconButton
          v-if="docked"
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
</template>

<style scoped>
.bd-scrim {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--ag-scrim);
}

.bd-panel {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  height: 100%;
  min-height: 0;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
  outline: none;
}

.bd-panel.is-docked {
  border-left: 1px solid var(--ag-divider);
}

.bd-panel.is-sheet {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 21;
  width: min(760px, 100%);
  border-left: 1px solid var(--ag-divider);
  box-shadow: var(--ag-shadow-pop);
}

.bd-panel.is-sheet.is-full {
  width: 100%;
  border-left: 0;
  box-shadow: none;
}

.bd-panel-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 48px;
  padding: 0 12px 0 20px;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

.bd-panel-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
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

  .bd-panel-body {
    padding: 12px 16px 32px;
  }
}
</style>

<!-- Unscoped on purpose: the pages shown here were built for the page
     area, whose links wear the app's ink (AgentShell); the agent base layer
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
