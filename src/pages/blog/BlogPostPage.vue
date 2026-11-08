<template>
  <BlogFrame>
    <!-- Mirrors postMainHtml() in lib/blog/prerender.js. -->
    <div v-if="post" class="blog-wrap">
      <nav class="blog-crumbs" aria-label="Breadcrumb">
        <ol>
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/blog">Blog</router-link></li>
          <li>
            <span aria-current="page">{{ post.title }}</span>
          </li>
        </ol>
      </nav>

      <article class="blog-article">
        <header class="blog-article-head">
          <h1 class="blog-h1">{{ post.title }}</h1>
          <p class="blog-lede">{{ post.description }}</p>
          <p class="blog-meta">
            <span>By {{ post.author }}</span
            ><span aria-hidden="true">&middot;</span>
            <span
              >Published <time :datetime="post.date">{{ formatDate(post.date) }}</time></span
            ><span aria-hidden="true">&middot;</span>
            <span
              >Updated <time :datetime="post.updated">{{ formatDate(post.updated) }}</time></span
            ><span aria-hidden="true">&middot;</span>
            <span>{{ post.readingMinutes }} min read</span>
          </p>
          <ul class="blog-tags" aria-label="Tags">
            <li v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</li>
          </ul>
        </header>

        <div class="blog-layout">
          <nav v-if="toc.length" id="blog-toc" class="blog-toc" aria-labelledby="blog-toc-title">
            <p id="blog-toc-title" class="blog-toc-title">On this page</p>
            <ol>
              <li v-for="item in toc" :key="item.id">
                <router-link :to="{ hash: `#${item.id}` }">{{ item.text }}</router-link>
              </li>
            </ol>
          </nav>
          <div class="blog-content">
            <!-- Sanitized in lib/blog/sanitize.js (DOMPurify, strict allowlist). -->
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="blog-body" v-html="html" @click="onBodyClick"></div>
            <section
              v-if="post.faq.length"
              id="blog-faq"
              class="blog-faq"
              aria-labelledby="blog-faq-title"
            >
              <h2 id="blog-faq-title">{{ FAQ_HEADING }}</h2>
              <div v-for="item in post.faq" :key="item.q" class="blog-faq-item">
                <h3>{{ item.q }}</h3>
                <p>{{ item.a }}</p>
              </div>
            </section>
          </div>
        </div>
      </article>

      <nav
        v-if="adjacent.previous || adjacent.next"
        class="blog-pager"
        aria-label="Previous and next posts"
      >
        <router-link
          v-if="adjacent.previous"
          :to="`/blog/${adjacent.previous.slug}`"
          class="blog-pager-link blog-pager-prev"
          rel="prev"
        >
          <span class="blog-pager-label">Previous post</span>
          <span class="blog-pager-title">{{ adjacent.previous.title }}</span>
        </router-link>
        <span v-else></span>
        <router-link
          v-if="adjacent.next"
          :to="`/blog/${adjacent.next.slug}`"
          class="blog-pager-link blog-pager-next"
          rel="next"
        >
          <span class="blog-pager-label">Next post</span>
          <span class="blog-pager-title">{{ adjacent.next.title }}</span>
        </router-link>
        <span v-else></span>
      </nav>

      <section
        v-if="related.length"
        id="blog-related"
        class="blog-related"
        aria-labelledby="blog-related-title"
      >
        <h2 id="blog-related-title" class="blog-section-title">Related posts</h2>
        <ul class="blog-cards blog-cards--compact" role="list">
          <BlogCard v-for="item in related" :key="item.slug" :post="item" heading-tag="h3" />
        </ul>
      </section>
    </div>

    <div v-else class="blog-wrap">
      <header class="blog-hero">
        <p class="blog-eyebrow">Blog</p>
        <h1 class="blog-h1">Post not found</h1>
        <p class="blog-lede">There is no post at this address. It may have moved.</p>
      </header>
      <p><router-link to="/blog" class="blog-back">See all posts</router-link></p>
    </div>
  </BlogFrame>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BlogFrame from '@/components/blog/BlogFrame.vue'
import BlogCard from '@/components/blog/BlogCard.vue'
import { useHead } from '@/composables/useHead'
import { adjacentPosts, formatDate, relatedPosts } from '@/lib/blog/content'
import { findPost, postHtml, posts, siteUrl } from '@/lib/blog/posts'
import { FAQ_HEADING } from '@/lib/blog/prerender'
import { blogPostHead, missingPostHead } from '@/lib/blog/seo'

const props = defineProps({
  slug: { type: String, required: true },
})

const router = useRouter()

const post = computed(() => findPost(props.slug))
const html = computed(() => (post.value ? postHtml(post.value) : ''))
const toc = computed(() => {
  if (!post.value) return []
  const items = [...post.value.toc]
  if (post.value.faq.length) items.push({ id: 'blog-faq', text: FAQ_HEADING })
  return items
})
const related = computed(() => (post.value ? relatedPosts(post.value, posts) : []))
const adjacent = computed(() =>
  post.value ? adjacentPosts(post.value, posts) : { previous: null, next: null }
)

useHead(() => (post.value ? blogPostHead(post.value, siteUrl) : missingPostHead()))

// Links inside the article are plain <a> tags; send the site's own paths
// through the router so they do not reload the app.
function onBodyClick(event) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.target.closest?.('a[href]')
  if (!link || link.target) return
  const href = link.getAttribute('href')
  if (!href || !href.startsWith('/') || href.startsWith('//')) return
  event.preventDefault()
  router.push(href)
}
</script>
