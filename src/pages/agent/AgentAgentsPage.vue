<script setup>
// The agents the workspace offers (GET agents/), by team (p2_contract.md
// 12), and the research agents (research_swarm, the Gap Analyst's tool),
// which have no catalog entry and get their own card with presets. Use
// opens the agent's task dialog: the six specialists ask for their inputs,
// the four general agents and the research agents start from a task
// template. Every task is drafted into a new chat, where the person reviews
// it and sends it.
//
// GET status/ says what is set up (the strip on top) and why an agent
// cannot run (lib/agent/availability); a missing status blocks nothing.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useAgentStore } from '@/stores/agent'
import { useAppStore } from '@/stores/app'
import { agentList } from '@/lib/agent/agentsMeta'
import { agentBlock, workspaceBlock } from '@/lib/agent/availability'
import { RESEARCH_AGENTS } from '@/lib/agent/researchAgents'
import { TEAMS, TEAM_KEYS } from '@/lib/agent/teams'
import { ASK_TEMPLATES } from '@/lib/analytics/askTemplates'
import { boardLocation } from '@/lib/board/links'
import { WIDGETS } from '@/lib/board/widgets'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import { IconAgents } from '@/components/agent/icons'
import { asList, errorMessage } from '@/components/agent/common/agentText'
import AgentCard from '@/components/agent/agents/AgentCard.vue'
import AgentSetupStrip from '@/components/agent/agents/AgentSetupStrip.vue'
import AgentTaskDialog from '@/components/agent/agents/AgentTaskDialog.vue'
import ResearchAgentsCard from '@/components/agent/agents/ResearchAgentsCard.vue'

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
const agents = computed(() => (catalog.value.length ? agentList(catalog.value, agent.status) : []))

/* ── Why an agent cannot run ── */

const blocks = computed(() => {
  const out = {}
  for (const a of agents.value) out[a.key] = agentBlock(a.key, agent.status)
  return out
})
const researchBlock = computed(() => agentBlock(RESEARCH_AGENTS.key, agent.status))
const everyAgentBlock = computed(() => workspaceBlock(agent.status))
const checking = computed(() => Boolean(agent.statusLoading))

function recheck() {
  if (typeof agent.loadStatus === 'function') agent.loadStatus()
}

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

const researchIn = (key) => key === 'all' || RESEARCH_AGENTS.teams.some((t) => t.key === key)

/* ── Starts from: the widgets whose Ask the agent drafts name the agent ── */

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
    // Catalog order and titles; each link opens that widget's panel.
    out[name] = WIDGETS.filter((w) => keys.has(w.key)).map((w) => ({
      key: w.key,
      label: w.title,
      to: boardLocation(wid.value, w.key),
    }))
  }
  return out
})

/* ── The task dialog ── */

const taskAgent = ref(null)
const taskTemplate = ref('')
const taskOpen = ref(false)

function openTask(item, template = '') {
  taskAgent.value = item
  taskTemplate.value = template
  taskOpen.value = true
}

function openResearch(template) {
  openTask(RESEARCH_AGENTS, template)
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

    <template v-else>
      <AgentSetupStrip
        class="ag-agents-setup"
        :status="agent.status"
        :block="everyAgentBlock"
        :checking="checking"
        @refresh="recheck"
      />

      <TabsRoot v-model="tab" class="ag-agents-tabs" activation-mode="manual">
        <TabsList class="ag-agents-tablist" aria-label="Teams">
          <TabsTrigger v-for="t in tabs" :key="t.key" :value="t.key" class="ag-agents-tab">{{ t.label }}</TabsTrigger>
        </TabsList>
        <TabsContent v-for="t in tabs" :key="t.key" :value="t.key" class="ag-agents-panel">
          <ul class="ag-agents" role="list">
            <ResearchAgentsCard
              v-if="researchIn(t.key)"
              :status="agent.status"
              :block="researchBlock"
              :no-project="!wid"
              @use="openResearch"
            />
            <AgentCard
              v-for="item in agentsOf(t.key)"
              :key="item.key"
              :agent="item"
              :starts-from="startsFromByAgent[item.key] || []"
              :block="blocks[item.key]"
              :no-project="!wid"
              @use="openTask"
            />
          </ul>
        </TabsContent>
      </TabsRoot>
    </template>

    <AgentTaskDialog
      v-model:open="taskOpen"
      :agent="taskAgent"
      :template="taskTemplate"
      :website-id="wid"
      :website="website"
      :status="agent.status"
    />
  </AgPage>
</template>

<style scoped>
.ag-agents-setup {
  margin-bottom: 16px;
}

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
