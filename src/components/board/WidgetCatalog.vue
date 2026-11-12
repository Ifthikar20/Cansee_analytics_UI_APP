<script setup>
// "Add widget" (board_contract.md 9): a gallery of every block of the
// catalog in its order, searchable by title, one-liner and code. Each tile
// is a small drawing of the block's layout on the block's own surface,
// marked "Sample data" (it is a sketch, never the project's numbers), then
// the block's code, title and one-liner, and whether it is on the board.
// Add puts it at the end of the board at its default size and keeps the
// dialog open, so several can go on in a row; the tile then reads "On your
// board". `done` tells the board which card was added last, once the
// dialog has closed.
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgSearchField from '@/components/agent/common/AgSearchField.vue'
import { SIZE_LABELS, WIDGETS, blockCode } from '@/lib/board/widgets'
import { useAgentUiStore } from '@/stores/agentUi'
import { useBoardStore } from '@/stores/board'
import BlockPreview from './BlockPreview.vue'
import { WIDGET_COMPONENTS } from './widgetComponents'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  websiteId: { type: String, required: true },
})
const emit = defineEmits(['done'])

const store = useBoardStore()
const ui = useAgentUiStore()

const query = ref('')
const listEl = ref(null)
let lastAdded = null

// A block's own drawing when its group gives one, else the catalog's kind.
const OWN_PREVIEWS = new Map()
function ownPreview(key) {
  const loader = WIDGET_COMPONENTS[key]?.preview
  if (typeof loader !== 'function') return null
  if (!OWN_PREVIEWS.has(key)) OWN_PREVIEWS.set(key, defineAsyncComponent(loader))
  return OWN_PREVIEWS.get(key)
}

const TILES = WIDGETS.map((w) => ({
  ...w,
  code: blockCode(w.key),
  sizeLabel: SIZE_LABELS[w.size] || w.size,
  own: ownPreview(w.key),
  haystack: `${w.title} ${w.description} ${blockCode(w.key)}`.toLowerCase(),
}))

const needle = computed(() => query.value.trim().toLowerCase())
const tiles = computed(() => TILES.filter((w) => !needle.value || w.haystack.includes(needle.value)))
const onBoard = computed(() => TILES.filter((w) => store.has(props.websiteId, w.key)).length)

function add(widget) {
  if (!store.add(props.websiteId, widget.key)) return
  lastAdded = widget.key
  ui.announce(`Added ${widget.title} to your board.`)
  // The button turns into text: keep focus on that tile.
  nextTick(() => listEl.value?.querySelector(`[data-catalog="${widget.key}"] .bd-cat-on`)?.focus())
}

watch(open, (now) => {
  if (now) {
    query.value = ''
    lastAdded = null
    return
  }
  if (lastAdded) emit('done', lastAdded)
  lastAdded = null
})
</script>

<template>
  <AgDialog
    v-model:open="open"
    title="Add a widget"
    description="Pick what this board shows. Each widget opens a detailed view. The drawings are sketches with sample data, not your numbers."
    gallery
  >
    <div class="bd-cat-bar">
      <AgSearchField v-model="query" class="bd-cat-search" label="Search widgets" placeholder="Search widgets" />
      <p class="bd-cat-count cs-label">{{ onBoard }} of {{ TILES.length }} on your board</p>
    </div>
    <ul v-if="tiles.length" ref="listEl" class="bd-cat" role="list" aria-label="Widgets">
      <li v-for="w in tiles" :key="w.key" class="bd-cat-tile" :data-catalog="w.key">
        <div class="bd-cat-preview cs-card" :class="{ 'cs-contrast': w.tone === 'ink' }">
          <span class="bd-cat-sample cs-chip cs-chip--quiet">Sample data</span>
          <component :is="w.own" v-if="w.own" class="bd-cat-drawing" />
          <BlockPreview v-else class="bd-cat-drawing" :kind="w.preview" />
        </div>
        <p class="bd-cat-code cs-caption">
          <span class="cs-caption__code">{{ w.code }}</span>
          <span>{{ w.sizeLabel }}</span>
        </p>
        <h3 class="bd-cat-title">{{ w.title }}</h3>
        <p class="bd-cat-desc">{{ w.description }}</p>
        <div class="bd-cat-action">
          <span v-if="store.has(websiteId, w.key)" class="bd-cat-on cs-label cs-label--ink" tabindex="-1">On your board</span>
          <AgButton v-else size="sm" :aria-label="`Add ${w.title}`" @click="add(w)">Add</AgButton>
        </div>
      </li>
    </ul>
    <p v-else class="bd-cat-none" role="status">No widget matches "{{ query.trim() }}".</p>
  </AgDialog>
</template>

<style scoped>
.bd-cat-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.bd-cat-search {
  flex: 1 1 240px;
  max-width: 360px;
}

.bd-cat-count {
  margin: 0 0 0 auto;
}

.bd-cat {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
  gap: 28px 16px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.bd-cat-tile {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* The drawing sits on the block's own surface, under the chip that says
   what it is. */
.bd-cat-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 10px 14px;
}

.bd-cat-sample {
  align-self: flex-start;
  height: 20px;
  font-size: 11px;
}

.bd-cat-drawing {
  box-sizing: border-box;
  padding: 0 6px;
}

.bd-cat-code {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 16px;
}

.bd-cat-title {
  margin: 6px 0 0;
  color: var(--ag-fg-1);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: -0.01em;
}

.bd-cat-desc {
  margin: 2px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.bd-cat-action {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-top: auto;
  padding-top: 10px;
}

.bd-cat-on {
  outline: none;
}

.bd-cat-on:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.bd-cat-none {
  margin: 20px 0 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}
</style>
