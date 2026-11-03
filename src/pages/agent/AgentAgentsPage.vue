<script setup>
// The agents the workspace offers (GET agents/), by team (p2_contract.md
// 12). The four general agents start a new chat with that agent picked;
// the six specialists ask for their inputs first and draft the task into a
// new chat, where the person reviews it and sends it.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useAgentStore } from '@/stores/agent'
import { useAppStore } from '@/stores/app'
import { agentList } from '@/lib/agent/agentsMeta'
import { TEAMS, TEAM_KEYS } from '@/lib/agent/teams'
import { ASK_TEMPLATES } from '@/lib/analytics/askTemplates'
import { ANALYTICS_SECTIONS, sectionRoute } from '@/lib/analyticsNav'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import { IconAgents } from '@/components/agent/icons'
import { asList, errorMessage } from '@/components/agent/common/agentText'
import AgentCard from '@/components/agent/agents/AgentCard.vue'
import AgentTaskDialog from '@/components/agent/agents/AgentTaskDialog.vue'

// The agents that open a chat directly; the others take their inputs first.
const CHAT_AGENTS = new Set(['gap_analyst', 'landing_page', 'aeo_article', 'ad_campaign'])
const OFF_REASON = 'The agent workspace is turned off on this server.'

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const agent = useAgentStore()
const app = useAppStore()

// Starts true when there is nothing to show, so the empty state never flashes.
const loading = ref(!asList(agent.catalog).length)
const error = ref('')

const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))
const website = computed(() => app.websites.find((w) => String(w.id) === wid.value) || null)
const catalog = computed(() => asList(agent.catalog))
// With GET status/, a writing agent the AI allowance cannot start says why.
const agents = computed(() => (catalog.value.length ? agentList(catalog.value, agent.status) : []))
const offReason = computed(() => (agent.status && agent.status.enabled === false ? OFF_REASON : ''))

/* ── Team tabs, kept in ?team= ── */

const tab = computed({
  get() {
    const raw = route.query.team
    const value = Array.isArray(raw) ? raw[0] : raw
    return TEAM_KEYS.includes(value) ? value : 'all'
  },
  set(value) {
    const query = { ...route.query }
    if (!value || value === 'all') delete query.team
    else query.team = value
    router.replace({ query })
  },
})

const tabs = computed(() => [{ key: 'all', label: 'All agents' }, ...TEAMS])

function agentsOf(key) {
  if (key === 'all') return agents.value
  return agents.value.filter((a) => (a.teams || []).some((t) => t.key === key))
}

/* ── Starts from: the tabs whose Ask the agent drafts name the agent ── */

const startsFromByAgent = computed(() => {
  const fromKeys = {}
  for (const template of Object.values(ASK_TEMPLATES || {})) {
    const names = Array.isArray(template?.agents) ? template.agents : template?.agent ? [template.agent] : []
    for (const name of names) {
      if (!fromKeys[name]) fromKeys[name] = new Set()
      if (template.from) fromKeys[name].add(template.from)
    }
  }
  const out = {}
  for (const [name, keys] of Object.entries(fromKeys)) {
    // Sidebar order, labels and routes from the analytics navigation.
    out[name] = ANALYTICS_SECTIONS.filter((s) => keys.has(s.key)).map((s) => ({
      key: s.key,
      label: s.label,
      to: sectionRoute(s.key, wid.value),
    }))
  }
  return out
})

function useTo(item) {
  if (!wid.value || !CHAT_AGENTS.has(item.key)) return null
  return { name: 'agent-home', params: { websiteId: wid.value }, query: { agent: item.key } }
}

/* ── The task dialog of the six specialists ── */

const taskAgent = ref(null)
const taskOpen = ref(false)

function openTask(item) {
  taskAgent.value = item
  taskOpen.value = true
}

async function load({ force = false } = {}) {
  if (typeof agent.loadCatalog !== 'function') return
  loading.value = true
  error.value = ''
  try {
    await agent.loadCatalog({ force })
  } catch (err) {
    error.value = errorMessage(err, "Couldn't load the agents.")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!catalog.value.length) load()
})
</script>

<template>
  <AgPage
    title="Agents"
    intro="Specialists the agent hands work to, by team. Each one works from your context and Cansee's measurements and saves a draft for review."
    :busy="loading"
  >
    <ul v-if="loading && !agents.length" class="ag-agents" role="list" aria-hidden="true">
      <li v-for="n in 4" :key="n" class="ag-agent-skel">
        <span class="ag-skel ag-skel-box" />
        <span class="ag-skel ag-skel-line" />
        <span class="ag-skel ag-skel-line is-short" />
      </li>
    </ul>

    <AgEmptyState v-else-if="error && !agents.length" :icon="IconAgents" tone="error" title="Couldn't load the agents." :body="error">
      <AgButton size="sm" @click="load({ force: true })">Try again</AgButton>
    </AgEmptyState>

    <AgEmptyState
      v-else-if="!agents.length"
      :icon="IconAgents"
      title="No agents are available."
      body="The workspace has not published any agents yet."
    />

    <TabsRoot v-else v-model="tab" class="ag-agents-tabs" activation-mode="manual">
      <TabsList class="ag-agents-tablist" aria-label="Teams">
        <TabsTrigger v-for="t in tabs" :key="t.key" :value="t.key" class="ag-agents-tab">{{ t.label }}</TabsTrigger>
      </TabsList>
      <TabsContent v-for="t in tabs" :key="t.key" :value="t.key" class="ag-agents-panel">
        <ul class="ag-agents" role="list">
          <AgentCard
            v-for="item in agentsOf(t.key)"
            :key="item.key"
            :agent="item"
            :to="useTo(item)"
            :starts-from="startsFromByAgent[item.key] || []"
            :off-reason="offReason"
            :no-project="!wid"
            @use="openTask"
          />
        </ul>
      </TabsContent>
    </TabsRoot>

    <AgentTaskDialog
      v-model:open="taskOpen"
      :agent="taskAgent"
      :website-id="wid"
      :website="website"
      :status="agent.status"
    />
  </AgPage>
</template>

<style scoped>
.ag-agents-tabs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ag-agents-tablist {
  display: flex;
  gap: 4px;
  margin: 0 -4px;
  padding: 0 4px 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.ag-agents-tab {
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-agents-tab:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-agents-tab[data-state='active'] {
  border-color: var(--ag-card-border);
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-agents-tab:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-agents-panel:focus-visible {
  border-radius: 12px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 4px;
}

.ag-agents {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-agent-skel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  min-height: 168px;
  padding: 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-skel {
  display: block;
  border-radius: 6px;
  background: var(--ag-row-hover);
  animation: ag-pulse 1.4s ease-in-out infinite;
}

.ag-skel-box {
  width: 30px;
  height: 30px;
}

.ag-skel-line {
  width: 80%;
  height: 12px;
}

.ag-skel-line.is-short {
  width: 45%;
}

@media (prefers-reduced-motion: reduce) {
  .ag-skel {
    animation: none;
  }
}

@media (max-width: 420px) {
  .ag-agents {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
