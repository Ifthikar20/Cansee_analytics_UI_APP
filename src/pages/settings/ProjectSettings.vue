<template>
  <SettingsShell active="project">
    <p v-if="!websiteId" class="ps-muted">Pick a project in the header, or add one, to edit its settings.</p>

    <p v-else-if="loadState === 'loading'" class="ps-muted">Loading project settings...</p>

    <!-- Without the saved values the form would overwrite them with blanks. -->
    <div v-else-if="loadState === 'failed'" class="ps-failed">
      <p class="ps-muted">We couldn't load this project's settings.</p>
      <Button variant="outline" class="ps-btn" @click="load">Try again</Button>
    </div>

    <template v-else>
      <SettingsSection
        label="Project"
        title="Details"
        description="How Cansee names this project and describes the business to the AI engines."
      >
        <form id="ps-details-form" class="ps-form" @submit.prevent="saveDetails">
          <div class="ps-field">
            <label for="ps-name" class="ps-label">Project name</label>
            <input id="ps-name" v-model="details.name" class="ps-input" required />
          </div>
          <div class="ps-field">
            <label for="ps-url" class="ps-label">Website</label>
            <input id="ps-url" :value="details.url" class="ps-input" disabled />
          </div>
          <div class="ps-field">
            <label for="ps-industry" class="ps-label">Industry</label>
            <input id="ps-industry" v-model="details.industry" class="ps-input" placeholder="SaaS, e-commerce, legal..." />
          </div>
          <div class="ps-field">
            <label for="ps-description" class="ps-label">What the business does</label>
            <textarea id="ps-description" v-model="details.description" class="ps-input ps-textarea" rows="3"></textarea>
          </div>
        </form>
        <template #footer>
          <span v-if="detailsState" class="ps-note" :class="{ 'is-error': detailsState === 'error' }">
            {{ detailsState === 'saved' ? 'Saved' : "Couldn't save. Try again." }}
          </span>
          <Button type="submit" form="ps-details-form" class="ps-btn" :disabled="savingDetails || !details.name">
            {{ savingDetails ? 'Saving...' : 'Save changes' }}
          </Button>
        </template>
      </SettingsSection>

      <SettingsSection
        label="Project"
        title="Competitors"
        description="Brands you compete with. Cansee flags them when they outrank you on Google or are recommended ahead of you."
      >
        <div class="ps-comps">
          <p v-if="!competitors.length" class="ps-muted">No competitors yet.</p>
          <div v-for="(c, i) in competitors" :key="i" class="ps-comp">
            <input v-model="c.name" class="ps-input" placeholder="Brand name" :aria-label="`Competitor ${i + 1} name`" />
            <input v-model="c.domain" class="ps-input" placeholder="domain.com" :aria-label="`Competitor ${i + 1} domain`" />
            <Button variant="ghost" size="icon" class="ps-remove" :aria-label="`Remove competitor ${i + 1}`" @click="competitors.splice(i, 1)">
              <X class="size-4" />
            </Button>
          </div>
          <Button variant="outline" class="ps-btn ps-add" :disabled="competitors.length >= 25" @click="competitors.push({ name: '', domain: '' })">
            <Plus class="size-4" /> Add competitor
          </Button>
        </div>
        <template #footer>
          <span v-if="compState" class="ps-note" :class="{ 'is-error': compState === 'error' }">
            {{ compState === 'saved' ? 'Saved' : "Couldn't save. Try again." }}
          </span>
          <Button class="ps-btn" :disabled="savingComps" @click="saveCompetitors">
            {{ savingComps ? 'Saving...' : 'Save competitors' }}
          </Button>
        </template>
      </SettingsSection>

      <SettingsSection
        label="Danger zone"
        title="Delete project"
        description="Removes this project, its prompts and their history for everyone who can see it."
        danger
      >
        <Button variant="destructive" class="ps-btn" :disabled="deleting" @click="deleteProject">
          {{ deleting ? 'Deleting...' : confirmDelete ? 'Click again to delete' : 'Delete project' }}
        </Button>
      </SettingsSection>
    </template>
  </SettingsShell>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, X } from '@lucide/vue'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import { Button } from '@/components/ui/button'
import api from '@/api/client'
import websitesApi from '@/api/websites'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const toast = useToast()

const websiteId = computed(() => appStore.activeWebsite?.id || '')

const details = ref({ name: '', url: '', industry: '', description: '' })
const competitors = ref([])
const loadState = ref('loading') // loading | ready | failed
const savingDetails = ref(false)
const savingComps = ref(false)
const detailsState = ref('')
const compState = ref('')
const deleting = ref(false)
const confirmDelete = ref(false)

async function load() {
  const id = websiteId.value
  if (!id) return
  confirmDelete.value = false
  loadState.value = 'loading'
  try {
    // Silent: the page shows the failure inline.
    const { data } = await api.get(`/websites/${id}/`, { _silentError: true })
    if (id !== websiteId.value) return
    details.value = {
      name: data.name || '',
      url: data.url || '',
      industry: data.industry || '',
      description: data.description || '',
    }
    competitors.value = (data.competitors || []).map((c) =>
      typeof c === 'string' ? { name: c, domain: '' } : { name: c.name || '', domain: c.domain || '' },
    )
    loadState.value = 'ready'
  } catch {
    if (id === websiteId.value) loadState.value = 'failed'
  }
}

// Saves report their outcome next to the button, so they are silent.
function saveProject(payload) {
  return api.put(`/websites/${websiteId.value}/`, payload, { _silentError: true })
}

function syncStore(project) {
  const i = appStore.websites.findIndex((w) => w.id === project.id)
  if (i !== -1) appStore.websites.splice(i, 1, { ...appStore.websites[i], ...project })
  if (appStore.activeWebsite?.id === project.id) appStore.setActiveWebsite({ ...appStore.activeWebsite, ...project })
}

async function saveDetails() {
  savingDetails.value = true
  detailsState.value = ''
  try {
    const { name, industry, description } = details.value
    const { data } = await saveProject({ name, industry, description })
    syncStore(data)
    detailsState.value = 'saved'
  } catch {
    detailsState.value = 'error'
  } finally {
    savingDetails.value = false
  }
}

async function saveCompetitors() {
  savingComps.value = true
  compState.value = ''
  try {
    const rows = competitors.value
      .map((c) => ({ name: c.name.trim(), domain: c.domain.trim() }))
      .filter((c) => c.name)
    const { data } = await saveProject({ competitors: rows })
    competitors.value = (data.competitors || []).map((c) => ({ ...c }))
    syncStore(data)
    // The list just changed, which queues the edit watcher below that clears
    // the note; let it run first, or 'Saved' would be wiped before it shows.
    await nextTick()
    compState.value = 'saved'
  } catch {
    compState.value = 'error'
  } finally {
    savingComps.value = false
  }
}

// Two clicks: the first arms the button, the second deletes.
async function deleteProject() {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  deleting.value = true
  try {
    await websitesApi.delete(websiteId.value)
    const remaining = appStore.websites.filter((w) => w.id !== websiteId.value)
    appStore.setWebsites(remaining)
    appStore.setActiveWebsite(remaining[0] || null)
    // With no project left the session routes the user back to onboarding.
    await authStore.fetchSession()
    toast.success('Project deleted.')
    router.push({ name: 'dashboard' })
  } catch {
    deleting.value = false
    confirmDelete.value = false
  }
}

watch(websiteId, load, { immediate: true })
// An edit after a save hides that section's 'Saved' or error note.
watch(details, () => {
  detailsState.value = ''
}, { deep: true })
watch(competitors, () => {
  compState.value = ''
}, { deep: true })
</script>

<style scoped>
.ps-form,
.ps-comps {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ps-field {
  display: flex;
  flex-direction: column;
}

.ps-label {
  margin: 0 0 6px;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
}

.ps-input {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
}

.ps-textarea {
  height: auto;
  padding: 10px 14px;
  line-height: 1.55;
  resize: vertical;
}

.ps-input:focus,
.ps-input:focus-visible {
  border-color: var(--ring);
  border-radius: var(--radius);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}

.ps-input:disabled {
  background: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}

.ps-comp {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 36px;
  gap: 8px;
  align-items: center;
}

.ps-add {
  align-self: flex-start;
}

.ps-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius);
  font-size: 13px;
}

.ps-note {
  color: var(--muted-foreground);
  font-size: 12px;
}

.ps-note.is-error {
  color: var(--destructive);
}

.ps-muted {
  color: var(--muted-foreground);
  font-size: 14px;
}

.ps-failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>
