<script setup>
// Brand context every agent writes with: audience, voice, offerings and
// rules. Saves with the context's revision; a stale revision means someone
// else saved first, and the page offers to reload. Leaving with unsaved
// edits asks first.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { Plus, RotateCcw, X } from '@lucide/vue'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { IconContext } from '@/components/agent/icons'
import { errorCode, errorMessage, errorStatus, relativeTime } from '@/components/agent/common/agentText'

// Same caps as the backend's BrandContextWriteSerializer.
const LIMITS = {
  audience: 4000,
  voice: 2000,
  offeringName: 120,
  offeringDescription: 1000,
  offeringUrl: 500,
  offerings: 20,
  rule: 500,
  rules: 30,
}

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const agent = useAgentStore()
const ui = useAgentUiStore()
const app = useAppStore()
const toast = useToast()

const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))
const projectName = computed(
  () => app.websites.find((w) => String(w.id) === wid.value)?.name || app.activeWebsite?.name || 'this project',
)

const status = ref('loading')
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const conflict = ref(false)
const fieldErrors = ref({})
const revision = ref(0)
const updatedAt = ref('')
const updatedBy = ref('')

const form = reactive({ audience: '', voice: '', offerings: [], rules: [] })
const baseline = ref('')
let rowSeq = 0

function nextKey() {
  rowSeq += 1
  return `row-${rowSeq}`
}

function snapshot() {
  return JSON.stringify({
    audience: form.audience,
    voice: form.voice,
    offerings: form.offerings.map(({ name, description, url }) => ({ name, description, url })),
    rules: form.rules.map((r) => r.text),
  })
}

const dirty = computed(() => status.value === 'ready' && snapshot() !== baseline.value)

function adopt(ctx) {
  const data = ctx && typeof ctx === 'object' ? ctx : {}
  form.audience = typeof data.audience === 'string' ? data.audience : ''
  form.voice = typeof data.voice === 'string' ? data.voice : ''
  form.offerings = (Array.isArray(data.offerings) ? data.offerings : [])
    .filter((o) => o && typeof o === 'object')
    .map((o) => ({
      key: nextKey(),
      name: String(o.name ?? ''),
      description: String(o.description ?? ''),
      url: String(o.url ?? ''),
    }))
  form.rules = (Array.isArray(data.rules) ? data.rules : [])
    .filter((r) => typeof r === 'string')
    .map((text) => ({ key: nextKey(), text }))
  revision.value = Number.isFinite(Number(data.revision)) ? Number(data.revision) : 0
  updatedAt.value = data.updated_at || ''
  updatedBy.value = data.updated_by_name || ''
  baseline.value = snapshot()
  fieldErrors.value = {}
  conflict.value = false
  saveError.value = ''
}

async function load() {
  if (!wid.value || typeof agent.loadContext !== 'function') return
  status.value = 'loading'
  loadError.value = ''
  try {
    const ctx = await agent.loadContext()
    adopt(ctx ?? agent.context)
    status.value = 'ready'
  } catch (err) {
    loadError.value = errorMessage(err, "Couldn't load the context.")
    status.value = 'error'
  }
}

/* ── Editing ── */

function addOffering() {
  if (form.offerings.length >= LIMITS.offerings) return
  const row = { key: nextKey(), name: '', description: '', url: '' }
  form.offerings.push(row)
  nextTick(() => document.getElementById(`${row.key}-name`)?.focus())
}

function removeOffering(index) {
  form.offerings.splice(index, 1)
}

/** Add an empty rule (after `afterIndex` when given) and focus it. */
function addRule(afterIndex) {
  if (form.rules.length >= LIMITS.rules) return
  const at = Number.isInteger(afterIndex) ? afterIndex + 1 : form.rules.length
  if (Number.isInteger(afterIndex) && !form.rules[afterIndex]?.text.trim()) return
  const row = { key: nextKey(), text: '' }
  form.rules.splice(at, 0, row)
  nextTick(() => document.getElementById(`${row.key}-text`)?.focus())
}

function removeRule(index) {
  form.rules.splice(index, 1)
}

function discard() {
  const saved = JSON.parse(baseline.value || '{}')
  adopt({ ...saved, revision: revision.value, updated_at: updatedAt.value, updated_by_name: updatedBy.value })
}

/* ── Saving ── */

function normalizeUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return { value: '' }
  if (/^https?:\/\//i.test(value)) return { value }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value)) return { value: `https://${value}` }
  return { error: 'Use a full web address, like https://…' }
}

function validate() {
  const errors = {}
  const offerings = []
  form.offerings.forEach((o, index) => {
    const name = o.name.trim()
    const description = o.description.trim()
    const url = normalizeUrl(o.url)
    if (!name && !description && !url.value && !url.error) return
    if (!name) errors[`offering-${o.key}-name`] = 'Give this offering a name.'
    if (url.error) errors[`offering-${o.key}-url`] = url.error
    offerings.push({ name, description, url: url.value || '', index })
  })
  const rules = form.rules.map((r) => r.text.trim()).filter(Boolean)
  fieldErrors.value = errors
  return { ok: Object.keys(errors).length === 0, offerings, rules }
}

async function save() {
  if (saving.value || status.value !== 'ready') return
  saveError.value = ''
  const { ok, offerings, rules } = validate()
  if (!ok) {
    saveError.value = 'Fix the highlighted fields, then save again.'
    ui.announce(saveError.value, 'assertive')
    return
  }
  saving.value = true
  try {
    const saved = await agent.saveContext({
      audience: form.audience.trim(),
      voice: form.voice.trim(),
      offerings: offerings.map(({ name, description, url }) => ({ name, description, url })),
      rules,
      revision: revision.value,
    })
    adopt(saved ?? agent.context)
    toast.success('Context saved')
    ui.announce('Context saved')
  } catch (err) {
    if (errorCode(err) === 'revision_conflict' || errorStatus(err) === 409) {
      conflict.value = true
      ui.announce('Someone else saved this context first.', 'assertive')
    } else {
      saveError.value = errorMessage(err, "Couldn't save the context. Try again.")
      ui.announce(saveError.value, 'assertive')
    }
  } finally {
    saving.value = false
  }
}

function onKeydown(event) {
  const mod = event.metaKey || event.ctrlKey
  if (mod && !event.altKey && !event.shiftKey && String(event.key).toLowerCase() === 's') {
    event.preventDefault()
    save()
  }
}

/* ── Leaving with unsaved edits ── */

const leaveOpen = ref(false)
let pendingRoute = null
let bypass = false

function guard(to) {
  if (bypass || !dirty.value) return true
  pendingRoute = to
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
  leaveOpen.value = false
  pendingRoute = null
  if (!to) return
  bypass = true
  router.push(to.fullPath).finally(() => {
    bypass = false
  })
}

function onBeforeUnload(event) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

// Another project: hide this one's form until the new context arrives.
watch(wid, () => {
  status.value = 'loading'
})

// Load once the store is scoped to this project (the shell runs init()).
watch(
  () => [wid.value, String(agent.websiteId ?? '')],
  ([id, storeId]) => {
    if (!id || storeId !== id || dirty.value) return
    load()
  },
  { immediate: true },
)

const savedLine = computed(() => {
  if (!updatedAt.value) return 'Not saved yet'
  const when = relativeTime(updatedAt.value)
  return updatedBy.value ? `Saved by ${updatedBy.value} ${when}` : `Saved ${when}`
})
</script>

<template>
  <AgPage
    title="Context"
    :intro="`What every agent knows about ${projectName}. It reads this before it writes a page, an article, an ad campaign or a report.`"
    :busy="status === 'loading'"
    @keydown="onKeydown"
  >
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
      :body="loadError"
    >
      <AgButton size="sm" @click="load">Try again</AgButton>
    </AgEmptyState>

    <form v-else class="ag-ctx" novalidate @submit.prevent="save">
      <div v-if="conflict" class="ag-ctx-banner" role="alert">
        <span>Someone else saved this context after you opened it. Reload to see their version; your edits here will be replaced.</span>
        <AgButton size="xs" :icon="RotateCcw" @click="load">Reload</AgButton>
      </div>

      <section class="ag-ctx-field">
        <label class="ag-ctx-label" for="ag-ctx-audience">Audience</label>
        <p id="ag-ctx-audience-help" class="ag-ctx-help">Who you sell to, what they need and how they decide.</p>
        <textarea
          id="ag-ctx-audience"
          v-model="form.audience"
          class="ag-ctx-input ag-ctx-area"
          rows="4"
          :maxlength="LIMITS.audience"
          aria-describedby="ag-ctx-audience-help"
          placeholder="Describe your customers"
        />
      </section>

      <section class="ag-ctx-field">
        <label class="ag-ctx-label" for="ag-ctx-voice">Voice</label>
        <p id="ag-ctx-voice-help" class="ag-ctx-help">How {{ projectName }} sounds: tone, words to use and words to avoid.</p>
        <textarea
          id="ag-ctx-voice"
          v-model="form.voice"
          class="ag-ctx-input ag-ctx-area"
          rows="4"
          :maxlength="LIMITS.voice"
          aria-describedby="ag-ctx-voice-help"
          placeholder="Describe the brand voice"
        />
      </section>

      <section class="ag-ctx-field" aria-labelledby="ag-ctx-offerings-label">
        <h2 id="ag-ctx-offerings-label" class="ag-ctx-label">Offerings</h2>
        <p class="ag-ctx-help">Products, plans or services the agent may mention, each with the page that describes it.</p>
        <p v-if="!form.offerings.length" class="ag-ctx-none">No offerings added.</p>
        <ul v-else class="ag-ctx-rows" role="list">
          <li v-for="(o, index) in form.offerings" :key="o.key" class="ag-ctx-offering">
            <div class="ag-ctx-offering-grid">
              <div class="ag-ctx-cell">
                <label class="ag-ctx-sublabel" :for="`${o.key}-name`">Name</label>
                <input
                  :id="`${o.key}-name`"
                  v-model="o.name"
                  class="ag-ctx-input"
                  type="text"
                  :maxlength="LIMITS.offeringName"
                  :aria-invalid="fieldErrors[`offering-${o.key}-name`] ? 'true' : undefined"
                  :aria-describedby="fieldErrors[`offering-${o.key}-name`] ? `${o.key}-name-err` : undefined"
                />
                <p v-if="fieldErrors[`offering-${o.key}-name`]" :id="`${o.key}-name-err`" class="ag-ctx-error">
                  {{ fieldErrors[`offering-${o.key}-name`] }}
                </p>
              </div>
              <div class="ag-ctx-cell">
                <label class="ag-ctx-sublabel" :for="`${o.key}-url`">Page URL</label>
                <input
                  :id="`${o.key}-url`"
                  v-model="o.url"
                  class="ag-ctx-input"
                  type="url"
                  inputmode="url"
                  :maxlength="LIMITS.offeringUrl"
                  placeholder="https://"
                  :aria-invalid="fieldErrors[`offering-${o.key}-url`] ? 'true' : undefined"
                  :aria-describedby="fieldErrors[`offering-${o.key}-url`] ? `${o.key}-url-err` : undefined"
                />
                <p v-if="fieldErrors[`offering-${o.key}-url`]" :id="`${o.key}-url-err`" class="ag-ctx-error">
                  {{ fieldErrors[`offering-${o.key}-url`] }}
                </p>
              </div>
              <div class="ag-ctx-cell is-wide">
                <label class="ag-ctx-sublabel" :for="`${o.key}-desc`">Description</label>
                <textarea
                  :id="`${o.key}-desc`"
                  v-model="o.description"
                  class="ag-ctx-input ag-ctx-area is-short"
                  rows="2"
                  :maxlength="LIMITS.offeringDescription"
                />
              </div>
            </div>
            <AgIconButton
              class="ag-ctx-remove"
              :label="o.name.trim() ? `Remove ${o.name.trim()}` : `Remove offering ${index + 1}`"
              :size="28"
              muted
              @click="removeOffering(index)"
            >
              <X />
            </AgIconButton>
          </li>
        </ul>
        <AgButton
          class="ag-ctx-add"
          variant="ghost"
          size="xs"
          :icon="Plus"
          :disabled="form.offerings.length >= LIMITS.offerings"
          @click="addOffering"
        >
          Add offering
        </AgButton>
      </section>

      <section class="ag-ctx-field" aria-labelledby="ag-ctx-rules-label">
        <h2 id="ag-ctx-rules-label" class="ag-ctx-label">Rules</h2>
        <p class="ag-ctx-help">Things every agent must always or never do, one per line.</p>
        <p v-if="!form.rules.length" class="ag-ctx-none">No rules added.</p>
        <ul v-else class="ag-ctx-rows" role="list">
          <li v-for="(r, index) in form.rules" :key="r.key" class="ag-ctx-rule">
            <span class="ag-ctx-rule-n ag-tnum" aria-hidden="true">{{ index + 1 }}</span>
            <input
              :id="`${r.key}-text`"
              v-model="r.text"
              class="ag-ctx-input"
              type="text"
              :maxlength="LIMITS.rule"
              :aria-label="`Rule ${index + 1}`"
              enterkeyhint="next"
              @keydown.enter.prevent="addRule(index)"
            />
            <AgIconButton :label="`Remove rule ${index + 1}`" :size="28" muted @click="removeRule(index)">
              <X />
            </AgIconButton>
          </li>
        </ul>
        <AgButton
          class="ag-ctx-add"
          variant="ghost"
          size="xs"
          :icon="Plus"
          :disabled="form.rules.length >= LIMITS.rules"
          @click="addRule"
        >
          Add rule
        </AgButton>
      </section>
    </form>

    <template v-if="status === 'ready'" #footer>
      <div class="ag-ctx-bar">
        <p class="ag-ctx-state" :class="{ 'is-dirty': dirty, 'is-error': saveError }" aria-live="polite">
          <template v-if="saveError">{{ saveError }}</template>
          <template v-else-if="dirty">Unsaved changes</template>
          <template v-else>{{ savedLine }}</template>
        </p>
        <div class="ag-ctx-bar-actions">
          <AgButton v-if="dirty" variant="ghost" size="sm" :disabled="saving" @click="discard">Discard</AgButton>
          <AgButton variant="primary" size="sm" :loading="saving" :disabled="!dirty || conflict" @click="save">
            {{ saving ? 'Saving' : 'Save' }}
          </AgButton>
        </div>
      </div>
    </template>

    <AgConfirmDialog
      v-model:open="leaveOpen"
      title="Leave without saving?"
      description="Your changes to the context have not been saved."
      confirm-label="Leave"
      cancel-label="Keep editing"
      destructive
      @confirm="leave"
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

.ag-ctx-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--ag-warning) 40%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--ag-warning) 8%, transparent);
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
}

.ag-ctx-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ag-ctx-label {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-ctx-help {
  margin: 0 0 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-ctx-none {
  margin: 0;
  color: var(--ag-fg-4);
  font-size: 13px;
  line-height: 19px;
}

.ag-ctx-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 8px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
  transition: border-color 120ms ease;
}

.ag-ctx-input::placeholder {
  color: var(--ag-placeholder);
}

.ag-ctx-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: 8px;
  outline: none;
}

.ag-ctx-input[aria-invalid='true'] {
  border-color: var(--ag-danger);
}

.ag-ctx-area {
  min-height: 96px;
  resize: vertical;
}

.ag-ctx-area.is-short {
  min-height: 60px;
}

.ag-ctx-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-ctx-offering {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-ctx-offering-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px 12px;
  min-width: 0;
}

.ag-ctx-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ag-ctx-cell.is-wide {
  grid-column: 1 / -1;
}

.ag-ctx-sublabel {
  color: var(--ag-fg-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-ctx-error {
  margin: 0;
  color: var(--ag-danger);
  font-size: 12px;
  line-height: 16px;
}

.ag-ctx-rule {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ag-ctx-rule-n {
  flex-shrink: 0;
  width: 18px;
  color: var(--ag-fg-4);
  font-size: 13px;
  text-align: right;
}

.ag-ctx-field :deep(.ag-ctx-add) {
  align-self: flex-start;
  margin-top: 4px;
  margin-left: -8px;
}

.ag-ctx-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  min-height: 56px;
  padding: 10px max(16px, calc((100% - 720px) / 2));
  border-top: 1px solid var(--ag-divider-subtle);
  background: var(--ag-pane-bg);
}

.ag-ctx-state {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-ctx-state.is-dirty {
  color: var(--ag-fg-1);
}

.ag-ctx-state.is-error {
  color: var(--ag-danger);
  white-space: normal;
}

.ag-ctx-bar-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

@media (max-width: 560px) {
  .ag-ctx-offering-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (pointer: coarse) {
  .ag-ctx-input {
    font-size: 16px;
  }
}
</style>
