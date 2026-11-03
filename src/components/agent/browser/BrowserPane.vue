<template>
  <div class="ag-bp" :class="`is-${currentLayout}`">
    <template v-if="pane.hasTabs">
      <TabStrip :can-expand="currentLayout === 'split'" @close-pane="closePane" />
      <div
        v-if="tab"
        :id="PANE_PANEL_ID"
        class="ag-bp-panel"
        role="tabpanel"
        :aria-labelledby="tabDomId(tab.id)"
      >
        <PaneHeader :tab="tab" :source="tab.kind === 'artifact' ? source : null" @version="setVersion" />
        <div ref="body" class="ag-bp-body" :class="{ 'is-fixed': fixedView }">
          <SerpView v-if="tab.kind === 'serp'" :key="tab.id" :tab="tab" />
          <PageView v-else-if="tab.kind === 'page' || tab.kind === 'url'" :key="tab.id" :tab="tab" />
          <NewTabView v-else-if="tab.kind === 'newtab'" :key="tab.id" :tab="tab" />
          <ArtifactView v-else-if="tab.kind === 'artifact'" :key="tab.id" :source="source" @version="setVersion" />
        </div>
      </div>
    </template>
    <PaneEmpty v-else @close-pane="closePane" />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, provide, ref, watch } from 'vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { PANE_PANEL_ID, tabDomId } from './ids'
import PaneEmpty from './PaneEmpty.vue'
import PaneHeader from './PaneHeader.vue'
import TabStrip from './TabStrip.vue'
import { useArtifactSource } from './useArtifactSource'
import ArtifactView from './views/ArtifactView.vue'
import NewTabView from './views/NewTabView.vue'
import PageView from './views/PageView.vue'
import SerpView from './views/SerpView.vue'

// The browser pane: tab strip, header and the active tab's view. Mounted in
// the workspace's #pane slot, and inside the full-screen dialog on phones.

const props = defineProps({
  // split | overlay | fullscreen; defaults to what the workspace provides.
  layout: { type: String, default: '' },
})

const pane = useAgentPaneStore()
const injectedLayout = inject('agWorkspaceLayout', null)
const currentLayout = computed(() => props.layout || injectedLayout?.value || 'split')

const tab = computed(() => pane.activeTab)
const body = ref(null)

// Views inside the pane open links as pane tabs; elsewhere (the full-page
// artifact view) links open as usual.
provide('agInBrowserPane', true)

const source = useArtifactSource(
  () => (tab.value?.kind === 'artifact' ? tab.value.artifactId : null),
  () => (tab.value?.kind === 'artifact' ? tab.value.version : null),
  { call: (id) => pane.artifactCall(id) }
)

const fixedView = computed(() => {
  const kind = tab.value?.kind
  if (kind === 'page' || kind === 'url') return true
  return kind === 'artifact' && source.kind.value === 'page'
})

function closePane() {
  pane.setOpen(false)
}

function setVersion(version) {
  if (tab.value) pane.updateTab(tab.value.id, { version })
}

// Each tab keeps its scroll position while the pane is open.
const scrollMemory = new Map()
watch(
  () => pane.activeId,
  (id, previous) => {
    if (previous && body.value) scrollMemory.set(previous, body.value.scrollTop)
    nextTick(() => {
      if (body.value) body.value.scrollTop = scrollMemory.get(id) || 0
    })
  }
)
watch(
  () => pane.tabs.map((t) => t.id).join('|'),
  () => {
    for (const id of scrollMemory.keys()) {
      if (!pane.tabs.some((t) => t.id === id)) scrollMemory.delete(id)
    }
  }
)
</script>

<style scoped>
.ag-bp {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.ag-bp-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.ag-bp-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ag-bp-body.is-fixed {
  overflow: hidden;
}
</style>
