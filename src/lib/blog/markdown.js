// Markdown to HTML for blog posts, with the app's markdown-it.
//
// Raw HTML in a post is escaped (html: false) and images are off, so the
// only markup in the output is what markdown-it itself emits. H2 and H3
// headings get stable ids for the table of contents and deep links. The
// output still goes through sanitizeBlogHtml before it reaches a page.
//
// Runs in the browser and under Node (the prerender script): relative
// imports only, no DOM.
import MarkdownIt from 'markdown-it'

/** Links a post may contain: site paths, in-page anchors, http(s), mailto. */
export const SAFE_HREF = /^(?:https?:|mailto:|\/(?!\/)|#)/i

export function isSafeHref(url) {
  if (typeof url !== 'string') return false
  // Browsers ignore control characters and spaces inside a scheme.
  const probe = Array.from(url)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('')
  return SAFE_HREF.test(probe)
}

/** Lowercase, hyphenated id for a heading; always starts with a letter. */
export function slugify(text) {
  const base = String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!base) return 'section'
  return /^[a-z]/.test(base) ? base : `s-${base}`
}

function inlineText(token) {
  if (!token || !token.children) return token?.content || ''
  return token.children
    .filter((t) => t.type === 'text' || t.type === 'code_inline')
    .map((t) => t.content)
    .join('')
}

// Ids the article page uses itself; a heading never takes one of them.
const RESERVED_IDS = new Set([
  'main',
  'blog-toc',
  'blog-toc-title',
  'blog-faq',
  'blog-faq-title',
  'blog-related',
  'blog-related-title',
])

function createRenderer() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: false,
  })
  md.disable(['image'])
  md.validateLink = (url) => isSafeHref(url)

  // Heading ids, unique within a post.
  md.core.ruler.push('blog_heading_ids', (state) => {
    const used = new Set(RESERVED_IDS)
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      if (token.type !== 'heading_open' || (token.tag !== 'h2' && token.tag !== 'h3')) continue
      const text = inlineText(tokens[i + 1]).trim()
      let id = slugify(text)
      let n = 2
      while (used.has(id)) {
        id = `${slugify(text)}-${n}`
        n += 1
      }
      used.add(id)
      token.attrSet('id', id)
      token.meta = { ...(token.meta || {}), text, id }
    }
  })

  // Wide tables scroll in their own box instead of widening the column.
  md.renderer.rules.table_open = () => '<div class="blog-table"><table>\n'
  md.renderer.rules.table_close = () => '</table></div>\n'
  return md
}

let renderer = null

function md() {
  if (!renderer) renderer = createRenderer()
  return renderer
}

function countWords(tokens) {
  let words = 0
  for (const token of tokens) {
    if (token.type !== 'inline') continue
    for (const child of token.children || []) {
      if (child.type === 'text' || child.type === 'code_inline') {
        words += child.content.split(/\s+/).filter(Boolean).length
      }
    }
  }
  return words
}

/**
 * Render a post body. Returns the HTML (not yet sanitized), the H2 table of
 * contents, every heading level used, internal /blog/ links and a word
 * count, which the validator and the pages use.
 */
export function renderMarkdown(body) {
  const instance = md()
  const env = {}
  const tokens = instance.parse(String(body ?? ''), env)
  const toc = []
  const headings = []
  const links = []
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type === 'heading_open') {
      headings.push(token.tag)
      if (token.tag === 'h2' && token.meta?.id)
        toc.push({ id: token.meta.id, text: token.meta.text })
    }
    if (token.type === 'inline') {
      for (const child of token.children || []) {
        if (child.type === 'link_open') {
          const href = child.attrGet('href')
          if (href) links.push(href)
        }
      }
    }
  }
  const html = instance.renderer.render(tokens, instance.options, env)
  return { html, toc, headings, links, wordCount: countWords(tokens) }
}
