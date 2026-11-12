<template>
  <div class="ag-stv">
    <SwarmTable
      v-if="table"
      :table="table"
      :message="message"
      mode="pane"
      :busy="busy"
      :chat-id="chatId"
      :changed-only="Boolean(tab.changedOnly)"
      @version="setVersion"
      @update:changed-only="(value) => pane.updateTab(tab.id, { changedOnly: value })"
    />
    <div v-else-if="state === 'gone'" class="ag-stv-note">
      <p class="ag-stv-text">This table is no longer available.</p>
    </div>
    <div v-else-if="state === 'error'" class="ag-stv-note">
      <p class="ag-stv-text">The table could not be loaded.</p>
      <AgButton size="xs" :icon="RotateCw" @click="load({ force: true })">Retry</AgButton>
    </div>
    <div v-else class="ag-stv-skeleton" role="status" aria-label="Loading the results table">
      <span v-for="n in 5" :key="n" class="ag-stv-bar" :style="{ width: `${92 - n * 9}%` }"></span>
    </div>
  </div>
</template>

<script setup>
// A research's results table in the pane (tab kind `table`). The table comes
// from a loaded message when the chat holds it, else from the API; the tab's
// version is null for the latest.
import { computed, ref, watch } from 'vue'
import { RotateCw } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import SwarmTable from '@/components/agent/swarm/SwarmTable.vue'
import { errorInfo } from '@/components/agent/message/parts'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'

const props = defineProps({
  // {id: 'table:<swarmId>', kind: 'table', swarmId, version, title}
  tab: { type: Object, required: true },
})

const agent = useAgentStore()
const pane = useAgentPaneStore()

const swarmId = computed(() => String(props.tab.swarmId || ''))
const entry = computed(() => (agent.swarms && agent.swarms[swarmId.value]) || null)

const latest = computed(() => {
  try {
    return Number(agent.latestSwarmVersion(swarmId.value)) || null
  } catch {
    return null
  }
})
const version = computed(() => Number(props.tab.version) || latest.value || null)

// The version this view fetched, in case the store keeps it elsewhere.
const fetched = ref(null)

function storeTable(sid, v) {
  try {
    return agent.swarmTable(sid, v) || null
  } catch {
    return null
  }
}

const table = computed(() => {
  if (!swarmId.value || !version.value) return null
  const found = storeTable(swarmId.value, version.value)
  if (found) return found
  const f = fetched.value
  return f && f.swarmId === swarmId.value && f.version === version.value ? f.table : null
})

// The message that shows this version: the one holding its table part, else
// the one the API names.
const message = computed(() => {
  const v = version.value
  if (!v) return null
  for (const m of Object.values(agent.messages || {})) {
    for (const part of (m && m.parts) || []) {
      if (part && part.type === 'swarm_table' && part.swarm_id === swarmId.value && Number(part.version) === v) return m
    }
  }
  const loaded = entry.value && entry.value.versions && entry.value.versions[v]
  const summary = entry.value && entry.value.detail && (entry.value.detail.versions || []).find((s) => s.version === v)
  const id = (loaded && loaded.message_id) || (summary && summary.message_id) || null
  return (id && agent.messages && agent.messages[id]) || null
})

const chatId = computed(() => {
  if (message.value && message.value.chat_id) return message.value.chat_id
  return (entry.value && entry.value.detail && entry.value.detail.chat_id) || null
})

const busy = computed(() => {
  if (!chatId.value) return false
  try {
    return Boolean(agent.isChatBusy(chatId.value))
  } catch {
    return false
  }
})

// idle | loading | gone | error
const state = ref('idle')
let request = 0

function notFound(error) {
  if (!error) return false
  const info = errorInfo(error)
  return info.status === 404 || info.code === 'not_found'
}

function failed(error) {
  return notFound(error) ? 'gone' : 'error'
}

async function load({ force = false } = {}) {
  const sid = swarmId.value
  if (!sid || (table.value && !force)) return
  const mine = ++request
  state.value = 'loading'
  try {
    let v = version.value
    if (!v) {
      // The latest version is known once the swarm's detail has loaded.
      const detail = await agent.loadSwarm(sid, { force })
      if (mine !== request) return
      v = Number(props.tab.version) || latest.value || Number(detail && detail.latest_version) || null
      if (!v) {
        state.value = detail ? 'gone' : failed(entry.value && entry.value.error)
        return
      }
    }
    const loaded = await agent.loadSwarmVersion(sid, v, { force })
    if (mine !== request) return
    if (loaded && loaded.table) fetched.value = { swarmId: sid, version: v, table: loaded.table }
    if (table.value) state.value = 'idle'
    else if (!loaded) state.value = failed(entry.value && entry.value.error)
    else state.value = loaded.table ? 'idle' : 'gone'
  } catch (error) {
    if (mine === request) state.value = failed(error)
  }
}

watch(
  () => [swarmId.value, version.value],
  () => {
    if (!table.value) load()
  },
  { immediate: true }
)

function setVersion(next) {
  pane.updateTab(props.tab.id, { version: next ?? null })
}
</script>

<style scoped>
.ag-stv {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ag-stv-note {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 24px 20px;
}

.ag-stv-text {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-stv-skeleton {
  display: grid;
  gap: 14px;
  padding: 24px 20px;
}

.ag-stv-bar {
  display: block;
  height: 12px;
  border-radius: var(--radius);
  background: var(--ag-row-hover);
}
</style>
