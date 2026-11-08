<template>
  <!-- The blog's header and footer. Mirrors frameHtml() in lib/blog/prerender.js,
       which writes the same markup for the prerendered pages. -->
  <div class="blog">
    <a class="blog-skip" href="#main" @click.prevent="focusMain">Skip to content</a>
    <header class="blog-top">
      <div class="blog-top-inner">
        <router-link to="/" class="blog-home" aria-label="Cansee home">
          <img src="/images/cansee-logo.png" alt="Cansee" class="blog-logo" />
        </router-link>
        <nav class="blog-nav" aria-label="Primary">
          <router-link v-for="l in NAV_LINKS" :key="l.to" :to="l.to" class="blog-nav-link">{{
            l.label
          }}</router-link>
          <router-link to="/login" class="blog-cta">Sign in</router-link>
        </nav>
      </div>
    </header>
    <main id="main" ref="mainEl" class="blog-main" tabindex="-1">
      <slot />
    </main>
    <footer class="blog-foot">
      <div class="blog-foot-inner">
        <span>&copy; 2026 Cansee, Inc.</span>
        <nav class="blog-foot-links" aria-label="Footer">
          <router-link v-for="l in FOOTER_LINKS" :key="l.to" :to="l.to">{{ l.label }}</router-link>
        </nav>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { FOOTER_LINKS, NAV_LINKS } from '@/lib/blog/prerender'
import '@/assets/css/blog.css'

const mainEl = ref(null)

// The router's scroll handling would treat #main as a route hash; move
// focus (and the reading position) to the content directly instead.
function focusMain() {
  mainEl.value?.focus()
  mainEl.value?.scrollIntoView()
}
</script>
