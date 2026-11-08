<template>
  <div class="ppn">
    <PromptPage v-if="promptId" :website-id="websiteId" :prompt-id="promptId" />

    <template v-else>
      <CardSkeleton v-if="phase === 'loading'" :height="320" />
      <CardState v-else-if="phase === 'failed'" v-bind="failed" @action="reload" />
      <CardState
        v-else-if="!prompts.length"
        title="Start with the questions your buyers ask."
        body="Add a few. Cansee checks where Google ranks you for each one and asks each AI engine the same question."
        :action="{ label: 'Add prompts' }"
        @action="showAdd = true"
      />

      <template v-else>
        <p v-if="stale" class="ppn-stale" role="alert">
          We couldn't refresh this page. Showing the last loaded numbers.
          <button type="button" class="ppn-retry" @click="reload">Try again</button>
        </p>

        <div class="ppn-head">
          <p class="ppn-count">{{ prompts.length }} {{ prompts.length === 1 ? 'prompt' : 'prompts' }} tracked.</p>
          <div class="ppn-actions">
            <AgButton size="sm" :icon="Plus" @click="showAdd = true">Add prompts</AgButton>
            <AgButton v-if="canCheck" size="sm" :icon="RefreshCw" :loading="checking" @click="run(prompts)">
              {{ label(unchecked.length) }}
            </AgButton>
          </div>
        </div>
        <p v-for="note in notes" :key="note" class="ppn-note">{{ note }}</p>

        <GapTable v-model:filter="filter" :rows="prompts" :engines="data.engines || []" :order="order" @open="openPrompt" />
      </template>
    </template>

    <AddPromptsDialog v-model:open="showAdd" :website-id="websiteId" :engine-count="engines" @added="onAdded" />
  </div>
</template>

<script setup>
// Prompts, expanded: every tracked prompt in the gap table (biggest gap
// first; "Newest" from the visibility source's order), with Add prompts
// and Check Google. ?prompt=<id> shows that prompt's page instead, whose
// "All prompts" comes back here; ?add=1 opens Add prompts once and leaves
// the URL. A row opens its prompt through the board.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, RefreshCw } from '@lucide/vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import AgButton from '@/components/agent/common/AgButton.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import AddPromptsDialog from '@/components/gap/AddPromptsDialog.vue'
import GapTable from '@/components/gap/GapTable.vue'
import PromptPage from '@/pages/PromptPage.vue'
import CardState from './CardState.vue'
import { engineCount, failureState, promptsNotes } from './specs'
import { uncheckedPrompts, useCheckGoogle } from './useCheckGoogle'

defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const board = useBoard()
const { data, failure, stale, reload } = useBoardSource('overview')
const visibility = useBoardSource('visibility')
const { checking, label, run } = useCheckGoogle()

const showAdd = ref(false)
const filter = ref('all')

const promptId = computed(() => {
  const value = route.query.prompt
  return typeof value === 'string' ? value : ''
})

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const failed = computed(() => failureState('prompts', failure.value))
const prompts = computed(() => data.value?.prompts || [])
const notes = computed(() => promptsNotes(data.value))
const engines = computed(() => engineCount(data.value?.engines))
const unchecked = computed(() => uncheckedPrompts(prompts.value))
const canCheck = computed(() => unchecked.value.length > 0 && Boolean(data.value?.serp_configured))
// Prompt ids in the order they were added (oldest first), for "Newest".
const order = computed(() => (visibility.data.value?.prompts || []).map((p) => String(p.prompt_id)))

function openPrompt(row) {
  if (row?.prompt_id !== undefined && row?.prompt_id !== null) board.open('prompts', { prompt: String(row.prompt_id) })
}

function onAdded() {
  board.invalidate('overview')
  board.invalidate('visibility')
}

// ?add=1 opens the dialog once, then leaves the URL.
watch(
  () => route.query.add,
  (add) => {
    if (add !== '1') return
    showAdd.value = true
    const query = { ...route.query }
    delete query.add
    router.replace({ query })
  },
  { immediate: true },
)
</script>

<style scoped>
.ppn {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.ppn-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.ppn-count {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.ppn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ppn-note {
  margin: -8px 0 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ppn-stale {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 1.5;
}

.ppn-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.ppn-retry:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
