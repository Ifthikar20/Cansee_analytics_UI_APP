<script setup>
// Workspace sections. Project-scoped entries need a project; without one they
// render disabled (the projects list stays reachable). Reviews shows how
// many drafts wait for this user's review, loaded with the activity.
import { computed, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardCheck } from '@lucide/vue'
import { useAgentStore } from '@/stores/agent'
import {
  IconAgent,
  IconAgents,
  IconContext,
  IconDocuments,
  IconFindings,
  IconProjects,
  IconReports,
  IconSheets,
} from '@/components/agent/icons'

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const agent = useAgentStore()

const ITEMS = [
  { key: 'agent', label: 'Agent', icon: IconAgent, name: 'agent-home' },
  { key: 'projects', label: 'Projects', icon: IconProjects, name: 'agent-projects', global: true },
  { key: 'context', label: 'Context', icon: IconContext, name: 'agent-context' },
  { key: 'agents', label: 'Agents', icon: IconAgents, name: 'agent-agents' },
  { key: 'findings', label: 'Findings', icon: IconFindings, name: 'agent-findings' },
  { key: 'reviews', label: 'Reviews', icon: markRaw(ClipboardCheck), name: 'agent-reviews' },
  { key: 'reports', label: 'Reports', icon: IconReports, name: 'agent-reports' },
  { key: 'sheets', label: 'Sheets', icon: IconSheets, name: 'agent-sheets' },
  { key: 'documents', label: 'Documents', icon: IconDocuments, name: 'agent-documents' },
]

// A count the server has not answered (null) shows nothing, like zero.
const waiting = computed(() => {
  const n = Number(agent.reviewsWaiting)
  return Number.isInteger(n) && n > 0 ? n : 0
})

const KIND_SECTION = { report: 'reports', sheet: 'sheets', document: 'documents', page: 'documents' }

// An open artifact highlights the list it belongs to.
const artifactSection = computed(() => {
  if (route.name !== 'agent-artifact') return null
  const id = route.params?.artifactId
  const record = typeof agent.artifact === 'function' ? agent.artifact(id) : agent.artifacts?.[id]
  return KIND_SECTION[record?.kind] || null
})

const items = computed(() =>
  ITEMS.map((item) => {
    const enabled = item.global || Boolean(props.websiteId)
    const to = item.global ? { name: item.name } : enabled ? { name: item.name, params: { websiteId: props.websiteId } } : null
    const active = route.name === item.name || artifactSection.value === item.key
    return { ...item, to, enabled, active, count: item.key === 'reviews' && enabled ? waiting.value : 0 }
  }),
)
</script>

<template>
  <ul class="ag-nav" role="list">
    <li v-for="item in items" :key="item.key">
      <router-link
        v-if="item.enabled"
        :to="item.to"
        class="ag-nav-row"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
      >
        <component :is="item.icon" class="ag-nav-icon" :size="16" />
        <span class="ag-nav-label">{{ item.label }}</span>
        <span v-if="item.count" class="ag-nav-count ag-tnum" :aria-label="`${item.count} waiting for your review`">
          {{ item.count }}
        </span>
      </router-link>
      <span v-else class="ag-nav-row is-disabled" aria-disabled="true">
        <component :is="item.icon" class="ag-nav-icon" :size="16" />
        <span class="ag-nav-label">{{ item.label }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.ag-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.ag-nav-row {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ag-fg-2);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

a.ag-nav-row:hover {
  background: var(--ag-row-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-nav-row.is-active {
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-nav-row.is-disabled {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-nav-row:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-nav-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.ag-nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-nav-count {
  flex-shrink: 0;
  min-width: 18px;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-align: center;
}
</style>
