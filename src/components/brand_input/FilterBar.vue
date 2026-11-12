<script setup>
/**
 * Filter + search controls above the source list.
 *
 * Uses v-model:status / v-model:kind / v-model:search / v-model:domain
 * so the parent stays the single source of truth for filter state (and
 * can drive the server-side query params directly from that state).
 *
 * Status counts come from the server's `stats` block so the badges
 * always reflect the whole corpus, not the current filter.
 */
import { computed } from 'vue'
import { Search, X } from '@lucide/vue'

const props = defineProps({
  status: { type: String, default: '' },
  kind: { type: String, default: '' },
  search: { type: String, default: '' },
  domain: { type: String, default: '' },
  stats: { type: Object, default: () => ({}) },
  domainOptions: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'update:status', 'update:kind', 'update:search', 'update:domain', 'clear',
])

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ready', label: 'Ready', statKey: 'ready' },
  { value: 'ingesting', label: 'Ingesting', statKey: 'ingesting' },
  { value: 'pending', label: 'Pending', statKey: 'pending' },
  { value: 'failed', label: 'Failed', statKey: 'failed' },
]

const KIND_OPTIONS = [
  { value: '', label: 'All kinds' },
  { value: 'homepage', label: 'Homepage' },
  { value: 'docs', label: 'Docs' },
  { value: 'blog', label: 'Blog' },
  { value: 'product', label: 'Product' },
  { value: 'review', label: 'Review' },
  { value: 'other', label: 'Other' },
]

const isFiltered = computed(
  () => Boolean(props.status || props.kind || props.search || props.domain),
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Search + kind + clear row -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-[220px] flex-1">
        <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          :value="search"
          @input="emit('update:search', $event.target.value)"
          type="text"
          placeholder="Search URL or title"
          class="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <select
        :value="kind"
        @change="emit('update:kind', $event.target.value)"
        class="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option v-for="opt in KIND_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <select
        v-if="domainOptions.length > 1"
        :value="domain"
        @change="emit('update:domain', $event.target.value)"
        class="h-9 max-w-[200px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All domains</option>
        <option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</option>
      </select>

      <button
        v-if="isFiltered"
        class="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        @click="emit('clear')"
      >
        <X class="size-3" /> Clear
      </button>
    </div>

    <!-- Status chips row with counts -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="opt in STATUS_OPTIONS"
        :key="opt.value || 'all'"
        class="inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors"
        :class="status === opt.value
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'"
        @click="emit('update:status', opt.value)"
      >
        {{ opt.label }}
        <span
          v-if="opt.statKey"
          class="bg-secondary/50 px-1.5 text-[10px] font-semibold text-foreground"
          :class="status === opt.value ? 'bg-background/25 text-background' : ''"
        >
          {{ stats[opt.statKey] || 0 }}
        </span>
        <span
          v-else
          class="bg-secondary/50 px-1.5 text-[10px] font-semibold text-foreground"
          :class="status === opt.value ? 'bg-background/25 text-background' : ''"
        >
          {{ stats.total || 0 }}
        </span>
      </button>
    </div>
  </div>
</template>
