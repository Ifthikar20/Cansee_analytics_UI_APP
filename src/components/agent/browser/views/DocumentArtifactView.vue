<template>
  <div class="ag-docv">
    <slot name="before" />
    <article
      ref="root"
      class="ag-prose ag-doc ag-docv-body"
      :aria-busy="live ? 'true' : 'false'"
      :aria-label="title || 'Document'"
      @click="onClick"
    >
      <div v-for="block in blocks" :key="block.key" class="ag-md-block" v-html="block.html" />
      <p v-if="!blocks.length && live" class="ag-docv-wait" role="status">
        <AgSpinner :size="14" />
        Writing…
      </p>
      <p v-else-if="!blocks.length" class="ag-docv-empty">This document is empty.</p>
    </article>
    <slot name="after" />
  </div>
</template>

<script setup>
import { inject, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { createStreamingRenderer, onHighlighterReady } from '@/lib/agent/markdown/renderer'
import { useAgentPaneStore } from '@/stores/agentPane'
import { copyText } from '@/lib/agent/download'
import { useToast } from '@/composables/useToast'

// Markdown documents and reports. The HTML comes from the shared renderer
// (markdown-it with raw HTML off, then DOMPurify). While a draft streams only
// the last block is parsed again, at most once per animation frame. Inside
// the browser pane a plain click on a web link opens it as a pane tab;
// elsewhere (the full-page artifact view) the link opens a new browser tab.

const props = defineProps({
  markdown: { type: String, default: '' },
  live: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

const pane = useAgentPaneStore()
const inPane = inject('agInBrowserPane', false)
const toast = useToast()
const root = ref(null)
const blocks = shallowRef([])
const renderer = createStreamingRenderer()
let frame = 0

function render() {
  frame = 0
  blocks.value = renderer.render(props.markdown || '', { final: !props.live })
}

function schedule() {
  if (!props.live) {
    if (frame) cancelAnimationFrame(frame)
    render()
    return
  }
  if (!frame) frame = requestAnimationFrame(render)
}

watch(() => [props.markdown, props.live], schedule, { immediate: true })

// Code renders plain until the lazy highlighter arrives; then render again.
const stopListening = onHighlighterReady(schedule)

onBeforeUnmount(() => {
  stopListening()
  if (frame) cancelAnimationFrame(frame)
})

async function onClick(event) {
  const copy = event.target.closest?.('[data-ag-copy]')
  if (copy && root.value?.contains(copy)) {
    const code = copy.closest('.ag-code')?.querySelector('pre code, pre')
    const ok = await copyText(code ? code.textContent : '')
    if (ok) toast.success('Code copied')
    return
  }
  const link = event.target.closest?.('a[href]')
  if (!inPane || !link || !root.value?.contains(link)) return
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const href = link.getAttribute('href') || ''
  if (!/^https?:/i.test(href)) return
  event.preventDefault()
  pane.openUrl(href, { activate: true })
}
</script>

<style scoped>
.ag-docv {
  box-sizing: border-box;
  padding: 28px 28px 56px;
}

.ag-docv-body {
  margin: 0 auto;
}

.ag-docv-wait,
.ag-docv-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ag-fg-3);
  font-size: 14px;
}
</style>
