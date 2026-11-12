<script setup>
// Findings: the project's issues and opportunities from the research agents,
// shared with everyone on the project. Rows are added from a research table
// (or by hand), then marked done or dismissed. Filters (status, category,
// severity) persist per project in the findings store; the search does not.
// Viewers (can_edit false, or a write refused with 403) see the list with
// every write action hidden.
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Plus } from '@lucide/vue'
import { useAgentFindingsStore } from '@/stores/agentFindings'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgSearchField from '@/components/agent/common/AgSearchField.vue'
import FindingRow from '@/components/agent/findings/FindingRow.vue'
import FindingDialog from '@/components/agent/findings/FindingDialog.vue'
import FindingBulkBar from '@/components/agent/findings/FindingBulkBar.vue'
import { IconFindings } from '@/components/agent/icons'
import { errorInfo } from '@/components/agent/message/parts'
import {
  FINDING_CATEGORY_LIST,
  FINDING_SEVERITY_LIST,
  FINDING_STATUS,
  SWARM_CATEGORY_LABELS,
} from '@/lib/agent/types'

const INTRO =
  'Issues and opportunities the research agents found. Add them from a research table, then mark them done when they are fixed.'
const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const STATUS_ALL = 'all'
const DONE_COPY = {
  [FINDING_STATUS.DONE]: { one: 'Marked done', many: (n) => `Marked ${n} done.` },
  [FINDING_STATUS.DISMISSED]: { one: 'Dismissed', many: (n) => `Dismissed ${n}.` },
  [FINDING_STATUS.OPEN]: { one: 'Reopened', many: (n) => `Reopened ${n}.` },
}

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const findings = useAgentFindingsStore()
const ui = useAgentUiStore()
const toast = useToast()

const listEl = ref(null)
const query = ref('')
const expanded = ref({})
const selected = ref([])
const rowBusy = ref({})
const bulkPending = ref('')
const moreLoading = ref(false)
// A write came back 403: this user can only read, whatever the list said.
const forbidden = ref(false)

const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))
const items = computed(() =>
  (Array.isArray(findings.items) ? findings.items : []).filter((f) => f && f.id !== undefined && f.id !== null),
)
const filters = computed(() => findings.filters || {})
const status = computed(() => filters.value.status || FINDING_STATUS.OPEN)
const counts = computed(() => findings.counts || {})
const loaded = computed(() => Boolean(findings.loaded))
const loading = computed(() => Boolean(findings.loading))
const readOnly = computed(() => loaded.value && (findings.canEdit === false || forbidden.value))
const editable = computed(() => loaded.value && !readOnly.value)
const filtered = computed(() =>
  Boolean(filters.value.category || filters.value.severity || String(filters.value.q || '').trim()),
)
const loadError = computed(() => {
  if (!findings.error) return ''
  return errorInfo(findings.error).message || ''
})

const statusTabs = computed(() => [
  { key: FINDING_STATUS.OPEN, label: 'Open', count: countOf(FINDING_STATUS.OPEN) },
  { key: FINDING_STATUS.DONE, label: 'Done', count: countOf(FINDING_STATUS.DONE) },
  { key: FINDING_STATUS.DISMISSED, label: 'Dismissed', count: countOf(FINDING_STATUS.DISMISSED) },
  { key: STATUS_ALL, label: 'All', count: null },
])

const categoryOptions = FINDING_CATEGORY_LIST.map((key) => ({ key, label: SWARM_CATEGORY_LABELS[key] || key }))
const severityOptions = FINDING_SEVERITY_LIST.map((key) => ({ key, label: SEVERITY_LABELS[key] || key }))

function countOf(key) {
  const n = Number(counts.value[key])
  return Number.isFinite(n) && n > 0 ? n : 0
}

const researchTo = computed(() =>
  wid.value ? { name: 'agent-home', params: { websiteId: wid.value }, query: { agent: 'gap_analyst' } } : null,
)

const emptyState = computed(() => {
  if (filtered.value) return { title: 'No findings match these filters.', body: '', clear: true }
  if (status.value === FINDING_STATUS.DONE) return { title: 'Nothing marked done yet.', body: '' }
  if (status.value === FINDING_STATUS.DISMISSED) return { title: 'Nothing dismissed.', body: '' }
  return {
    title: status.value === STATUS_ALL ? 'No findings yet.' : 'No open findings.',
    body: 'Run a research, then add findings from its results table.',
    research: true,
  }
})

const showSkeleton = computed(() => !findings.error && !items.value.length && (!loaded.value || loading.value))
const showError = computed(() => Boolean(findings.error) && !items.value.length && !loading.value)
const showEmpty = computed(() => loaded.value && !loading.value && !findings.error && !items.value.length)

/* ── Loading ── */

watch(
  wid,
  (id) => {
    if (!id) return
    findings.init(id)
    query.value = String(findings.filters?.q || '')
    expanded.value = {}
    selected.value = []
    forbidden.value = false
    findings.load()
  },
  { immediate: true },
)

// Rows that left the list (moved to another tab, deleted, filtered out)
// leave the selection and the expanded set.
watch(items, (list) => {
  const ids = new Set(list.map((f) => String(f.id)))
  if (selected.value.some((id) => !ids.has(id))) selected.value = selected.value.filter((id) => ids.has(id))
  const open = Object.keys(expanded.value).filter((id) => ids.has(id))
  if (open.length !== Object.keys(expanded.value).length) {
    expanded.value = Object.fromEntries(open.map((id) => [id, true]))
  }
})

function retry() {
  findings.load()
}

async function showMore() {
  if (moreLoading.value || loading.value) return
  moreLoading.value = true
  try {
    await findings.load({ more: true })
  } finally {
    moreLoading.value = false
  }
}

/* ── Filters ── */

function applyFilters(patch) {
  selected.value = []
  expanded.value = {}
  return findings.setFilters(patch)
}

function setStatusFilter(key) {
  if (key === status.value) return
  applyFilters({ status: key })
}

function setFilter(key, value) {
  if ((filters.value[key] || '') === value) return
  applyFilters({ [key]: value })
}

function onSearch(q) {
  if (q === String(filters.value.q || '').trim()) return
  applyFilters({ q })
}

function clearFilters() {
  query.value = ''
  applyFilters({ category: '', severity: '', q: '' })
}

/* ── Rows ── */

function isSelected(id) {
  return selected.value.includes(String(id))
}

function toggleSelected(id, on) {
  const key = String(id)
  const rest = selected.value.filter((x) => x !== key)
  selected.value = on ? [...rest, key] : rest
}

function toggleExpanded(id) {
  const key = String(id)
  const next = { ...expanded.value }
  if (next[key]) delete next[key]
  else next[key] = true
  expanded.value = next
}

function setRowBusy(id, on) {
  const next = { ...rowBusy.value }
  if (on) next[id] = true
  else delete next[id]
  rowBusy.value = next
}

/** A refused write: viewers lose the write actions; anything else is reported. */
function writeFailed(err, fallback) {
  const info = errorInfo(err)
  if (info.status === 403) {
    forbidden.value = true
    selected.value = []
  }
  const message = info.message || fallback
  toast.error(message)
  ui.announce(message, 'assertive')
}

/** After a row leaves the list, keep focus in the list instead of on <body>. */
function focusRowNear(index) {
  nextTick(() => {
    const titles = listEl.value ? [...listEl.value.querySelectorAll('.ag-fr-title')] : []
    const target = titles[Math.min(index, titles.length - 1)]
    if (target) target.focus()
  })
}

async function changeStatus(finding, next) {
  const id = String(finding.id)
  if (rowBusy.value[id] || bulkPending.value) return
  const index = items.value.findIndex((f) => String(f.id) === id)
  setRowBusy(id, true)
  try {
    await findings.setStatus(id, next)
    ui.announce(DONE_COPY[next]?.one || 'Finding updated')
    if (!items.value.some((f) => String(f.id) === id)) focusRowNear(index)
  } catch (err) {
    writeFailed(err, "Couldn't update the finding. Try again.")
  } finally {
    setRowBusy(id, false)
  }
}

/* ── Bulk ── */

const selectedFindings = computed(() => {
  const byId = new Map(items.value.map((f) => [String(f.id), f]))
  return selected.value.map((id) => byId.get(id)).filter(Boolean)
})

const bulkAbility = computed(() => {
  const list = selectedFindings.value
  return {
    done: list.some((f) => f.status !== FINDING_STATUS.DONE),
    dismiss: list.some((f) => f.status !== FINDING_STATUS.DISMISSED),
    reopen: list.some((f) => f.status && f.status !== FINDING_STATUS.OPEN),
  }
})

function findingsNoun(n) {
  return `${n} ${n === 1 ? 'finding' : 'findings'}`
}

async function bulk(next) {
  if (bulkPending.value) return
  const targets = selectedFindings.value.filter((f) => f.status !== next)
  if (!targets.length) return
  bulkPending.value = next
  const failed = new Set()
  let changed = 0
  let firstError = null
  // One at a time: a handful of rows is the norm, and the counts stay exact.
  for (const finding of targets) {
    const id = String(finding.id)
    try {
      await findings.setStatus(id, next)
      changed += 1
    } catch (err) {
      failed.add(id)
      firstError = firstError || err
      // A viewer is refused every row; one refusal is enough.
      if (errorInfo(err).status === 403) break
    }
  }
  bulkPending.value = ''
  if (changed) {
    const copy = DONE_COPY[next].many(findingsNoun(changed))
    toast.success(copy)
    ui.announce(copy)
  }
  // Rows that failed stay checked for another try.
  selected.value = selected.value.filter((id) => failed.has(id))
  if (firstError) writeFailed(firstError, "Some findings couldn't be updated. Try again.")
}

function clearSelection() {
  selected.value = []
}

/* ── Create and edit ── */

const dialogOpen = ref(false)
const dialogFinding = ref(null)
const dialogBusy = ref(false)
const dialogError = ref('')

function openCreate() {
  dialogFinding.value = null
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(finding) {
  dialogFinding.value = finding
  dialogError.value = ''
  dialogOpen.value = true
}

async function saveDialog(fields) {
  if (dialogBusy.value) return
  dialogBusy.value = true
  dialogError.value = ''
  const editing = dialogFinding.value
  try {
    if (editing) {
      await findings.update(String(editing.id), fields)
      ui.announce('Finding saved')
    } else {
      await findings.create(fields)
      // A new finding is open; on the Done or Dismissed tab it is not in view.
      toast.success('Finding added.')
      ui.announce('Finding added')
    }
    dialogOpen.value = false
  } catch (err) {
    const info = errorInfo(err)
    if (info.status === 403) {
      dialogOpen.value = false
      writeFailed(err, "You can view findings but not change them.")
    } else {
      dialogError.value = info.message || "Couldn't save the finding. Try again."
    }
  } finally {
    dialogBusy.value = false
  }
}

/* ── Delete ── */

const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')

function askDelete(finding) {
  deleteTarget.value = finding
  deleteError.value = ''
  deleteOpen.value = true
}

async function confirmDelete() {
  const finding = deleteTarget.value
  if (!finding || deleting.value) return
  const index = items.value.findIndex((f) => String(f.id) === String(finding.id))
  deleting.value = true
  deleteError.value = ''
  try {
    await findings.remove(String(finding.id))
    deleteOpen.value = false
    deleteTarget.value = null
    ui.announce('Finding deleted')
    focusRowNear(index)
  } catch (err) {
    const info = errorInfo(err)
    if (info.status === 403) {
      deleteOpen.value = false
      writeFailed(err, "You can view findings but not change them.")
    } else {
      deleteError.value = info.message || "Couldn't delete the finding. Try again."
    }
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AgPage title="Findings" :intro="INTRO" :busy="loading">
    <template v-if="editable" #actions>
      <AgButton variant="primary" size="sm" :icon="Plus" @click="openCreate">New finding</AgButton>
    </template>

    <template #intro>
      <p v-if="readOnly" class="ag-fp-readonly">You can view findings but not change them.</p>
    </template>

    <div class="ag-fp-toolbar">
      <div class="ag-fp-seg" role="group" aria-label="Status">
        <button
          v-for="tab in statusTabs"
          :key="tab.key"
          type="button"
          class="ag-fp-seg-item"
          :class="{ 'is-on': status === tab.key }"
          :aria-pressed="status === tab.key ? 'true' : 'false'"
          @click="setStatusFilter(tab.key)"
        >
          <span>{{ tab.label }}</span>{{ ' ' }}<span v-if="tab.count !== null" class="ag-fp-seg-count ag-tnum">{{ tab.count }}</span>
        </button>
      </div>

      <span class="ag-fp-select">
        <select
          class="ag-fp-select-input"
          aria-label="Category"
          :value="filters.category || ''"
          @change="setFilter('category', $event.target.value)"
        >
          <option value="">All categories</option>
          <option v-for="c in categoryOptions" :key="c.key" :value="c.key">{{ c.label }}</option>
        </select>
        <ChevronDown class="ag-fp-select-icon" :size="14" aria-hidden="true" />
      </span>

      <span class="ag-fp-select">
        <select
          class="ag-fp-select-input"
          aria-label="Severity"
          :value="filters.severity || ''"
          @change="setFilter('severity', $event.target.value)"
        >
          <option value="">All severities</option>
          <option v-for="s in severityOptions" :key="s.key" :value="s.key">{{ s.label }}</option>
        </select>
        <ChevronDown class="ag-fp-select-icon" :size="14" aria-hidden="true" />
      </span>

      <div class="ag-fp-search">
        <AgSearchField v-model="query" label="Search findings" placeholder="Search findings" @search="onSearch" />
      </div>
    </div>

    <ul v-if="showSkeleton" class="ag-fp-list" role="list" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="ag-fp-skel-row">
        <span class="ag-fp-skel ag-fp-skel-dot" />
        <span class="ag-fp-skel-lines">
          <span class="ag-fp-skel ag-fp-skel-line" />
          <span class="ag-fp-skel ag-fp-skel-line is-short" />
        </span>
      </li>
    </ul>

    <AgEmptyState
      v-else-if="showError"
      :icon="IconFindings"
      tone="error"
      title="Findings could not be loaded."
      :body="loadError"
    >
      <AgButton size="sm" @click="retry">Retry</AgButton>
    </AgEmptyState>

    <AgEmptyState v-else-if="showEmpty" :icon="IconFindings" :title="emptyState.title" :body="emptyState.body">
      <AgButton v-if="emptyState.clear" size="sm" @click="clearFilters">Clear filters</AgButton>
      <AgButton v-else-if="emptyState.research && researchTo" size="sm" :to="researchTo">
        Research with the agent
      </AgButton>
    </AgEmptyState>

    <template v-else>
      <ul ref="listEl" class="ag-fp-list" :class="{ 'is-loading': loading }" role="list" aria-label="Findings">
        <FindingRow
          v-for="f in items"
          :key="f.id"
          :finding="f"
          :website-id="wid"
          :editable="editable"
          :selected="isSelected(f.id)"
          :expanded="Boolean(expanded[String(f.id)])"
          :busy="Boolean(rowBusy[String(f.id)]) || Boolean(bulkPending)"
          @select="toggleSelected(f.id, $event)"
          @toggle="toggleExpanded(f.id)"
          @status="changeStatus(f, $event)"
          @edit="openEdit(f)"
          @delete="askDelete(f)"
        />
      </ul>

      <p v-if="findings.error && items.length" class="ag-fp-inline-error" role="alert">
        <span>Findings could not be loaded.</span>
        <button type="button" class="ag-fp-link" @click="retry">Retry</button>
      </p>

      <div v-if="findings.hasMore" class="ag-fp-more">
        <AgButton variant="ghost" size="sm" :loading="moreLoading" :disabled="loading && !moreLoading" @click="showMore">
          Show more
        </AgButton>
      </div>
    </template>

    <template v-if="editable && selected.length" #footer>
      <FindingBulkBar
        :count="selected.length"
        :pending="bulkPending"
        :can-done="bulkAbility.done"
        :can-dismiss="bulkAbility.dismiss"
        :can-reopen="bulkAbility.reopen"
        @status="bulk"
        @clear="clearSelection"
      />
    </template>

    <FindingDialog
      v-model:open="dialogOpen"
      :finding="dialogFinding"
      :busy="dialogBusy"
      :error="dialogError"
      @save="saveDialog"
    />

    <AgConfirmDialog
      v-model:open="deleteOpen"
      title="Delete this finding?"
      description="This removes it for everyone in the project. It can't be undone."
      confirm-label="Delete"
      busy-label="Deleting"
      destructive
      :busy="deleting"
      :error="deleteError"
      @confirm="confirmDelete"
    />
  </AgPage>
</template>

<style scoped>
.ag-fp-readonly {
  margin: -8px 0 20px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-fp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.ag-fp-seg {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  box-sizing: border-box;
  height: 36px;
  padding: 1px;
  border: 1px solid var(--ag-seg-border);
  border-radius: var(--radius);
  background: var(--ag-seg-track);
}

.ag-fp-seg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
  transition: color 120ms ease, background-color 120ms ease;
}

.ag-fp-seg-item:hover {
  color: var(--ag-fg-1);
}

.ag-fp-seg-item.is-on {
  background: var(--ag-seg-thumb);
  box-shadow: var(--ag-seg-thumb-shadow);
  color: var(--ag-fg-1);
}

.ag-fp-seg-item:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -1px;
}

.ag-fp-seg-count {
  color: var(--ag-fg-3);
  font-weight: 400;
}

.ag-fp-seg-item.is-on .ag-fp-seg-count {
  color: var(--ag-fg-2);
}

.ag-fp-select {
  position: relative;
  display: inline-flex;
  flex: 0 1 auto;
  min-width: 0;
}

.ag-fp-select-input {
  box-sizing: border-box;
  max-width: 220px;
  height: 36px;
  padding: 0 30px 0 11px;
  border: 1px solid var(--ag-composer-border);
  border-radius: var(--radius);
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.ag-fp-select-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-fp-select-icon {
  position: absolute;
  top: 50%;
  right: 10px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-fp-search {
  flex: 1 1 180px;
  min-width: 160px;
}

.ag-fp-search :deep(.ag-search-input) {
  height: 36px;
  border-radius: var(--radius);
}

.ag-fp-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 -12px;
  padding: 0;
  list-style: none;
  transition: opacity 120ms ease;
}

.ag-fp-list.is-loading {
  opacity: 0.6;
}

.ag-fp-skel-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 56px;
  padding: 12px;
  list-style: none;
}

.ag-fp-skel-lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
}

.ag-fp-skel {
  display: block;
  border-radius: var(--radius);
  background: var(--ag-row-hover);
  animation: ag-pulse 1.4s ease-in-out infinite;
}

.ag-fp-skel-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
}

.ag-fp-skel-line {
  width: 60%;
  height: 12px;
}

.ag-fp-skel-line.is-short {
  width: 35%;
}

.ag-fp-inline-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

.ag-fp-link {
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.ag-fp-link:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-fp-more {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

@media (max-width: 640px) {
  .ag-fp-seg {
    width: 100%;
  }

  .ag-fp-seg-item {
    flex: 1 1 auto;
    justify-content: center;
    padding: 0 6px;
  }

  .ag-fp-select {
    flex: 1 1 140px;
  }

  .ag-fp-select-input {
    width: 100%;
    max-width: none;
  }

  .ag-fp-search {
    flex-basis: 100%;
  }

  .ag-fp-list {
    margin: 0 -8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-fp-skel {
    animation: none;
  }

  .ag-fp-list,
  .ag-fp-seg-item {
    transition: none;
  }
}

@media (pointer: coarse) {
  .ag-fp-select-input {
    font-size: 16px;
  }
}
</style>
