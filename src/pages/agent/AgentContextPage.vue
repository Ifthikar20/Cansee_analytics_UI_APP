<script setup>
// The Context Manager (p2_contract.md 11): what the agents know about the
// project in six sections, each entry with the sources it comes from, plus
// documents people add. Build from my site reads the site and suggests
// entries a person accepts; the agents use active entries only. Leaving
// with an unsaved entry form asks first.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { Check, FilePlus, Hammer } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'
import { useBrandContext } from '@/composables/agent/useBrandContext'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { IconContext } from '@/components/agent/icons'
import ContextBuildDialog from '@/components/agent/context/ContextBuildDialog.vue'
import ContextBuildProgress from '@/components/agent/context/ContextBuildProgress.vue'
import ContextDocumentDialog from '@/components/agent/context/ContextDocumentDialog.vue'
import ContextDocuments from '@/components/agent/context/ContextDocuments.vue'
import ContextEntryForm from '@/components/agent/context/ContextEntryForm.vue'
import ContextSection from '@/components/agent/context/ContextSection.vue'
import ContextSectionNav from '@/components/agent/context/ContextSectionNav.vue'
import ReferencePicker from '@/components/agent/context/ReferencePicker.vue'
import { CONTEXT_LIMITS, contextSections, domainOf, plural } from '@/lib/agent/contextSections'

const BUILD_REASONS = {
  insights_disabled: "Building from your site isn't available on this server.",
  ai_not_configured: "The analysis model isn't configured on this server.",
}

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const ui = useAgentUiStore()
const toast = useToast()

const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))
const website = computed(() => app.websites.find((w) => String(w.id) === wid.value) || null)
const projectName = computed(() => website.value?.name || app.activeWebsite?.name || 'this project')
const domain = computed(() => domainOf(website.value?.url || ''))

const ctx = useBrandContext(wid)
const builder = useInsightRun('context_build', {
  websiteId: wid,
  onFinished: () => ctx.reload({ quiet: true }),
})

const overview = computed(() => ctx.overview.value)
const canEdit = computed(() => ctx.canEdit.value)
const sections = computed(() => contextSections(overview.value?.sections))
const entries = computed(() => ctx.entries.value)
const documents = computed(() => ctx.documents.value)
const competitors = computed(() => (Array.isArray(overview.value?.competitors) ? overview.value.competitors : []))
const totals = computed(() => overview.value?.totals || {})
const suggested = computed(() => entries.value.filter((e) => e.status === 'suggested'))
const empty = computed(() => Boolean(overview.value) && !entries.value.length)

const buildInfo = computed(() => overview.value?.build || null)
const buildAvailable = computed(() => buildInfo.value?.available !== false)
const buildReason = computed(() => BUILD_REASONS[buildInfo.value?.reason] || '')

// A build running (from another tab or an earlier visit) shows its progress
// even before the run options answer.
watch(
  () => buildInfo.value?.active_run,
  (active) => {
    if (active && !builder.run.value) builder.track(active)
  },
)

const intro = computed(
  () =>
    `What the agents know about ${projectName.value}, and where each piece comes from. Agents use active entries; suggestions wait for you.`,
)

function entriesOf(key) {
  return entries.value.filter((e) => e.section === key)
}

/* ── Loading ── */

const status = computed(() => {
  if (overview.value) return 'ready'
  if (ctx.error.value) return 'error'
  return 'loading'
})

/* ── Entry forms (one open at a time) ── */

// {id: entry id | 'new', section}
const editing = ref(null)
const formDirty = ref(false)

function closeForm() {
  editing.value = null
  formDirty.value = false
}

// Another project: its context replaces this one, and no form stays open.
watch(
  wid,
  (id) => {
    closeForm()
    if (id) ctx.reload()
  },
  { immediate: true },
)

function guardForm(next) {
  if (!formDirty.value) {
    next()
    return
  }
  pendingAction = next
  leaveOpen.value = true
}

function startAdd(sectionKey = 'company') {
  guardForm(() => {
    editing.value = { id: 'new', section: sectionKey }
    formDirty.value = false
    nextTick(() => document.getElementById(`ctx-${sectionKey}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  })
}

function startEdit(entry) {
  guardForm(() => {
    editing.value = { id: entry.id, section: entry.section }
    formDirty.value = false
  })
}

function editingIn(key) {
  const e = editing.value
  if (!e) return ''
  if (e.id === 'new') return e.section === key ? 'new' : ''
  return entriesOf(key).some((x) => x.id === e.id) ? e.id : ''
}

async function saveForm(entry, fields, changes) {
  const saved = await ctx.saveEntry(entry, fields, changes)
  ui.announce(entry ? 'Entry saved' : 'Entry added')
  return saved
}

async function reloadConflict(entry) {
  await ctx.resolveConflict(entry.id)
  // Their version replaces the form.
  closeForm()
}

/* ── Suggestions ── */

const busyIds = ref([])

async function decide(entry, accept) {
  busyIds.value = [...busyIds.value, entry.id]
  try {
    await ctx.review(accept ? { accept: [entry.id] } : { dismiss: [entry.id] })
    ui.announce(accept ? 'Suggestion accepted' : 'Suggestion dismissed')
  } catch (err) {
    toast.error(err?.message || "Couldn't update the suggestions. Try again.")
  } finally {
    busyIds.value = busyIds.value.filter((id) => id !== entry.id)
  }
}

const acceptingAll = ref(false)

async function acceptAll() {
  if (acceptingAll.value || !suggested.value.length) return
  acceptingAll.value = true
  try {
    await ctx.review({ accept: suggested.value.map((e) => e.id) })
    ui.announce('Suggestions accepted')
  } catch (err) {
    toast.error(err?.message || "Couldn't update the suggestions. Try again.")
  } finally {
    acceptingAll.value = false
  }
}

function reviewFirst() {
  const first = suggested.value[0]
  if (!first) return
  const el = document.querySelector(`[data-entry="${first.id}"]`)
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const button = el.querySelector('button')
  if (button) button.focus({ preventScroll: true })
}

const suggestionLine = computed(() => {
  const n = Number(totals.value.suggested) || suggested.value.length
  return n === 1 ? '1 suggestion waits for your review.' : `${plural(n, 'suggestion', 'suggestions')} wait for your review.`
})

/* ── Sources added from an entry's menu ── */

const pickerEntry = ref(null)
const pickerOpen = ref(false)
const pickerBusy = ref(false)
const pickerError = ref('')

function openPicker(entry) {
  pickerEntry.value = entry
  pickerError.value = ''
  pickerOpen.value = true
}

async function addSource({ input }) {
  if (!pickerEntry.value || pickerBusy.value) return
  pickerBusy.value = true
  pickerError.value = ''
  try {
    await ctx.addReference(pickerEntry.value, input)
    pickerOpen.value = false
    ui.announce('Source added')
  } catch (err) {
    pickerError.value = err?.message || "Couldn't add the source. Try again."
  } finally {
    pickerBusy.value = false
  }
}

/* ── Deleting (entries and documents) ── */

// {type: 'entry' | 'document', target}
const deleting = ref(null)
const deleteOpen = ref(false)
const deleteBusy = ref(false)
const deleteError = ref('')

const deleteCopy = computed(() => {
  const d = deleting.value
  if (d?.type === 'document') {
    return {
      title: `Delete ${d.target.title || 'this document'}?`,
      description: 'Entries that cite it lose that source; their text stays.',
    }
  }
  return { title: 'Delete this entry?', description: 'The agents stop using it.' }
})

function askDelete(type, target) {
  deleting.value = { type, target }
  deleteError.value = ''
  deleteOpen.value = true
}

async function confirmDelete() {
  const d = deleting.value
  if (!d || deleteBusy.value) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    if (d.type === 'document') await ctx.deleteDocument(d.target.id)
    else await ctx.deleteEntry(d.target)
    deleteOpen.value = false
    ui.announce(d.type === 'document' ? 'Document deleted' : 'Entry deleted')
  } catch (err) {
    deleteError.value = err?.message || "Couldn't delete it. Try again."
  } finally {
    deleteBusy.value = false
  }
}

/* ── Documents ── */

const documentOpen = ref(false)
const documentTarget = ref(null)
const documentsFull = computed(() => documents.value.length >= CONTEXT_LIMITS.documents)

function openDocument(doc = null) {
  documentTarget.value = doc
  documentOpen.value = true
}

async function saveDocument(fields, doc) {
  if (doc) await ctx.updateDocument(doc.id, fields)
  else await ctx.createDocument(fields)
  ui.announce('Document saved')
}

/* ── Build from my site ── */

function openBuild() {
  if (!buildAvailable.value) return
  builder.open({
    synthesize: buildInfo.value?.reason !== 'ai_not_configured',
    extra_urls: [],
    document_ids: null,
  })
}

/* ── Leaving with an unsaved form ── */

const leaveOpen = ref(false)
let pendingRoute = null
let pendingAction = null
let bypass = false

function guard(to) {
  if (bypass || !formDirty.value) return true
  pendingRoute = to
  pendingAction = null
  leaveOpen.value = true
  return false
}

onBeforeRouteLeave(guard)
onBeforeRouteUpdate((to, from) => {
  if (to.params?.websiteId === from.params?.websiteId) return true
  return guard(to)
})

function leave() {
  const to = pendingRoute
  const action = pendingAction
  leaveOpen.value = false
  pendingRoute = null
  pendingAction = null
  if (action) {
    formDirty.value = false
    action()
    return
  }
  if (!to) return
  bypass = true
  router.push(to.fullPath).finally(() => {
    bypass = false
  })
}

function stay() {
  pendingRoute = null
  pendingAction = null
}

function onBeforeUnload(event) {
  if (!formDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <AgPage title="Context" :intro="intro" :busy="status === 'loading'">
    <template v-if="canEdit" #actions>
      <!-- Unavailable, the button stays focusable so its tooltip says why. -->
      <AgTooltip v-if="!buildAvailable" :text="buildReason" :disabled="!buildReason">
        <button type="button" class="ag-ctx-build-off" aria-disabled="true">
          <Hammer :size="16" aria-hidden="true" />
          Build from my site
        </button>
      </AgTooltip>
      <AgButton v-else size="sm" variant="primary" :icon="Hammer" @click="openBuild">Build from my site</AgButton>
      <AgButton size="sm" :icon="FilePlus" :disabled="documentsFull" @click="openDocument()">Add document</AgButton>
    </template>

    <template #intro>
      <p class="ag-ctx-links">
        Facts about the brand itself live in
        <RouterLink :to="{ name: 'settings-brand-facts' }" class="ag-ctx-link">Brand facts</RouterLink>,
        and the website details in
        <RouterLink :to="{ name: 'settings-project' }" class="ag-ctx-link">Project settings</RouterLink>.
      </p>
    </template>

    <div v-if="status === 'loading'" class="ag-ctx-loading" aria-live="polite">
      <AgSpinner :size="14" />
      <span>Loading context</span>
    </div>

    <AgEmptyState
      v-else-if="status === 'error'"
      :icon="IconContext"
      tone="error"
      title="Couldn't load the context."
      :body="ctx.error.value"
    >
      <AgButton size="sm" @click="ctx.reload()">Try again</AgButton>
    </AgEmptyState>

    <div v-else class="ag-ctx">
      <p v-if="!canEdit" class="ag-ctx-readonly">You can read this context. Editing needs member access.</p>

      <ContextBuildProgress
        v-if="builder.run.value"
        :run="builder.run.value"
        :stopping="builder.stopping.value"
        :stop-error="builder.stopError.value"
        @stop="builder.stop()"
        @dismiss="builder.dismiss()"
      />

      <div v-if="suggested.length" class="ag-ctx-banner" role="status">
        <span>{{ suggestionLine }}</span>
        <div v-if="canEdit" class="ag-ctx-banner-actions">
          <AgButton size="xs" variant="primary" :icon="Check" :loading="acceptingAll" @click="acceptAll">
            Accept all
          </AgButton>
          <AgButton size="xs" @click="reviewFirst">Review</AgButton>
        </div>
      </div>

      <AgEmptyState
        v-if="empty && !editing"
        :icon="IconContext"
        title="No context yet."
        body="Build it from your site: Cansee reads up to 8 pages and suggests entries with their sources. You see the cost first."
      >
        <template v-if="canEdit">
          <AgButton size="sm" variant="primary" :disabled="!buildAvailable" @click="openBuild">Build from my site</AgButton>
          <AgButton size="sm" @click="startAdd('company')">Add an entry</AgButton>
        </template>
      </AgEmptyState>

      <ContextSectionNav v-else :sections="sections" />

      <ContextSection
        v-for="s in sections"
        :key="s.key"
        :section="s"
        :entries="entriesOf(s.key)"
        :can-edit="canEdit"
        :editing="editingIn(s.key)"
        :busy-ids="busyIds"
        @add="startAdd"
        @accept="decide($event, true)"
        @dismiss="decide($event, false)"
        @edit="startEdit"
        @add-source="openPicker"
        @delete="askDelete('entry', $event)"
      >
        <template #form="{ entry }">
          <ContextEntryForm
            :key="entry ? entry.id : `new-${s.key}`"
            :entry="entry"
            :section="s.key"
            :sections="sections"
            :website-id="wid"
            :domain="domain"
            :documents="documents"
            :competitors="competitors"
            :conflict="Boolean(entry && ctx.conflicts.value[entry.id])"
            :save="saveForm"
            @dirty="formDirty = $event"
            @done="closeForm"
            @cancel="closeForm"
            @reload="reloadConflict(entry)"
          />
        </template>
      </ContextSection>

      <ContextDocuments
        :documents="documents"
        :can-edit="canEdit"
        @edit="openDocument"
        @delete="askDelete('document', $event)"
      />
    </div>

    <ContextBuildDialog :builder="builder" :build="buildInfo" :domain="domain" />

    <ContextDocumentDialog
      v-model:open="documentOpen"
      :document="documentTarget"
      :load="ctx.loadDocument"
      :save="saveDocument"
    />

    <ReferencePicker
      v-model:open="pickerOpen"
      :website-id="wid"
      :domain="domain"
      :documents="documents"
      :competitors="competitors"
      :busy="pickerBusy"
      :error="pickerError"
      @add="addSource"
    />

    <AgConfirmDialog
      v-model:open="deleteOpen"
      :title="deleteCopy.title"
      :description="deleteCopy.description"
      confirm-label="Delete"
      busy-label="Deleting"
      destructive
      :busy="deleteBusy"
      :error="deleteError"
      @confirm="confirmDelete"
    />

    <AgConfirmDialog
      v-model:open="leaveOpen"
      title="Leave without saving?"
      description="Your changes to the context have not been saved."
      confirm-label="Leave"
      cancel-label="Keep editing"
      destructive
      @confirm="leave"
      @cancel="stay"
    />
  </AgPage>
</template>

<style scoped>
.ag-ctx-links {
  margin: -8px 0 24px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-ctx-link {
  color: var(--ag-fg-1);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
}

.ag-ctx-link:hover {
  text-decoration-color: currentColor;
  opacity: 1;
}

.ag-ctx-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 4px;
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-ctx {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.ag-ctx-readonly {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-ctx-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--ag-accent) 35%, transparent);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--ag-accent) 6%, transparent);
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
}

.ag-ctx-banner-actions {
  display: flex;
  gap: 8px;
}

.ag-ctx-build-off {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ag-send-bg);
  border-radius: var(--radius);
  background: var(--ag-send-bg);
  color: var(--ag-send-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  opacity: 0.5;
  cursor: default;
}

.ag-ctx-build-off:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
