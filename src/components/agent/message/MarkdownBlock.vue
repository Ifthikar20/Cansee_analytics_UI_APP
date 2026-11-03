<template>
  <div class="ag-prose" :class="{ 'ag-prose-quiet': quiet }" @click="onClick">
    <div v-for="block in blocks" :key="block.key" class="ag-md-block" v-html="block.html"></div>
  </div>
</template>

<script setup>
// Markdown for a text part. While the reply streams, the smoothed text goes
// through the streaming renderer so only the growing last block is parsed
// again; finished blocks keep their DOM. Links open in the browser pane
// (a modified click keeps the browser's own behaviour).
import { computed, onBeforeUnmount, ref } from 'vue'
import { createStreamingRenderer, isSafeUrl, onHighlighterReady } from '@/lib/agent/markdown/renderer'
import { useSmoothText } from '@/composables/agent/useSmoothText'
import { useAgentPaneStore } from '@/stores/agentPane'
import { copyText } from '@/lib/agent/download'

const props = defineProps({
  text: { type: String, default: '' },
  streaming: { type: Boolean, default: false },
  // Smaller, secondary prose (thinking text).
  quiet: { type: Boolean, default: false },
})

const pane = useAgentPaneStore()
const { text: shown, catchingUp } = useSmoothText(() => props.text, () => props.streaming)
const renderer = createStreamingRenderer()
const highlightTick = ref(0)
const stopListening = onHighlighterReady(() => {
  highlightTick.value += 1
})

const blocks = computed(() => {
  void highlightTick.value
  return renderer.render(shown.value, { final: !props.streaming && !catchingUp.value })
})

const copyTimers = new Set()

async function copyCode(button) {
  const code = button.closest('.ag-code')?.querySelector('pre code')
  if (!code) return
  const ok = await copyText(code.textContent || '')
  button.textContent = ok ? 'Copied' : 'Copy failed'
  const timer = setTimeout(() => {
    button.textContent = 'Copy'
    copyTimers.delete(timer)
  }, 1500)
  copyTimers.add(timer)
}

function onClick(event) {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return
  const copy = target.closest('[data-ag-copy]')
  if (copy) {
    event.preventDefault()
    copyCode(copy)
    return
  }
  const link = target.closest('a[href]')
  if (!link) return
  const href = link.getAttribute('href') || ''
  if (!/^https?:/i.test(href) || !isSafeUrl(href)) return
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  event.preventDefault()
  pane.setReturnFocus(link)
  if (!pane.openUrl(href, { activate: true })) window.open(href, '_blank', 'noopener,noreferrer')
}

onBeforeUnmount(() => {
  stopListening()
  copyTimers.forEach(clearTimeout)
})
</script>
