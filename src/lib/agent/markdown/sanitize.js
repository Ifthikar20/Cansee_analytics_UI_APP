// DOMPurify pass over rendered Markdown. A private instance keeps these hooks
// away from any other DOMPurify user in the app.
import DOMPurify from 'dompurify'

export const SAFE_URL = /^(?:https?:|mailto:)/i

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'button', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
]

const ALLOWED_ATTR = ['href', 'title', 'class', 'start', 'style', 'type', 'data-ag-copy', 'aria-label']

const ALIGN_STYLE = /^text-align:\s*(?:left|right|center)\s*;?$/i

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP: SAFE_URL,
  // These carry no URL, so they skip the URI check above.
  ADD_URI_SAFE_ATTR: ['start', 'type', 'data-ag-copy'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  KEEP_CONTENT: true,
}

/** True for absolute http(s) and mailto URLs, ignoring control characters. */
export function isSafeUrl(url) {
  if (typeof url !== 'string') return false
  const probe = Array.from(url)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('')
  return SAFE_URL.test(probe)
}

let purify = null

function instance() {
  if (purify) return purify
  purify = DOMPurify(window)

  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') data.keepAttr = ALIGN_STYLE.test(String(data.attrValue || '').trim())
  })

  purify.addHook('afterSanitizeAttributes', (node) => {
    const tag = node.tagName
    if (tag === 'A') {
      const href = node.getAttribute('href')
      if (href && isSafeUrl(href)) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer nofollow')
      } else {
        node.removeAttribute('href')
      }
      return
    }
    if (tag === 'BUTTON') {
      // The only button is the code-block Copy control the renderer emits;
      // anything else is left inert.
      node.setAttribute('type', 'button')
      if (!node.classList.contains('ag-code-copy')) {
        node.removeAttribute('class')
        node.removeAttribute('data-ag-copy')
      }
      return
    }
    node.removeAttribute('type')
    node.removeAttribute('data-ag-copy')
  })
  return purify
}

export function sanitizeHtml(html) {
  if (!html) return ''
  return instance().sanitize(html, CONFIG)
}
