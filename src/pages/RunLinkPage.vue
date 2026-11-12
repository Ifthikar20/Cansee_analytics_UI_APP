<template>
  <!-- The daily text's link (autopilot_frontend.md 5): /r/<code> resolves
       to its project and opens that project's Prompt ranking. -->
  <main class="rl">
    <div class="rl-card">
      <template v-if="state === 'missing'">
        <p class="rl-text">This link isn't available. It may belong to a project you can't open.</p>
        <Button as-child class="rl-btn">
          <router-link :to="{ name: 'dashboard' }">Go to Analytics</router-link>
        </Button>
      </template>
      <template v-else-if="state === 'failed'">
        <p class="rl-text">We couldn't open this link.</p>
        <Button variant="outline" class="rl-btn" @click="resolve">Try again</Button>
      </template>
      <p v-else class="rl-text rl-muted" role="status">Opening the ranking...</p>
    </div>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
import { Button } from '@/components/ui/button'
import { boardLocation } from '@/lib/board/links'

const route = useRoute()
const router = useRouter()
const state = ref('loading') // loading | missing | failed

async function resolve() {
  state.value = 'loading'
  const code = String(route.params.code || '')
  try {
    const { data } = await api.get(`/autopilot/links/${encodeURIComponent(code)}/`, { _silentError: true })
    if (!data?.website_id) {
      state.value = 'missing'
      return
    }
    router.replace(boardLocation(data.website_id, 'ranking'))
  } catch (e) {
    // 404 also when the caller cannot open the project: say nothing more.
    state.value = e?.response?.status === 404 ? 'missing' : 'failed'
  }
}

onMounted(resolve)
</script>

<style scoped>
.rl {
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  place-items: center;
  padding: 24px 16px;
  background: var(--background);
  color: var(--foreground);
}

.rl-card {
  display: grid;
  justify-items: start;
  gap: 16px;
  width: min(420px, 100%);
}

.rl-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
}

.rl-muted {
  color: var(--muted-foreground);
}

.rl-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius);
  font-size: 13px;
}
</style>
