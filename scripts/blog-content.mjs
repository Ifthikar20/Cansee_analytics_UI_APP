// Build-time access to the blog posts in src/content/blog: read them from
// disk and, through the Vite plugin, fail `vite build` on an invalid post
// with a message naming the file and the field.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatProblems, loadPosts } from '../src/lib/blog/content.js'

export const CONTENT_DIR = 'src/content/blog'

/** Every *.md file in `dir` as { path, raw }, sorted by name. No folder: none. */
export function readPostFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort()
    .map((name) => ({ path: join(dir, name), raw: readFileSync(join(dir, name), 'utf8') }))
}

/** Load and validate the posts in `dir`; throws one message listing every problem. */
export function loadPostsOrThrow(dir, log = console) {
  const { posts, errors, warnings } = loadPosts(readPostFiles(dir))
  for (const w of warnings) log.warn(`Blog warning: ${w}`)
  if (errors.length) throw new Error(formatProblems(errors))
  return posts
}

/** Vite plugin: validates the posts when a production build starts. */
export function blogContent({ dir } = {}) {
  let root = process.cwd()
  return {
    name: 'cansee-blog-content',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      const contentDir = dir || join(root, CONTENT_DIR)
      try {
        loadPostsOrThrow(contentDir, { warn: (m) => this.warn(m) })
        for (const file of readPostFiles(contentDir)) this.addWatchFile(file.path)
      } catch (err) {
        this.error(err.message)
      }
    },
  }
}
