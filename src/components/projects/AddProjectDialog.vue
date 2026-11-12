<template>
  <BaseModal :model-value="open" title="Add a project" @update:model-value="open = $event">
    <div v-if="!appStore.canCreateProject" class="apj-limit">
      <p>
        Your <strong>{{ authStore.planState.tierLabel }}</strong> allows
        {{ appStore.projectLimit }} {{ appStore.projectLimit === 1 ? 'project' : 'projects' }}.
      </p>
      <p>Upgrade in Billing to add more projects.</p>
    </div>
    <form v-else id="add-project-form" class="apj" @submit.prevent="create">
      <label class="apj-field">
        <span class="apj-label">Project name</span>
        <input v-model="form.name" class="apj-input" placeholder="Project name" required />
      </label>
      <label class="apj-field">
        <span class="apj-label">Website URL</span>
        <input v-model="form.url" class="apj-input" placeholder="https://yourcompany.com" required />
      </label>
      <label class="apj-field">
        <span class="apj-label">Industry <span class="apj-optional">(optional)</span></span>
        <input v-model="form.industry" class="apj-input" placeholder="SaaS, e-commerce, legal..." />
      </label>
      <p v-if="error" class="apj-error">{{ error }}</p>
    </form>

    <template #footer>
      <div class="apj-footer">
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button v-if="!appStore.canCreateProject" @click="goToBilling">Open Billing</Button>
        <Button v-else type="submit" form="add-project-form" :disabled="!form.name || !form.url || creating">
          {{ creating ? 'Creating...' : 'Create project' }}
        </Button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'
import api from '@/api/client'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const open = defineModel('open', { type: Boolean, default: false })

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const toast = useToast()

const form = ref({ name: '', url: '', industry: '' })
const creating = ref(false)
const error = ref('')

async function create() {
  creating.value = true
  error.value = ''
  try {
    // Silent: the dialog shows the failure inline.
    const { data: project } = await api.post('/websites/', form.value, { _silentError: true })
    appStore.websites.push(project)
    appStore.setActiveWebsite(project)
    form.value = { name: '', url: '', industry: '' }
    open.value = false
    toast.success('Project created. Add the prompts you want to track.')
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err.displayMessage || "We couldn't create the project. Please check the URL and try again."
  } finally {
    creating.value = false
  }
}

function goToBilling() {
  open.value = false
  router.push('/billing')
}
</script>

<style scoped>
.apj {
  display: grid;
  gap: 14px;
}

.apj-field {
  display: grid;
  gap: 6px;
}

.apj-label {
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
}

.apj-optional {
  color: var(--muted-foreground);
  font-weight: 400;
}

.apj-input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
}

.apj-input:focus-visible {
  border-color: var(--ring);
  border-radius: var(--radius);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.apj-error {
  color: var(--destructive);
  font-size: 13px;
}

.apj-limit {
  display: grid;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.apj-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
