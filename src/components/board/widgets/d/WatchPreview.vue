<script setup>
// The Watch block's tile in the catalog: the card's own eye, looking a
// little up and to the right, inside the tile's 160 by 100 frame. A
// drawing only; the catalog marks it "Sample data".
import WatchEye from './WatchEye.vue'

const LOOK = Object.freeze({ x: 0.4, y: -0.25 })
</script>

<template>
  <WatchEye :look="LOOK" view-box="-40 -57.5 520 325" />
</template>
