<template>
  <DocumentArtifactView :markdown="markdown" :live="live" :title="title">
    <template v-if="header" #before>
      <ReportHeader :header="header" :template="template" />
    </template>
    <template #after>
      <ResearchAppendix :data="data" />
    </template>
  </DocumentArtifactView>
</template>

<script setup>
import { computed } from 'vue'
import DocumentArtifactView from './DocumentArtifactView.vue'
import ReportHeader from './ReportHeader.vue'
import ResearchAppendix from './ResearchAppendix.vue'

// A saved SEO and GEO report: its header (template, project, capture date,
// data windows, engines; reports saved before headers existed have none
// and show none), the reply's Markdown, then the research captured during
// that run (prompt gaps, Google pages, engine checks, inspected pages).

const props = defineProps({
  markdown: { type: String, default: '' },
  data: { type: Object, default: null },
  live: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

const header = computed(() => {
  const value = props.data?.header
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
})
const template = computed(() => (typeof props.data?.template === 'string' ? props.data.template : null))
</script>
