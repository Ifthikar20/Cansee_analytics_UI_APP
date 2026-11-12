<script setup>
// "Add widget" (board_contract.md 9): every widget of the catalog in its
// order, searchable by title and one-liner. Add puts it at the end of the
// board at its default size and keeps the dialog open, so several can go
// on in a row; the row then reads "On your board". `done` tells the board
// which card was added last, once the dialog has closed.
import { computed, nextTick, ref, watch } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import AgSearchField from '@/components/agent/common/AgSearchField.vue'
import { WIDGETS } from '@/lib/board/widgets'
import { useAgentUiStore } from '@/stores/agentUi'
import { useBoardStore } from '@/stores/board'

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

const needle = computed(() => query.value.trim().toLowerCase())
const rows = computed(() =>
  WIDGETS.filter(
    (w) => !needle.value || w.title.toLowerCase().includes(needle.value) || w.description.toLowerCase().includes(needle.value),
  ),
)

function add(widget) {
  if (!store.add(props.websiteId, widget.key)) return
  lastAdded = widget.key
  ui.announce(`Added ${widget.title} to your board.`)
  // The button turns into text: keep focus on that row.
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
    description="Pick what this board shows. Each widget opens a detailed view."
    wide
  >
    <AgSearchField v-model="query" label="Search widgets" placeholder="Search widgets" />
    <ul v-if="rows.length" ref="listEl" class="bd-cat" role="list" aria-label="Widgets">
      <li v-for="w in rows" :key="w.key" class="bd-cat-row" :data-catalog="w.key">
        <div class="bd-cat-text">
          <p class="bd-cat-title">{{ w.title }}</p>
          <p class="bd-cat-desc">{{ w.description }}</p>
        </div>
        <span v-if="store.has(websiteId, w.key)" class="bd-cat-on" tabindex="-1">On your board</span>
        <AgButton v-else size="sm" :aria-label="`Add ${w.title}`" @click="add(w)">Add</AgButton>
      </li>
    </ul>
    <p v-else class="bd-cat-none" role="status">No widget matches "{{ query.trim() }}".</p>
  </AgDialog>
</template>

<style scoped>
.bd-cat {
  display: flex;
  flex-direction: column;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.bd-cat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--ag-divider-subtle);
}

.bd-cat-row:first-child {
  border-top: 0;
}

.bd-cat-text {
  flex: 1 1 auto;
  min-width: 0;
}

.bd-cat-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.bd-cat-desc {
  margin: 2px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.bd-cat-on {
  flex-shrink: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  outline: none;
}

.bd-cat-on:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.bd-cat-none {
  margin: 16px 0 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}
</style>
