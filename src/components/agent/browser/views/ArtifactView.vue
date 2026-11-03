<template>
  <div class="ag-artv" :class="{ 'is-frame': kind === 'page' && !blocking }">
    <div v-if="notice" class="ag-artv-notice" :class="notice.tone" role="status">
      <component :is="notice.icon" :size="14" aria-hidden="true" />
      <span class="ag-artv-notice-text">{{ notice.text }}</span>
      <button v-if="notice.action" type="button" class="ag-artv-notice-btn" @click="notice.action.run">
        {{ notice.action.label }}
      </button>
    </div>

    <div v-if="blocking === 'loading'" class="ag-artv-state" role="status">
      <AgSpinner :size="14" />
      {{ selected !== null ? `Loading version ${selected}…` : 'Loading…' }}
    </div>
    <PaneError
      v-else-if="blocking === 'error'"
      :title="blockingError.title"
      :body="blockingError.body"
      :retry="blockingError.retry !== false"
      @retry="retry"
    />
    <PaneError
      v-else-if="blocking === 'failed'"
      title="The agent couldn't finish this draft."
      :body="failureText"
    />
    <div v-else-if="blocking === 'empty'" class="ag-artv-state" role="status">
      <AgSpinner :size="14" />
      {{ source.draft.value?.partial ? 'Drafting… It shows here when the draft is finished.' : 'Starting the draft…' }}
    </div>

    <template v-else>
      <PageArtifactView v-if="kind === 'page'" class="ag-artv-fill" :html="text" :live="live" :title="title" />
      <ReportArtifactView v-else-if="kind === 'report'" :markdown="text" :data="source.data.value" :live="live" :title="title" />
      <SheetArtifactView
        v-else-if="kind === 'sheet'"
        :sheet="source.sheet.value"
        :warnings="source.warnings.value"
        :live="live"
      />
      <StructuredDocumentView v-else-if="kind === 'document' && structured" :source="source" :live="live" />
      <template v-else>
        <p v-if="llmsOrigin" class="ag-artv-note">Publish this file at {{ llmsOrigin }}/llms.txt. Cansee doesn't publish it.</p>
        <DocumentArtifactView :markdown="documentText" :live="live" :title="title" />
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CircleAlert, History, TriangleAlert } from '@lucide/vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import PaneError from '../PaneError.vue'
import DocumentArtifactView from './DocumentArtifactView.vue'
import PageArtifactView from './PageArtifactView.vue'
import ReportArtifactView from './ReportArtifactView.vue'
import SheetArtifactView from './SheetArtifactView.vue'
import StructuredDocumentView from './structured/StructuredDocumentView.vue'
import { hasStructuredView, structuredType } from '@/lib/agent/structured'

// Picks the view for an artifact tab and owns its loading, failure and
// version notices. `source` comes from useArtifactSource.

const props = defineProps({
  source: { type: Object, required: true },
})

const emit = defineEmits(['version'])

const kind = computed(() => props.source.kind.value)
const title = computed(() => props.source.title.value)
const live = computed(() => props.source.drafting.value)
const selected = computed(() => props.source.selected.value)
const text = computed(() => {
  const value = props.source.content.value
  return typeof value === 'string' ? value : ''
})

// A document whose version keeps structured parts (p2_contract.md 12d) has
// its own view; while drafting, `data` is the latest snapshot, which names
// its type from the first one. A press release has no view of its own: its
// Markdown streams inside the snapshot until the saved copy arrives.
const dataType = computed(() => (kind.value === 'document' ? structuredType(props.source.data.value) : ''))
const structured = computed(() => kind.value === 'document' && hasStructuredView(props.source.data.value))
const documentText = computed(() => {
  const data = props.source.data.value
  if (dataType.value === 'press' && live.value && !text.value && typeof data?.markdown === 'string') return data.markdown
  return text.value
})
const llmsOrigin = computed(() => {
  if (dataType.value !== 'llms_txt') return ''
  const origin = props.source.data.value?.origin
  return typeof origin === 'string' ? origin.replace(/\/+$/, '') : ''
})

const failureText = computed(() => {
  const failure = props.source.failure.value
  return failure?.message || 'Ask the agent to try again.'
})

const blockingError = computed(
  () => props.source.versionError.value || props.source.error.value || { title: '', body: '', retry: true }
)

const blocking = computed(() => {
  const s = props.source
  if (selected.value !== null) {
    if (s.versionState.value === 'error') return 'error'
    return s.ready.value ? '' : 'loading'
  }
  if (s.ready.value) return ''
  if (s.failure.value) return 'failed'
  if (s.drafting.value || s.showDraft.value || s.state.value === 'waiting') return 'empty'
  if (s.state.value === 'error') return 'error'
  return 'loading'
})

const notice = computed(() => {
  const s = props.source
  if (s.failure.value && s.ready.value) {
    return {
      tone: 'is-error',
      icon: CircleAlert,
      text: `The latest draft failed${s.failure.value.message ? `: ${s.failure.value.message}` : ''}. Showing the last saved version.`,
    }
  }
  if (selected.value !== null && s.ready.value) {
    return {
      tone: '',
      icon: History,
      text: `Viewing version ${selected.value} of ${s.latestVersion.value}.`,
      action: { label: 'Show latest', run: () => emit('version', null) },
    }
  }
  // A finished draft stays on screen until its saved copy loads. Until then
  // it is the agent's raw output, before the server checked it, so it says
  // so and Export waits for the saved copy.
  if (s.showDraft.value && !live.value) {
    if (s.state.value === 'error') {
      return {
        tone: 'is-error',
        icon: CircleAlert,
        text: "The saved version couldn't be loaded. This is the unchecked draft, and export is off until the saved version loads.",
        action: { label: 'Retry', run: retry },
      }
    }
    return { tone: '', icon: AgSpinner, text: 'Draft finished. Loading the saved version…' }
  }
  if (kind.value === 'page' && s.warnings.value.length && !live.value) {
    const n = s.warnings.value.length
    return {
      tone: 'is-warning',
      icon: TriangleAlert,
      text: `${n} ${n === 1 ? 'change was' : 'changes were'} made when this page was checked for safety.`,
    }
  }
  return null
})

function retry() {
  if (selected.value !== null) props.source.loadSelectedVersion()
  else props.source.load()
}
</script>

<style scoped>
.ag-artv {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.ag-artv.is-frame {
  height: 100%;
}

.ag-artv-fill {
  flex: 1 1 auto;
  min-height: 0;
}

.ag-artv-notice {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-artv-notice.is-error {
  background: var(--ag-danger-bg);
  color: var(--ag-danger);
}

.ag-artv-notice.is-warning {
  color: var(--ag-warning);
}

.ag-artv-notice-text {
  flex: 1 1 auto;
  min-width: 0;
}

.ag-artv-notice-btn {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 6px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.ag-artv-notice-btn:hover {
  background: var(--ag-btn-hover);
}

.ag-artv-notice-btn:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-artv-note {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 24px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
}

.ag-artv-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 56px 24px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}
</style>
