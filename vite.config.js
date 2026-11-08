import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { blogContent } from './scripts/blog-content.mjs'

// Build-time env vars (set in .env / .env.local / CI):
//   VITE_API_URL          - backend origin for the dev proxy (default http://localhost:8000)
//   VITE_GOOGLE_CLIENT_ID - Google OAuth web client ID for "Continue with
//                           Google" sign-in. Public by design; the client
//                           secret stays on the backend. The same client
//                           needs {origin}/auth/google/callback in its
//                           authorized redirect URIs.
//   VITE_SITE_URL         - public origin for canonical URLs, structured data
//                           and the sitemap (default https://cansee.ai).

export default defineConfig({
  // blogContent fails the build on an invalid post in src/content/blog.
  plugins: [vue(), tailwindcss(), blogContent()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    // Read by scripts/prerender-blog.mjs (to link the blog pages' CSS from
    // the prerendered HTML), which deletes it afterwards.
    manifest: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
