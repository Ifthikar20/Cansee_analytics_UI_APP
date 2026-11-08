// Rules every blog post must meet. A post that breaks one fails the build
// (see scripts/blog-content.mjs and scripts/prerender-blog.mjs) with a
// message naming the file and the field, so a writer can fix it without
// reading this code. Warnings are printed but do not fail the build.

export const RULES = Object.freeze({
  title: { min: 50, max: 60 },
  description: { min: 140, max: 155 },
  slugWords: { min: 3, max: 7 },
  tags: { min: 3, max: 5 },
  keywords: { min: 4, max: 8 },
  faq: { min: 3, max: 5 },
  h2: { min: 6, max: 10 },
  words: { min: 1200, max: 1800 },
})

export const REQUIRED_FIELDS = Object.freeze([
  'title',
  'description',
  'slug',
  'date',
  'updated',
  'author',
  'tags',
  'keywords',
  'readingMinutes',
  'faq',
])

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

const isText = (v) => typeof v === 'string' && v.trim() !== ''

function checkLength(errors, field, value, { min, max }) {
  if (!isText(value)) {
    errors.push(`${field} must be a non-empty string`)
    return
  }
  const n = value.trim().length
  if (n < min || n > max) errors.push(`${field} must be ${min}-${max} characters (it is ${n})`)
}

function checkList(errors, field, value, { min, max }) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be a list like [a, b, c]`)
    return
  }
  if (value.length < min || value.length > max) {
    errors.push(`${field} must have ${min}-${max} items (it has ${value.length})`)
  }
  value.forEach((item, i) => {
    if (!isText(item)) errors.push(`${field} item ${i + 1} must be a non-empty string`)
  })
  const seen = new Set(value.filter(isText).map((v) => v.trim().toLowerCase()))
  if (seen.size !== value.filter(isText).length) errors.push(`${field} has duplicate items`)
}

/**
 * Check one post's frontmatter and rendered body.
 *
 * - data: the parsed frontmatter
 * - rendered: renderMarkdown(body) output (headings, links, wordCount)
 * - fileSlug: the file name without .md; the slug field must match it
 * - knownSlugs: every post's slug, to warn about broken /blog/ links
 */
export function validatePost(data, rendered, { fileSlug, knownSlugs } = {}) {
  const errors = []
  const warnings = []
  const d = data && typeof data === 'object' ? data : {}

  for (const field of REQUIRED_FIELDS) {
    if (d[field] === undefined || d[field] === null || d[field] === '')
      errors.push(`${field} is required`)
  }

  if (d.title !== undefined) checkLength(errors, 'title', d.title, RULES.title)
  if (d.description !== undefined)
    checkLength(errors, 'description', d.description, RULES.description)

  if (d.slug !== undefined) {
    if (typeof d.slug !== 'string' || !SLUG.test(d.slug)) {
      errors.push('slug must be lowercase words joined by hyphens')
    } else {
      const words = d.slug.split('-').length
      if (words < RULES.slugWords.min || words > RULES.slugWords.max) {
        errors.push(
          `slug must have ${RULES.slugWords.min}-${RULES.slugWords.max} words (it has ${words})`
        )
      }
      if (fileSlug !== undefined && d.slug !== fileSlug) {
        errors.push(`slug "${d.slug}" must match the file name "${fileSlug}.md"`)
      }
    }
  }

  for (const field of ['date', 'updated']) {
    if (d[field] !== undefined && !isIsoDate(d[field]))
      errors.push(`${field} must be a date written "YYYY-MM-DD"`)
  }
  if (isIsoDate(d.date) && isIsoDate(d.updated) && d.updated < d.date) {
    errors.push('updated must not be earlier than date')
  }

  if (d.author !== undefined && !isText(d.author)) errors.push('author must be a non-empty string')
  if (d.tags !== undefined) checkList(errors, 'tags', d.tags, RULES.tags)
  if (d.keywords !== undefined) checkList(errors, 'keywords', d.keywords, RULES.keywords)

  if (
    d.readingMinutes !== undefined &&
    !(Number.isInteger(d.readingMinutes) && d.readingMinutes > 0)
  ) {
    errors.push('readingMinutes must be a whole number above 0')
  }

  if (d.faq !== undefined) {
    if (!Array.isArray(d.faq)) {
      errors.push('faq must be a block list of q/a items')
    } else {
      if (d.faq.length < RULES.faq.min || d.faq.length > RULES.faq.max) {
        errors.push(
          `faq must have ${RULES.faq.min}-${RULES.faq.max} items (it has ${d.faq.length})`
        )
      }
      d.faq.forEach((item, i) => {
        const ok = item && typeof item === 'object' && !Array.isArray(item)
        if (!ok || !isText(item.q) || !isText(item.a)) {
          errors.push(`faq item ${i + 1} needs a question (q) and an answer (a)`)
        } else if (Object.keys(item).some((k) => k !== 'q' && k !== 'a')) {
          errors.push(`faq item ${i + 1} may only have q and a`)
        }
      })
    }
  }

  const known = new Set(Object.keys(d))
  for (const key of known) {
    if (!REQUIRED_FIELDS.includes(key))
      warnings.push(`unknown frontmatter field "${key}" is ignored`)
  }

  if (rendered) {
    if (rendered.headings.includes('h1'))
      errors.push('the body must not contain an H1 (# heading); the title is the H1')
    const h2 = rendered.headings.filter((h) => h === 'h2').length
    if (h2 < RULES.h2.min || h2 > RULES.h2.max) {
      warnings.push(`the body has ${h2} H2 sections; aim for ${RULES.h2.min}-${RULES.h2.max}`)
    }
    if (rendered.wordCount < RULES.words.min || rendered.wordCount > RULES.words.max) {
      warnings.push(
        `the body has about ${rendered.wordCount} words; aim for ${RULES.words.min}-${RULES.words.max}`
      )
    }
    if (knownSlugs) {
      for (const href of rendered.links) {
        const m = href.match(/^\/blog\/([^/?#]+)\/?(?:[?#].*)?$/)
        if (m && !knownSlugs.has(m[1]))
          warnings.push(`link ${href} points to a post that does not exist`)
      }
    }
  }

  return { errors, warnings }
}
