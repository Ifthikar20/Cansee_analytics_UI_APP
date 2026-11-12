<script setup>
// One card on the board (board_frontend.md 4) and the line under it.
//
// The card is a flat surface in its block's tone (ink or light, from the
// catalog): a chip in the corner that says what the body shows (Live only
// when the card reports fresh numbers; see useCardStatus), the title (it
// opens the block's side panel) and the block's compact card, loaded on
// demand. Under the card, outside it: the block's code and caption, the
// grip that moves the card (frame_board.md B3a: drag it, or Space and the
// arrow keys on it; with a mouse the card's header drags too) and the
// options menu.
//
// A card that fails to load or to render says so and can be loaded again;
// the rest of the board is untouched. A move never remounts the card: it
// stays keyed by its widget.
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, provide, ref, toValue } from 'vue'
import { useRoute } from 'vue-router'
import { GripVertical } from '@lucide/vue'
import { useBoardDragItem } from '@/composables/board/useBoardDrag'
import { CARD_RETRY, CARD_STATUS, useBoard } from '@/lib/board/context'
import { CARD_STATUSES, statusChip } from '@/lib/board/frame'
import { SIZE_WORDS, blockCode, widgetMeta } from '@/lib/board/widgets'
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
const code = computed(() => blockCode(widgetKey.value))
const ink = computed(() => meta.value?.tone === 'ink')

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

// What the card says its body shows; null until it says so.
const reported = ref(null)
provide(CARD_STATUS, (status) => {
  reported.value = CARD_STATUSES.includes(status) ? status : null
})

function retry() {
  failed.value = false
  reported.value = null
  attempt.value += 1
}
provide(CARD_RETRY, retry)

// A card that throws while loading or rendering: this card shows the
// failure, and the error stops here.
onErrorCaptured(() => {
  failed.value = true
  return false
})

// The chip never claims more than the frame knows: a layout still loading
// is loading, a card that could not load is an error, and otherwise it is
// what the card reports (no chip until it does).
const status = computed(() => {
  if (props.pending) return 'loading'
  if (failed.value || !card.value) return 'error'
  return reported.value
})
const chip = computed(() => statusChip(status.value))

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
    :data-tone="ink ? 'ink' : 'light'"
  >
    <section
      class="bd-card cs-card"
      :class="{ 'cs-contrast': ink, 'is-lifted': lifted }"
      :aria-labelledby="titleId"
      :aria-busy="pending ? 'true' : undefined"
    >
      <header class="bd-card-head" :class="{ 'is-movable': canMove }" v-on="head">
        <span
          v-if="chip"
          class="bd-card-chip cs-chip"
          :class="{ 'cs-chip--live': chip.live, 'cs-chip--quiet': chip.quiet }"
          :data-status="status"
        >{{ chip.label }}</span>
        <h2 :id="titleId" class="bd-card-title">
          <button type="button" class="bd-card-open" :title="meta?.description || undefined" @click="expand(false)">
            {{ title }}
          </button>
        </h2>
      </header>
      <div class="bd-card-body">
        <CardSkeleton v-if="pending" />
        <CardLoadError v-else-if="failed || !card" :on-retry="retry" />
        <component :is="card" v-else :key="attempt" :website-id="wid" :size="item.size" />
      </div>
    </section>
    <footer class="bd-card-foot">
      <p class="bd-card-caption cs-caption">
        <span class="cs-caption__code">{{ code }}</span>
        <span v-if="meta?.caption" class="bd-card-caption-text">{{ meta.caption }}</span>
      </p>
      <div class="bd-card-tools">
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
      </div>
    </footer>
  </li>
</template>

<style scoped>
/* No dense packing: DOM, visual and tab order are the user's order. The
   span of a third, a half and a full row is the grid's (BoardGrid: it
   follows the board's density and width). */
.bd-cell {
  --bd-foot-h: 36px;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bd-cell.is-third {
  grid-column: span var(--bd-span-third, 4);
}

.bd-cell.is-half {
  grid-column: span var(--bd-span-half, 6);
}

.bd-cell.is-full {
  grid-column: 1 / -1;
}

/* A card that moves glides to its new place (BoardGrid's move class). */
.bd-move {
  transition: transform 200ms var(--ag-ease);
}

/* The lifted card's cell stays in the grid as its slot, and a held card's
   cell keeps its place: both above the other cards, under the toolbar. The
   slot keeps room for the line under the card, which stays where it is. */
.bd-cell.is-slot,
.bd-cell.is-held {
  z-index: 5;
}

.bd-cell.is-slot {
  box-sizing: content-box;
  padding-bottom: var(--bd-foot-h);
}

.bd-cell.is-slot .bd-card-foot {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
}

.bd-cell.is-slot::before {
  position: absolute;
  inset: 0 0 var(--bd-foot-h);
  z-index: 1;
  box-sizing: border-box;
  border: 1px dashed var(--subtle-foreground);
  border-radius: var(--radius);
  content: '';
}

/* The card: a flat surface in the block's tone (cs-card, with cs-contrast
   for ink). Its body paints the surface, so the fills that would otherwise
   be the card's own colour step one tone away from it. Card layouts query
   the card's own width (bd-card), not its size word, so a full-width card
   on a one-column board still fits. */
.bd-card {
  --ag-pane-bg: var(--card);
  --viz-surface: var(--card);
  --ag-row-hover: var(--muted);
  --ag-ghost-hover: var(--muted);
  --ag-btn-hover: var(--muted);
  --ag-bubble-bg: var(--muted);
  --ag-seg-track: var(--muted);
  --ag-tab-bg: var(--muted);
  --ag-code-bg: var(--muted);
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  padding: 12px;
  container: bd-card / inline-size;
}

/* Floating under the pointer at its size at the lift (the width, height
   and transform are written inline while it moves). No shadow: a hairline
   in the card's own ink marks it off the cards it passes. */
.bd-card.is-lifted {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  overflow: hidden;
  outline: 1px solid var(--foreground);
}

.bd-cell.is-held .bd-card {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

/* The chip on the left, the title on the right. */
.bd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}

/* With a mouse or pen the whole header drags; the title still opens. */
.bd-card-head.is-movable {
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
}

.bd-card-chip {
  flex: 0 0 auto;
}

.bd-card-title {
  min-width: 0;
  margin: 0 0 0 auto;
  padding: 0 8px 0 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  text-align: right;
}

.bd-card-open {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-align: inherit;
  text-transform: uppercase;
  cursor: pointer;
  /* Focus and reveals keep it clear of the sticky toolbar. */
  scroll-margin-top: 72px;
}

.bd-card-open:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.bd-card-open:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

/* A third is at least about as tall as it is wide, as far as that stays a
   card: the row then reads as one band, and a short state has room. */
.bd-card-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  padding: 20px 8px 8px;
}

.bd-cell.is-third .bd-card-body {
  min-height: min(100cqi - 24px, 340px);
}

/* A headline figure sits on the card itself: no box of its own, a small
   monospace label and a large numeral. */
.bd-card-body :deep(.viz-stat) {
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
}

.bd-card-body :deep(.viz-stat-label) {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bd-card-body :deep(.viz-stat-value) {
  font-family: var(--font-display);
  font-size: 48px;
  letter-spacing: -0.045em;
  line-height: 1;
}

/* The line under the card: code and caption, then the card's controls. */
.bd-card-foot {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: var(--bd-foot-h);
  padding-top: 4px;
}

.bd-card-caption {
  flex: 1 1 auto;
  flex-wrap: nowrap;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.bd-card-caption-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bd-card-tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-right: -4px;
}

/* The grip, styled as the muted ghost AgIconButton beside it. */
.bd-card-grip {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--subtle-foreground);
  line-height: 0;
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  scroll-margin-top: 72px;
  transition: background-color 120ms ease, color 120ms ease;
}

.bd-card-grip:hover {
  background: var(--ag-ghost-hover);
  color: var(--foreground);
}

.bd-card-grip:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

@media (pointer: coarse) {
  .bd-cell {
    --bd-foot-h: 44px;
  }

  .bd-card-grip {
    width: 36px;
    height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* transition: none on a cell belongs here only: TransitionGroup reads the
     first cell's move transition, so one anywhere else would stop every
     move while that cell comes first. */
  .bd-move {
    transition: none;
  }

  .bd-card-grip {
    transition: none;
  }
}
</style>
