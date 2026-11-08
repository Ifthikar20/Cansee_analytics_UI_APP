// DOMPurify pass over a rendered post. The caller passes the window to use:
// the browser's own, or a jsdom window in the prerender script. Each window
// gets its own DOMPurify instance, so these hooks never touch another
// DOMPurify user in the app (the agent's renderer has its own).
import DOMPurify from 'dompurify'
import { SAFE_HREF, isSafeHref } from './markdown.js'

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'div',
  'em',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]

const ALLOWED_ATTR = ['href', 'title', 'class', 'id', 'start', 'style']

const ALIGN_STYLE = /^text-align:\s*(?:left|right|center)\s*;?$/i
const CLASS_NAME = /^blog-table$/

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP: SAFE_HREF,
  ADD_URI_SAFE_ATTR: ['start'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  KEEP_CONTENT: true,
  // DOMPurify's DOM-clobbering guard drops any id that matches a document
  // property, which takes heading ids such as "links" or "images" and
  // breaks the table of contents. Clobbering needs named form, img, embed,
  // object or iframe elements, none of which the tag list above allows, and
  // ids only ever come from the heading slugger in markdown.js.
  SANITIZE_DOM: false,
}

const instances = new WeakMap()

function instanceFor(win) {
  let purify = instances.get(win)
  if (purify) return purify
  purify = DOMPurify(win)

  purify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style') {
      data.keepAttr = ALIGN_STYLE.test(String(data.attrValue || '').trim())
    } else if (data.attrName === 'class') {
      data.keepAttr = CLASS_NAME.test(String(data.attrValue || '').trim())
    } else if (data.attrName === 'id') {
      data.keepAttr =
        /^H[2-6]$/.test(node.tagName) && /^[a-z][a-z0-9-]*$/.test(String(data.attrValue || ''))
    }
  })

  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return
    const href = node.getAttribute('href')
    if (!href || !isSafeHref(href)) {
      node.removeAttribute('href')
      return
    }
    // Other sites open in a new tab; links within the site stay in place.
    if (/^(?:https?:)/i.test(href.trim())) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  instances.set(win, purify)
  return purify
}

/** Sanitize rendered post HTML with the given window's DOM. */
export function sanitizeBlogHtml(html, win) {
  if (!html) return ''
  if (!win || !win.document) throw new Error('sanitizeBlogHtml needs a window with a document')
  return instanceFor(win).sanitize(html, CONFIG)
}
