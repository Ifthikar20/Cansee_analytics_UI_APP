<template>
  <!-- First-run onboarding takes over the page until the user has a project. -->
  <OnboardingFlow v-if="showOnboarding" />

  <div v-else class="an-entry">
    <section v-if="state === 'failed'" class="an-entry-state" role="alert">
      <p class="an-entry-title">We couldn't load your projects.</p>
      <Button variant="outline" class="an-entry-btn rounded-full" @click="settle({ force: true })">Try again</Button>
    </section>

    <section v-else-if="state === 'empty'" class="an-entry-state">
      <p class="an-entry-title">No project selected.</p>
      <p class="an-entry-sub">Add a project to start tracking prompts.</p>
      <Button class="an-entry-btn rounded-full" @click="showAddProject = true">
        <Plus class="size-4" />
        Add project
      </Button>
    </section>

    <div v-else class="an-entry-skeleton" aria-hidden="true">
      <Skeleton class="h-24 rounded-2xl" />
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <AddProjectDialog v-model:open="showAddProject" />
  </div>
</template>

<script setup>
// /dashboard when it has no board to open (board_contract.md 2 and 9): the
// onboarding flow for a first-run user, a project list that failed to load,
// or no project yet. Once a project exists it opens that project's board,
// keeping the address's query and hash. The guard (router/analyticsEntry.js)
// sends everyone else straight to a board.
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow.vue'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { boardLocation } from '@/lib/board/links'
import { ensureWebsites } from '@/router/ensureWebsites'
import { activeProjectId, entryProjectId } from '@/router/analyticsEntry'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const auth = useAuthStore()

const showOnboarding = computed(() => auth.session?.onboarding?.needs_onboarding === true)

// loading | failed | empty
const state = ref('loading')
const showAddProject = ref(false)

// A navigation away (the onboarding flow opening a chat) wins over the
// board this page would open.
let leaving = false
onBeforeRouteLeave(() => {
  leaving = true
})

function openBoard(id) {
  if (leaving || route.name !== 'dashboard') return
  router.replace({ ...boardLocation(id), query: { ...route.query }, hash: route.hash }).catch(() => {})
}

async function settle({ force = false } = {}) {
  if (showOnboarding.value) return
  state.value = 'loading'
  // The same choice as the /dashboard guard, read before the list loads.
  const chosen = activeProjectId()
  let websites
  try {
    websites = await ensureWebsites({ force, rejectOnError: true })
  } catch {
    if (!leaving) state.value = 'failed'
    return
  }
  if (leaving || showOnboarding.value) return
  const id = entryProjectId(websites, chosen)
  if (id) openBoard(id)
  else state.value = 'empty'
}

onMounted(() => settle())

// Finishing onboarding creates the first project; pick it up.
watch(showOnboarding, (now, before) => {
  if (before && !now) settle({ force: true })
})

// A project that becomes active while this page says there is none (Add
// project, or the shell's own list load after a failed one) opens its board.
watch(
  () => app.activeWebsite?.id,
  (id) => {
    if (state.value === 'loading' || showOnboarding.value) return
    if (id !== undefined && id !== null && id !== '') openBoard(String(id))
  },
)
</script>

<style scoped>
/* The frame renders this page straight into its main: it sets its own box. */
.an-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  box-sizing: border-box;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
}

@media (max-width: 767px) {
  .an-entry {
    padding: 16px;
  }
}

.an-entry-state {
  display: grid;
  justify-items: start;
  gap: 6px;
  padding: 28px 30px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--card);
}

.an-entry-title {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
}

.an-entry-sub {
  color: var(--muted-foreground);
  font-size: 14px;
}

.an-entry-btn {
  margin-top: 8px;
}

.an-entry-skeleton {
  display: grid;
  gap: 16px;
}
</style>
