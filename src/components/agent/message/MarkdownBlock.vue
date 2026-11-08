<template>
  <div class="ag-prose" :class="{ 'ag-prose-quiet': quiet }" @click="onClick">
    <div v-for="block in marked" :key="block.key" class="ag-md-block" v-html="block.html"></div>
  </div>
</template>

<script setup>
// Markdown for a text part. While the reply streams, the smoothed text goes
// through the streaming renderer so only the growing last block is parsed
// again; finished blocks keep their DOM. Links open in the browser pane
// (a modified click keeps the browser's own behaviour). The project's brand
// and its competitors are highlighted (brandMarks.js), so a reply shows at
// a glance where the brand stands.
import { computed, onBeforeUnmount, ref } from 'vue'
import { createStreamingRenderer, isSafeUrl, onHighlighterReady } from '@/lib/agent/markdown/renderer'
import { brandMatcher, markBrands } from '@/lib/agent/markdown/brandMarks'
import { useSmoothText } from '@/composables/agent/useSmoothText'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentStore } from '@/stores/agent'
import { useAppStore } from '@/stores/app'
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

const agent = useAgentStore()
const app = useAppStore()

// The tracked brand and its competitors for the agent's project.
const matcher = computed(() => {
  if (props.quiet) return null
  const id = agent.websiteId
  const site = (app.websites || []).find((w) => w && w.id === id) || app.activeWebsite
  if (!site) return null
  return brandMatcher({ own: site.name, competitors: site.competitors || [] })
})

// Finished blocks keep the same markup while a reply streams, so their
// marked markup is cached instead of re-parsed on every tick.
const markCache = new Map()
const MARK_CACHE_MAX = 200

function markedHtml(html, m) {
  const key = `${m.pattern.source}\u0000${html}`
  let out = markCache.get(key)
  if (out === undefined) {
    out = markBrands(html, m)
    if (markCache.size >= MARK_CACHE_MAX) markCache.delete(markCache.keys().next().value)
    markCache.set(key, out)
  }
  return out
}

const marked = computed(() => {
  const m = matcher.value
  if (!m) return blocks.value
  return blocks.value.map((block) => ({ ...block, html: markedHtml(block.html, m) }))
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

<style>
/* Unscoped: the marks are inserted into v-html content, which scoped CSS
   cannot reach. */
.ag-prose mark.ag-brand {
  border-radius: 3px;
  padding: 0 2px;
  color: inherit;
  font-weight: 600;
}
.ag-prose mark.ag-brand--own {
  background: color-mix(in srgb, var(--ag-accent, #2f7d4f) 18%, transparent);
  box-shadow: inset 0 -2px 0 var(--ag-accent, #2f7d4f);
}
.ag-prose mark.ag-brand--competitor {
  background: color-mix(in srgb, var(--ag-warning, #b07d28) 16%, transparent);
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--ag-warning, #b07d28) 70%, transparent);
}
</style>
