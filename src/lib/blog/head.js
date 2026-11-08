// Managing <head> without a framework. A head spec is
//
//   { title, description, canonical?, meta: [{ name | property, content }],
//     jsonLd: [object] }
//
// and turns into the same tags two ways: applyHead() edits a live document
// (the SPA), renderHeadTags() writes them as HTML (the prerender script).
// Every tag this module adds carries data-head, so the next page (or the
// SPA taking over a prerendered page) can find and replace them all.
//
// The <title> and <meta name="description"> already in index.html are
// updated in place. Before the first change their original values are kept
// in a data-default attribute (the prerender script writes it too), which
// is what restoring puts back when the visitor leaves the blog.

export const MANAGED_ATTR = 'data-head'
export const DEFAULT_ATTR = 'data-default'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/**
 * JSON for a <script type="application/ld+json"> block. "<" and ">" are
 * escaped so a value containing "</script>" cannot end the block early.
 */
export function serializeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** The tags of a spec besides title and description, in order. */
export function headTags(spec) {
  const tags = []
  if (spec.canonical) tags.push({ tag: 'link', attrs: { rel: 'canonical', href: spec.canonical } })
  for (const m of spec.meta || []) {
    const attrs = m.property
      ? { property: m.property, content: m.content }
      : { name: m.name, content: m.content }
    tags.push({ tag: 'meta', attrs })
  }
  for (const data of spec.jsonLd || []) {
    tags.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      text: serializeJsonLd(data),
    })
  }
  return tags
}

/** The spec's tags as HTML, one per line, for the prerendered pages. */
export function renderHeadTags(spec) {
  return headTags(spec)
    .map(({ tag, attrs, text }) => {
      const attrText = Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join('')
      const open = `<${tag}${attrText} ${MANAGED_ATTR}>`
      return tag === 'script' ? `${open}${text}</script>` : open
    })
    .join('\n')
}

function ensureDescription(doc) {
  const el = doc.head.querySelector('meta[name="description"]')
  if (el) return { el, created: false }
  const made = doc.createElement('meta')
  made.setAttribute('name', 'description')
  made.setAttribute('content', '')
  doc.head.appendChild(made)
  return { el: made, created: true }
}

function ensureTitle(doc) {
  let el = doc.head.querySelector('title')
  if (!el) {
    el = doc.createElement('title')
    doc.head.appendChild(el)
  }
  return el
}

function removeManaged(doc) {
  doc.head.querySelectorAll(`[${MANAGED_ATTR}]`).forEach((el) => el.remove())
}

/**
 * Apply a spec to `doc`, replacing any managed tags already there (from a
 * prerendered page or a previous spec). Returns a function that undoes it:
 * the tags it added removed, title and description back to their defaults.
 */
export function applyHead(doc, spec) {
  const titleEl = ensureTitle(doc)
  if (!titleEl.hasAttribute(DEFAULT_ATTR)) titleEl.setAttribute(DEFAULT_ATTR, titleEl.textContent)
  removeManaged(doc)
  const { el: descEl, created } = ensureDescription(doc)
  if (!descEl.hasAttribute(DEFAULT_ATTR))
    descEl.setAttribute(DEFAULT_ATTR, descEl.getAttribute('content') || '')

  if (spec.title) doc.title = spec.title
  if (spec.description) descEl.setAttribute('content', spec.description)

  const added = headTags(spec).map(({ tag, attrs, text }) => {
    const el = doc.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    el.setAttribute(MANAGED_ATTR, '')
    if (text !== undefined) el.textContent = text
    doc.head.appendChild(el)
    return el
  })

  return function restore() {
    added.forEach((el) => el.remove())
    if (titleEl.isConnected) doc.title = titleEl.getAttribute(DEFAULT_ATTR) || ''
    if (created) descEl.remove()
    else if (descEl.isConnected)
      descEl.setAttribute('content', descEl.getAttribute(DEFAULT_ATTR) || '')
  }
}
