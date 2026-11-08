<template>
  <section
    v-if="data"
    :id="domId || undefined"
    class="ag-st"
    :class="`is-${mode}`"
    :data-swarm-table="`${swarmId}:${version}`"
    tabindex="-1"
    :aria-label="`Research results: ${data.title || 'Results'}`"
  >
    <div class="ag-st-bar">
      <div class="ag-st-bar-start">
        <span class="ag-st-title">Results</span>
        <span class="ag-st-chip ag-tnum" :aria-label="`Version ${version}`">v{{ version }}</span>
        <button v-if="newer" type="button" class="ag-st-chip is-newer ag-tnum" @click="openLatest">
          Newer: v{{ latest }}
        </button>
        <div v-if="sheets.length" class="ag-st-seg" role="tablist" aria-label="Sheets" @keydown="onSheetKey">
          <button
            v-for="s in sheets"
            :id="`${uid}-tab-${s.key}`"
            :key="s.key"
            type="button"
            role="tab"
            class="ag-st-seg-item"
            :class="{ 'is-on': s.key === sheetKey }"
            :aria-selected="s.key === sheetKey ? 'true' : 'false'"
            :aria-controls="`${uid}-panel`"
            :tabindex="s.key === sheetKey ? 0 : -1"
            @click="selectSheet(s.key)"
          >
            <span>{{ s.title || s.key }}</span>{{ ' ' }}<span class="ag-st-seg-count ag-tnum">{{ sheetRows(s).length }}</span>
          </button>
        </div>
        <button
          v-if="canFilterChanges"
          type="button"
          class="ag-st-toggle"
          :aria-pressed="changedOnly ? 'true' : 'false'"
          @click="toggleChangedOnly"
        >
          Changed only
        </button>
      </div>
      <div class="ag-st-bar-end">
        <AgIconButton v-if="mode === 'inline'" label="Open in browser pane" :size="28" :icon-size="15" @click="openInPane">
          <PanelRight aria-hidden="true" />
        </AgIconButton>
        <AgIconButton label="Download CSV" :size="28" :icon-size="15" :disabled="!sheet" @click="download">
          <Download aria-hidden="true" />
        </AgIconButton>
      </div>
    </div>

    <div
      :id="`${uid}-panel`"
      class="ag-st-scroll"
      role="tabpanel"
      tabindex="0"
      aria-label="Results table, scrolls sideways"
      :style="{ '--ag-st-sel': selectable ? '32px' : '0px' }"
    >
      <table v-if="sheet" class="ag-st-table">
        <caption class="ag-st-sr">{{ data.title || 'Results' }} · {{ sheet.title || sheet.key }}, version {{ version }}</caption>
        <thead>
          <tr>
            <th v-if="selectable" scope="col" class="ag-st-sel">
              <span class="ag-st-sr">Add to findings</span>
              <HintCallout hint="agent.findings-select" :when="hasDrafts">
                <span class="ag-st-sel-help">
                  <HelpTip :text="TIPS.agent.findings" label="What adding to findings does" side="right" />
                </span>
              </HintCallout>
            </th>
            <th
              v-for="(col, i) in columns"
              :key="col.key"
              scope="col"
              :class="[{ 'is-first': i === 0, 'is-right': col.align === 'right' }, `is-col-${col.key}`]"
              :aria-sort="col.sortable ? ariaSort(sort, col.key) : undefined"
            >
              <button v-if="col.sortable" type="button" class="ag-st-sort" @click="sortBy(col.key)">
                <span>{{ col.label }}</span>
                <ArrowUp v-if="sort.key === col.key && sort.dir === 'asc'" :size="12" aria-hidden="true" />
                <ArrowDown v-else-if="sort.key === col.key && sort.dir === 'desc'" :size="12" aria-hidden="true" />
              </button>
              <span v-else class="ag-st-head">{{ col.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :class="{ 'is-changed': isChangedRow(row) || isAddedRow(row) }">
            <td v-if="selectable" class="ag-st-sel">
              <span v-if="hasDraft(row) && isAdded(row.key)" class="ag-st-added">In findings</span>
              <input
                v-else-if="hasDraft(row)"
                type="checkbox"
                class="ag-st-check"
                :checked="selected.includes(String(row.key))"
                :aria-label="`Add “${rowLabel(sheet, row)}” to findings`"
                @change="toggleRow(row.key, $event.target.checked)"
              />
            </td>
            <component
              :is="i === 0 ? 'th' : 'td'"
              v-for="(col, i) in columns"
              :key="col.key"
              :scope="i === 0 ? 'row' : undefined"
              :class="[{ 'is-first': i === 0, 'is-right': col.align === 'right', 'ag-tnum': numeric(col) }, `is-col-${col.key}`]"
            >
              <div class="ag-st-box" :class="`is-w-${widthOf(col)}`">
                <span class="ag-st-cell" :class="cellClasses(cellOf(row, col.key))" :title="noteOf(row, col) || undefined">
                  <a
                    v-if="col.kind === 'link' && linkOf(row, col)"
                    class="ag-st-link"
                    :href="linkOf(row, col)"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click="openLink($event, linkOf(row, col))"
                  >{{ textOf(row, col) }}</a>
                  <template v-else>{{ textOf(row, col) }}</template>
                  <sup
                    v-if="isCarried(cellOf(row, col.key), version)"
                    class="ag-st-ver"
                    role="img"
                    :aria-label="`measured in version ${cellOf(row, col.key).version}`"
                  >v{{ cellOf(row, col.key).version }}</sup>
                  <span v-if="noteOf(row, col)" class="ag-st-sr">. {{ noteOf(row, col) }}</span>
                </span>
                <span v-if="previousOf(row, col)" class="ag-st-prev">was {{ previousOf(row, col) }}</span>
                <span v-if="i === 0 && isAddedRow(row)" class="ag-st-badge is-new"
                  >New<span class="ag-st-sr"> since version {{ data.previous_version }}</span></span
                >
                <span v-else-if="i === 0 && isChangedRow(row)" class="ag-st-badge"
                  >Changed<span class="ag-st-sr">
                    since version {{ data.previous_version }}: {{ changedLabel(row) }}</span
                  ></span
                >
                <span v-if="i === 0 && rowLinks(row).length" class="ag-st-links">
                  <template v-for="(ev, j) in rowLinks(row)" :key="`${ev.label}-${j}`">
                    <button v-if="ev.tab_id" type="button" class="ag-st-ev" @click="openCapture($event, ev.tab_id)">
                      {{ ev.label }}
                    </button>
                    <a
                      v-else
                      class="ag-st-ev"
                      :href="safeHref(ev.url)"
                      target="_blank"
                      rel="noopener noreferrer"
                      @click="openLink($event, ev.url)"
                    >{{ ev.label }}</a>
                  </template>
                </span>
              </div>
            </component>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="ag-st-empty">
        {{ emptyText }}
      </p>
      <p v-if="unlisted > 0" class="ag-st-more">
        Only the most significant changes are listed.
        <button type="button" class="ag-st-more-btn" @click="revealUnlisted">
          Show {{ unlisted }} more changed {{ unlisted === 1 ? 'row' : 'rows' }}
        </button>
      </p>
    </div>

    <SwarmTableActions
      :table="data"
      :sheet="sheet"
      :message="message"
      :mode="mode"
      :busy="busy"
      :chat-id="resolvedChatId"
      :selected-keys="shownSelected"
      :row-keys="shownKeys"
      @added="dropFromSelection"
      @download="download"
    />
  </section>
</template>

<script setup>
// The consolidated results of a research (a SwarmTable): three sheets
// (prompts, content gaps, sources) with sorting, CSV export and the
// actions to add rows to Findings, save the reply to Reports or re-run.
// Inline in the chat, full height in the pane (mode "pane"), or read-only
// (mode "report"). Every value shown is a cell's own text; a state such as
// "Not configured" is always a word, never a number.
import { computed, nextTick, ref, useId, watch } from 'vue'
import { ArrowDown, ArrowUp, Download, PanelRight } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import HintCallout from '@/components/ui/help/HintCallout.vue'
import { TIPS } from '@/lib/help/tips'
import SwarmTableActions from './SwarmTableActions.vue'
import {
  ariaSort,
  cellClasses,
  cellOf,
  cellText,
  csvFilename,
  csvRows,
  changedColumns,
  filterChangedRows,
  hasChanges,
  hasDraft,
  hasPrevious,
  isAddedRow,
  isCarried,
  isChangedRow,
  nextSort,
  rowLabel,
  sheetColumns,
  sheetRows,
  sortRows,
  tableDomId,
  tableSheets,
  unlistedChangedRows,
} from './tableModel'
import { toCsv } from '@/lib/agent/csv'
import { downloadText } from '@/lib/agent/download'
import { safeHref } from '@/utils/safeHref'
import { useAgentStore } from '@/stores/agent'
import { useAgentFindingsStore } from '@/stores/agentFindings'
import { useAgentPaneStore } from '@/stores/agentPane'

const props = defineProps({
  // A SwarmTable, or a `swarm_table` part that carries one.
  table: { type: Object, default: null },
  part: { type: Object, default: null },
  // The message holding the table; null in the pane when loaded by API.
  message: { type: Object, default: null },
  mode: { type: String, default: 'inline' },
  // The chat has an active run.
  busy: { type: Boolean, default: false },
  // The chat of the research, when there is no message to read it from.
  chatId: { type: [String, Number], default: null },
  // "Changed only" held by the caller (the pane tab); null keeps it here.
  changedOnly: { type: Boolean, default: null },
})

// version: null asks the pane to show the latest version.
const emit = defineEmits(['version', 'update:changedOnly'])

const agent = useAgentStore()
const findings = useAgentFindingsStore()
const pane = useAgentPaneStore()
const uid = `ag-st-${useId()}`

const data = computed(() => {
  const t = props.table || (props.part && props.part.table) || null
  return t && typeof t === 'object' ? t : null
})
const swarmId = computed(() => String((data.value && data.value.swarm_id) || (props.part && props.part.swarm_id) || ''))
const version = computed(() => Number((data.value && data.value.version) || (props.part && props.part.version)) || null)
const domId = computed(() =>
  props.mode === 'inline' && props.message && props.part ? tableDomId(props.message.id, props.part.id) : ''
)
const resolvedChatId = computed(() => {
  const id = (props.message && props.message.chat_id) ?? props.chatId
  return id === undefined || id === '' ? null : id
})

const latest = computed(() => {
  try {
    return Number(agent.latestSwarmVersion(swarmId.value)) || null
  } catch {
    return null
  }
})
const newer = computed(() => Boolean(latest.value && version.value && latest.value > version.value))

// ── Sheets ──

const sheets = computed(() => tableSheets(data.value))
const chosenSheet = ref('prompts')
const sheet = computed(() => sheets.value.find((s) => s.key === chosenSheet.value) || sheets.value[0] || null)
const sheetKey = computed(() => (sheet.value ? sheet.value.key : ''))
const columns = computed(() => sheetColumns(sheet.value))

function selectSheet(key) {
  chosenSheet.value = key
}

// Arrow keys, Home and End move between the sheet tabs.
function sheetStep(key, at, count) {
  if (key === 'ArrowLeft') return (at - 1 + count) % count
  if (key === 'ArrowRight') return (at + 1) % count
  return key === 'Home' ? 0 : count - 1
}

function onSheetKey(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const keys = sheets.value.map((s) => s.key)
  const at = keys.indexOf(sheetKey.value)
  if (at < 0 || !keys.length) return
  event.preventDefault()
  const next = sheetStep(event.key, at, keys.length)
  selectSheet(keys[next])
  const el = document.getElementById(`${uid}-tab-${keys[next]}`)
  if (el) el.focus()
}

// ── Sorting (per sheet) ──

const sorts = ref({})
const sort = computed(() => sorts.value[sheetKey.value] || { key: null, dir: null })

// ── Changes since the previous version (table-wide) ──

// Rows the change list names and new rows; showUnlisted adds the changed rows
// past the list's cap. The pane keeps "Changed only" on its tab (the
// changedOnly prop), so it outlives a remount while a version loads.
const ownChangedOnly = ref(false)
const changedOnly = computed({
  get: () => (typeof props.changedOnly === 'boolean' ? props.changedOnly : ownChangedOnly.value),
  set: (value) => {
    ownChangedOnly.value = value
    emit('update:changedOnly', value)
  },
})
const showUnlisted = ref(false)
// A first version (or one where nothing changed) offers no filter.
const canFilterChanges = computed(() => hasChanges(data.value))
const filtering = computed(() => changedOnly.value && canFilterChanges.value)

function visibleRows(target) {
  const base = sheetRows(target)
  return filtering.value ? filterChangedRows(data.value, target, base, { unlisted: showUnlisted.value }) : base
}

const rows = computed(() => sortRows(visibleRows(sheet.value), sort.value.key, sort.value.dir))
const unlisted = computed(() =>
  filtering.value && !showUnlisted.value ? unlistedChangedRows(data.value, sheet.value) : 0
)
const emptyText = computed(() => {
  if (!filtering.value) return 'No rows in this sheet.'
  if (unlisted.value > 0) return 'None of the most significant changes are in this sheet.'
  return `No changes since version ${data.value.previous_version} in this sheet.`
})

// The rows shown while filtering (null when every row shows). Findings take
// only these: a checked row the filter hides is never added unseen, and it is
// checked again once the filter is off.
const shownKeys = computed(() =>
  filtering.value ? visibleRows(sheet.value).map((row) => String(row.key)) : null
)
const shownSelected = computed(() => {
  if (!shownKeys.value) return selected.value
  const shown = new Set(shownKeys.value)
  return selected.value.filter((key) => shown.has(key))
})

function toggleChangedOnly() {
  changedOnly.value = !changedOnly.value
}

// The button goes once its rows show; focus moves to the table, not the page.
function revealUnlisted() {
  showUnlisted.value = true
  nextTick(() => document.getElementById(`${uid}-panel`)?.focus())
}

function changedLabel(row) {
  const changed = new Set(changedColumns(row))
  return columns.value
    .filter((col) => changed.has(col.key))
    .map((col) => col.label)
    .join(', ')
}
// A row can still be ticked: the findings hint points at the column then.
const hasDrafts = computed(() => rows.value.some((row) => hasDraft(row) && !isAdded(row.key)))

function sortBy(key) {
  sorts.value = { ...sorts.value, [sheetKey.value]: nextSort(sort.value, key) }
}

// ── Selection for Findings (per sheet) ──

const selectable = computed(() => props.mode !== 'report' && findings.canEdit !== false)
const selection = ref({})
const selected = computed(() => selection.value[sheetKey.value] || [])

function isAdded(rowKey) {
  return Boolean(findings.isAdded(swarmId.value, sheetKey.value, String(rowKey)))
}

function toggleRow(rowKey, on) {
  const key = String(rowKey)
  const next = new Set(selected.value)
  if (on) next.add(key)
  else next.delete(key)
  selection.value = { ...selection.value, [sheetKey.value]: [...next] }
}

// The rows just added leave the selection; a checked row the filter hid
// was not added and stays checked.
function dropFromSelection(key, rowKeys) {
  const sheet = key || sheetKey.value
  const gone = new Set((Array.isArray(rowKeys) ? rowKeys : []).map(String))
  selection.value = { ...selection.value, [sheet]: (selection.value[sheet] || []).filter((k) => !gone.has(k)) }
}

// A different table (a newer version in the pane) starts unsorted and
// unselected. "Changed only" stays as chosen; the cells past the change
// list's cap are folded away again.
watch(
  () => `${swarmId.value}:${version.value}`,
  () => {
    sorts.value = {}
    selection.value = {}
    showUnlisted.value = false
  }
)

// ── Cells ──

function textOf(row, col) {
  return cellText(cellOf(row, col.key))
}

function noteOf(row, col) {
  const cell = cellOf(row, col.key)
  return cell && typeof cell.note === 'string' ? cell.note : ''
}

function previousOf(row, col) {
  const cell = cellOf(row, col.key)
  return hasPrevious(cell) ? String(cell.previous.text) : ''
}

function linkOf(row, col) {
  const cell = cellOf(row, col.key)
  if (!cell) return null
  return safeHref(typeof cell.url === 'string' ? cell.url : typeof cell.v === 'string' ? cell.v : '')
}

function numeric(col) {
  return col.kind === 'rank' || col.kind === 'number'
}

function widthOf(col) {
  if (col.key === 'prompt') return 'prompt'
  if (col.key === 'finding') return 'finding'
  return 'default'
}

function rowLinks(row) {
  const links = Array.isArray(row && row.links) ? row.links : []
  return links.filter((ev) => {
    if (!ev || typeof ev !== 'object' || !ev.label) return false
    // Captures open in the chat's pane only; a report shows plain URLs.
    if (ev.tab_id) return props.mode !== 'report'
    return Boolean(safeHref(ev.url))
  })
}

// ── Links and the pane ──

function plainClick(event) {
  return !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
}

function openLink(event, url) {
  if (props.mode === 'report' || !plainClick(event) || !safeHref(url)) return
  event.preventDefault()
  pane.setReturnFocus(event.currentTarget || null)
  pane.openUrl(url, { activate: true })
}

function openCapture(event, tabId) {
  pane.setReturnFocus((event && event.currentTarget) || null)
  pane.openCapture(tabId, { activate: true })
}

function openInPane(event) {
  if (!swarmId.value) return
  pane.setReturnFocus((event && event.currentTarget) || null)
  // The latest version follows later re-runs; an older one stays pinned.
  const pinned = newer.value ? version.value : null
  pane.openTable(swarmId.value, { version: pinned, activate: true, title: (data.value && data.value.title) || '' })
}

function openLatest(event) {
  if (props.mode === 'pane') {
    emit('version', null)
    return
  }
  pane.setReturnFocus((event && event.currentTarget) || null)
  pane.openTable(swarmId.value, { version: null, activate: true, title: (data.value && data.value.title) || '' })
}

function download() {
  if (!sheet.value || !data.value) return
  downloadText(toCsv(csvRows(sheet.value)), csvFilename(data.value, sheet.value), 'text/csv;charset=utf-8')
}
</script>

<style scoped>
.ag-st {
  container-name: ag-st;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-top: 4px;
  overflow: hidden;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.ag-st:focus {
  outline: none;
}

.ag-st.is-pane {
  height: 100%;
  margin-top: 0;
  border: 0;
  border-radius: 0;
}

.ag-st-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0 8px 0 12px;
}

.ag-st-bar-start {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  padding: 7px 0;
}

.ag-st-bar-end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.ag-st-title {
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.ag-st-chip {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 6px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 11px;
  line-height: 16px;
}

.ag-st-chip.is-newer {
  color: var(--ag-accent);
  cursor: pointer;
}

.ag-st-chip.is-newer:hover {
  background: var(--ag-ghost-hover);
}

.ag-st-chip.is-newer:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-st-toggle {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 6px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
}

.ag-st-toggle:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-st-toggle[aria-pressed='true'] {
  border-color: var(--ag-changed-line);
  background: var(--ag-changed-bg);
  color: var(--ag-fg-1);
}

.ag-st-toggle:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-st-seg {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 26px;
  padding: 1px;
  border: 1px solid var(--ag-seg-border);
  border-radius: 7px;
  background: var(--ag-seg-track);
}

.ag-st-seg-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
}

.ag-st-seg-item.is-on {
  background: var(--ag-seg-thumb);
  box-shadow: var(--ag-seg-thumb-shadow);
  color: var(--ag-fg-1);
}

.ag-st-seg-item:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -1px;
}

.ag-st-seg-count {
  color: var(--ag-fg-4);
}

.ag-st-seg-item.is-on .ag-st-seg-count {
  color: var(--ag-fg-3);
}

.ag-st-scroll {
  /* Keeps the screen-reader text of far columns inside the scroll box. */
  position: relative;
  min-width: 0;
  overflow-x: auto;
  border-top: 1px solid var(--ag-divider-subtle);
}

.ag-st.is-pane .ag-st-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.ag-st-scroll:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-st-table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  line-height: 18px;
}

.ag-st-table th,
.ag-st-table td {
  text-align: left;
  vertical-align: top;
}

.ag-st-table thead th {
  box-sizing: border-box;
  height: 32px;
  padding: 0 10px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  vertical-align: middle;
  white-space: nowrap;
}

.ag-st.is-pane thead th {
  position: sticky;
  top: 0;
  z-index: 2;
}

.ag-st-table tbody :is(th, td) {
  padding: 7px 10px;
  border-top: 1px solid var(--ag-divider-subtle);
  color: var(--ag-fg-1);
  font-weight: 400;
}

.ag-st-table .is-right {
  text-align: right;
}

.ag-st-table .is-first {
  position: sticky;
  left: var(--ag-st-sel);
  z-index: 1;
  background: var(--ag-pane-bg);
}

.ag-st-table thead .is-first {
  z-index: 3;
  background: var(--ag-tab-bg);
}

.ag-st-sel {
  position: sticky;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 32px;
  min-width: 32px;
  background: var(--ag-pane-bg);
  text-align: center;
}

.ag-st-table tbody td.ag-st-sel {
  padding: 7px 0 7px 10px;
}

.ag-st-table thead .ag-st-sel {
  z-index: 3;
  background: var(--ag-tab-bg);
}

/* A row changed since the previous version: a tint on every cell (the sticky
   first and select cells paint their own background, so the tint is opaque)
   and a line on the left, drawn inset so the columns do not shift. Kept apart
   from the <mark> highlights, which stay inside cell text. */
.ag-st-table tbody tr.is-changed > :is(th, td) {
  background: var(--ag-changed-bg);
}

.ag-st-table tbody tr.is-changed > :first-child {
  box-shadow: inset 2px 0 0 var(--ag-changed-line);
}

/* The help icon, centred over the row checkboxes (14px at 10px). */
.ag-st-table thead th.ag-st-sel {
  padding: 0 0 0 7px;
}

.ag-st-sel-help {
  display: inline-flex;
  vertical-align: middle;
}

.ag-st-check {
  width: 14px;
  height: 14px;
  margin: 2px 0 0;
  accent-color: var(--ag-fg-1);
  cursor: pointer;
}

.ag-st-check:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-st-added {
  display: block;
  color: var(--ag-fg-4);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.ag-st-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.ag-st-sort:hover {
  color: var(--ag-fg-1);
}

.ag-st-sort:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-st-box {
  display: grid;
  justify-items: start;
  max-width: 260px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.is-right > .ag-st-box {
  justify-items: end;
  margin-left: auto;
}

.ag-st-box.is-w-prompt {
  max-width: 280px;
}

.ag-st-box.is-w-finding {
  max-width: 320px;
}

.ag-st-cell {
  color: var(--ag-fg-1);
}

.ag-st-cell.is-tone-good {
  color: var(--ag-you);
}

.ag-st-cell.is-tone-warn {
  color: var(--ag-warning);
}

.ag-st-cell.is-not-found {
  color: var(--ag-fg-2);
}

.ag-st-cell.is-not-found.is-tone-good {
  color: var(--ag-you);
}

.ag-st-cell.is-not-found.is-tone-warn {
  color: var(--ag-warning);
}

.ag-st-cell.is-not-configured,
.ag-st-cell.is-not-selected,
.ag-st-cell.is-not-measured,
.ag-st-cell.is-skipped,
.ag-st-cell.is-stopped,
.ag-st-cell.is-empty {
  color: var(--ag-fg-4);
}

.ag-st-cell.is-failed {
  color: var(--ag-danger);
}

.ag-st-ver {
  margin-left: 2px;
  color: var(--ag-fg-4);
  font-size: 10px;
  line-height: 1;
}

.ag-st-prev {
  color: var(--ag-fg-4);
  font-size: 11px;
  line-height: 16px;
}

.ag-st-badge {
  display: inline-block;
  align-self: flex-start;
  margin-top: 2px;
  padding: 0 4px;
  border: 1px solid var(--ag-changed-line);
  border-radius: 4px;
  color: var(--ag-changed-line);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.ag-st-link,
.ag-st-ev {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
}

.ag-st-link:hover,
.ag-st-ev:hover {
  color: var(--ag-fg-1);
  text-decoration-color: currentColor;
  opacity: 1;
}

.ag-st-link:focus-visible,
.ag-st-ev:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-st-links {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 4px;
}

.ag-st-ev {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}

.ag-st-empty {
  margin: 0;
  padding: 16px 12px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-st-more {
  margin: 0;
  padding: 10px 12px 14px;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 18px;
}

.ag-st-more-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-serp-title);
  font: inherit;
  cursor: pointer;
}

.ag-st-more-btn:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-st-more-btn:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-st-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
