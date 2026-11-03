<template>
  <section v-if="items.length" class="ag-suggest" aria-label="Suggestions from your tracked prompts">
    <p class="ag-suggest-label">From your tracked prompts</p>
    <ul class="ag-suggest-grid">
      <li v-for="(s, i) in items" :key="`${i}-${s.label}`">
        <button type="button" class="ag-suggest-item" @click="emit('use', s)">
          <span class="ag-suggest-text">{{ s.label }}</span>
          <span v-if="s.agentName" class="ag-suggest-agent">
            <component :is="s.icon" aria-hidden="true" />
            {{ s.agentName }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
// Suggestions built by the server from the project's tracked prompts and
// their gaps. With no tracked prompts the list is empty and nothing renders.
import { computed } from 'vue'
import { agentMeta } from '@/lib/agent/agentsMeta'

const props = defineProps({
  suggestions: { type: Array, default: () => [] },
  catalog: { type: Array, default: null },
})

const emit = defineEmits(['use'])

const items = computed(() =>
  (Array.isArray(props.suggestions) ? props.suggestions : [])
    .filter((s) => s && typeof s.label === 'string' && s.label.trim() && typeof s.prompt === 'string' && s.prompt.trim())
    .slice(0, 6)
    .map((s) => {
      const meta = s.agent ? agentMeta(s.agent, props.catalog) : null
      return { ...s, agentName: meta?.name || '', icon: meta?.icon || null }
    })
)
</script>

<style scoped>
.ag-suggest {
  display: grid;
  gap: 10px;
  width: 100%;
}

.ag-suggest-label {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-suggest-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-suggest-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-suggest-item:hover {
  background: var(--ag-ghost-hover);
}

.ag-suggest-item:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 12px;
}

.ag-suggest-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.ag-suggest-agent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ag-suggest-agent svg {
  width: 12px;
  height: 12px;
  color: var(--ag-accent);
}

@media (max-width: 560px) {
  .ag-suggest-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
