// Static HTML for the blog, written into dist by scripts/prerender-blog.mjs
// after `vite build`. Crawlers that run no JavaScript get the full article,
// its head tags and JSON-LD; browsers get the same markup first and the SPA
// replaces it when it mounts on #app.
//
// The markup mirrors components/blog/BlogFrame.vue and pages/blog/*.vue
// (same elements, same classes, styled by assets/css/blog.css), so the swap
// is not visible. Change both together.
//
// Pure string functions: no file system, no DOM.
import { adjacentPosts, formatDate, relatedPosts } from './content.js'
import { escapeHtml, renderHeadTags, DEFAULT_ATTR } from './head.js'
import { blogIndexHead, blogPostHead, blogUrl, postUrl, BLOG_DESCRIPTION } from './seo.js'

export const BLOG_HEADING = 'AI search visibility, explained'
export const EMPTY_MESSAGE = 'No posts yet. Check back soon.'
export const FAQ_HEADING = 'Frequently asked questions'

export const NAV_LINKS = Object.freeze([
  { label: 'Blog', to: '/blog' },
  { label: 'Docs', to: '/docs' },
  { label: 'Pricing', to: '/pricing' },
])

export const FOOTER_LINKS = Object.freeze([
  { label: 'Blog', to: '/blog' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Docs', to: '/docs' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Support', to: '/support' },
])

const e = escapeHtml

/** The header, main and footer every blog page shares. */
export function frameHtml(main) {
  const nav = NAV_LINKS.map(
    (l) => `<a href="${l.to}" class="blog-nav-link">${e(l.label)}</a>`
  ).join('')
  const foot = FOOTER_LINKS.map((l) => `<a href="${l.to}">${e(l.label)}</a>`).join('')
  return (
    '<div class="blog">' +
    '<a class="blog-skip" href="#main">Skip to content</a>' +
    '<header class="blog-top"><div class="blog-top-inner">' +
    '<a href="/" class="blog-home" aria-label="Cansee home">' +
    '<img src="/images/cansee-logo.png" alt="Cansee" class="blog-logo" /></a>' +
    `<nav class="blog-nav" aria-label="Primary">${nav}<a href="/login" class="blog-cta">Sign in</a></nav>` +
    '</div></header>' +
    `<main id="main" class="blog-main" tabindex="-1">${main}</main>` +
    '<footer class="blog-foot"><div class="blog-foot-inner">' +
    '<span>&copy; 2026 Cansee</span>' +
    `<nav class="blog-foot-links" aria-label="Footer">${foot}</nav>` +
    '</div></footer>' +
    '</div>'
  )
}

function tagsHtml(tags) {
  return `<ul class="blog-tags" aria-label="Tags">${tags.map((t) => `<li class="blog-tag">${e(t)}</li>`).join('')}</ul>`
}

function timeHtml(iso) {
  return `<time datetime="${e(iso)}">${e(formatDate(iso))}</time>`
}

/** One post card, as on the index and under Related posts. */
export function cardHtml(post, headingTag = 'h2') {
  return (
    '<li class="blog-card"><article>' +
    `<${headingTag} class="blog-card-title"><a href="/blog/${e(post.slug)}">${e(post.title)}</a></${headingTag}>` +
    `<p class="blog-card-desc">${e(post.description)}</p>` +
    `<p class="blog-meta">${timeHtml(post.date)}<span aria-hidden="true">&middot;</span>` +
    `<span>${post.readingMinutes} min read</span></p>` +
    tagsHtml(post.tags) +
    '</article></li>'
  )
}

/** The /blog page body. */
export function indexMainHtml(posts) {
  const list = posts.length
    ? `<ul class="blog-cards" role="list">${posts.map((p) => cardHtml(p)).join('')}</ul>`
    : `<p class="blog-empty">${EMPTY_MESSAGE}</p>`
  return (
    '<div class="blog-wrap">' +
    '<header class="blog-hero">' +
    '<p class="blog-eyebrow">Blog</p>' +
    `<h1 class="blog-h1">${BLOG_HEADING}</h1>` +
    `<p class="blog-lede">${e(BLOG_DESCRIPTION)}</p>` +
    '</header>' +
    list +
    '</div>'
  )
}

/** The /blog/<slug> page body. `html` is the sanitized article. */
export function postMainHtml(post, { html, related = [], previous = null, next = null }) {
  const toc = post.toc.map((t) => `<li><a href="#${e(t.id)}">${e(t.text)}</a></li>`)
  if (post.faq.length) toc.push(`<li><a href="#blog-faq">${FAQ_HEADING}</a></li>`)
  const faq = post.faq.length
    ? '<section class="blog-faq" id="blog-faq" aria-labelledby="blog-faq-title">' +
      `<h2 id="blog-faq-title">${FAQ_HEADING}</h2>` +
      post.faq
        .map((f) => `<div class="blog-faq-item"><h3>${e(f.q)}</h3><p>${e(f.a)}</p></div>`)
        .join('') +
      '</section>'
    : ''
  const pagerLink = (p, rel, label) =>
    `<a class="blog-pager-link blog-pager-${rel}" href="/blog/${e(p.slug)}" rel="${rel}">` +
    `<span class="blog-pager-label">${label}</span><span class="blog-pager-title">${e(p.title)}</span></a>`
  const pager =
    previous || next
      ? '<nav class="blog-pager" aria-label="Previous and next posts">' +
        (previous ? pagerLink(previous, 'prev', 'Previous post') : '<span></span>') +
        (next ? pagerLink(next, 'next', 'Next post') : '<span></span>') +
        '</nav>'
      : ''
  const relatedHtml = related.length
    ? '<section class="blog-related" id="blog-related" aria-labelledby="blog-related-title">' +
      '<h2 id="blog-related-title" class="blog-section-title">Related posts</h2>' +
      `<ul class="blog-cards blog-cards--compact" role="list">${related.map((p) => cardHtml(p, 'h3')).join('')}</ul>` +
      '</section>'
    : ''
  return (
    '<div class="blog-wrap">' +
    '<nav class="blog-crumbs" aria-label="Breadcrumb"><ol>' +
    '<li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li>' +
    `<li><span aria-current="page">${e(post.title)}</span></li>` +
    '</ol></nav>' +
    '<article class="blog-article">' +
    '<header class="blog-article-head">' +
    `<h1 class="blog-h1">${e(post.title)}</h1>` +
    `<p class="blog-lede">${e(post.description)}</p>` +
    '<p class="blog-meta">' +
    `<span>By ${e(post.author)}</span><span aria-hidden="true">&middot;</span>` +
    `<span>Published ${timeHtml(post.date)}</span><span aria-hidden="true">&middot;</span>` +
    `<span>Updated ${timeHtml(post.updated)}</span><span aria-hidden="true">&middot;</span>` +
    `<span>${post.readingMinutes} min read</span>` +
    '</p>' +
    tagsHtml(post.tags) +
    '</header>' +
    '<div class="blog-layout">' +
    (toc.length
      ? '<nav class="blog-toc" id="blog-toc" aria-labelledby="blog-toc-title">' +
        `<p class="blog-toc-title" id="blog-toc-title">On this page</p><ol>${toc.join('')}</ol></nav>`
      : '') +
    `<div class="blog-content"><div class="blog-body">${html}</div>${faq}</div>` +
    '</div>' +
    '</article>' +
    pager +
    relatedHtml +
    '</div>'
  )
}

/**
 * Put a page into the built index.html: title, description, managed head
 * tags and stylesheets into <head>, the markup into <div id="app">. The
 * shell's own title and description are kept in data-default, which the
 * SPA restores when the visitor leaves the blog.
 */
export function fillShell(shell, { spec, content, stylesheets = [] }) {
  let html = String(shell)
  const app = /<div id="app"><\/div>/
  if (!app.test(html))
    throw new Error('index.html has no empty <div id="app"></div> to prerender into')
  if (!/<\/head>/i.test(html)) throw new Error('index.html has no </head>')

  // The originals are copied as written in the shell (already HTML text),
  // so only a double quote needs escaping to sit inside an attribute.
  const attr = (raw) => raw.replace(/"/g, '&quot;')
  const titleTag = /<title>([\s\S]*?)<\/title>/i
  const titleMatch = html.match(titleTag)
  const newTitle = (orig) => `<title ${DEFAULT_ATTR}="${attr(orig)}">${e(spec.title)}</title>`
  html = titleMatch
    ? html.replace(titleTag, () => newTitle(titleMatch[1].trim()))
    : html.replace(/<\/head>/i, () => `${newTitle('')}\n</head>`)

  const descTag = /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i
  const descMatch = html.match(descTag)
  const newDesc = (orig) =>
    `<meta name="description" content="${e(spec.description)}" ${DEFAULT_ATTR}="${attr(orig)}" />`
  html = descMatch
    ? html.replace(descTag, () => newDesc(descMatch[1]))
    : html.replace(/<\/head>/i, () => `${newDesc('')}\n</head>`)

  const links = stylesheets.map((href) => `<link rel="stylesheet" href="${e(href)}" />`)
  const headBlock = [...links, renderHeadTags(spec)].filter(Boolean).join('\n')
  html = html.replace(/<\/head>/i, () => `${headBlock}\n</head>`)
  return html.replace(app, () => `<div id="app">${content}</div>`)
}

/** sitemap.xml: home, pricing, docs, the blog index and every post. */
export function sitemapXml(posts, site) {
  const newest = posts.reduce((max, p) => (p.updated > max ? p.updated : max), '')
  const url = (loc, lastmod) =>
    `  <url><loc>${e(loc)}</loc>${lastmod ? `<lastmod>${e(lastmod)}</lastmod>` : ''}</url>`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    url(`${site}/`),
    url(`${site}/pricing`),
    url(`${site}/docs`),
    url(blogUrl(site), newest),
    ...posts.map((p) => url(postUrl(site, p.slug), p.updated)),
    '</urlset>',
    '',
  ].join('\n')
}

/** robots.txt: everything allowed, and where the sitemap is. */
export function robotsTxt(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`
}

/**
 * Every file the prerender writes, relative to dist.
 * renderHtml(post) returns the post's sanitized article HTML.
 */
export function buildBlogFiles({ shell, posts, site, renderHtml, stylesheets = [] }) {
  const files = [
    {
      path: 'blog/index.html',
      content: fillShell(shell, {
        spec: blogIndexHead(posts, site),
        content: frameHtml(indexMainHtml(posts)),
        stylesheets,
      }),
    },
  ]
  for (const post of posts) {
    const { previous, next } = adjacentPosts(post, posts)
    const main = postMainHtml(post, {
      html: renderHtml(post),
      related: relatedPosts(post, posts),
      previous,
      next,
    })
    files.push({
      path: `blog/${post.slug}/index.html`,
      content: fillShell(shell, {
        spec: blogPostHead(post, site),
        content: frameHtml(main),
        stylesheets,
      }),
    })
  }
  files.push({ path: 'sitemap.xml', content: sitemapXml(posts, site) })
  files.push({ path: 'robots.txt', content: robotsTxt(site) })
  return files
}
