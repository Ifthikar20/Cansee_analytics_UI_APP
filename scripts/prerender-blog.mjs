#!/usr/bin/env node
// Post-build step (npm run build runs it after vite build): writes
// dist/blog/index.html and dist/blog/<slug>/index.html with each page's
// markup, head tags and JSON-LD baked into the built index.html shell, plus
// dist/sitemap.xml and dist/robots.txt. No headless browser: the pages are
// assembled from the same modules the SPA uses (src/lib/blog).
//
// Usage: node scripts/prerender-blog.mjs [--dist dist] [--content src/content/blog]
// The site origin comes from VITE_SITE_URL (the environment or the .env
// files, read the way vite build reads them), default https://cansee.ai.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { renderPostHtml } from '../src/lib/blog/content.js'
import { buildBlogFiles } from '../src/lib/blog/prerender.js'
import { siteUrlFrom } from '../src/lib/blog/seo.js'
import { CONTENT_DIR, loadPostsOrThrow } from './blog-content.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The page components whose CSS the prerendered pages link, so the markup
// is styled before the SPA mounts.
export const PAGE_ENTRIES = ['src/pages/blog/BlogIndexPage.vue', 'src/pages/blog/BlogPostPage.vue']

/**
 * Stylesheets of the blog pages, from Vite's build manifest: each page's
 * own CSS and that of the chunks it imports, minus the app entry's (the
 * shell links that already). Empty without a manifest.
 */
export function blogStylesheets(manifest, entries = PAGE_ENTRIES) {
  const css = []
  const seen = new Set()
  const visit = (key) => {
    if (seen.has(key) || !manifest[key]) return
    seen.add(key)
    // The app entry's CSS is already linked by the index.html shell.
    if (manifest[key].isEntry) return
    for (const imported of manifest[key].imports || []) visit(imported)
    for (const file of manifest[key].css || []) {
      const href = `/${file}`
      if (!css.includes(href)) css.push(href)
    }
  }
  entries.forEach(visit)
  return css
}

/**
 * Prerender into `dist`. Returns the paths written, relative to dist.
 * Throws (and writes nothing) when a post is invalid or the build is missing.
 * `siteUrl` defaults to VITE_SITE_URL from the environment; the command
 * line entry below also reads it from the .env files.
 */
export function prerender({
  root = ROOT,
  dist = 'dist',
  content = CONTENT_DIR,
  siteUrl,
  log = console,
} = {}) {
  const distDir = resolve(root, dist)
  const shellPath = join(distDir, 'index.html')
  if (!existsSync(shellPath))
    throw new Error(`Blog prerender: ${shellPath} not found; run vite build first.`)

  const posts = loadPostsOrThrow(resolve(root, content), log)
  const site = siteUrlFrom(siteUrl ?? process.env.VITE_SITE_URL)

  const manifestPath = join(distDir, '.vite', 'manifest.json')
  let stylesheets = []
  if (existsSync(manifestPath)) {
    stylesheets = blogStylesheets(JSON.parse(readFileSync(manifestPath, 'utf8')))
  } else {
    log.warn(
      'Blog prerender: no .vite/manifest.json in dist; pages are written without the blog stylesheet.'
    )
  }

  const { window } = new JSDOM('')
  let files
  try {
    files = buildBlogFiles({
      shell: readFileSync(shellPath, 'utf8'),
      posts,
      site,
      renderHtml: (post) => renderPostHtml(post, window),
      stylesheets,
    })
  } finally {
    window.close()
  }

  for (const file of files) {
    const target = join(distDir, file.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content)
  }
  // The manifest only served this script; it has no business being public.
  rmSync(join(distDir, '.vite'), { recursive: true, force: true })
  log.log(
    `Blog prerender: ${posts.length} post${posts.length === 1 ? '' : 's'}, ${files.length} files written for ${site}`
  )
  return files.map((f) => f.path)
}

function argValue(args, name) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  try {
    // Imported here, not at the top: Vite (esbuild) is only needed to
    // read .env files, and the tests import this module without it.
    const { loadEnv } = await import('vite')
    prerender({
      dist: argValue(args, '--dist') || 'dist',
      content: argValue(args, '--content') || CONTENT_DIR,
      siteUrl: loadEnv(process.env.MODE || 'production', ROOT, 'VITE_').VITE_SITE_URL,
    })
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}
