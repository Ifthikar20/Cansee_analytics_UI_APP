<script setup>
// The Analytics board (board_contract.md 1, 2 and 9; frame_board.md B1): one
// page of widgets, a full page under the header on the agent's surface. The
// frame's <main id="app-main"> scrolls it; its toolbar sticks to the top of
// main. The layout is the user's (stores/board.js); `+ Add widget` and a
// panel's Add to board are the only ways a widget goes on, and cards move by
// drag and drop or their menu. ?widget=<key> opens that widget's expanded
// view in the side panel and never touches the layout; every other query
// key belongs to the open panel.
//
// The page titles itself (its route has no meta.title) and provides the
// board context (lib/board/context.js) to every card and panel.
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScroll } from '@vueuse/core'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { MoreHorizontal, Plus, RotateCcw } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import HintCallout from '@/components/ui/help/HintCallout.vue'
import BoardGrid from '@/components/board/BoardGrid.vue'
import BoardPanel from '@/components/board/BoardPanel.vue'
import BoardSaveState from '@/components/board/BoardSaveState.vue'
import WidgetCatalog from '@/components/board/WidgetCatalog.vue'
import { invalidate, revalidate } from '@/composables/board/useBoardSource'
import { useScrollParent } from '@/composables/board/useScrollParent'
import { BOARD_CONTEXT } from '@/lib/board/context'
import { DEFAULT_LAYOUT, panelTitle, widgetMeta } from '@/lib/board/widgets'
import { useAppStore } from '@/stores/app'
import { useBoardStore } from '@/stores/board'
import { useHintsStore } from '@/stores/hints'
import { TIPS } from '@/lib/help/tips'

const WIDE_KEY = 'cs-board-panel-wide'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const store = useBoardStore()

const rootEl = ref(null)
const catalogOpen = ref(false)
const resetOpen = ref(false)

/* ── Layout ── */

const layout = computed(() => store.layoutOf(props.websiteId))
// Until the layout is known the board shows skeletons and asks for no data.
const layoutLoading = computed(() => !layout.value || layout.value.status === 'loading')
const widgets = computed(() => layout.value?.widgets || DEFAULT_LAYOUT)

// Another project mounts a new page, which the frame starts at the top.
watch(
  () => props.websiteId,
  (wid) => store.load(wid),
  { immediate: true },
)

/* ── The scroll container (the frame's main) ── */

const { el: scrollParent, height: viewHeight } = useScrollParent(rootEl)
// The document's own scroller sends its scroll events to the window.
const scrollTarget = () => {
  const el = scrollParent.value
  return el && (el === document.scrollingElement || el === document.documentElement) ? window : el
}
const { y: scrollY } = useScroll(scrollTarget)
// A rule under the toolbar once the board scrolls under it.
const stuck = computed(() => scrollY.value > 0)
// Main's scrollbar gutter while the panel holds it (lockScroll).
const lockGutter = ref(0)
// The panel's scrim and sheet cover what main shows, its gutter included.
const rootStyle = computed(() => {
  const style = {}
  if (viewHeight.value > 0) style['--bd-view-h'] = `${viewHeight.value}px`
  if (lockGutter.value > 0) style['--bd-lock-gutter'] = `${lockGutter.value}px`
  return Object.keys(style).length ? style : undefined
})

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

// The board under the sheet is out of reach (and cannot be dragged).
const covered = computed(() => Boolean(panelKey.value))

// Nor does it scroll: the wheel, a touch or the keys on the sheet would move
// it. A script still scrolls a hidden overflow (a row the sheet brings into
// view, a focus), so main is put back at its place each time it moves, and
// on close. The inline values found go back when the panel closes and when
// the page unmounts; the frame never writes them.
//
// Hidden, main still keeps its scrollbar gutter (scrollbar-gutter: stable):
// an empty strip at the window's edge, beside the sheet and outside the box
// the layer covers. So while locked main trades it for as much padding,
// which the layer reaches over (--bd-lock-gutter): the board keeps its
// width, and the sheet meets the window's edge.
let locked = null
const putBack = (el, top) => {
  if (Math.abs(el.scrollTop - top) >= 1) el.scrollTop = top
}
// The gutter's width: main's inner width less the board root's, which fills
// main's content box as its child. Rects keep the fraction a zoomed page
// gives it.
function gutterOf(el, css) {
  const root = rootEl.value
  if (!root || root.parentElement !== el) return 0
  const edges = ['borderLeftWidth', 'borderRightWidth', 'paddingLeft', 'paddingRight']
    .reduce((sum, side) => sum + (parseFloat(css[side]) || 0), 0)
  const gutter = el.getBoundingClientRect().width - edges - root.getBoundingClientRect().width
  return gutter > 0 ? Math.round(gutter * 100) / 100 : 0
}
function lockScroll(el, top) {
  if (locked?.el === el) return
  unlockScroll()
  if (!el) return
  const hold = () => putBack(el, top)
  const { overflowY, scrollbarGutter, paddingRight } = el.style
  const css = getComputedStyle(el)
  const gutter = gutterOf(el, css)
  const padding = parseFloat(css.paddingRight) || 0
  locked = { el, style: { overflowY, scrollbarGutter, paddingRight }, top, hold }
  el.style.overflowY = 'hidden'
  if (gutter) {
    el.style.scrollbarGutter = 'auto'
    el.style.paddingRight = `${padding + gutter}px`
  }
  lockGutter.value = gutter
  el.addEventListener('scroll', hold, { passive: true })
}
// Leaving the page leaves main's place to the frame, which places the next one.
function unlockScroll({ keepPlace = true } = {}) {
  const lock = locked
  if (!lock) return
  locked = null
  lock.el.removeEventListener('scroll', lock.hold)
  if (keepPlace) putBack(lock.el, lock.top)
  Object.assign(lock.el.style, lock.style)
  lockGutter.value = 0
}
// A deep link with ?widget= locks once the container is known, on mount. Its
// place is the top, where the frame starts a new page: the frame does so just
// after the mount, so main may still show the last page's place.
watch(
  [scrollParent, covered],
  ([el, open], [known] = []) => (open ? lockScroll(el, known ? el?.scrollTop : 0) : unlockScroll()),
  { immediate: true },
)
onBeforeUnmount(() => unlockScroll({ keepPlace: false }))

// No first-visit hint over the side panel, the catalog or the reset dialog.
const hints = useHintsStore()
watch(
  () => covered.value || catalogOpen.value || resetOpen.value,
  (on) => hints.suspend('board', on),
  { immediate: true },
)
onBeforeUnmount(() => hints.suspend('board', false))

let opener = null
let restoreOnClose = true

// What has focus on the board itself (a card's title, a row, a map mark),
// or null: focus inside the panel, or nowhere.
function boardFocus() {
  const active = document.activeElement
  const main = rootEl.value?.querySelector('.bd-main')
  return active instanceof Element && typeof active.focus === 'function' && main?.contains(active) ? active : null
}

/**
 * Open `key`'s panel with the panel's own query keys. From the board this
 * adds one history entry (state bdPanel); from an open panel it replaces
 * the entry, keeping that state. The layout never changes. Close gives
 * focus back to what opened the panel from the board.
 */
function open(key, query = {}) {
  if (!widgetMeta(key)) return Promise.resolve()
  const location = { query: { ...(query || {}), widget: key } }
  if (panelKey.value) return router.replace(location).catch(() => {})
  opener = boardFocus()
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
    if (scrollParent.value) scrollParent.value.scrollTop = 0
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
  <div ref="rootEl" class="bd bd-surface" :style="rootStyle">
    <!-- First, so the sticky layer's own place is the top of the board. -->
    <BoardPanel v-if="panelKey" v-model:wide="wide" :widget-key="panelKey" :website-id="websiteId" />

    <section class="bd-main" aria-labelledby="bd-title" :inert="covered ? true : undefined">
      <div class="bd-top" :class="{ 'is-stuck': stuck }" data-bd-sticky>
        <header class="bd-bar">
          <h1 id="bd-title" class="bd-title">Analytics</h1>
          <div class="bd-bar-actions">
            <BoardSaveState class="bd-save-head" :website-id="websiteId" />
            <HintCallout hint="board.add-widget" :when="!layoutLoading" align="end">
              <AgTooltip :text="TIPS.board.addWidget">
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
              </AgTooltip>
            </HintCallout>
            <DropdownMenuRoot :modal="false">
              <DropdownMenuTrigger as-child>
                <AgIconButton label="Board options" :tooltip="TIPS.board.options" data-bd-options :size="32">
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
          </div>
        </header>
        <BoardSaveState class="bd-save-row" failures-only :website-id="websiteId" />
      </div>

      <div class="bd-body">
        <AgEmptyState
          v-if="!layoutLoading && !widgets.length"
          class="bd-empty"
          title="Your board is empty."
          :body="TIPS.board.emptyBody"
        >
          <AgButton :icon="Plus" @click="catalogOpen = true">Add widget</AgButton>
        </AgEmptyState>
        <!-- Keyed by project: another project's cards mount fresh. -->
        <BoardGrid v-else :key="websiteId" :widgets="widgets" :pending="layoutLoading" />
      </div>
    </section>

    <WidgetCatalog v-model:open="catalogOpen" :website-id="websiteId" @done="focusCard" />
    <AgConfirmDialog
      v-model:open="resetOpen"
      title="Reset this board?"
      description="Your board goes back to Ask AI and Prompt ranking. Widgets you added are removed; their data is not touched."
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

/* The page fills main, which scrolls it. The gutter is the header bar's own
   side padding, so the board's left edge lines up with the logo; on a very
   wide screen the content stops at 1600px and is centred. */
.bd {
  --bd-gutter: var(--app-gutter, 24px);
  --bd-max: 1600px;
  --bd-sheet-w: clamp(560px, 60%, 960px);
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 100%;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.bd-main {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  min-width: 0;
  container: bd-main / inline-size;
}

/* The toolbar sticks to the top of main, above the cards (a lifted card's
   cell is z 5) and under the panel layer (20). */
.bd-top {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--ag-pane-bg);
}

.bd-top.is-stuck {
  box-shadow: 0 1px 0 var(--ag-divider-subtle);
}

.bd-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: content-box;
  height: 48px;
  max-width: var(--bd-max);
  margin: 0 auto;
  padding: 0 var(--bd-gutter);
}

.bd-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bd-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* A flex item with auto side margins does not stretch, so the body takes
   the full width itself; its content box is the board container. */
.bd-body {
  box-sizing: border-box;
  width: 100%;
  max-width: calc(var(--bd-max) + 2 * var(--bd-gutter));
  margin: 0 auto;
  padding: 8px var(--bd-gutter) 64px;
  container: board / inline-size;
}

.bd-empty {
  max-width: 560px;
  margin: 48px auto 0;
}

/* The save state sits in the toolbar; on a narrow board its long failure
   lines take a row of their own under it, inside the sticky block. */
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
    padding: 0 var(--bd-gutter) 8px;
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
