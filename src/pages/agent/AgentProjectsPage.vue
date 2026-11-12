<script setup>
// Every project (website) the agent can work in. Opening one switches the
// workspace to it; Add project opens the shared dialog.
import { computed, onMounted, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAgentUiStore } from '@/stores/agentUi'
import { useProjectSwitch } from '@/composables/agent/useProjectSwitch'
import { ensureWebsites } from '@/router/ensureWebsites'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgMonogram from '@/components/agent/common/AgMonogram.vue'
import AgSearchField from '@/components/agent/common/AgSearchField.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { IconProjects } from '@/components/agent/icons'
import { errorMessage, hostOf } from '@/components/agent/common/agentText'

const SEARCH_FROM = 7
const COUNT_KEYS = ['tracked_prompt_count', 'tracked_prompts_count', 'prompt_count', 'prompts_count']

const app = useAppStore()
const auth = useAuthStore()
const ui = useAgentUiStore()
const { switchProject } = useProjectSwitch()

const loading = ref(!app.websites.length)
const loadError = ref('')
const query = ref('')

const websites = computed(() => (Array.isArray(app.websites) ? app.websites : []))
const activeId = computed(() => String(app.activeWebsite?.id ?? ''))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return websites.value
  return websites.value.filter((w) =>
    [w.name, w.url, w.industry].some((v) => String(v || '').toLowerCase().includes(q)),
  )
})

function promptCount(w) {
  for (const key of COUNT_KEYS) {
    const n = Number(w?.[key])
    if (w?.[key] !== undefined && w?.[key] !== null && Number.isFinite(n)) return n
  }
  return null
}

function metaFor(w) {
  const bits = []
  if (w.industry) bits.push(w.industry)
  const count = promptCount(w)
  if (count !== null) bits.push(`${count} tracked ${count === 1 ? 'prompt' : 'prompts'}`)
  if (auth.org && w.created_by?.full_name) bits.push(`Added by ${w.created_by.full_name}`)
  return bits.join(' · ')
}

// A failed load is an error, never "No projects yet".
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    await ensureWebsites({ rejectOnError: true })
  } catch (err) {
    loadError.value = errorMessage(err, "Couldn't load your projects.")
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AgPage
    title="Projects"
    intro="Each project is one website. The agent researches, writes and builds for the project you open."
    :busy="loading"
  >
    <template #actions>
      <AgButton size="sm" :icon="Plus" @click="ui.openAddProject()">Add project</AgButton>
    </template>

    <div v-if="websites.length >= SEARCH_FROM" class="ag-projects-search">
      <AgSearchField v-model="query" label="Search projects" />
    </div>

    <div v-if="loading && !websites.length" class="ag-projects-loading" aria-live="polite">
      <AgSpinner :size="14" />
      <span>Loading projects</span>
    </div>

    <AgEmptyState
      v-else-if="!websites.length && loadError"
      :icon="IconProjects"
      tone="error"
      title="Couldn't load your projects."
      :body="loadError"
    >
      <AgButton size="sm" @click="load">Try again</AgButton>
    </AgEmptyState>

    <AgEmptyState
      v-else-if="!websites.length"
      :icon="IconProjects"
      title="No projects yet."
      body="Add your website to start working with the agent."
    >
      <AgButton variant="primary" size="sm" :icon="Plus" @click="ui.openAddProject()">Add project</AgButton>
    </AgEmptyState>

    <p v-else-if="!filtered.length" class="ag-projects-none">No projects match "{{ query.trim() }}".</p>

    <ul v-else class="ag-projects" role="list">
      <li v-for="w in filtered" :key="w.id" class="ag-project" :class="{ 'is-current': String(w.id) === activeId }">
        <AgMonogram :name="w.name" :size="32" />
        <div class="ag-project-text">
          <p class="ag-project-name">
            <span class="ag-project-name-text">{{ w.name }}</span>
            <span v-if="String(w.id) === activeId" class="ag-project-badge">Current</span>
          </p>
          <p v-if="w.url" class="ag-project-host">{{ hostOf(w.url) }}</p>
          <p v-if="metaFor(w)" class="ag-project-meta">{{ metaFor(w) }}</p>
        </div>
        <AgButton size="sm" :aria-label="`Open ${w.name}`" @click="switchProject(w.id)">Open</AgButton>
      </li>
    </ul>
  </AgPage>
</template>

<style scoped>
.ag-projects-search {
  margin-bottom: 16px;
}

.ag-projects-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 4px;
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-projects-none {
  margin: 0;
  padding: 24px 4px;
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-projects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-project {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-height: 72px;
  padding: 12px 16px 12px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.ag-project.is-current {
  border-color: color-mix(in srgb, var(--ag-accent) 45%, var(--ag-card-border));
}

.ag-project-text {
  flex: 1 1 auto;
  min-width: 0;
}

.ag-project-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-project-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-project-badge {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: var(--radius);
  background: var(--ag-you-bg);
  color: var(--ag-accent);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
}

.ag-project-host,
.ag-project-meta {
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-project-meta {
  color: var(--ag-fg-4);
  font-size: 12px;
}

@media (max-width: 420px) {
  .ag-projects {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
