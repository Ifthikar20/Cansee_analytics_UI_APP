// Markdown rendering for the agent workspace.
//
//   renderMarkdown(src)          sanitized HTML for a whole document
//   renderMarkdownBlocks(src)    [{key, html}] per top-level block
//   createStreamingRenderer()    {render(src, {final}), reset()} for text that
//                                only grows: finished blocks are cached and
//                                only the last block is parsed again
//
// Output is styled by .ag-prose (prose.css) and .hljs tokens (hljs.css). The
// fence Copy button carries data-ag-copy; the host handles its click.
import md from './md.js'
import { sanitizeHtml } from './sanitize.js'
import { highlightGeneration } from './highlight.js'
import '@/assets/agent/prose.css'
import '@/assets/agent/hljs.css'

export { loadHighlighter, onHighlighterReady, highlighterLoaded } from './highlight.js'
export { isSafeUrl } from './sanitize.js'

function normalize(src) {
  return String(src ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\0/g, '�')
}

// Top-level token ranges: each block opener at depth 0 through its closer.
function topLevelGroups(tokens) {
  const groups = []
  let depth = 0
  let from = 0
  for (let i = 0; i < tokens.length; i++) {
    if (depth === 0) from = i
    depth += tokens[i].nesting
    if (depth <= 0) {
      depth = 0
      groups.push({ from, to: i + 1 })
    }
  }
  return groups
}

function renderGroup(tokens, group, env) {
  return sanitizeHtml(md.renderer.render(tokens.slice(group.from, group.to), md.options, env))
}

function lineOffset(text, line) {
  let offset = 0
  for (let n = 0; n < line; n++) {
    const next = text.indexOf('\n', offset)
    if (next === -1) return text.length
    offset = next + 1
  }
  return offset
}

export function renderMarkdown(src) {
  const text = normalize(src)
  if (!text.trim()) return ''
  return sanitizeHtml(md.render(text))
}

export function renderMarkdownBlocks(src) {
  const text = normalize(src)
  if (!text.trim()) return []
  const env = {}
  const tokens = md.parse(text, env)
  return topLevelGroups(tokens).map((group, i) => ({ key: `b${i}`, html: renderGroup(tokens, group, env) }))
}

export function createStreamingRenderer() {
  let stable = []
  let consumed = ''
  let generation = highlightGeneration()
  let lastTail = null
  let lastFinal = false
  let tailBlocks = []

  function reset() {
    stable = []
    consumed = ''
    lastTail = null
    lastFinal = false
    tailBlocks = []
  }

  function render(src, { final = false } = {}) {
    const text = normalize(src)
    if (generation !== highlightGeneration()) {
      generation = highlightGeneration()
      reset()
    }
    if (!text.startsWith(consumed)) reset()

    const tail = text.slice(consumed.length)
    if (tail === lastTail && final === lastFinal) return stable.concat(tailBlocks)
    lastTail = tail
    lastFinal = final
    tailBlocks = []
    if (!tail.trim()) return stable.slice()

    const env = {}
    const tokens = md.parse(tail, env)
    const groups = topLevelGroups(tokens)
    // A block followed by another top-level block can no longer change; the
    // last one can, until the text is final.
    const settled = final ? groups.length : Math.max(0, groups.length - 1)
    const base = stable.length

    for (let g = 0; g < groups.length; g++) {
      const block = { key: `b${base + g}`, html: renderGroup(tokens, groups[g], env) }
      if (g < settled) stable.push(block)
      else tailBlocks.push(block)
    }

    if (final) {
      consumed = text
      lastTail = ''
    } else if (settled > 0) {
      const map = tokens[groups[settled].from].map
      if (map) {
        consumed += tail.slice(0, lineOffset(tail, map[0]))
        lastTail = text.slice(consumed.length)
      } else {
        // No line map to cut at: keep everything as tail and re-parse.
        stable.splice(base)
        tailBlocks = groups.map((group, g) => ({ key: `b${base + g}`, html: renderGroup(tokens, group, env) }))
      }
    }
    return stable.concat(tailBlocks)
  }

  return { render, reset }
}
