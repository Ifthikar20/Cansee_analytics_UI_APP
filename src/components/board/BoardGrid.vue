<script setup>
// The board's widgets on a 12-column grid (board_frontend.md 3): thirds,
// halves and full rows in the user's order, one column on a narrow board.
// The column rules live with the cell (BoardWidget); the container is the
// page's .bd-body.
import BoardWidget from './BoardWidget.vue'

defineProps({
  // [{key, size}] in the user's order.
  widgets: { type: Array, default: () => [] },
  // The layout is still loading: skeleton cards, no data requests.
  pending: { type: Boolean, default: false },
})
</script>

<template>
  <ul class="bd-grid" role="list" aria-label="Widgets">
    <BoardWidget
      v-for="(item, i) in widgets"
      :key="item.key"
      :item="item"
      :index="i"
      :count="widgets.length"
      :pending="pending"
    />
  </ul>
</template>

<style scoped>
.bd-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
