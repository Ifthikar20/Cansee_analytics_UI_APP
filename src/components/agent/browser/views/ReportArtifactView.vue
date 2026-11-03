<template>
  <DocumentArtifactView :markdown="markdown" :live="live" :title="title">
    <template #after>
      <ResearchAppendix :data="data" />
    </template>
  </DocumentArtifactView>
</template>

<script setup>
import DocumentArtifactView from './DocumentArtifactView.vue'
import ResearchAppendix from './ResearchAppendix.vue'

// A saved SEO and GEO report: the reply's Markdown, then the research
// captured during that run (Google pages, engine checks, inspected pages).

defineProps({
  markdown: { type: String, default: '' },
  data: { type: Object, default: null },
  live: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
</script>
