<script setup>
// The board's density (the three sets of bars at the top right): how many
// columns of one-third cards the grid has, 2, 3 or 4. A radio group: Tab
// reaches the chosen one, the arrow keys, Home and End choose another. The
// page hides it on a phone, where the board is always one column.
import { nextTick, ref } from 'vue'
import { DENSITIES } from '@/lib/board/flow'

const model = defineModel({ type: Number, required: true })

const rootEl = ref(null)

// Each icon is as many bars as columns, in one 22 by 18 box.
const BOX_W = 22
const GAP = 2
function bars(n) {
  const width = (BOX_W - GAP * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => ({ x: i * (width + GAP), width }))
}
const OPTIONS = DENSITIES.map((n) => ({ n, bars: bars(n), label: `${n} columns` }))

function choose(n, focus = false) {
  if (n !== model.value) model.value = n
  if (focus) nextTick(() => rootEl.value?.querySelector('[aria-checked="true"]')?.focus())
}

function onKeydown(event) {
  const at = DENSITIES.indexOf(model.value)
  const last = DENSITIES.length - 1
  let to = -1
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') to = at >= last ? 0 : at + 1
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') to = at <= 0 ? last : at - 1
  else if (event.key === 'Home') to = 0
  else if (event.key === 'End') to = last
  if (to < 0) return
  event.preventDefault()
  choose(DENSITIES[to], true)
}
</script>

<template>
  <div ref="rootEl" class="bd-density" role="radiogroup" aria-label="Columns" @keydown="onKeydown">
    <button
      v-for="option in OPTIONS"
      :key="option.n"
      type="button"
      class="bd-density-option"
      role="radio"
      :aria-checked="option.n === model ? 'true' : 'false'"
      :aria-label="option.label"
      :title="option.label"
      :tabindex="option.n === model ? 0 : -1"
      :data-columns="option.n"
      @click="choose(option.n)"
    >
      <svg class="bd-density-icon" viewBox="0 0 22 18" width="22" height="18" aria-hidden="true" focusable="false">
        <rect v-for="(bar, i) in option.bars" :key="i" :x="bar.x" y="0" :width="bar.width" height="18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.bd-density {
  display: flex;
  align-items: center;
  gap: 2px;
}

.bd-density-option {
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: var(--input);
  cursor: pointer;
  transition: color 120ms ease;
}

.bd-density-option:hover {
  color: var(--muted-foreground);
}

.bd-density-option[aria-checked='true'] {
  color: var(--foreground);
}

.bd-density-option:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.bd-density-icon {
  display: block;
  fill: currentColor;
}

@media (prefers-reduced-motion: reduce) {
  .bd-density-option {
    transition: none;
  }
}
</style>
