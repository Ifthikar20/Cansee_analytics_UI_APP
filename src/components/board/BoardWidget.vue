<script setup>
// One card on the board (board_frontend.md 4): the title (it opens the
// widget's side panel), the one-liner, the grip that moves the card
// (frame_board.md B3a: drag it, or Space and the arrow keys on it; with a
// mouse the whole header drags too), the options menu, and the widget's
// compact card, loaded on demand. A card that fails to load or to render
// says so and can be loaded again; the rest of the board is untouched. A
// move never remounts the card: it stays keyed by its widget.
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, provide, ref, toValue } from 'vue'
import { useRoute } from 'vue-router'
import { GripVertical } from '@lucide/vue'
import { useBoardDragItem } from '@/composables/board/useBoardDrag'
import { CARD_RETRY, useBoard } from '@/lib/board/context'
import { SIZE_WORDS, widgetMeta } from '@/lib/board/widgets'
import { useAgentUiStore } from '@/stores/agentUi'
import { useBoardStore } from '@/stores/board'
import { WIDGET_COMPONENTS } from './widgetComponents'
import CardLoadError from './CardLoadError.vue'
import CardSkeleton from './CardSkeleton.vue'
import WidgetMenu from './WidgetMenu.vue'

const props = defineProps({
  // {key, size}
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  count: { type: Number, required: true },
  // The layout is not known yet: a skeleton, and no data requests.
  pending: { type: Boolean, default: false },
})

const board = useBoard()
const store = useBoardStore()
const ui = useAgentUiStore()
const route = useRoute()
const cellEl = ref(null)
// The key alone: a save's answer hands the card a new {key, size} object,
// and a card definition built from that object would remount the card.
const widgetKey = computed(() => props.item.key)
const { grip, head, canMove, lifted, held, slot } = useBoardDragItem(widgetKey)

const meta = computed(() => widgetMeta(widgetKey.value))
const title = computed(() => meta.value?.title || widgetKey.value)
const titleId = computed(() => `bd-card-${widgetKey.value}`)
const wid = computed(() => toValue(board.websiteId))

// Bumped by Try again: a fresh definition loads the card's code again (a
// failed async component keeps its failure), and the new key remounts it.
const attempt = ref(0)
const failed = ref(false)

const card = computed(() => {
  void attempt.value
  const loader = WIDGET_COMPONENTS[widgetKey.value]?.card
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

// A card that throws while loading or rendering: this card shows the
// failure, and the error stops here.
onErrorCaptured(() => {
  failed.value = true
  return false
})

const trigger = () => cellEl.value?.querySelector('.bd-card-menu')

function expand(fromMenu) {
  // From the menu, the panel's Close returns to the menu button.
  if (fromMenu) trigger()?.focus()
  board.open(props.item.key)
}

function move(step) {
  const key = props.item.key
  if (!store.move(wid.value, key, step)) return
  const widgets = store.layoutOf(wid.value)?.widgets || []
  const at = widgets.findIndex((w) => w.key === key) + 1
  ui.announce(`Moved ${title.value} ${step < 0 ? 'up' : 'down'}. Now ${at} of ${widgets.length}.`)
  nextTick(() => trigger()?.focus())
}

function resize(size) {
  const key = props.item.key
  if (!store.resize(wid.value, key, size)) return
  const now = store.layoutOf(wid.value)?.widgets.find((w) => w.key === key)?.size || size
  ui.announce(`${title.value} is now ${SIZE_WORDS[now] || now}.`)
  nextTick(() => trigger()?.focus())
}

function remove() {
  const key = props.item.key
  const widgets = store.layoutOf(wid.value)?.widgets || []
  const at = widgets.findIndex((w) => w.key === key)
  const neighbour = widgets[at + 1] || widgets[at - 1] || null
  const root = cellEl.value?.closest('.bd') || document
  const panelOpen = route.query.widget === key
  if (!store.remove(wid.value, key)) return
  ui.announce(`Removed ${title.value} from your board.`)
  if (panelOpen) board.close({ restoreFocus: false })
  // This card is gone once the list re-renders: the next card's title, else
  // the previous one's, else Add widget.
  nextTick(() => {
    const target = neighbour
      ? root.querySelector(`.bd-cell[data-widget="${neighbour.key}"] .bd-card-open`)
      : root.querySelector('[data-bd-add]')
    target?.focus()
  })
}
</script>

<template>
  <li
    ref="cellEl"
    class="bd-cell"
    :class="[`is-${item.size}`, { 'is-slot': slot, 'is-held': held }]"
    :data-widget="item.key"
  >
    <section
      class="bd-card"
      :class="{ 'is-lifted': lifted }"
      :aria-labelledby="titleId"
      :aria-busy="pending ? 'true' : undefined"
    >
      <header class="bd-card-head" :class="{ 'is-movable': canMove }" v-on="head">
        <div class="bd-card-heading">
          <h2 :id="titleId" class="bd-card-title">
            <button type="button" class="bd-card-open" @click="expand(false)">{{ title }}</button>
          </h2>
          <p v-if="meta?.description" class="bd-card-desc">{{ meta.description }}</p>
        </div>
        <button
          v-if="canMove"
          type="button"
          class="bd-card-grip"
          :aria-label="`Move ${title}`"
          aria-describedby="bd-move-help"
          v-on="grip"
        >
          <GripVertical :size="16" aria-hidden="true" />
        </button>
        <WidgetMenu
          v-if="!pending"
          :title="title"
          :index="index"
          :count="count"
          :size="item.size"
          :sizes="meta?.sizes || []"
          @expand="expand(true)"
          @move="move"
          @resize="resize"
          @remove="remove"
        />
      </header>
      <div class="bd-card-body">
        <CardSkeleton v-if="pending" />
        <CardLoadError v-else-if="failed || !card" :on-retry="retry" />
        <component :is="card" v-else :key="attempt" :website-id="wid" :size="item.size" />
      </div>
    </section>
  </li>
</template>

<style scoped>
/* No dense packing: DOM, visual and tab order are the user's order. */
.bd-cell {
  position: relative;
  min-width: 0;
}

/* A card that moves glides to its new place (BoardGrid's move class). */
.bd-move {
  transition: transform 200ms var(--ag-ease);
}

/* The lifted card's cell stays in the grid as its slot, and a held card's
   cell keeps its place: both above the other cards, under the toolbar. */
.bd-cell.is-slot,
.bd-cell.is-held {
  z-index: 5;
}

.bd-cell.is-slot::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  box-sizing: border-box;
  border: 1px dashed var(--ag-fg-4);
  border-radius: 12px;
  background: var(--ag-ghost-hover);
  content: '';
}

.bd-cell.is-third {
  grid-column: span 4;
}

.bd-cell.is-half {
  grid-column: span 6;
}

.bd-cell.is-full {
  grid-column: span 12;
}

@container board (max-width: 1039px) {
  .bd-cell.is-third {
    grid-column: span 6;
  }
}

@container board (max-width: 639px) {
  .bd-cell,
  .bd-cell.is-third,
  .bd-cell.is-half,
  .bd-cell.is-full {
    grid-column: 1 / -1;
  }
}

/* Card layouts query the card's own width (bd-card), not its size word, so
   a full-width card on a one-column board still fits. */
.bd-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: var(--ag-pane-bg);
  container: bd-card / inline-size;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

/* Floating under the pointer at its size at the lift (the width, height
   and transform are written inline while it moves). */
.bd-card.is-lifted {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  overflow: hidden;
  border-color: var(--ag-fg-4);
  box-shadow: var(--ag-shadow-pop);
}

.bd-cell.is-held .bd-card {
  border-color: var(--ag-ring);
  box-shadow: var(--ag-shadow-pop);
}

.bd-card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

/* With a mouse or pen the whole header drags; the title still opens. */
.bd-card-head.is-movable {
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
}

.bd-card-heading {
  flex: 1 1 auto;
  min-width: 0;
}

.bd-card-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.bd-card-open {
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  /* Focus and reveals keep it clear of the sticky toolbar. */
  scroll-margin-top: 64px;
}

.bd-card-open:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.bd-card-open:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.bd-card-desc {
  margin: 2px 0 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.bd-card-head :deep(.bd-card-menu) {
  margin: -4px -6px 0 0;
}

/* The grip, styled as the muted ghost AgIconButton beside it. It keeps its
   space while hidden, so the title never shifts. */
.bd-card-grip {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  margin: -4px -4px 0 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-4);
  line-height: 0;
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  scroll-margin-top: 64px;
  transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease;
}

.bd-card-grip:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.bd-card-grip:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

/* On devices that hover it shows with the card's hover or focus; on touch
   it is always there. */
@media (hover: hover) {
  .bd-card-grip {
    opacity: 0;
  }

  .bd-card:hover .bd-card-grip,
  .bd-card:focus-within .bd-card-grip,
  .bd-card-grip:focus-visible,
  .bd-card.is-lifted .bd-card-grip,
  .bd-cell.is-held .bd-card-grip {
    opacity: 1;
  }
}

@media (pointer: coarse) {
  .bd-card-grip {
    width: 36px;
    height: 36px;
    margin-top: -8px;
  }
}

.bd-card-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  /* transition: none on a cell belongs here only: TransitionGroup reads the
     first cell's move transition, so one anywhere else would stop every
     move while that cell comes first. */
  .bd-move {
    transition: none;
  }

  .bd-card,
  .bd-card-grip {
    transition: none;
  }
}
</style>
