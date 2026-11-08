<script setup>
// Keyboard shortcuts reference (Ctrl/Cmd+/, the help drawer and the phone menu).
import { computed } from 'vue'
import { AGENT_SHORTCUTS } from '@/composables/agent/useAgentHotkeys'
import AgDialog from './AgDialog.vue'
import AgKbd from './AgKbd.vue'

const open = defineModel('open', { type: Boolean, default: false })

const groups = computed(() => {
  const out = []
  for (const item of AGENT_SHORTCUTS) {
    let group = out.find((g) => g.name === item.group)
    if (!group) {
      group = { name: item.group, items: [] }
      out.push(group)
    }
    group.items.push(item)
  }
  return out
})
</script>

<template>
  <AgDialog v-model:open="open" title="Keyboard shortcuts" description="Shortcuts for the agent workspace." hide-description wide>
    <div class="ag-sc">
      <section v-for="group in groups" :key="group.name" class="ag-sc-group" :aria-label="group.name">
        <h3 class="ag-sc-heading">{{ group.name }}</h3>
        <dl class="ag-sc-list">
          <div v-for="item in group.items" :key="item.id" class="ag-sc-row">
            <dt class="ag-sc-label">{{ item.label }}</dt>
            <dd class="ag-sc-keys"><AgKbd :keys="item.keys" /></dd>
          </div>
        </dl>
      </section>
    </div>
  </AgDialog>
</template>

<style scoped>
.ag-sc {
  display: grid;
  gap: 20px;
}

.ag-sc-heading {
  margin: 0 0 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-sc-list {
  display: grid;
  margin: 0;
}

.ag-sc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 36px;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

.ag-sc-row:last-child {
  border-bottom: 0;
}

.ag-sc-label {
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
}

.ag-sc-keys {
  flex-shrink: 0;
  margin: 0;
}
</style>
