<script setup>
/**
 * Status pill for a KnowledgeSource row.
 *
 * The `title` (native tooltip) is the single most requested affordance
 * for this page: users kept asking "what does Ready mean?" — now the
 * pill answers on hover with the concrete meaning + timestamps.
 */
import { computed } from 'vue'
import { CheckCircle2, Loader2, Clock, AlertCircle } from '@lucide/vue'
import { timeAgo } from '@/utils/timeAgo.js'

const props = defineProps({
  source: { type: Object, required: true },
})

const statusMeta = computed(() => {
  const s = String(props.source.status || '').toLowerCase()
  if (s === 'ready') return {
    label: props.source.status_display || 'Ready',
    icon: CheckCircle2,
    klass: 'bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]',
  }
  if (s === 'ingesting') return {
    label: props.source.status_display || 'Ingesting',
    icon: Loader2,
    klass: 'bg-[color:var(--chart-3)]/15 text-[color:var(--chart-3)]',
    spin: true,
  }
  if (s === 'pending') return {
    label: props.source.status_display || 'Pending',
    icon: Clock,
    klass: 'bg-[color:var(--chart-4)]/15 text-[color:var(--chart-4)]',
  }
  if (s === 'failed') return {
    label: props.source.status_display || 'Failed',
    icon: AlertCircle,
    klass: 'bg-destructive/15 text-destructive',
  }
  return {
    label: props.source.status_display || props.source.status || 'Unknown',
    icon: Clock,
    klass: 'bg-secondary text-muted-foreground',
  }
})

const tooltip = computed(() => {
  const s = props.source
  const status = String(s.status || '').toLowerCase()
  if (status === 'ready') {
    const parts = [`${s.chunk_count || 0} passages`]
    if (s.last_ingested_at) parts.push(`updated ${timeAgo(s.last_ingested_at)}`)
    return parts.join(' · ')
  }
  if (status === 'ingesting') return 'Fetching page, chunking text, generating embeddings.'
  if (status === 'pending') return 'Waiting in queue. A worker will pick this up shortly.'
  if (status === 'failed') return s.error_message || 'Ingestion failed. Try Reingest, or delete and re-add.'
  return ''
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize"
    :class="statusMeta.klass"
    :title="tooltip"
  >
    <component
      :is="statusMeta.icon"
      class="size-3"
      :class="{ 'animate-spin': statusMeta.spin }"
    />
    {{ statusMeta.label }}
  </span>
</template>
