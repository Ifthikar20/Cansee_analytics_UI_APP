<template>
  <div class="ag-card" :class="{ 'is-error': failed }">
    <span class="ag-card-icon" :style="{ color: kindInfo.color }" aria-hidden="true">
      <component :is="kindInfo.icon" />
    </span>
    <div class="ag-card-text">
      <p class="ag-card-title">{{ title || kindInfo.label }}</p>
      <p class="ag-card-sub">{{ subtitle }}</p>
    </div>
    <button
      v-if="artifactId"
      type="button"
      class="ag-card-open"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-controls="controls || undefined"
      :aria-label="`Open ${title || kindInfo.label}`"
      @click="emit('open', $event)"
    >
      Open
    </button>
  </div>
</template>

<script setup>
// The deliverable of a sub-agent run: kind icon, title, "{project} website"
// and Open, which shows the artifact (or its live draft) in the browser pane.
import { computed } from 'vue'
import { kindMeta } from '@/lib/agent/agentsMeta'
import { isLiveStatus } from './parts'

const props = defineProps({
  artifactId: { type: [String, Number], default: null },
  title: { type: String, default: '' },
  kind: { type: String, default: 'page' },
  version: { type: Number, default: null },
  projectName: { type: String, default: '' },
  // agent_call status
  status: { type: String, default: '' },
  // agent_call progress: the sub-agent's latest planning line (a backend extra field)
  progress: { type: String, default: '' },
  error: { type: [String, Object], default: null },
  live: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  controls: { type: String, default: '' },
})

const emit = defineEmits(['open'])

const kindInfo = computed(() => kindMeta(props.kind))
const failed = computed(() => props.status === 'error')

const SUBJECT = {
  page: 'website',
  document: 'article',
  sheet: 'ad campaign',
  report: 'report',
}

const subtitle = computed(() => {
  if (failed.value) {
    const msg = typeof props.error === 'string' ? props.error : props.error?.message
    return msg ? `Not finished: ${msg}` : 'Not finished'
  }
  if (props.live && isLiveStatus(props.status)) {
    const planning = props.status === 'preparing' || props.status === 'planning'
    return planning && props.progress.trim() ? props.progress.trim() : 'Drafting…'
  }
  const subject = SUBJECT[props.kind] || kindInfo.value.label.toLowerCase()
  const base = props.projectName ? `${props.projectName} ${subject}` : kindInfo.value.label
  return props.version && props.version > 1 ? `${base} · v${props.version}` : base
})
</script>

<style scoped>
.ag-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(100%, 428px);
  min-height: 64px;
  padding: 10px 16px 10px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: transparent;
}

.ag-card-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: 6px;
}

.ag-card-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.ag-card-text {
  display: grid;
  flex: 1;
  min-width: 0;
}

.ag-card-title,
.ag-card-sub {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-card-title {
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-card-sub {
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
}

.ag-card.is-error .ag-card-sub {
  color: var(--ag-danger);
}

.ag-card-open {
  flex-shrink: 0;
  min-width: 54px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 8px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-card-open:hover {
  background: var(--ag-btn-hover);
}

.ag-card-open:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
