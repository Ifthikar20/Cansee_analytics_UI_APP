<template>
  <div class="ag-artpage">
    <header class="ag-artpage-top">
      <AgSidebarToggle />
      <RouterLink class="ag-artpage-back" :to="back.to">
        <ArrowLeft :size="16" aria-hidden="true" />
        {{ back.label }}
      </RouterLink>
      <div class="ag-artpage-top-actions">
        <AgButton v-if="chatLink" variant="ghost" size="xs" :icon="MessageSquare" :to="chatLink">Open in chat</AgButton>
      </div>
    </header>

    <section class="ag-artpage-frame" :aria-label="source.title.value || 'Artifact'">
      <PaneHeader :tab="tab" :source="source" @version="setVersion" />
      <div class="ag-artpage-body" :class="{ 'is-fixed': source.kind.value === 'page' }">
        <ArtifactView :key="tab.id" :source="source" @version="setVersion" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, MessageSquare } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSidebarToggle from '@/components/agent/common/AgSidebarToggle.vue'
import PaneHeader from '@/components/agent/browser/PaneHeader.vue'
import ArtifactView from '@/components/agent/browser/views/ArtifactView.vue'
import { useArtifactSource } from '@/components/agent/browser/useArtifactSource'

// Full-width viewer for one artifact (agent-artifact route): the pane header
// and the artifact's view, with a way back to its list and to its chat.

const props = defineProps({
  websiteId: { type: [String, Number], default: null },
  artifactId: { type: [String, Number], default: null },
})

const route = useRoute()
const router = useRouter()

const wid = computed(() => props.websiteId ?? route.params.websiteId ?? null)
const aid = computed(() => props.artifactId ?? route.params.artifactId ?? null)
const version = computed(() => {
  const n = Number(route.query.version)
  return Number.isFinite(n) && n > 0 ? n : null
})

const tab = computed(() => ({
  id: `artifact:${aid.value}`,
  kind: 'artifact',
  artifactId: aid.value,
  version: version.value,
  title: '',
  status: 'ready',
}))

const source = useArtifactSource(aid, version)

const LISTS = {
  report: { name: 'agent-reports', label: 'Reports' },
  sheet: { name: 'agent-sheets', label: 'Sheets' },
  document: { name: 'agent-documents', label: 'Documents' },
  page: { name: 'agent-documents', label: 'Documents' },
}

const back = computed(() => {
  const list = LISTS[source.kind.value] || LISTS.document
  return { to: { name: list.name, params: { websiteId: wid.value } }, label: list.label }
})

const chatLink = computed(() => {
  const chatId = source.artifact.value?.source_chat_id
  if (chatId === undefined || chatId === null || chatId === '') return null
  return {
    name: 'agent-chat',
    params: { websiteId: wid.value, chatId },
    query: { artifact: aid.value },
  }
})

function setVersion(next) {
  const query = { ...route.query }
  if (next === null || next === undefined) delete query.version
  else query.version = String(next)
  router.replace({ query })
}

watch(
  () => source.title.value,
  (title) => {
    if (title) document.title = `${title} — Cansee`
  },
  { immediate: true }
)
</script>

<style scoped>
.ag-artpage {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-1);
}

.ag-artpage-top {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 48px;
  padding: 0 16px;
}

.ag-artpage-top > :deep(.ag-icon-btn) {
  margin-left: -8px;
}

.ag-artpage-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px 0 6px;
  border-radius: 8px;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-artpage-back:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-artpage-back:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-artpage-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.ag-artpage-frame {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--ag-divider-subtle);
}

.ag-artpage-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.ag-artpage-body.is-fixed {
  overflow: hidden;
}
</style>
