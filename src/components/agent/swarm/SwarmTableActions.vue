<template>
  <div class="ag-sta">
    <template v-if="mode !== 'report'">
      <template v-if="message">
        <AgButton v-if="savedId" class="ag-sta-btn is-saved" variant="ghost" size="xs" :icon="Check" @click="openReport">
          Saved to Reports
        </AgButton>
        <AgButton
          v-else
          class="ag-sta-btn"
          variant="ghost"
          size="xs"
          :icon="FileChartColumn"
          :loading="saving"
          :disabled="!canSave"
          @click="saveReport"
        >
          Add to report
        </AgButton>
      </template>
      <AgButton
        v-if="canEditFindings"
        class="ag-sta-btn"
        variant="ghost"
        size="xs"
        :icon="Flag"
        :loading="adding"
        :disabled="!addKeys.length"
        @click="addFindings"
      >
        {{ addLabel }}
      </AgButton>
      <router-link v-if="viewFindings" class="ag-sta-view" :to="viewFindings">View findings</router-link>
      <SwarmRerunMenu
        v-if="rerunVisible"
        variant="button"
        :swarm-id="swarmId"
        :chat-id="chatId"
        :disabled="rerunDisabled"
      />
    </template>
    <AgButton
      class="ag-sta-btn ag-sta-csv"
      :class="{ 'is-always': mode === 'report' }"
      variant="ghost"
      size="xs"
      :icon="Download"
      @click="emit('download')"
    >
      Download CSV
    </AgButton>
  </div>
</template>

<script setup>
// The results table's footer: add the reply to Reports, add rows to the
// project's Findings, re-run the research, and (on narrow layouts) the CSV
// download the toolbar also offers.
import { computed, ref } from 'vue'
import { Check, Download, FileChartColumn, Flag } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import SwarmRerunMenu from './SwarmRerunMenu.vue'
import { addableRowKeys } from './tableModel'
import { errorInfo } from '@/components/agent/message/parts'
import { useToast } from '@/composables/useToast'
import { useAgentStore } from '@/stores/agent'
import { useAgentFindingsStore } from '@/stores/agentFindings'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'

const props = defineProps({
  // The SwarmTable.
  table: { type: Object, required: true },
  // The sheet on screen.
  sheet: { type: Object, default: null },
  // The message that holds the table; null when the pane loaded it by API.
  message: { type: Object, default: null },
  mode: { type: String, default: 'inline' },
  // The chat has an active run.
  busy: { type: Boolean, default: false },
  chatId: { type: [String, Number], default: null },
  // Row keys checked on this sheet.
  selectedKeys: { type: Array, default: () => [] },
  // The row keys shown (the table's "Changed only" filter); null when all show.
  rowKeys: { type: Array, default: null },
})

const emit = defineEmits(['added', 'download'])

const agent = useAgentStore()
const findings = useAgentFindingsStore()
const pane = useAgentPaneStore()
const ui = useAgentUiStore()
const toast = useToast()

const swarmId = computed(() => String(props.table.swarm_id || ''))
const version = computed(() => Number(props.table.version) || null)
const sheetKey = computed(() => (props.sheet && props.sheet.key) || '')

// ── Add to report ──

// What is saved, and what is being saved, is per message: in the pane one
// footer serves every version of a research, and switching the version
// swaps the message (each version's reply is saved on its own).
const messageKey = computed(() => (props.message ? String(props.message.id) : ''))
const savedHere = ref({})
const savingKey = ref('')
const saving = computed(() => Boolean(messageKey.value) && savingKey.value === messageKey.value)
const savedId = computed(() => {
  if (!props.message) return null
  return props.message.saved_report_id || savedHere.value[messageKey.value] || null
})

function rememberSaved(key, id) {
  if (key && id) savedHere.value = { ...savedHere.value, [key]: id }
}

const canSave = computed(() => {
  const status = props.message && props.message.status
  return props.mode !== 'report' && (status === 'complete' || status === 'truncated')
})

async function saveReport() {
  if (!canSave.value || saving.value || !props.message) return
  const key = messageKey.value
  savingKey.value = key
  try {
    const result = await agent.saveReport(props.message.id)
    rememberSaved(key, (result && (result.id ?? result.artifact_id)) || null)
    const text = result && result.already_saved ? 'Already in Reports.' : 'Saved to Reports.'
    toast.success(text)
    ui.announce(text)
  } catch (error) {
    const info = errorInfo(error)
    const existing = info.details && info.details.artifact_id
    if (info.code === 'already_saved' && existing) {
      rememberSaved(key, existing)
      toast.success('Already in Reports.')
      ui.announce('Already in Reports.')
    } else {
      toast.error(info.message || 'The report could not be saved. Try again.')
    }
  } finally {
    if (savingKey.value === key) savingKey.value = ''
  }
}

function openReport(event) {
  if (!savedId.value) return
  pane.setReturnFocus((event && event.currentTarget) || null)
  pane.openArtifact(savedId.value, { activate: true })
}

// ── Add to findings ──

const adding = ref(false)
const addedHere = ref(false)
const canEditFindings = computed(() => findings.canEdit !== false)

function isAdded(rowKey) {
  return Boolean(findings.isAdded(swarmId.value, sheetKey.value, rowKey))
}

const addable = computed(() => {
  const keys = addableRowKeys(props.sheet, isAdded)
  if (!Array.isArray(props.rowKeys)) return keys
  const shown = new Set(props.rowKeys.map(String))
  return keys.filter((key) => shown.has(key))
})
const chosen = computed(() => (props.selectedKeys || []).map(String).filter((key) => addable.value.includes(key)))
const addKeys = computed(() => (chosen.value.length ? chosen.value : addable.value))
const addLabel = computed(() => {
  if (chosen.value.length) return `Add ${chosen.value.length} to findings`
  const all = Array.isArray(props.rowKeys) ? 'Add all shown to findings' : 'Add all to findings'
  return `${all} (${addable.value.length})`
})

const viewFindings = computed(() => {
  const wid = agent.websiteId
  if (!addedHere.value || wid === null || wid === undefined || wid === '') return null
  return { name: 'agent-findings', params: { websiteId: String(wid) } }
})

function addedText(created, duplicates) {
  const parts = []
  if (created) parts.push(`Added ${created} ${created === 1 ? 'finding' : 'findings'}.`)
  if (duplicates) parts.push(`${duplicates} ${duplicates === 1 ? 'was' : 'were'} already in Findings.`)
  return parts.join(' ') || 'Nothing was added.'
}

async function addFindings() {
  if (adding.value || !addKeys.value.length) return
  adding.value = true
  const rowKeys = addKeys.value.slice()
  try {
    const wid = agent.websiteId
    if (wid !== null && wid !== undefined && wid !== '') findings.init(wid)
    const result = await findings.addFromTable({
      swarmId: swarmId.value,
      version: version.value,
      sheet: sheetKey.value,
      rowKeys: rowKeys.slice(),
    })
    const created = Array.isArray(result && result.created) ? result.created.length : 0
    const duplicates = Array.isArray(result && result.duplicates) ? result.duplicates.length : 0
    const text = addedText(created, duplicates)
    toast.success(text)
    ui.announce(text)
    addedHere.value = true
    emit('added', sheetKey.value, rowKeys)
  } catch (error) {
    const text = errorInfo(error).message || 'These rows could not be added to Findings. Try again.'
    toast.error(text)
    ui.announce(text, 'assertive')
  } finally {
    adding.value = false
  }
}

// ── Re-run ──

const swarmEnabled = computed(() => !(agent.status && agent.status.swarm && agent.status.swarm.enabled === false))
const rerunVisible = computed(
  () => swarmEnabled.value && Boolean(swarmId.value) && props.chatId !== null && props.chatId !== undefined && props.chatId !== ''
)
const rerunDisabled = computed(() => {
  if (props.busy) return true
  try {
    return Boolean(agent.isChatBusy(props.chatId))
  } catch {
    return false
  }
})
</script>

<style scoped>
.ag-sta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  box-sizing: border-box;
  min-height: 44px;
  padding: 6px 12px;
  border-top: 1px solid var(--ag-divider-subtle);
}

.ag-sta .ag-sta-btn.is-saved {
  color: var(--ag-accent);
}

.ag-sta-view {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 4px;
  border-radius: 6px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-sta-view:hover {
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-sta-view:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

/* The toolbar has Download CSV; the footer repeats it on narrow layouts. */
.ag-sta .ag-sta-csv {
  display: none;
  margin-left: auto;
}

.ag-sta .ag-sta-csv.is-always {
  display: inline-flex;
}

@container ag-st (max-width: 519px) {
  .ag-sta .ag-sta-csv {
    display: inline-flex;
  }
}
</style>
