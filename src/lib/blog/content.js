// Turns the raw post files into post objects. Shared by the browser (fed by
// import.meta.glob in posts.js) and the prerender script (fed by the file
// system), so both see the same posts in the same order.
import { parseFrontmatter } from './frontmatter.js'
import { renderMarkdown } from './markdown.js'
import { sanitizeBlogHtml } from './sanitize.js'
import { validatePost } from './validate.js'

/** "src/content/blog/my-post.md" -> "my-post". */
export function slugFromPath(path) {
  const name = String(path).split(/[\\/]/).pop() || ''
  return name.replace(/\.md$/i, '')
}

/** Newest first; the same date falls back to slug order, so builds are stable. */
export function compareNewestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

function toPost(data, body, rendered) {
  return {
    slug: data.slug,
    title: data.title.trim(),
    description: data.description.trim(),
    date: data.date,
    updated: data.updated,
    author: data.author.trim(),
    tags: data.tags.map((t) => t.trim()),
    keywords: data.keywords.map((k) => k.trim()),
    readingMinutes: data.readingMinutes,
    faq: data.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
    toc: rendered.toc,
    wordCount: rendered.wordCount,
    body,
  }
}

/**
 * Parse and validate every file. Returns the valid posts (newest first) and
 * the problems found, each as "file: message". Nothing here throws on a bad
 * post: the caller decides whether problems fail the build.
 *
 * files: [{ path, raw }]
 */
export function loadPosts(files) {
  const errors = []
  const warnings = []
  const parsed = []
  for (const { path, raw } of files) {
    const fileSlug = slugFromPath(path)
    const name = `${fileSlug}.md`
    try {
      const { data, body } = parseFrontmatter(raw)
      parsed.push({ name, fileSlug, data, body, rendered: renderMarkdown(body) })
    } catch (err) {
      errors.push(`${name}: ${err.message}`)
    }
  }
  const knownSlugs = new Set(parsed.map((p) => p.fileSlug))
  const posts = []
  for (const p of parsed) {
    const result = validatePost(p.data, p.rendered, { fileSlug: p.fileSlug, knownSlugs })
    errors.push(...result.errors.map((m) => `${p.name}: ${m}`))
    warnings.push(...result.warnings.map((m) => `${p.name}: ${m}`))
    if (!result.errors.length) posts.push(toPost(p.data, p.body, p.rendered))
  }
  posts.sort(compareNewestFirst)
  return { posts, errors, warnings }
}

/** The sanitized article HTML for a post, rendered with the given window. */
export function renderPostHtml(post, win) {
  return sanitizeBlogHtml(renderMarkdown(post.body).html, win)
}

/** One message listing every problem, for a failed build. */
export function formatProblems(errors) {
  return [
    `Blog: ${errors.length} problem${errors.length === 1 ? '' : 's'} in src/content/blog:`,
    ...errors.map((e) => `  - ${e}`),
    'Fix the post frontmatter (see src/lib/blog/validate.js for the rules) and build again.',
  ].join('\n')
}

/**
 * Up to `limit` other posts sharing the most tags with `post`, newest first
 * among equals. Posts with no shared tag are left out.
 */
export function relatedPosts(post, posts, limit = 3) {
  const tags = new Set(post.tags.map((t) => t.toLowerCase()))
  return posts
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ post: p, shared: p.tags.filter((t) => tags.has(t.toLowerCase())).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || compareNewestFirst(a.post, b.post))
    .slice(0, limit)
    .map((x) => x.post)
}

/**
 * The posts around `post` in date order: `previous` is the next older post,
 * `next` the next newer one. `posts` must be sorted newest first.
 */
export function adjacentPosts(post, posts) {
  const i = posts.findIndex((p) => p.slug === post.slug)
  if (i === -1) return { previous: null, next: null }
  return { previous: posts[i + 1] || null, next: posts[i - 1] || null }
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

/** "2026-11-08" -> "November 8, 2026", the same in every time zone. */
export function formatDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  return DATE_FORMAT.format(new Date(Date.UTC(y, m - 1, d)))
}
