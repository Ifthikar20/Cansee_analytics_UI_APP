<script setup>
// The Watch block's eye, drawn in lines: an almond, the ring of the iris,
// its fine radial lines and the accent pupil with one glint. `look` is the
// gaze ({x, y}, each -1..1); the pupil travels with it and the radial
// lines follow at a shorter distance, which reads as depth. A drawing
// only: the card says in words what the eye stands for.
import { computed } from 'vue'

const props = defineProps({
  look: { type: Object, default: () => ({ x: 0, y: 0 }) },
  // The drawing's frame. The eye fills "0 0 440 210"; a larger box sets it
  // inside a margin (the catalog's tile).
  viewBox: { type: String, default: '0 0 440 210' },
})

const CX = 220
const CY = 105
// How far the pupil and the radial lines travel at full gaze, in the
// drawing's units; both stay inside the ring (radius 70).
const PUPIL_REACH = 20
const LINES_REACH = 8
const TICKS = 48

const round = (v) => Math.round(v * 100) / 100
const ticks = Array.from({ length: TICKS }, (_, i) => {
  const angle = (i / TICKS) * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x1: round(CX + cos * 36), y1: round(CY + sin * 36), x2: round(CX + cos * 58), y2: round(CY + sin * 58) }
})

const axis = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)
const shift = (reach) => `translate(${round(axis(props.look?.x) * reach)}px, ${round(axis(props.look?.y) * reach)}px)`
const pupil = computed(() => ({ transform: shift(PUPIL_REACH) }))
const lines = computed(() => ({ transform: shift(LINES_REACH) }))
</script>

<template>
  <svg class="wd-eye" :viewBox="viewBox" aria-hidden="true" focusable="false">
    <path class="wd-eye-line" d="M4 105 Q220 -95 436 105 Q220 305 4 105 Z" />
    <circle class="wd-eye-line" :cx="CX" :cy="CY" r="70" />
    <g class="wd-eye-move" :style="lines">
      <line v-for="(t, i) in ticks" :key="i" class="wd-eye-tick" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
    </g>
    <g class="wd-eye-move wd-eye-pupil" :style="pupil">
      <circle class="wd-eye-iris" :cx="CX" :cy="CY" r="28" />
      <circle class="wd-eye-glint" :cx="CX - 10" :cy="CY - 10" r="5" />
    </g>
  </svg>
</template>

<style scoped>
.wd-eye {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.wd-eye-line,
.wd-eye-tick {
  fill: none;
  stroke: var(--foreground);
  vector-effect: non-scaling-stroke;
}

.wd-eye-line {
  stroke-width: 1.5px;
  stroke-linejoin: round;
}

.wd-eye-tick {
  stroke-width: 1px;
}

.wd-eye-iris {
  fill: var(--signal);
}

/* The glint is light on every surface: it is a highlight, not ink. */
.wd-eye-glint {
  fill: var(--paper);
}

.wd-eye-move {
  transition: transform 90ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .wd-eye-move {
    transition: none;
  }
}
</style>
