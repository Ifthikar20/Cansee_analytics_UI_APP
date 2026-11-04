<script setup>
// The board's widgets on a 12-column grid (board_frontend.md 3): thirds,
// halves and full rows in the user's order, one column on a narrow board.
// Cards move by drag and drop (a card's header or grip, or the grip's keys)
// as well as by their menu (frame_board.md B3 and B4): while one moves the
// grid shows the draft order and the other cards glide out of its way. The
// column rules live with the cell (BoardWidget); the container is the
// page's .bd-body.
import { ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { provideBoardDrag } from '@/composables/board/useBoardDrag'
import BoardWidget from './BoardWidget.vue'

const props = defineProps({
  // [{key, size}] in the user's order.
  widgets: { type: Array, default: () => [] },
  // The layout is still loading: skeleton cards, no data requests.
  pending: { type: Boolean, default: false },
})

const wrapEl = ref(null)
const phone = useMediaQuery('(max-width: 767px)')

// No moving while the layout loads, nor on a phone (the menu moves there).
const { shown } = provideBoardDrag({
  grid: () => wrapEl.value?.querySelector('.bd-grid') || null,
  items: () => props.widgets,
  enabled: () => !props.pending && !phone.value,
})
</script>

<template>
  <div ref="wrapEl" class="bd-grid-wrap">
    <!-- css false: cards come and go at once; only moves glide (bd-move). -->
    <TransitionGroup tag="ul" class="bd-grid" role="list" aria-label="Widgets" move-class="bd-move" :css="false">
      <BoardWidget
        v-for="(item, i) in shown"
        :key="item.key"
        :item="item"
        :index="i"
        :count="shown.length"
        :pending="pending"
      />
    </TransitionGroup>
    <p id="bd-move-help" hidden>Press Space to pick up. Then use the arrow keys to move, and Space to drop.</p>
  </div>
</template>

<style scoped>
.bd-grid-wrap {
  position: relative;
}

.bd-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>

<!-- Unscoped on purpose: while a card is dragged (useBoardDrag puts
     bd-dragging on <html>) the cursor says so everywhere, no text selects,
     scroll anchoring leaves the board where it is, and no card hovers under
     the floating one. -->
<style>
html.bd-dragging,
html.bd-dragging * {
  cursor: grabbing !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

html.bd-dragging .bd {
  overflow-anchor: none;
}

html.bd-dragging .bd-cell {
  pointer-events: none;
}
</style>
