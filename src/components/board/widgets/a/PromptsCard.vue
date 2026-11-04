<template>
  <div class="pc">
    <CardShell
      widget="prompts"
      :phase="phase"
      :failure="failure"
      :stale="stale"
      :empty="empty"
      :notes="notes"
      :skeleton="size === 'full' ? 236 : 280"
      @retry="reload"
      @action="showAdd = true"
    >
      <ul class="pc-rows" aria-label="Prompts with the biggest gaps">
        <li v-for="row in rows" :key="row.id" class="pc-item">
          <button type="button" class="pc-row" @click="openPrompt(row.id)">
            <span class="pc-text">{{ row.text }}</span>
            <span class="pc-meta">
              <span class="pc-cell">{{ row.google }}</span>
              <span class="pc-sep" aria-hidden="true">·</span>
              <span class="pc-cell">{{ row.ai }}</span>
              <span class="pc-sep" aria-hidden="true">·</span>
              <span class="pc-cell">{{ row.gap }}</span>
            </span>
          </button>
        </li>
      </ul>

      <template v-if="prompts.length" #link>
        <AgButton size="sm" :icon="Plus" @click="showAdd = true">Add prompts</AgButton>
        <AgButton size="sm" variant="ghost" @click="board.open('prompts')">
          See all {{ prompts.length }} {{ prompts.length === 1 ? 'prompt' : 'prompts' }}
        </AgButton>
        <AgButton v-if="canCheck" size="sm" variant="ghost" :loading="checking" @click="run(prompts)">
          {{ label(unchecked.length) }}
        </AgButton>
      </template>
    </CardShell>

    <AddPromptsDialog v-model:open="showAdd" :website-id="websiteId" :engine-count="engines" @added="onAdded" />
  </div>
</template>

<script setup>
// Prompts (board_contract.md 3): the six biggest gaps between Google and
// the AI engines, in the overview's order. Each row opens that prompt in
// the panel. The foot adds prompts, opens the full list, and checks
// Google for the prompts that have no check yet; the Overview's two
// alerts are foot lines here.
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import AgButton from '@/components/agent/common/AgButton.vue'
import AddPromptsDialog from '@/components/gap/AddPromptsDialog.vue'
import CardShell from './CardShell.vue'
import { engineCount, promptRows, promptsNotes } from './specs'
import { uncheckedPrompts, useCheckGoogle } from './useCheckGoogle'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'full' },
})

const board = useBoard()
const { data, failure, stale, reload } = useBoardSource('overview')
const { checking, label, run } = useCheckGoogle()
const showAdd = ref(false)

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const prompts = computed(() => data.value?.prompts || [])
const rows = computed(() => promptRows(prompts.value))
const notes = computed(() => promptsNotes(data.value))
const engines = computed(() => engineCount(data.value?.engines))
const unchecked = computed(() => uncheckedPrompts(prompts.value))
const canCheck = computed(() => unchecked.value.length > 0 && Boolean(data.value?.serp_configured))

const empty = computed(() =>
  data.value && !prompts.value.length
    ? {
        title: 'Start with the questions your buyers ask.',
        body: 'Add a few. Cansee checks where Google ranks you for each one and asks each AI engine the same question.',
        action: { label: 'Add prompts' },
      }
    : null,
)

function openPrompt(id) {
  board.open('prompts', { prompt: id })
}

function onAdded() {
  board.invalidate('overview')
  board.invalidate('visibility')
}
</script>

<style scoped>
.pc {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.pc-rows {
  display: flex;
  flex-direction: column;
  margin: 0 -6px;
  padding: 0;
  list-style: none;
}

.pc-item + .pc-item {
  border-top: 1px solid var(--ag-divider);
}

.pc-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pc-row:hover {
  background: var(--ag-ghost-hover);
}

.pc-row:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.pc-text {
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 6px;
  min-width: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.pc-cell {
  white-space: nowrap;
}

/* A wide card: one row per prompt, Google, AI and the gap in columns. */
@container bd-card (min-width: 720px) {
  .pc-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px 170px 120px;
    align-items: center;
    gap: 12px;
  }

  .pc-meta {
    display: contents;
  }

  .pc-sep {
    display: none;
  }

  .pc-cell {
    overflow: hidden;
    color: var(--ag-fg-2);
    font-size: 13px;
    line-height: 18px;
    text-overflow: ellipsis;
  }
}
</style>
