// Head tags and JSON-LD for the blog pages. Pure functions of the posts and
// the site origin, shared by the pages (through useHead) and the prerender
// script, so a crawler without JavaScript and the running app see the same
// tags.

export const DEFAULT_SITE_URL = 'https://cansee.ai'
export const SITE_NAME = 'Cansee'
export const LOGO_PATH = '/images/cansee-mark.png'

export const BLOG_TITLE = 'Blog: AI search visibility guides from Cansee'
export const BLOG_DESCRIPTION =
  'Plain guides on AI search visibility: how ChatGPT, Claude, Gemini, Grok and Perplexity mention brands, how to measure it, and what to change on your site.'

/**
 * The site origin from VITE_SITE_URL: absolute http(s), no trailing slash.
 * Anything else falls back to https://cansee.ai.
 */
export function siteUrlFrom(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return DEFAULT_SITE_URL
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_SITE_URL
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  } catch {
    return DEFAULT_SITE_URL
  }
}

export const blogUrl = (site) => `${site}/blog`
export const postUrl = (site, slug) => `${site}/blog/${slug}`

function publisher(site) {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${site}/`,
    logo: { '@type': 'ImageObject', url: `${site}${LOGO_PATH}` },
  }
}

/** schema.org BlogPosting for one post. */
export function blogPostingLd(post, site) {
  const url = postUrl(site, post.slug)
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated,
    author: { '@type': 'Organization', name: post.author, url: `${site}/` },
    publisher: publisher(site),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    image: `${site}${LOGO_PATH}`,
    inLanguage: 'en',
    keywords: post.keywords.join(', '),
    articleSection: post.tags[0],
    wordCount: post.wordCount,
  }
}

/** schema.org BreadcrumbList from [{ name, url }]. */
export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/** schema.org FAQPage from the post's faq field; null when there is none. */
export function faqPageLd(faq) {
  if (!Array.isArray(faq) || !faq.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

/** schema.org Blog for the index, listing every post. */
export function blogLd(posts, site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} blog`,
    description: BLOG_DESCRIPTION,
    url: blogUrl(site),
    publisher: publisher(site),
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      url: postUrl(site, p.slug),
      datePublished: p.date,
      dateModified: p.updated,
    })),
  }
}

function socialTags({ title, description, url, site, type }) {
  return [
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'en_US' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: `${site}${LOGO_PATH}` },
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: `${site}${LOGO_PATH}` },
  ]
}

/** Head for /blog. */
export function blogIndexHead(posts, site) {
  const url = blogUrl(site)
  return {
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    canonical: url,
    meta: socialTags({
      title: BLOG_TITLE,
      description: BLOG_DESCRIPTION,
      url,
      site,
      type: 'website',
    }),
    jsonLd: [
      blogLd(posts, site),
      breadcrumbLd([
        { name: 'Home', url: `${site}/` },
        { name: 'Blog', url },
      ]),
    ],
  }
}

/** Head for /blog/<slug>. */
export function blogPostHead(post, site) {
  const url = postUrl(site, post.slug)
  const meta = [
    { name: 'keywords', content: post.keywords.join(', ') },
    { name: 'author', content: post.author },
    ...socialTags({ title: post.title, description: post.description, url, site, type: 'article' }),
    { property: 'article:published_time', content: post.date },
    { property: 'article:modified_time', content: post.updated },
    ...post.tags.map((tag) => ({ property: 'article:tag', content: tag })),
  ]
  const jsonLd = [
    blogPostingLd(post, site),
    breadcrumbLd([
      { name: 'Home', url: `${site}/` },
      { name: 'Blog', url: blogUrl(site) },
      { name: post.title, url },
    ]),
  ]
  const faq = faqPageLd(post.faq)
  if (faq) jsonLd.push(faq)
  return { title: post.title, description: post.description, canonical: url, meta, jsonLd }
}

/** Head for a /blog/<slug> with no such post: kept out of the index. */
export function missingPostHead() {
  return {
    title: 'Post not found | Cansee blog',
    description: BLOG_DESCRIPTION,
    meta: [{ name: 'robots', content: 'noindex' }],
    jsonLd: [],
  }
}
