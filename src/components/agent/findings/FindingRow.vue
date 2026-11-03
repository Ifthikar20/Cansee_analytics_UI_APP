<script setup>
// One finding on the Findings page: checkbox, severity dot, title and meta,
// and the status actions (shown on hover and focus, always on touch). The
// title toggles the details: the detail text, the evidence and where the
// finding came from. Evidence that points at a capture opens it in the chat
// that made it; that link is only there for the chat's owner (the API leaves
// source.chat_id null for everyone else). Finding text can quote pages and
// engine answers, so it is rendered as text only.
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight, Check, Ellipsis, MessageSquare, Pencil, RotateCcw, Trash2, X } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import { hostOf, relativeTime } from '@/components/agent/common/agentText'
import { FINDING_STATUS, SWARM_CATEGORY_LABELS } from '@/lib/agent/types'

const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const SHEET_TITLES = { prompts: 'Prompts', gaps: 'Content gaps', sources: 'Sources' }
const CAPTURE_TAB = /^(serp|page):[A-Za-z0-9_-]+$/

const props = defineProps({
  finding: { type: Object, required: true },
  websiteId: { type: String, required: true },
  // Write actions and the checkbox; false for viewers.
  editable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  // A change to this finding is in flight.
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'toggle', 'status', 'edit', 'delete'])

const menuOpen = ref(false)

const id = computed(() => String(props.finding.id))
const bodyId = computed(() => `ag-finding-${id.value}-body`)
const title = computed(() => String(props.finding.title || '').trim() || 'Untitled finding')
const status = computed(() => props.finding.status || FINDING_STATUS.OPEN)
const severity = computed(() => (SEVERITY_LABELS[props.finding.severity] ? props.finding.severity : ''))
const severityLabel = computed(() => (severity.value ? `${SEVERITY_LABELS[severity.value]} severity` : 'Severity not set'))
const source = computed(() => (props.finding.source && typeof props.finding.source === 'object' ? props.finding.source : null))
const chatId = computed(() => (source.value?.chat_id ? String(source.value.chat_id) : ''))

const categoryLabel = computed(
  () => props.finding.category_label || SWARM_CATEGORY_LABELS[props.finding.category] || '',
)

// {category} · “{prompt}” · From {research} v{n} · {when}
const meta = computed(() => {
  const bits = []
  if (categoryLabel.value) bits.push(categoryLabel.value)
  const prompt = String(props.finding.prompt_text || '').trim()
  if (prompt) bits.push(`“${prompt}”`)
  const from = sourceName(source.value)
  if (from) bits.push(`From ${from}${source.value?.version ? ` v${source.value.version}` : ''}`)
  const when = relativeTime(props.finding.created_at)
  if (when) bits.push(when)
  return bits.join(' · ')
})

function sourceName(src) {
  if (!src) return ''
  return String(src.swarm_title || '').trim()
}

// From “{research}”, version {n}, {sheet} sheet
const sourceLine = computed(() => {
  const src = source.value
  if (!src) return ''
  const bits = []
  const name = sourceName(src)
  bits.push(name ? `From “${name}”` : 'From a research')
  if (src.version) bits.push(`version ${src.version}`)
  const sheet = SHEET_TITLES[src.sheet]
  if (sheet) bits.push(`${sheet} sheet`)
  return bits.join(', ')
})

const chatTo = computed(() =>
  chatId.value ? { name: 'agent-chat', params: { websiteId: props.websiteId, chatId: chatId.value } } : null,
)

function safeUrl(url) {
  const raw = String(url || '').trim()
  if (!/^https?:\/\//i.test(raw)) return ''
  try {
    return new URL(raw).href
  } catch {
    return ''
  }
}

// What each evidence item can do: open its capture in the chat (owner only),
// open its web address, or nothing (an engine answer is named, not linked).
const evidence = computed(() =>
  (Array.isArray(props.finding.evidence) ? props.finding.evidence : [])
    .filter((ev) => ev && typeof ev === 'object')
    .map((ev, index) => {
      const kind = String(ev.kind || '')
      const tabId = typeof ev.tab_id === 'string' && CAPTURE_TAB.test(ev.tab_id) ? ev.tab_id : ''
      const url = kind === 'link' || kind === 'page' ? safeUrl(ev.url) : ''
      const label = String(ev.label || '').trim() || (url ? hostOf(url) : '')
      const capture = (kind === 'serp' || kind === 'page') && tabId && chatTo.value
      return {
        key: `${index}:${kind}:${tabId || url || label}`,
        label: label || 'Evidence',
        to: capture ? { ...chatTo.value, query: { tab: tabId } } : null,
        href: !capture && url ? url : '',
      }
    }),
)

const history = computed(() => {
  const lines = []
  const added = relativeTime(props.finding.created_at)
  const by = String(props.finding.created_by_name || '').trim()
  if (added) lines.push(by ? `Added ${added} by ${by}` : `Added ${added}`)
  if (status.value !== FINDING_STATUS.OPEN) {
    const verb = status.value === FINDING_STATUS.DONE ? 'Marked done' : 'Dismissed'
    const when = relativeTime(props.finding.status_changed_at)
    const who = String(props.finding.status_changed_by_name || '').trim()
    lines.push([verb, when, who ? `by ${who}` : ''].filter(Boolean).join(' '))
  }
  return lines.join(' · ')
})

function onCheck(event) {
  emit('select', Boolean(event.target.checked))
}
</script>

<template>
  <li
    class="ag-fr"
    :class="{
      'is-expanded': expanded,
      'is-selected': selected,
      'is-readonly': !editable,
      'is-menu-open': menuOpen,
      'is-busy': busy,
    }"
    :data-finding-id="id"
  >
    <div class="ag-fr-row">
      <span v-if="editable" class="ag-fr-check">
        <input
          type="checkbox"
          class="ag-fr-checkbox"
          :checked="selected"
          :aria-label="`Select ${title}`"
          @change="onCheck"
        />
      </span>
      <span class="ag-fr-sev" :class="severity ? `is-${severity}` : ''" :title="severityLabel" aria-hidden="true" />
      <div class="ag-fr-text">
        <h3 class="ag-fr-heading">
          <button
            type="button"
            class="ag-fr-title"
            :aria-expanded="expanded ? 'true' : 'false'"
            :aria-controls="bodyId"
            @click="emit('toggle')"
          >
            <span class="ag-sr-only">{{ severityLabel }}: </span>{{ title }}
          </button>
        </h3>
        <p v-if="meta" class="ag-fr-meta ag-tnum">{{ meta }}</p>
      </div>
      <div v-if="editable" class="ag-fr-actions">
        <template v-if="status === FINDING_STATUS.OPEN">
          <AgIconButton
            :label="`Mark done: ${title}`"
            tooltip="Mark done"
            :size="28"
            :disabled="busy"
            @click="emit('status', FINDING_STATUS.DONE)"
          >
            <Check />
          </AgIconButton>
          <AgIconButton
            :label="`Dismiss: ${title}`"
            tooltip="Dismiss"
            :size="28"
            :disabled="busy"
            @click="emit('status', FINDING_STATUS.DISMISSED)"
          >
            <X />
          </AgIconButton>
        </template>
        <AgIconButton
          v-else
          :label="`Reopen: ${title}`"
          tooltip="Reopen"
          :size="28"
          :disabled="busy"
          @click="emit('status', FINDING_STATUS.OPEN)"
        >
          <RotateCcw />
        </AgIconButton>
        <DropdownMenuRoot v-model:open="menuOpen" :modal="false">
          <DropdownMenuTrigger as-child>
            <AgIconButton
              class="ag-fr-more"
              :label="`More actions for ${title}`"
              tooltip="More actions"
              :size="28"
              :disabled="busy"
            >
              <Ellipsis />
            </AgIconButton>
          </DropdownMenuTrigger>
          <AgMenuContent align="end" :width="160">
            <AgMenuItem @select="emit('edit')">
              <Pencil aria-hidden="true" />
              Edit
            </AgMenuItem>
            <AgMenuItem danger @select="emit('delete')">
              <Trash2 aria-hidden="true" />
              Delete
            </AgMenuItem>
          </AgMenuContent>
        </DropdownMenuRoot>
      </div>
    </div>

    <div v-if="expanded" :id="bodyId" class="ag-fr-body">
      <p v-if="finding.detail" class="ag-fr-detail">{{ finding.detail }}</p>

      <section v-if="evidence.length" class="ag-fr-evidence" :aria-labelledby="`${bodyId}-evidence`">
        <h4 :id="`${bodyId}-evidence`" class="ag-fr-label">Evidence</h4>
        <ul class="ag-fr-evidence-list" role="list">
          <li v-for="ev in evidence" :key="ev.key" class="ag-fr-evidence-item">
            <a v-if="ev.href" :href="ev.href" class="ag-fr-link" target="_blank" rel="noopener noreferrer">
              <span>{{ ev.label }}</span>
              <ArrowUpRight :size="12" aria-hidden="true" />
              <span class="ag-sr-only">(opens in a new tab)</span>
            </a>
            <span v-else class="ag-fr-evidence-label">{{ ev.label }}</span>
            <AgButton
              v-if="ev.to"
              class="ag-fr-open"
              variant="ghost"
              size="xs"
              :icon="MessageSquare"
              :to="ev.to"
              :aria-label="`Open ${ev.label} in chat`"
            >
              Open in chat
            </AgButton>
          </li>
        </ul>
      </section>

      <p v-if="sourceLine" class="ag-fr-source">
        <span>{{ sourceLine }}</span>
        <RouterLink v-if="chatTo" :to="chatTo" class="ag-fr-source-link">Open in chat</RouterLink>
      </p>
      <p v-if="history" class="ag-fr-history">{{ history }}</p>
    </div>
  </li>
</template>

<style scoped>
.ag-fr {
  position: relative;
  border-radius: 10px;
  list-style: none;
  transition: background-color 120ms ease;
}

.ag-fr:hover,
.ag-fr.is-menu-open,
.ag-fr.is-selected {
  background: var(--ag-row-hover);
}

.ag-fr-row {
  display: grid;
  grid-template-columns: 20px 10px minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 10px;
  box-sizing: border-box;
  min-height: 56px;
  padding: 10px 12px;
}

.ag-fr.is-readonly .ag-fr-row {
  grid-template-columns: 10px minmax(0, 1fr) auto;
}

.ag-fr-check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
}

.ag-fr-checkbox {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--ag-fg-1);
  cursor: pointer;
}

.ag-fr-checkbox:focus-visible {
  border-radius: 3px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-fr-sev {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  margin-left: 1px;
  border-radius: 999px;
  background: var(--ag-fg-disabled);
}

.ag-fr-sev.is-high {
  background: var(--ag-danger);
}

.ag-fr-sev.is-medium {
  background: var(--ag-warning);
}

.ag-fr-sev.is-low {
  background: var(--ag-fg-4);
}

.ag-fr-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ag-fr-heading {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.ag-fr-title {
  display: block;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.ag-fr-title:hover {
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
}

.ag-fr-title:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-fr-meta {
  margin: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-fr-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: -4px -4px 0 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.ag-fr:hover .ag-fr-actions,
.ag-fr:focus-within .ag-fr-actions,
.ag-fr.is-menu-open .ag-fr-actions,
.ag-fr.is-selected .ag-fr-actions {
  opacity: 1;
  pointer-events: auto;
}

/* Aligned with the title: row padding, then the checkbox and dot columns. */
.ag-fr-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 12px 14px 62px;
}

.ag-fr.is-readonly .ag-fr-body {
  padding-left: 32px;
}

.ag-fr-detail {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-fr-evidence {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ag-fr-label {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-fr-evidence-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-fr-evidence-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-height: 26px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.ag-fr-evidence-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ag-fr-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  border-radius: 4px;
  color: var(--ag-fg-1);
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

.ag-fr-link:hover {
  text-decoration-color: currentColor;
}

.ag-fr-link:focus-visible,
.ag-fr-source-link:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-fr-evidence-item :deep(.ag-fr-open) {
  margin-left: -4px;
}

.ag-fr-source,
.ag-fr-history {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ag-fr-history {
  color: var(--ag-fg-4);
}

.ag-fr-source-link {
  border-radius: 4px;
  color: var(--ag-fg-1);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
}

.ag-fr-source-link:hover {
  text-decoration-color: currentColor;
}

@media (pointer: coarse) {
  .ag-fr-actions {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (max-width: 520px) {
  .ag-fr-row {
    grid-template-columns: 20px 10px minmax(0, 1fr);
  }

  .ag-fr.is-readonly .ag-fr-row {
    grid-template-columns: 10px minmax(0, 1fr);
  }

  .ag-fr-actions {
    grid-column: 3;
    margin: 6px 0 0 -6px;
    opacity: 1;
    pointer-events: auto;
  }

  .ag-fr-body,
  .ag-fr.is-readonly .ag-fr-body {
    padding-left: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-fr,
  .ag-fr-actions {
    transition: none;
  }
}
</style>
