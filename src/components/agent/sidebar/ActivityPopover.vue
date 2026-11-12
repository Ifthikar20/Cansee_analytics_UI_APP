<script setup>
// Body of the inbox popover: the project's recent activity (runs that
// finished, new versions of pages, reports and sheets, and the reviews
// that concern you: requests, decisions and comments). Empty means empty.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  CircleCheck,
  ClipboardCheck,
  FileChartColumn,
  FileText,
  MessageSquare,
  MessageSquareWarning,
  SquareTerminal,
  Table2,
} from '@lucide/vue'
import { IconRecentChat } from '@/components/agent/icons'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { relativeTime } from '@/components/agent/common/agentText'

const props = defineProps({
  items: { type: Array, default: () => [] },
  websiteId: { type: String, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['retry', 'navigate'])

const KIND = {
  page: { label: 'Landing page', icon: SquareTerminal, tone: 'accent' },
  document: { label: 'Document', icon: FileText, tone: 'doc' },
  sheet: { label: 'Sheet', icon: Table2, tone: 'sheet' },
  report: { label: 'Report', icon: FileChartColumn, tone: 'report' },
}

// Review items (p2_contract.md 13d): icon, tone and the meta line.
const REVIEW = {
  review_requested: { icon: ClipboardCheck, tone: 'accent', meta: (item, v) => `${actorOf(item)} asked you to review${v}` },
  review_approved: { icon: CircleCheck, tone: 'good', meta: (item, v) => `${actorOf(item)} approved it${v}` },
  review_changes_requested: {
    icon: MessageSquareWarning,
    tone: 'warn',
    meta: (item, v) => `${actorOf(item)} asked for changes${v}`,
  },
  review_comment: { icon: MessageSquare, tone: 'recent', meta: (item) => `${actorOf(item)} commented: ${item.excerpt || ''}`.trim() },
}

const KNOWN = new Set(['run_completed', 'artifact_version', ...Object.keys(REVIEW)])

function actorOf(item) {
  return String(item?.actor_name || '').trim() || 'Someone'
}

function artifactTo(item) {
  const wid = props.websiteId
  return wid && item.artifact_id ? { name: 'agent-artifact', params: { websiteId: wid, artifactId: String(item.artifact_id) } } : null
}

const rows = computed(() =>
  props.items
    .filter((item) => item && KNOWN.has(item.type))
    .map((item, index) => {
      const wid = props.websiteId
      const review = REVIEW[item.type]
      if (review) {
        const version = item.version ? ` · v${item.version}` : ''
        return {
          key: `${item.type}:${item.artifact_id}:${item.at}:${index}`,
          icon: review.icon,
          tone: review.tone,
          title: item.title || 'Draft',
          meta: review.meta(item, version),
          at: item.at,
          to: artifactTo(item),
        }
      }
      if (item.type === 'artifact_version') {
        const kind = KIND[item.kind] || { label: 'Artifact', icon: FileText, tone: 'doc' }
        const version = item.version ? ` v${item.version}` : ''
        return {
          key: `a:${item.artifact_id}:${item.version}:${item.at}:${index}`,
          icon: kind.icon,
          tone: kind.tone,
          title: item.title || kind.label,
          meta: `${kind.label}${version}`,
          at: item.at,
          to: artifactTo(item),
        }
      }
      return {
        key: `r:${item.chat_id}:${item.at}:${index}`,
        icon: IconRecentChat,
        tone: 'recent',
        title: item.title || 'New chat',
        meta: 'Agent finished',
        at: item.at,
        to: wid && item.chat_id ? { name: 'agent-chat', params: { websiteId: wid, chatId: String(item.chat_id) } } : null,
      }
    }),
)
</script>

<template>
  <div class="ag-act">
    <div class="ag-act-head">
      <p class="ag-act-title">Activity</p>
      <AgSpinner v-if="loading && rows.length" :size="12" label="Refreshing activity" />
    </div>

    <div v-if="loading && !rows.length" class="ag-act-state" aria-live="polite">
      <AgSpinner :size="14" />
      <span>Loading activity</span>
    </div>
    <div v-else-if="error && !rows.length" class="ag-act-state is-error" role="alert">
      <span>{{ error }}</span>
      <AgButton size="xs" @click="emit('retry')">Try again</AgButton>
    </div>
    <div v-else-if="!rows.length" class="ag-act-empty">
      <p class="ag-act-empty-title">Nothing new yet.</p>
      <p class="ag-act-empty-body">
        Finished agent runs, new drafts and review requests in this project show up here.
      </p>
    </div>
    <ul v-else class="ag-act-list" role="list">
      <li v-for="row in rows" :key="row.key">
        <component
          :is="row.to ? RouterLink : 'div'"
          :to="row.to || undefined"
          class="ag-act-item"
          :class="{ 'is-link': row.to }"
          @click="row.to && emit('navigate')"
        >
          <span class="ag-act-icon" :class="`is-${row.tone}`" aria-hidden="true">
            <component :is="row.icon" :size="14" />
          </span>
          <span class="ag-act-text">
            <span class="ag-act-item-title">{{ row.title }}</span>
            <span class="ag-act-meta">
              {{ row.meta }}<template v-if="relativeTime(row.at)"> · <time :datetime="row.at">{{ relativeTime(row.at) }}</time></template>
            </span>
          </span>
        </component>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ag-act {
  display: flex;
  flex-direction: column;
  max-height: inherit;
}

.ag-act-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 14px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  color: var(--ag-fg-3);
}

.ag-act-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
}

.ag-act-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 16px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  text-align: center;
}

.ag-act-empty {
  padding: 28px 24px 30px;
  text-align: center;
}

.ag-act-empty-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-act-empty-body {
  margin: 4px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-act-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 380px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
}

.ag-act-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  color: var(--ag-fg-1);
  text-decoration: none;
}

.ag-act-item.is-link:hover {
  background: var(--ag-menu-hover);
  opacity: 1;
}

.ag-act-item.is-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-act-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: var(--radius);
}

.ag-act-icon.is-accent {
  color: var(--ag-accent);
}

.ag-act-icon.is-doc {
  color: var(--ag-kind-doc);
}

.ag-act-icon.is-sheet {
  color: var(--ag-kind-sheet);
}

.ag-act-icon.is-report {
  color: var(--ag-kind-report);
}

.ag-act-icon.is-recent {
  color: var(--ag-recent-icon);
}

.ag-act-icon.is-good {
  color: var(--ag-you);
}

.ag-act-icon.is-warn {
  color: var(--ag-warning);
}

.ag-act-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ag-act-item-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-act-meta {
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
