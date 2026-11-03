<script setup>
// The agents the workspace offers, from GET agents/. "Use" starts a new chat
// with that agent preselected.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAgentStore } from '@/stores/agent'
import { agentList, kindMeta } from '@/lib/agent/agentsMeta'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import { IconAgents } from '@/components/agent/icons'
import { asList, errorMessage } from '@/components/agent/common/agentText'

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const agent = useAgentStore()

// Starts true when there is nothing to show, so the empty state never flashes.
const loading = ref(!asList(agent.catalog).length)
const error = ref('')

const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))
const catalog = computed(() => asList(agent.catalog))
const agents = computed(() => (catalog.value.length ? agentList(catalog.value) : []))

const DELIVERS = {
  report: 'Writes a report you can save to Reports',
  page: 'Builds a landing page',
  document: 'Writes an article for Documents',
  sheet: 'Builds an ad campaign sheet',
}

function deliverable(item) {
  return DELIVERS[item.outputKind] || ''
}

function useTo(item) {
  return { name: 'agent-home', params: { websiteId: wid.value }, query: { agent: item.key } }
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
    intro="Specialists the agent hands work to. Each one researches with your project's data and delivers one thing."
    :busy="loading"
  >
    <ul v-if="loading && !agents.length" class="ag-agents" role="list" aria-hidden="true">
      <li v-for="n in 4" :key="n" class="ag-agent is-skeleton">
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

    <ul v-else class="ag-agents" role="list">
      <li v-for="item in agents" :key="item.key" class="ag-agent">
        <div class="ag-agent-head">
          <span class="ag-agent-icon" :style="{ color: kindMeta(item.outputKind).color }" aria-hidden="true">
            <component :is="item.icon" :size="14" />
          </span>
          <h2 class="ag-agent-name">{{ item.name }}</h2>
        </div>
        <p v-if="item.description" class="ag-agent-desc">{{ item.description }}</p>
        <p v-if="deliverable(item)" class="ag-agent-meta">{{ deliverable(item) }}</p>
        <p v-if="item.starter" class="ag-agent-starter">
          <span class="ag-agent-starter-label">Try</span>
          <span class="ag-agent-starter-text">{{ item.starter }}</span>
        </p>
        <div class="ag-agent-actions">
          <AgButton size="sm" :to="wid ? useTo(item) : null" :disabled="!wid" :aria-label="`Use ${item.name}`">
            Use
          </AgButton>
        </div>
      </li>
    </ul>
  </AgPage>
</template>

<style scoped>
.ag-agents {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-agent {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-height: 168px;
  padding: 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-agent-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ag-agent-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: 6px;
}

.ag-agent-name {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-agent-desc {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 21px;
}

.ag-agent-meta {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-agent-starter {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--ag-bubble-bg);
  color: var(--ag-fg-1b);
  font-size: 13px;
  line-height: 19px;
}

.ag-agent-starter-label {
  flex-shrink: 0;
  color: var(--ag-fg-3);
  font-weight: 500;
}

.ag-agent-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 4px;
}

.ag-agent.is-skeleton {
  gap: 12px;
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
