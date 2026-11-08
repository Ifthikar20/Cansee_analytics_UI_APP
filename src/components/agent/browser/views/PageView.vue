<template>
  <div class="ag-page">
    <div class="ag-page-body">
      <div class="ag-page-main">
        <FindBar
          v-if="find && find.open"
          :tab="tab"
          :mode="mode"
          :count="matches.count"
          :total="matches.total"
          :capped="matches.capped"
          @reader="showReader"
        />
        <div v-if="tab.status === 'gone'" class="ag-page-state" role="status">
          This page capture is not part of this conversation anymore.
        </div>
        <div v-else-if="showLoading" class="ag-page-state" role="status">
          <span class="ag-page-spinner" aria-hidden="true" />
          {{ tab.status === 'missing' ? 'Loading saved page facts…' : `Loading ${host || 'the page'}…` }}
        </div>
        <PaneError
          v-else-if="errorInfo"
          :title="errorInfo.title"
          :body="errorInfo.body"
          :url="url"
          :retry="canRetry"
          @retry="reload"
        />
        <template v-else>
          <p v-if="blockedNotice" class="ag-page-notice" role="status">
            <Info :size="14" aria-hidden="true" />
            This page can't be shown live inside CanSee, so it opened in the reader view.
          </p>
          <LiveFrame
            v-if="mode === 'live'"
            class="ag-page-live"
            :url="url"
            :title="titleText"
            :nonce="tab.nonce || 0"
            @blocked="onBlocked"
          />
          <div v-else class="ag-page-scroll">
            <ReaderView
              v-if="reader"
              :reader="reader"
              :base-url="url"
              :source-label="sourceLabel"
              :terms="terms"
              :current="find && find.open ? find.index : -1"
              :nav-token="find ? find.nav : 0"
              @navigate="navigate"
              @matches="onMatches"
            />
            <div v-else-if="readerState === 'loading'" class="ag-page-state" role="status">
              <span class="ag-page-spinner" aria-hidden="true" />
              Loading the reader view…
            </div>
            <PaneError
              v-else-if="readerState === 'error'"
              :title="readerError.title"
              :body="readerError.body"
              :url="url"
              retry
              @retry="loadReader"
            />
          </div>
        </template>
      </div>

      <div v-if="seo" class="ag-page-facts" :class="{ 'is-collapsed': !pane.factsOpen }">
        <SeoFactsPanel
          :seo="seo"
          :status-code="data.status_code ?? null"
          :page-url="url"
          :open="pane.factsOpen"
          @toggle="pane.setFactsOpen(!pane.factsOpen)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Info } from '@lucide/vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useBrowse } from '@/composables/agent/useBrowse'
import { compileTerms } from '@/lib/agent/highlight'
import { hostOf } from '@/lib/agent/url'
import FindBar from '../FindBar.vue'
import PaneError from '../PaneError.vue'
import LiveFrame from './LiveFrame.vue'
import ReaderView from './ReaderView.vue'
import SeoFactsPanel from './SeoFactsPanel.vue'
import { formatCapturedAt } from '../format'
import { framesBlocked, pageData, pageErrorInfo, pageMode, pageUrl } from '../pageMode'

const props = defineProps({
  tab: { type: Object, required: true },
})

const pane = useAgentPaneStore()
const browse = useBrowse()

const data = computed(() => pageData(props.tab))
const url = computed(() => pageUrl(props.tab))
const host = computed(() => hostOf(url.value || props.tab.url))
const seo = computed(() => (data.value.seo && typeof data.value.seo === 'object' ? data.value.seo : null))
const reader = computed(() => (data.value.reader && typeof data.value.reader === 'object' ? data.value.reader : null))
const titleText = computed(() => pane.titleOf(props.tab))
const mode = computed(() => pageMode(props.tab))
const blockedNotice = ref(false)

const showLoading = computed(() => {
  if (data.value.error) return false
  const status = props.tab.status
  return (status === 'idle' || status === 'loading' || status === 'missing') && !seo.value && !reader.value
})

// Highlighting: this tab's find bar and the terms its reader view marks.
const find = computed(() => pane.findOf(props.tab.id))
const terms = computed(() => compileTerms(pane.highlightGroups(props.tab.id)))
const NO_MATCHES = { count: 0, total: 0, capped: false }
const matches = ref(NO_MATCHES)

function onMatches(info) {
  matches.value = info
  pane.setFindCount(props.tab.id, info.count)
}

// A find bar opened over marks already on screen (a keyword highlight)
// starts from their count: the reader only reports counts when they change.
watch(
  () => Boolean(find.value),
  (open) => {
    if (open) pane.setFindCount(props.tab.id, matches.value.count)
  }
)

function showReader() {
  pane.updateTab(props.tab.id, { mode: 'reader' })
}

const errorInfo = computed(() => pageErrorInfo(data.value.error))
const canRetry = computed(() => props.tab.kind === 'url' || Boolean(data.value.transport))

const sourceLabel = computed(() => {
  const captured = formatCapturedAt(data.value.captured_at)
  return [host.value, captured ? `Captured ${captured}` : ''].filter(Boolean).join(' · ')
})

// url tabs load on first view; reloads come through the toolbar.
watch(
  () => [props.tab.id, props.tab.url, props.tab.status],
  () => {
    if (props.tab.kind === 'url' && props.tab.status === 'idle' && props.tab.url) browse.load(props.tab.id)
  },
  { immediate: true }
)

watch(
  () => props.tab.url,
  () => {
    blockedNotice.value = false
  }
)

// Without a reader view on screen there is nothing marked to step through.
watch(
  () => mode.value === 'reader' && Boolean(reader.value),
  (shown) => {
    if (!shown) onMatches(NO_MATCHES)
  }
)

function reload() {
  if (props.tab.kind === 'url') browse.load(props.tab.id, { force: true })
  else loadReader()
}

// The tab becomes idle on the new URL; the watcher above loads it.
function navigate(target) {
  pane.navigateTab(props.tab.id, target)
}

function onBlocked() {
  framesBlocked.value = true
  blockedNotice.value = true
}

// Stored page captures do not keep the reader text; fetch it when the
// reader is shown.
const readerState = ref('idle')
const readerError = ref({ title: '', body: '' })
let readerFor = ''

async function loadReader() {
  const target = url.value
  if (!target) return
  readerFor = target
  readerState.value = 'loading'
  const outcome = await browse.fetchPage(target)
  if (readerFor !== target) return
  if (outcome.cancelled) {
    readerState.value = 'idle'
    return
  }
  const error = outcome.error || outcome.result?.error
  if (error) {
    readerError.value = pageErrorInfo(error)
    readerState.value = 'error'
    return
  }
  readerState.value = 'idle'
  pane.updateTab(props.tab.id, { data: { reader: outcome.result.reader || { title: '', blocks: [], links: [] } } })
}

watch(
  () => [mode.value, Boolean(reader.value), props.tab.status, url.value],
  ([currentMode, hasReader, status]) => {
    if (currentMode !== 'reader' || hasReader || props.tab.kind !== 'page') return
    if (status !== 'ready' || errorInfo.value || readerState.value !== 'idle') return
    loadReader()
  },
  { immediate: true }
)
</script>

<style scoped>
.ag-page {
  container-name: ag-page;
  container-type: inline-size;
  height: 100%;
  min-height: 0;
}

.ag-page-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ag-page-main {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.ag-page-live {
  flex: 1 1 auto;
  min-height: 0;
}

.ag-page-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ag-page-facts {
  flex: 0 0 auto;
  max-height: 50%;
  min-height: 0;
  border-top: 1px solid var(--ag-divider);
  background: var(--ag-pane-bg);
}

.ag-page-facts.is-collapsed {
  max-height: none;
}

.ag-page-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 56px 24px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.ag-page-spinner {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--ag-fg-disabled);
  border-top-color: var(--ag-fg-2);
  border-radius: 50%;
  animation: ag-spin 0.8s linear infinite;
}

.ag-page-notice {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

@container ag-page (min-width: 720px) {
  .ag-page-body {
    flex-direction: row;
  }

  .ag-page-facts {
    width: 260px;
    max-height: none;
    border-top: 0;
    border-left: 1px solid var(--ag-divider);
  }

  .ag-page-facts.is-collapsed {
    width: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-page-spinner {
    animation: none;
  }
}
</style>
