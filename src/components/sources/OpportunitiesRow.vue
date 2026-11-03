<script setup>
/**
 * "What to do next" — the URLs page's action layer. Three server-built
 * buckets: your pages AI cites but Google buries, third-party pages
 * feeding competitor answers, and your pages that are working. Each row
 * links to the URL's detail page; buckets that need a data source the
 * user has not connected say so instead of rendering empty.
 */
import { computed } from 'vue'
import { ArrowUpRight, Search, Trophy, Wrench } from '@lucide/vue'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const props = defineProps({
  // { available: {gsc, pixel}, buckets: [{key, title, items: []}] }
  opportunities: { type: Object, default: null },
})
const emit = defineEmits(['open-url'])

const BUCKET_META = {
  seo_gap: {
    icon: Wrench,
    hintWhenUnavailable:
      'Connect Search Console to spot pages AI trusts but Google buries.',
  },
  content_gap: { icon: Search, hintWhenUnavailable: '' },
  winning: {
    icon: Trophy,
    hintWhenUnavailable:
      'Connect Search Console to see which cited pages earn visits.',
  },
}

const buckets = computed(() => {
  const raw = props.opportunities?.buckets || []
  const available = props.opportunities?.available || {}
  return raw.map((bucket) => {
    const meta = BUCKET_META[bucket.key] || {}
    const needsData =
      (bucket.key === 'seo_gap' && !available.gsc) ||
      (bucket.key === 'winning' && !available.gsc && !available.pixel)
    return { ...bucket, ...meta, needsData }
  })
})
</script>

<template>
  <div v-if="opportunities" class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <Card v-for="bucket in buckets" :key="bucket.key" class="flex flex-col">
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-1.5 text-sm">
          <component :is="bucket.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
          {{ bucket.title }}
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-1 flex-col gap-1 pt-0">
        <template v-if="bucket.items.length">
          <button
            v-for="item in bucket.items"
            :key="item.normalized_url"
            type="button"
            class="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="emit('open-url', item)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-foreground">{{ item.title }}</span>
              <span class="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {{ item.reason }} —
                <span class="font-medium text-foreground/80">{{ item.action }}</span>
              </span>
            </span>
            <ArrowUpRight class="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          </button>
        </template>
        <p v-else-if="bucket.needsData" class="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
          {{ bucket.hintWhenUnavailable }}
          <router-link
            v-if="bucket.key === 'seo_gap' || bucket.key === 'winning'"
            to="/settings/connections"
            class="font-medium text-foreground hover:underline"
          >Open Connections</router-link>
        </p>
        <p v-else class="px-2 py-3 text-xs text-muted-foreground">
          Nothing here yet.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
