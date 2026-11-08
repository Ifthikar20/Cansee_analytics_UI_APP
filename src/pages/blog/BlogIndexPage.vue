<template>
  <BlogFrame>
    <!-- Mirrors indexMainHtml() in lib/blog/prerender.js. -->
    <div class="blog-wrap">
      <header class="blog-hero">
        <p class="blog-eyebrow">Blog</p>
        <h1 class="blog-h1">{{ BLOG_HEADING }}</h1>
        <p class="blog-lede">{{ BLOG_DESCRIPTION }}</p>
      </header>
      <ul v-if="posts.length" class="blog-cards" role="list">
        <BlogCard v-for="post in posts" :key="post.slug" :post="post" />
      </ul>
      <p v-else class="blog-empty">{{ EMPTY_MESSAGE }}</p>
    </div>
  </BlogFrame>
</template>

<script setup>
import BlogFrame from '@/components/blog/BlogFrame.vue'
import BlogCard from '@/components/blog/BlogCard.vue'
import { useHead } from '@/composables/useHead'
import { posts, siteUrl } from '@/lib/blog/posts'
import { BLOG_HEADING, EMPTY_MESSAGE } from '@/lib/blog/prerender'
import { BLOG_DESCRIPTION, blogIndexHead } from '@/lib/blog/seo'

useHead(() => blogIndexHead(posts, siteUrl))
</script>
