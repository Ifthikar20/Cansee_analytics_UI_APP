<script setup>
// A structured draft (p2_contract.md 12d) in two tabs: its parts (changes,
// sources and claims, posts or letters) and the Markdown document the
// writer or the server built from them. While the writer drafts, the parts
// come from the latest snapshot and the document follows once it is saved.
import { computed, ref } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { structuredTabLabel, structuredType } from '@/lib/agent/structured'
import DocumentArtifactView from '../DocumentArtifactView.vue'
import ComparisonView from './ComparisonView.vue'
import CorrectionsView from './CorrectionsView.vue'
import PageRevisionView from './PageRevisionView.vue'
import SocialPostsView from './SocialPostsView.vue'

const VIEWS = {
  page_revision: PageRevisionView,
  comparison: ComparisonView,
  social_posts: SocialPostsView,
  corrections: CorrectionsView,
}

const props = defineProps({
  // useArtifactSource()
  source: { type: Object, required: true },
  live: { type: Boolean, default: false },
})

const tab = ref('parts')

const data = computed(() => props.source.data.value)
const type = computed(() => structuredType(data.value))
const view = computed(() => VIEWS[type.value] || null)
const label = computed(() => structuredTabLabel(data.value))
const markdown = computed(() => {
  const value = props.source.content.value
  return typeof value === 'string' ? value : ''
})
const title = computed(() => props.source.title.value)
</script>

<template>
  <TabsRoot v-model="tab" class="ag-sdv">
    <TabsList class="ag-sdv-tabs" aria-label="Draft">
      <TabsTrigger value="parts" class="ag-sdv-tab">{{ label }}</TabsTrigger>
      <TabsTrigger value="document" class="ag-sdv-tab">Document</TabsTrigger>
    </TabsList>
    <TabsContent value="parts" class="ag-sdv-panel">
      <component :is="view" v-if="view" :data="data" :live="live" />
    </TabsContent>
    <TabsContent value="document" class="ag-sdv-panel">
      <DocumentArtifactView :markdown="markdown" :live="live" :title="title" />
    </TabsContent>
  </TabsRoot>
</template>

<style scoped>
.ag-sdv {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.ag-sdv-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 8px 16px 0;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

.ag-sdv-tab {
  position: relative;
  height: 34px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.ag-sdv-tab:hover {
  color: var(--ag-fg-1);
}

.ag-sdv-tab[data-state='active'] {
  color: var(--ag-fg-1);
}

.ag-sdv-tab[data-state='active']::after {
  position: absolute;
  right: 8px;
  bottom: -1px;
  left: 8px;
  height: 2px;
  border-radius: 2px;
  background: var(--ag-fg-1);
  content: '';
}

.ag-sdv-tab:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-sdv-panel {
  flex: 1 1 auto;
  min-height: 0;
}

.ag-sdv-panel:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}
</style>
