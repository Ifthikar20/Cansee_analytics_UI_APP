// The markdown-it instance shared by every agent renderer. Raw HTML is
// escaped, images are off (nothing is fetched automatically) and links must
// be http(s) or mailto.
import MarkdownIt from 'markdown-it'
import { cleanLanguage, highlightCode, languageLabel } from './highlight.js'
import { isSafeUrl } from './sanitize.js'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

md.disable(['image'])
md.validateLink = (url) => isSafeUrl(url)

const { escapeHtml, unescapeAll } = md.utils

function renderCode(code, lang) {
  const clean = cleanLanguage(lang)
  const label = languageLabel(clean)
  const highlighted = highlightCode(code, clean)
  const body = highlighted ?? escapeHtml(code)
  const codeClass = clean ? ` class="hljs language-${escapeHtml(clean)}"` : ' class="hljs"'
  const head =
    '<div class="ag-code-head">' +
    `<span class="ag-code-lang">${escapeHtml(label)}</span>` +
    '<button type="button" class="ag-code-copy" data-ag-copy="" aria-label="Copy code">Copy</button>' +
    '</div>'
  return `<div class="ag-code">${head}<pre><code${codeClass}>${body}</code></pre></div>\n`
}

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const info = token.info ? unescapeAll(token.info).trim() : ''
  const lang = info.split(/\s+/)[0] || ''
  return renderCode(token.content, lang)
}

md.renderer.rules.code_block = (tokens, idx) => renderCode(tokens[idx].content, '')

// Wide tables scroll inside their own box instead of widening the column.
md.renderer.rules.table_open = () => '<div class="ag-table"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

export default md
