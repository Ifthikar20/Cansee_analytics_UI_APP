<template>
  <div :id="id" class="ag-steps">
    <ol v-if="steps.length" class="ag-step-list">
      <li
        v-for="step in rows"
        :key="step.part.id"
        class="ag-step"
        :class="[`is-${step.line.tone}`, `ag-step-${step.part.type}`]"
      >
        <span class="ag-step-mark" aria-hidden="true">
          <LoaderCircle v-if="step.line.tone === 'live'" class="ag-step-spin" />
          <X v-else-if="step.line.tone === 'error'" class="ag-step-icon" />
          <span v-else class="ag-step-dot"></span>
        </span>
        <div class="ag-step-body">
          <button
            v-if="step.line.tabId || step.line.url"
            type="button"
            class="ag-step-line ag-step-link"
            :aria-label="step.line.tabId ? `${step.line.text}. Show in the browser` : `${step.line.text}. Open the page`"
            @click="open(step.line, $event)"
          >
            <span class="ag-step-text">{{ step.line.text }}</span>
            <ArrowUpRight class="ag-step-go" aria-hidden="true" />
          </button>
          <p v-else class="ag-step-line">
            <span class="ag-step-text">{{ step.line.text }}</span>
            <span v-if="step.part.type === 'thinking' && thinkingTime(step.part)" class="ag-step-meta ag-tnum">
              for {{ thinkingTime(step.part) }}
            </span>
          </p>
          <p v-if="step.line.detail" class="ag-step-detail" :class="{ 'is-error': step.line.tone === 'error' }">
            {{ step.line.detail }}
          </p>
          <MarkdownBlock
            v-if="step.part.type === 'thinking' && step.part.text"
            class="ag-step-thinking"
            :text="step.part.text"
            :streaming="live && step.line.tone === 'live'"
            quiet
          />
          <ul v-if="step.part.type === 'web_search' && webResults(step.part).length" class="ag-step-results">
            <li v-for="r in webResults(step.part)" :key="r.url">
              <button type="button" class="ag-step-result" @click="openUrl(r.url, $event)">
                <span class="ag-step-result-title">{{ r.title || r.host }}</span>
                <span class="ag-step-result-host">{{ r.host }}</span>
              </button>
            </li>
          </ul>
        </div>
      </li>
    </ol>

    <section v-if="checks.length" class="ag-checks" :aria-label="`Background checks, ${progress.settled} of ${progress.total} done`">
      <header class="ag-checks-head">
        <span class="ag-step-mark" aria-hidden="true">
          <LoaderCircle v-if="progress.live && live" class="ag-step-spin" />
          <span v-else class="ag-step-dot"></span>
        </span>
        <span class="ag-checks-title">Background checks</span>
        <span class="ag-checks-count ag-tnum">{{ progress.settled }} of {{ progress.total }}</span>
      </header>
      <div v-for="group in groups" :key="group.key" class="ag-check-group">
        <p v-if="group.prompt" class="ag-check-prompt">{{ quote(group.prompt) }}</p>
        <ul class="ag-check-list">
          <li v-for="check in group.checks" :key="check.id" class="ag-check" :class="`is-${checkLine(check).tone}`">
            <span class="ag-check-dot" :style="{ background: checkLine(check).color }" aria-hidden="true"></span>
            <span class="ag-check-engine">{{ checkLine(check).label }}</span>
            <span class="ag-check-sep" aria-hidden="true">&middot;</span>
            <span class="ag-check-status">{{ checkLine(check).status }}</span>
            <span v-if="checkLine(check).reason" class="ag-check-reason">{{ checkLine(check).reason }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
// The steps behind a reply: thinking, tools, web reads, Google results pages
// and inspected pages (these open their pane tab), then the background AI
// engine checks, which are text only and never touch the pane.
import { computed } from 'vue'
import { ArrowUpRight, LoaderCircle, X } from '@lucide/vue'
import MarkdownBlock from './MarkdownBlock.vue'
import { checkProgress, engineCheckLine, groupChecks, stepLine } from './parts'
import { formatDuration } from '@/composables/agent/useElapsed'
import { hostOf } from '@/lib/agent/url'
import { useAgentPaneStore } from '@/stores/agentPane'

const props = defineProps({
  id: { type: String, default: '' },
  steps: { type: Array, default: () => [] },
  checks: { type: Array, default: () => [] },
  // The message is still streaming.
  live: { type: Boolean, default: false },
})

const pane = useAgentPaneStore()

// Once the message is finished nothing in it can still be running.
const rows = computed(() =>
  props.steps.map((part) => {
    const line = stepLine(part)
    if (!props.live && line.tone === 'live') line.tone = 'done'
    return { part, line }
  })
)

const groups = computed(() => groupChecks(props.checks))
const progress = computed(() => checkProgress(props.checks))

function checkLine(part) {
  return engineCheckLine(part)
}

function quote(text) {
  return `“${text}”`
}

function thinkingTime(part) {
  const ms = Number(part.duration_ms)
  return Number.isFinite(ms) && ms >= 1000 ? formatDuration(ms) : ''
}

function webResults(part) {
  const list = Array.isArray(part.results) ? part.results : []
  return list
    .filter((r) => r && typeof r.url === 'string' && hostOf(r.url))
    .slice(0, 4)
    .map((r) => ({ url: r.url, title: r.title || '', host: hostOf(r.url) }))
}

function openUrl(url, event) {
  pane.setReturnFocus(event?.currentTarget || null)
  pane.openUrl(url, { activate: true })
}

function open(line, event) {
  pane.setReturnFocus(event?.currentTarget || null)
  if (line.tabId) pane.activateTab(line.tabId)
  else if (line.url) pane.openUrl(line.url, { activate: true })
}
</script>

<style scoped>
.ag-steps {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.ag-step-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-step {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: 10px;
  padding-bottom: 10px;
}

/* Connector between step markers. */
.ag-step:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 0;
  left: 7.5px;
  width: 1px;
  background: var(--ag-divider);
}

.ag-step:last-child {
  padding-bottom: 0;
}

.ag-step-mark {
  display: grid;
  place-items: center;
  width: 16px;
  height: 20px;
  color: var(--ag-fg-4);
}

.ag-step-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--ag-fg-4);
}

.ag-step-icon {
  width: 14px;
  height: 14px;
  color: var(--ag-danger);
}

.ag-step-spin {
  width: 14px;
  height: 14px;
  color: var(--ag-fg-3);
  animation: ag-step-spin 0.9s linear infinite;
}

@keyframes ag-step-spin {
  to {
    transform: rotate(360deg);
  }
}

.ag-step-body {
  min-width: 0;
}

.ag-step-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
}

.ag-step.is-live .ag-step-line {
  color: var(--ag-fg-1);
}

.ag-step-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ag-step-meta {
  flex-shrink: 0;
  color: var(--ag-fg-4);
}

.ag-step-link {
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s ease;
}

.ag-step-link:hover {
  color: var(--ag-fg-1);
}

.ag-step-link:focus-visible,
.ag-step-result:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 6px;
}

.ag-step-go {
  align-self: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ag-fg-4);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ag-step-link:hover .ag-step-go,
.ag-step-link:focus-visible .ag-step-go {
  opacity: 1;
}

.ag-step-detail {
  margin: 2px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.ag-step-detail.is-error {
  color: var(--ag-danger);
}

.ag-step-thinking {
  margin-top: 4px;
}

.ag-step-results {
  display: grid;
  gap: 2px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.ag-step-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
}

.ag-step-result:hover .ag-step-result-title {
  color: var(--ag-fg-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-step-result-title {
  overflow: hidden;
  color: var(--ag-fg-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-step-result-host {
  flex-shrink: 0;
  color: var(--ag-fg-4);
}

.ag-checks {
  display: grid;
  gap: 8px;
}

.ag-checks-head {
  display: grid;
  grid-template-columns: 16px auto auto;
  justify-content: start;
  align-items: center;
  column-gap: 10px;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 20px;
}

.ag-checks-count {
  margin-left: -4px;
  color: var(--ag-fg-4);
  font-size: 13px;
}

.ag-check-group {
  padding-left: 26px;
}

.ag-check-prompt {
  margin: 0 0 4px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.ag-check-list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 6px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 20px;
}

.ag-check-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 999px;
}

.ag-check-engine {
  color: var(--ag-fg-1);
  font-weight: 500;
}

.ag-check-sep {
  color: var(--ag-fg-4);
}

.ag-check.is-good .ag-check-status {
  color: var(--ag-accent);
}

.ag-check.is-error .ag-check-status {
  color: var(--ag-danger);
}

.ag-check.is-muted .ag-check-status,
.ag-check.is-live .ag-check-status {
  color: var(--ag-fg-4);
}

.ag-check-reason {
  flex-basis: 100%;
  padding-left: 12px;
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
}

.ag-tnum {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .ag-step-spin {
    animation: none;
  }
}
</style>
