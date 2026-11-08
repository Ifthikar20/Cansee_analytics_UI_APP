<template>
  <!-- Mirrors cardHtml() in lib/blog/prerender.js. -->
  <li class="blog-card">
    <article>
      <component :is="headingTag" class="blog-card-title">
        <router-link :to="`/blog/${post.slug}`">{{ post.title }}</router-link>
      </component>
      <p class="blog-card-desc">{{ post.description }}</p>
      <p class="blog-meta">
        <time :datetime="post.date">{{ formatDate(post.date) }}</time
        ><span aria-hidden="true">&middot;</span><span>{{ post.readingMinutes }} min read</span>
      </p>
      <ul class="blog-tags" aria-label="Tags">
        <li v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</li>
      </ul>
    </article>
  </li>
</template>

<script setup>
import { formatDate } from '@/lib/blog/content'

defineProps({
  post: { type: Object, required: true },
  headingTag: { type: String, default: 'h2' },
})
</script>
