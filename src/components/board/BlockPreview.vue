<script setup>
// A catalog tile's drawing: the shapes of a preview kind
// (lib/board/previews.js) as one inline SVG, painted with the surface's
// own tokens, so it reads on an ink tile and on a light one. A sketch of
// the block's layout, never data; decorative, so hidden from screen
// readers (the tile names the block in words).
import { computed } from 'vue'
import { PREVIEW_BOX, previewShapes } from '@/lib/board/previews'

const props = defineProps({
  // A preview kind of lib/board/previews.js ('eye', 'rank', 'numeral'...).
  kind: { type: String, default: '' },
})

const shapes = computed(() => previewShapes(props.kind))
const viewBox = `0 0 ${PREVIEW_BOX.width} ${PREVIEW_BOX.height}`
</script>

<template>
  <svg class="bd-preview" :viewBox="viewBox" :data-preview="kind" aria-hidden="true" focusable="false">
    <template v-for="(s, i) in shapes" :key="i">
      <rect v-if="s.t === 'rect'" :class="`is-${s.c}`" :x="s.x" :y="s.y" :width="s.w" :height="s.h" />
      <polyline v-else-if="s.t === 'line'" :class="`is-stroke is-${s.c}`" :points="s.points" />
      <path v-else-if="s.t === 'path'" :class="`is-stroke is-${s.c}`" :d="s.d" />
      <circle v-else-if="s.t === 'dot'" :class="`is-${s.c}`" :cx="s.x" :cy="s.y" :r="s.r" />
      <text
        v-else-if="s.t === 'text'"
        :class="[`is-${s.c}`, s.mono ? 'is-mono' : 'is-display']"
        :x="s.x"
        :y="s.y"
        :font-size="s.size"
      >{{ s.text }}</text>
    </template>
  </svg>
</template>

<style scoped>
.bd-preview {
  display: block;
  width: 100%;
  height: auto;
}

.is-ink {
  fill: var(--foreground);
}

.is-bar {
  fill: var(--bar);
}

.is-mute {
  fill: var(--subtle-foreground);
}

.is-rule {
  fill: var(--rule);
}

.is-you {
  fill: var(--signal);
}

.is-stroke {
  fill: none;
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.is-stroke.is-ink {
  stroke: var(--foreground);
}

.is-stroke.is-bar {
  stroke: var(--bar);
}

.is-stroke.is-mute {
  stroke: var(--subtle-foreground);
}

.is-stroke.is-rule {
  stroke: var(--input);
}

.is-display {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.05em;
}

.is-mono {
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}
</style>
