<script setup>
// The Analytics sub-nav under the header: Overview, Visibility, Countries,
// Traffic, AI traffic, Sources. One row that scrolls sideways on narrow
// screens; sections addressed by a project are disabled without one.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ANALYTICS_SECTIONS, analyticsSectionOf, sectionRoute } from '@/lib/analyticsNav'

const props = defineProps({
  websiteId: { type: [String, Number], default: null },
})

const route = useRoute()
const track = ref(null)

const current = computed(() => analyticsSectionOf(route.name))
const items = computed(() =>
  ANALYTICS_SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    to: sectionRoute(s.key, props.websiteId),
    active: s.key === current.value,
  })),
)

// Keep the current section in view when the row overflows.
async function revealCurrent() {
  await nextTick()
  const el = track.value?.querySelector('[aria-current="page"]')
  if (!el || !track.value) return
  const box = track.value
  if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
    box.scrollLeft = Math.max(0, el.offsetLeft - 16)
  }
}

onMounted(revealCurrent)
watch(current, revealCurrent)
</script>

<template>
  <nav class="an-nav" aria-label="Analytics">
    <div ref="track" class="an-nav-track">
      <template v-for="item in items" :key="item.key">
        <router-link
          v-if="item.to"
          :to="item.to"
          class="an-nav-link"
          :class="{ 'is-active': item.active }"
          :aria-current="item.active ? 'page' : null"
        >{{ item.label }}</router-link>
        <a v-else class="an-nav-link is-disabled" role="link" aria-disabled="true">{{ item.label }}</a>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.an-nav {
  min-width: 0;
}

.an-nav-track {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}

.an-nav-track::-webkit-scrollbar {
  display: none;
}

.an-nav-link {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  scroll-snap-align: start;
  transition: color 0.15s ease, background 0.15s ease;
}

.an-nav-link:hover {
  color: var(--foreground);
  opacity: 1;
}

.an-nav-link.is-active {
  background: var(--accent);
  color: var(--foreground);
}

.an-nav-link.is-disabled {
  color: var(--muted-foreground);
  cursor: not-allowed;
  opacity: 0.5;
}

.an-nav-link:focus-visible {
  border-radius: 999px;
  outline-offset: -2px;
}

/* Narrow screens: the row scrolls; the edges fade so a cut-off item reads
   as "more this way". */
@media (max-width: 900px) {
  .an-nav-track {
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
    mask-image: linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
    padding: 0 10px;
  }
}
</style>
