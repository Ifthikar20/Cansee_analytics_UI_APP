// Lazy syntax highlighting for fenced code. Until the highlight.js chunk has
// loaded, code renders escaped and unhighlighted; listeners registered with
// onHighlighterReady() re-render once it arrives.

const ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  htm: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  vue: 'xml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  patch: 'diff',
  jsonc: 'json',
  json5: 'json',
}

const SUPPORTED = new Set([
  'bash', 'css', 'diff', 'javascript', 'json', 'markdown', 'python', 'sql', 'typescript', 'xml', 'yaml',
])

const LABELS = {
  bash: 'Shell',
  css: 'CSS',
  diff: 'Diff',
  javascript: 'JavaScript',
  json: 'JSON',
  markdown: 'Markdown',
  python: 'Python',
  sql: 'SQL',
  typescript: 'TypeScript',
  yaml: 'YAML',
  html: 'HTML',
  htm: 'HTML',
  xhtml: 'XHTML',
  svg: 'SVG',
  vue: 'Vue',
  xml: 'XML',
  text: 'Text',
  txt: 'Text',
  plaintext: 'Text',
  csv: 'CSV',
}

let hljs = null
let loading = null
let generation = 0
const listeners = new Set()

/** Lower-cased fence language with only safe characters, or ''. */
export function cleanLanguage(lang) {
  const value = String(lang || '').trim().toLowerCase()
  return /^[a-z0-9_+#.-]{1,32}$/.test(value) ? value : ''
}

export function canonicalLanguage(lang) {
  const value = cleanLanguage(lang)
  const name = ALIASES[value] || value
  return SUPPORTED.has(name) ? name : ''
}

/** Display label for a fence language ("JavaScript", "HTML"), or ''. */
export function languageLabel(lang) {
  const value = cleanLanguage(lang)
  if (!value) return ''
  return LABELS[value] || LABELS[ALIASES[value]] || value
}

export function highlighterLoaded() {
  return hljs !== null
}

/** Increments each time the highlighter becomes available. */
export function highlightGeneration() {
  return generation
}

export function onHighlighterReady(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function loadHighlighter() {
  if (hljs) return Promise.resolve(true)
  if (!loading) {
    loading = import('./hljsBundle.js')
      .then((mod) => {
        hljs = mod.default
        generation += 1
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch {}
        }
        return true
      })
      .catch(() => {
        loading = null
        return false
      })
  }
  return loading
}

/**
 * Highlighted HTML for `code`, or null when the language is unsupported or
 * the highlighter has not loaded yet (the caller escapes the code then).
 */
export function highlightCode(code, lang) {
  const name = canonicalLanguage(lang)
  if (!name) return null
  if (!hljs) {
    loadHighlighter()
    return null
  }
  try {
    return hljs.highlight(code, { language: name, ignoreIllegals: true }).value
  } catch {
    return null
  }
}
