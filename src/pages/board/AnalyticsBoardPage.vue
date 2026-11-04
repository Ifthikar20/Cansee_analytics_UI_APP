<script setup>
// The Analytics board (board_contract.md 1, 2 and 9): one page of widgets
// in the workspace shell, on the agent's surface, like the chat. The layout
// is the user's (stores/board.js); `+ Add widget` and a panel's Add to
// board are the only ways a widget goes on. ?widget=<key> opens that
// widget's expanded view in the side panel and never touches the layout;
// every other query key belongs to the open panel.
//
// The page titles itself (its route has no meta.title) and provides the
// board context (lib/board/context.js) to every card and panel.
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { MoreHorizontal, Plus, RotateCcw } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgPageHeader from '@/components/agent/common/AgPageHeader.vue'
import BoardGrid from '@/components/board/BoardGrid.vue'
import BoardPanel from '@/components/board/BoardPanel.vue'
import BoardSaveState from '@/components/board/BoardSaveState.vue'
import WidgetCatalog from '@/components/board/WidgetCatalog.vue'
import { invalidate, revalidate } from '@/composables/board/useBoardSource'
import { BOARD_CONTEXT } from '@/lib/board/context'
import { DEFAULT_LAYOUT, panelTitle, widgetMeta } from '@/lib/board/widgets'
import { useAppStore } from '@/stores/app'
import { useBoardStore } from '@/stores/board'

// The panel docks beside a board this wide; below it, it lies over it.
const DOCK_MIN_PX = 1100
const WIDE_KEY = 'cs-board-panel-wide'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const store = useBoardStore()

const rootEl = ref(null)
const scrollEl = ref(null)
const catalogOpen = ref(false)
const resetOpen = ref(false)

/* ── Layout ── */

const layout = computed(() => store.layoutOf(props.websiteId))
// Until the layout is known the board shows skeletons and asks for no data.
const layoutLoading = computed(() => !layout.value || layout.value.status === 'loading')
const widgets = computed(() => layout.value?.widgets || DEFAULT_LAYOUT)

watch(
  () => props.websiteId,
  (wid, before) => {
    store.load(wid)
    if (before !== undefined) {
      nextTick(() => {
        if (scrollEl.value) scrollEl.value.scrollTop = 0
      })
    }
  },
  { immediate: true },
)

/* ── The side panel ── */

const panelKey = computed(() => {
  if (route.name !== 'analytics') return null
  const raw = route.query.widget
  const key = Array.isArray(raw) ? raw[0] : raw
  return typeof key === 'string' && widgetMeta(key) ? key : null
})

// An unknown widget leaves the address; the board stays as it is.
watch(
  () => route.query.widget,
  (raw) => {
    if (route.name !== 'analytics' || raw === undefined) return
    const key = Array.isArray(raw) ? raw[0] : raw
    if (typeof key === 'string' && widgetMeta(key)) return
    const query = { ...route.query }
    delete query.widget
    router.replace({ query, hash: route.hash }).catch(() => {})
  },
  { immediate: true },
)

const phone = useMediaQuery('(max-width: 767px)')
const boardWidth = ref(0)
let observer = null
onMounted(() => {
  const el = rootEl.value
  if (!el) return
  boardWidth.value = el.clientWidth || 0
  if (typeof ResizeObserver !== 'function') return
  observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width
    if (typeof width === 'number') boardWidth.value = width
  })
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

const panelMode = computed(() => (!phone.value && boardWidth.value >= DOCK_MIN_PX ? 'docked' : 'sheet'))
const docked = computed(() => Boolean(panelKey.value) && panelMode.value === 'docked')

function readWide() {
  try {
    return localStorage.getItem(WIDE_KEY) === '1'
  } catch {
    return false
  }
}
const wide = ref(readWide())
watch(wide, (value) => {
  try {
    localStorage.setItem(WIDE_KEY, value ? '1' : '0')
  } catch {}
})

// The board under a sheet, or under a widened panel, is out of reach.
const covered = computed(() => Boolean(panelKey.value) && (!docked.value || wide.value))

let opener = null
let restoreOnClose = true

/**
 * Open `key`'s panel with the panel's own query keys. From the board this
 * adds one history entry (state bdPanel); from an open panel it replaces
 * the entry, keeping that state. The layout never changes.
 */
function open(key, query = {}) {
  if (!widgetMeta(key)) return Promise.resolve()
  const location = { query: { ...(query || {}), widget: key } }
  if (panelKey.value) return router.replace(location).catch(() => {})
  const active = document.activeElement
  opener = active instanceof HTMLElement && active !== document.body ? active : null
  return router.push({ ...location, state: { bdPanel: true } }).catch(() => {})
}

/**
 * Close the panel: back to the entry before it when the board opened it,
 * else the same address without the panel's keys. Focus returns to what
 * opened it, else the widget's card, else Add widget.
 */
function close({ restoreFocus = true } = {}) {
  if (!panelKey.value) return
  restoreOnClose = restoreFocus
  if (router.options.history.state?.bdPanel) router.back()
  else router.replace({ query: {} }).catch(() => {})
}

watch(panelKey, (now, before) => {
  if (!before || now || route.name !== 'analytics') return
  revalidate(props.websiteId)
  const restore = restoreOnClose
  restoreOnClose = true
  const from = opener
  opener = null
  if (!restore) return
  nextTick(() => {
    const root = rootEl.value
    if (!root) return
    const target =
      (from?.isConnected && root.contains(from) ? from : null) ||
      root.querySelector(`.bd-cell[data-widget="${before}"] .bd-card-open`) ||
      root.querySelector('[data-bd-add]')
    target?.focus()
  })
})

provide(BOARD_CONTEXT, {
  websiteId: computed(() => props.websiteId),
  open,
  close,
  invalidate: (sourceKey) => invalidate(props.websiteId, sourceKey),
  revalidate: () => revalidate(props.websiteId),
})

/* ── Header actions ── */

// Menus and dialogs give focus back to their trigger once they close (in
// a timeout); this runs after that.
function afterFocusSettles(fn) {
  nextTick(() => setTimeout(fn, 0))
}

function focusCard(key) {
  afterFocusSettles(() => {
    const el = rootEl.value?.querySelector(`.bd-cell[data-widget="${key}"] .bd-card-open`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    el.focus({ preventScroll: true })
  })
}

// Reset board opens its confirmation once the menu has closed, from the
// menu button, so the dialog gives focus back there.
let resetAsked = false
function askReset() {
  resetAsked = true
}
function onBoardMenuClosed(event) {
  if (!resetAsked) return
  resetAsked = false
  event.preventDefault()
  rootEl.value?.querySelector('[data-bd-options]')?.focus()
  resetOpen.value = true
}

function confirmReset() {
  resetOpen.value = false
  store.reset(props.websiteId)
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
  })
}

/* ── Document title ── */

const projectName = computed(
  () => app.websites.find((w) => String(w.id) === String(props.websiteId))?.name || '',
)
const documentTitle = computed(() =>
  [panelKey.value ? panelTitle(panelKey.value, route.query) : '', 'Analytics', projectName.value, 'Cansee']
    .filter(Boolean)
    .join(' — '),
)
watch(
  documentTitle,
  (value) => {
    if (route.name === 'analytics') document.title = value
  },
  { immediate: true },
)
</script>

<template>
  <div ref="rootEl" class="bd bd-surface" :class="{ 'has-docked': docked, 'is-wide': docked && wide }">
    <section class="bd-main" aria-labelledby="bd-title" :inert="covered ? true : undefined">
      <AgPageHeader title="Analytics" title-id="bd-title">
        <template #actions>
          <BoardSaveState class="bd-save-head" :website-id="websiteId" />
          <AgButton
            class="bd-add"
            data-bd-add
            :icon="Plus"
            aria-label="Add widget"
            :disabled="layoutLoading"
            @click="catalogOpen = true"
          >
            Add widget
          </AgButton>
          <DropdownMenuRoot :modal="false">
            <DropdownMenuTrigger as-child>
              <AgIconButton label="Board options" data-bd-options :size="32">
                <MoreHorizontal :size="16" aria-hidden="true" />
              </AgIconButton>
            </DropdownMenuTrigger>
            <AgMenuContent align="end" :width="200" @close-auto-focus="onBoardMenuClosed">
              <AgMenuItem :disabled="layoutLoading" @select="askReset">
                <RotateCcw aria-hidden="true" />
                <span class="ag-menu-text">Reset board</span>
              </AgMenuItem>
            </AgMenuContent>
          </DropdownMenuRoot>
        </template>
      </AgPageHeader>
      <BoardSaveState class="bd-save-row" failures-only :website-id="websiteId" />

      <div ref="scrollEl" class="bd-scroll">
        <div class="bd-body">
          <AgEmptyState
            v-if="!layoutLoading && !widgets.length"
            class="bd-empty"
            title="Your board is empty."
            body="Add a widget to start."
          >
            <AgButton :icon="Plus" @click="catalogOpen = true">Add widget</AgButton>
          </AgEmptyState>
          <!-- Keyed by project: another project's cards mount fresh. -->
          <BoardGrid v-else :key="websiteId" :widgets="widgets" :pending="layoutLoading" />
        </div>
      </div>
    </section>

    <BoardPanel
      v-if="panelKey"
      v-model:wide="wide"
      :widget-key="panelKey"
      :website-id="websiteId"
      :mode="panelMode"
    />

    <WidgetCatalog v-model:open="catalogOpen" :website-id="websiteId" @done="focusCard" />
    <AgConfirmDialog
      v-model:open="resetOpen"
      title="Reset this board?"
      description="Your board goes back to Summary, Prompts, Countries and Traffic. Widgets you added are removed; their data is not touched."
      confirm-label="Reset board"
      destructive
      @confirm="confirmReset"
    />
  </div>
</template>

<style scoped>
/* The agent surface for everything on the board, the panel included:
   charts and the reused pages paint these tokens. Teleported dialogs keep
   the app's own. */
.bd-surface {
  --background: var(--ag-pane-bg);
  --card: var(--ag-pane-bg);
  --viz-surface: var(--ag-pane-bg);
  --border: var(--ag-card-border);
  font-family: var(--ag-font);
  font-feature-settings: var(--ag-font-features);
}

.bd {
  --bd-panel-w: clamp(480px, 48%, 760px);
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.bd.has-docked {
  grid-template-columns: minmax(0, 1fr) var(--bd-panel-w);
}

.bd.has-docked.is-wide {
  grid-template-columns: 0 minmax(0, 1fr);
}

.bd.has-docked.is-wide .bd-main {
  visibility: hidden;
}

.bd-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  container: bd-main / inline-size;
}

.bd-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.bd-body {
  box-sizing: border-box;
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px 24px 48px;
  container: board / inline-size;
}

.bd-empty {
  margin-top: 16px;
}

/* The save state sits in the header; on a narrow board its long failure
   lines take a row of their own under it. */
.bd-save-row {
  display: none;
}

@container bd-main (max-width: 639px) {
  .bd-save-head :deep(.bd-save-failure) {
    display: none;
  }

  .bd-save-row {
    display: flex;
  }

  .bd-save-row:not(:empty) {
    padding: 0 16px 8px;
  }
}

@media (max-width: 767px) {
  .bd-body {
    padding: 8px 16px 32px;
  }
}

@media (max-width: 479px) {
  .bd-add {
    width: 32px;
    padding: 0;
  }

  .bd-add :deep(.ag-button-text) {
    display: none;
  }
}
</style>
