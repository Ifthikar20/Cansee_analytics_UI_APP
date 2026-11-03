<template>
  <header class="ag-ph" :class="`is-${tab.kind}`">
    <template v-if="tab.kind === 'url' || tab.kind === 'page'">
      <div class="ag-ph-nav">
        <AgIconButton label="Back" :size="28" muted :disabled="!canBack" @click="goBack">
          <ArrowLeft :size="16" />
        </AgIconButton>
        <AgIconButton label="Forward" :size="28" muted :disabled="!canForward" @click="goForward">
          <ArrowRight :size="16" />
        </AgIconButton>
        <AgIconButton label="Reload" :size="28" muted :disabled="!pageAddress" @click="reload">
          <RotateCw :size="15" />
        </AgIconButton>
      </div>
      <UrlBar class="ag-ph-url" compact :value="pageAddress" @submit="go" />
      <div class="ag-ph-mode" role="group" aria-label="View">
        <AgTooltip :text="liveReason" :disabled="liveOk">
          <button
            type="button"
            class="ag-ph-seg"
            :class="{ 'is-on': mode === 'live' }"
            :aria-pressed="mode === 'live' ? 'true' : 'false'"
            :aria-disabled="liveOk ? undefined : 'true'"
            @click="setMode('live')"
          >
            <Monitor :size="14" aria-hidden="true" />
            <span class="ag-ph-seg-text">Live</span>
          </button>
        </AgTooltip>
        <button
          type="button"
          class="ag-ph-seg"
          :class="{ 'is-on': mode === 'reader' }"
          :aria-pressed="mode === 'reader' ? 'true' : 'false'"
          @click="setMode('reader')"
        >
          <BookOpen :size="14" aria-hidden="true" />
          <span class="ag-ph-seg-text">Reader</span>
        </button>
      </div>
      <AgTooltip v-if="externalHref" text="Open in new window">
        <a class="ag-ph-ext" :href="externalHref" target="_blank" rel="noopener noreferrer nofollow" aria-label="Open in new window">
          <ExternalLink :size="15" aria-hidden="true" />
        </a>
      </AgTooltip>
    </template>

    <template v-else>
      <h2 class="ag-ph-title">
        <span class="ag-ph-title-text">{{ heading }}</span>
        <span v-if="statusText" class="ag-ph-status">
          <AgSpinner v-if="drafting" :size="12" />
          {{ statusText }}
        </span>
      </h2>
      <div class="ag-ph-actions">
        <template v-if="tab.kind === 'serp'">
          <AgTooltip v-if="googleHref" text="Open in Google">
            <a class="ag-ph-ext" :href="googleHref" target="_blank" rel="noopener noreferrer nofollow" aria-label="Open in Google">
              <ExternalLink :size="15" aria-hidden="true" />
            </a>
          </AgTooltip>
          <ExportMenu
            kind="serp"
            :context="serpContext"
            :disabled="!serpResults"
            disabled-reason="Export is available once the results are in."
          />
        </template>
        <template v-else-if="tab.kind === 'artifact' && source">
          <VersionMenu
            v-if="(source.latestVersion.value || 0) > 1"
            :source="source"
            :disabled="drafting"
            @select="emit('version', $event)"
          />
          <ExportMenu
            v-if="artifactKind"
            :kind="artifactKind"
            :context="artifactContext"
            :disabled="drafting || !source.ready.value"
          />
        </template>
      </div>
    </template>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Monitor, RotateCw } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useBrowse } from '@/composables/agent/useBrowse'
import { googleSearchUrl } from '@/lib/agent/url'
import { safeHref } from '@/utils/safeHref'
import ExportMenu from './ExportMenu.vue'
import UrlBar from './UrlBar.vue'
import VersionMenu from './VersionMenu.vue'
import { liveAllowed, liveUnavailableReason, pageMode, pageUrl } from './pageMode'

// The row under the tab strip: a title with Export (and versions) for
// artifacts and Google results, or browser controls for web pages.

const props = defineProps({
  tab: { type: Object, required: true },
  source: { type: Object, default: null },
})

const emit = defineEmits(['version'])

const pane = useAgentPaneStore()
const browse = useBrowse()

const heading = computed(() => {
  if (props.tab.kind === 'artifact' && props.source) return props.source.title.value || pane.titleOf(props.tab)
  return pane.titleOf(props.tab)
})

const drafting = computed(() => Boolean(props.source && props.source.drafting.value))
const artifactKind = computed(() => (props.source ? props.source.kind.value : ''))

const statusText = computed(() => {
  if (props.tab.kind !== 'artifact' || !props.source) return ''
  if (drafting.value) return 'Drafting…'
  if (props.source.failure.value) return 'Draft failed'
  const shown = props.source.shownVersion.value
  const latest = props.source.latestVersion.value
  if (shown && latest && shown !== latest) return `Version ${shown} of ${latest}`
  return ''
})

// ── Web pages ──

// The address after redirects once the page has loaded.
const pageAddress = computed(() => pageUrl(props.tab) || props.tab.url || '')
const history = computed(() => props.tab.history || { entries: [], index: -1 })
const canBack = computed(() => history.value.index > 0)
const canForward = computed(() => history.value.index >= 0 && history.value.index < history.value.entries.length - 1)
const mode = computed(() => pageMode(props.tab))
const liveOk = computed(() => liveAllowed(props.tab))
const liveReason = computed(() => (liveOk.value ? '' : liveUnavailableReason(props.tab)))
const externalHref = computed(() => safeHref(pageUrl(props.tab) || props.tab.url || ''))

function goBack() {
  pane.goBack(props.tab.id)
}

function goForward() {
  pane.goForward(props.tab.id)
}

function go(url) {
  pane.navigateTab(props.tab.id, url)
}

function reload() {
  if (mode.value === 'live') {
    pane.updateTab(props.tab.id, { nonce: (props.tab.nonce || 0) + 1 })
    return
  }
  if (props.tab.kind === 'page') pane.navigateTab(props.tab.id, pageAddress.value, { replace: true })
  browse.load(props.tab.id, { force: true })
}

function setMode(next) {
  if (next === 'live' && !liveOk.value) return
  pane.updateTab(props.tab.id, { mode: next })
}

// ── Google results ──

const capture = computed(() => props.tab.data || {})
const serpResults = computed(() => Array.isArray(capture.value.results) && capture.value.results.length > 0)
const googleHref = computed(() => googleSearchUrl(capture.value.query, capture.value.page, capture.value.location))

function serpContext() {
  return { title: pane.titleOf(props.tab), capture: capture.value }
}

function artifactContext() {
  const s = props.source
  return {
    title: s.title.value || pane.titleOf(props.tab),
    content: typeof s.content.value === 'string' ? s.content.value : '',
    data: s.data.value,
    sheet: s.sheet.value,
  }
}
</script>

<style scoped>
.ag-ph {
  container-name: ag-ph;
  container-type: inline-size;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 52px;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  background: var(--ag-pane-bg);
}

.ag-ph.is-url,
.ag-ph.is-page {
  gap: 6px;
  padding: 0 12px 0 8px;
}

.ag-ph-title {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin: 0;
  color: var(--ag-fg-1b);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.ag-ph-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-ph-status {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
}

.ag-ph-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.ag-ph-nav {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.ag-ph-url {
  flex: 1 1 auto;
  min-width: 0;
}

.ag-ph-mode {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  box-sizing: border-box;
  height: 32px;
  padding: 1px;
  border: 1px solid var(--ag-seg-border);
  border-radius: 8px;
  background: var(--ag-seg-track);
}

.ag-ph-seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.ag-ph-seg.is-on {
  background: var(--ag-seg-thumb);
  box-shadow: var(--ag-seg-thumb-shadow);
  color: var(--ag-fg-1);
}

.ag-ph-seg[aria-disabled='true'] {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-ph-seg:focus-visible {
  border-radius: 7px;
  outline: 2px solid var(--ag-ring);
  outline-offset: -1px;
}

.ag-ph-ext {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--ag-fg-4);
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-ph-ext:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-ph-ext:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

@container ag-ph (max-width: 520px) {
  .ag-ph-seg-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .ag-ph-seg {
    padding: 0 8px;
  }
}
</style>
