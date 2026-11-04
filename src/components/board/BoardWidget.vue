<script setup>
// One card on the board (board_frontend.md 4): the title (it opens the
// widget's side panel), the one-liner, the options menu, and the widget's
// compact card, loaded on demand. A card that fails to load or to render
// says so and can be loaded again; the rest of the board is untouched.
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, provide, ref, toValue } from 'vue'
import { useRoute } from 'vue-router'
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

const meta = computed(() => widgetMeta(props.item.key))
const title = computed(() => meta.value?.title || props.item.key)
const titleId = computed(() => `bd-card-${props.item.key}`)
const wid = computed(() => toValue(board.websiteId))

// Bumped by Try again: a fresh definition loads the card's code again (a
// failed async component keeps its failure), and the new key remounts it.
const attempt = ref(0)
const failed = ref(false)

const card = computed(() => {
  void attempt.value
  const loader = WIDGET_COMPONENTS[props.item.key]?.card
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
  <li ref="cellEl" class="bd-cell" :class="`is-${item.size}`" :data-widget="item.key">
    <section class="bd-card" :aria-labelledby="titleId" :aria-busy="pending ? 'true' : undefined">
      <header class="bd-card-head">
        <div class="bd-card-heading">
          <h2 :id="titleId" class="bd-card-title">
            <button type="button" class="bd-card-open" @click="expand(false)">{{ title }}</button>
          </h2>
          <p v-if="meta?.description" class="bd-card-desc">{{ meta.description }}</p>
        </div>
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
  min-width: 0;
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
}

.bd-card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
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

.bd-card-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}
</style>
