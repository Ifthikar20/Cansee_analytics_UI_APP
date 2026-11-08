// The blog's posts, bundled at build time. Every src/content/blog/*.md is
// imported as text and parsed here; zero files is fine. Invalid posts never
// reach a production build (the blog-content Vite plugin and the prerender
// script fail it), so here they are only reported in development.
import { loadPosts, renderPostHtml } from './content.js'
import { siteUrlFrom } from './seo.js'

const files = import.meta.glob('../../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const result = loadPosts(Object.entries(files).map(([path, raw]) => ({ path, raw })))

if (import.meta.env.DEV && result.errors.length) {
  console.error(['Blog posts left out:', ...result.errors].join('\n  '))
}

/** Every valid post, newest first. */
export const posts = Object.freeze(result.posts)

/** The site origin used for canonical URLs and structured data. */
export const siteUrl = siteUrlFrom(import.meta.env.VITE_SITE_URL)

export function findPost(slug) {
  return posts.find((p) => p.slug === slug) || null
}

const htmlCache = new Map()

/** Sanitized article HTML, rendered once per post. */
export function postHtml(post) {
  if (!htmlCache.has(post.slug)) htmlCache.set(post.slug, renderPostHtml(post, window))
  return htmlCache.get(post.slug)
}
