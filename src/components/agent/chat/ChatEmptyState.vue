<template>
  <div class="ag-empty">
    <h2 class="ag-empty-title">{{ greeting }}</h2>
    <HintCallout hint="agent.chips" :when="agents.some((a) => a && !a.unavailable)" align="center">
      <AgentChips :agents="agents" :agent="agent" @pick="emit('pick-agent', $event)" />
    </HintCallout>
    <SuggestionGrid
      class="ag-empty-suggest"
      :suggestions="suggestions"
      :catalog="catalog"
      @use="emit('use-suggestion', $event)"
    />
  </div>
</template>

<script setup>
// A new chat: the greeting, the four agents, and suggestions that come only
// from the project's real tracked prompts (none when it has none). The
// first new chat points the agents out (hint agent.chips).
import { computed } from 'vue'
import HintCallout from '@/components/ui/help/HintCallout.vue'
import AgentChips from './AgentChips.vue'
import SuggestionGrid from './SuggestionGrid.vue'

const props = defineProps({
  projectName: { type: String, default: '' },
  agents: { type: Array, default: () => [] },
  agent: { type: String, default: null },
  suggestions: { type: Array, default: () => [] },
  catalog: { type: Array, default: null },
})

const emit = defineEmits(['pick-agent', 'use-suggestion'])

const greeting = computed(() =>
  props.projectName ? `What should we work on in ${props.projectName}?` : 'What should we work on?'
)
</script>

<style scoped>
.ag-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: 280px;
  padding: 24px 0;
  text-align: center;
}

.ag-empty-title {
  max-width: 520px;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 22px;
  font-weight: 500;
  line-height: 30px;
  overflow-wrap: anywhere;
}

.ag-empty-suggest {
  max-width: 560px;
  margin-top: 8px;
  text-align: left;
}
</style>
