<script setup>
/**
 * Right-side drawer that opens when a source row is clicked.
 *
 * Two purposes:
 * 1. Explain what the RAG stored for this source — chunk count, first
 *    few chunks with their section labels, ingestion timestamps.
 * 2. Let the user test what queries would retrieve from *this* source
 *    specifically. Passes ``source_id`` to /rag/retrieve so results
 *    stay scoped to the chunks under this row.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { X, Loader2, RefreshCw, Trash2, ExternalLink, FileText, Zap, CircleX } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import ragApi from '@/api/rag'
import { useToast } from '@/composables/useToast'
import { safeHref } from '@/utils/safeHref'
import StatusPill from './StatusPill.vue'
import { timeAgo } from '@/utils/timeAgo.js'

const props = defineProps({
  websiteId: { type: String, required: true },
  source: { type: Object, required: true },
})
const emit = defineEmits(['close', 'reingested', 'deleted'])

const toast = useToast()

// ── Chunk detail load ────────────────────────────────────────────
const chunks = ref([])
const detailLoading = ref(false)

async function loadDetail() {
  detailLoading.value = true
  try {
    const res = await ragApi.getSource(props.websiteId, props.source.id)
    // Envelope unwrap: res.data is { source, chunks }
    chunks.value = (res.data && res.data.chunks) || []
  } catch {
    toast.error('Failed to load chunks for this source')
  } finally {
    detailLoading.value = false
  }
}

onMounted(loadDetail)
watch(() => props.source.id, loadDetail)

// ── ESC closes ───────────────────────────────────────────────────
function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ── Test query ───────────────────────────────────────────────────
const query = ref('')
const testing = ref(false)
const hits = ref(null)  // null = never run; [] = ran, no results
// Why the search could not run (the backend's ``reason``); null after a
// normal search, so an empty result is never mistaken for "no matches".
const searchReason = ref(null)

const REASON_TEXT = {
  embeddings_not_configured: "Search isn't available yet.",
  embeddings_pending: "This source hasn't been indexed for search yet.",
  ai_allowance_exhausted: 'Your AI allowance for this month is used up, so search is paused.',
  embeddings_failed: "We couldn't search right now. Try again.",
}
const reasonText = computed(() =>
  searchReason.value ? (REASON_TEXT[searchReason.value] || "We couldn't search right now. Try again.") : '',
)

async function runTest() {
  const q = query.value.trim()
  if (!q) return
  testing.value = true
  hits.value = null
  searchReason.value = null
  try {
    const res = await ragApi.retrieve(props.websiteId, {
      query: q,
      topK: 5,
      sourceId: props.source.id,
    })
    hits.value = (res.data && res.data.hits) || []
    searchReason.value = (res.data && res.data.reason) || null
  } catch (err) {
    const msg = err?.response?.data?.error
      || err?.response?.data?.error?.message
      || 'Retrieval failed'
    toast.error(msg)
  } finally {
    testing.value = false
  }
}

// ── Actions ──────────────────────────────────────────────────────
const reingesting = ref(false)

async function reingest() {
  if (props.source.is_paste) {
    toast.warning('Paste-uploaded sources cannot be reingested. Re-upload the text to update.')
    return
  }
  reingesting.value = true
  try {
    await ragApi.reingestSource(props.websiteId, props.source.id)
    toast.success('Reingest queued')
    emit('reingested', props.source)
  } catch (err) {
    const msg = err?.response?.data?.error
      || err?.response?.data?.error?.message
      || 'Failed to queue reingest'
    toast.error(msg)
  } finally {
    reingesting.value = false
  }
}

async function del() {
  if (!confirm(`Delete "${props.source.title || props.source.url}"? Chunks are removed from the vector store.`)) return
  try {
    await ragApi.deleteSource(props.websiteId, props.source.id)
    toast.success('Source deleted')
    emit('deleted', props.source)
    emit('close')
  } catch {
    toast.error('Failed to delete source')
  }
}

const displayTitle = computed(
  () => props.source.title || (props.source.is_paste ? 'Pasted text' : props.source.url),
)
const lastIngestedLabel = computed(
  () => props.source.last_ingested_at ? timeAgo(props.source.last_ingested_at) : 'never',
)
</script>

<template>
  <!-- Centred modal, matching ChatDetailModal.vue. The backdrop is the
       positioning context rather than a separate fixed layer, so @click.self
       closes on the backdrop only and a click inside the panel does not
       bubble out and dismiss it. -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div
      class="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <!-- Header -->
      <header class="flex items-start gap-3 border-b border-border p-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <StatusPill :source="source" />
          <span class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {{ source.kind_display || source.kind }}
          </span>
        </div>
        <h2 class="mt-2 truncate text-base font-semibold text-foreground" :title="displayTitle">
          {{ displayTitle }}
        </h2>
        <div class="mt-1 truncate text-xs text-muted-foreground">
          <template v-if="source.is_paste">
            Pasted text · {{ chunks.length }} chunks
          </template>
          <a
            v-else
            :href="safeHref(source.url)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 hover:text-foreground hover:underline"
          >
            {{ source.url }}
            <ExternalLink class="size-3" />
          </a>
        </div>
      </div>
      <button
        class="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
        title="Close"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </header>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Metadata grid -->
      <dl class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt class="text-[10px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Chunks</dt>
          <dd class="mt-1 tabular-nums text-foreground">{{ source.chunk_count || 0 }}</dd>
        </div>
        <div>
          <dt class="text-[10px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Last ingested</dt>
          <dd class="mt-1 text-foreground">{{ lastIngestedLabel }}</dd>
        </div>
        <div>
          <dt class="text-[10px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Added</dt>
          <dd class="mt-1 text-foreground">{{ timeAgo(source.created_at) }}</dd>
        </div>
        <div v-if="source.domain">
          <dt class="text-[10px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Domain</dt>
          <dd class="mt-1 truncate text-foreground">{{ source.domain }}</dd>
        </div>
      </dl>

      <Alert v-if="source.error_message" variant="destructive" class="mt-4">
        <CircleX />
        <AlertTitle>Ingestion error</AlertTitle>
        <AlertDescription>{{ source.error_message }}</AlertDescription>
      </Alert>

      <!-- Test-query panel -->
      <section class="mt-6">
        <div class="flex items-center gap-2">
          <Zap class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-semibold text-foreground">Test what this source would return</h3>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          Runs a similarity search against just this source's passages.
        </p>
        <form class="mt-3 flex items-center gap-2" @submit.prevent="runTest">
          <input
            v-model="query"
            type="text"
            placeholder="What would a customer ask?"
            class="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            class="inline-flex h-9 items-center gap-1 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"
            :disabled="testing || !query.trim()"
          >
            <Loader2 v-if="testing" class="size-3.5 animate-spin" />
            Search
          </button>
        </form>

        <div v-if="hits !== null" class="mt-3 space-y-2">
          <div
            v-if="hits.length === 0 && reasonText"
            class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground"
          >
            {{ reasonText }}
          </div>
          <div
            v-else-if="hits.length === 0"
            class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground"
          >
            No passages from this source matched. Try a broader query, or check that the source
            covers this topic.
          </div>
          <div
            v-for="(hit, i) in hits"
            :key="hit.chunk_id"
            class="rounded-md border border-border bg-card p-3"
          >
            <div class="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>#{{ i + 1 }} · {{ hit.section_label || 'chunk' }}</span>
              <span class="tabular-nums">score {{ hit.score.toFixed(3) }}</span>
            </div>
            <p class="mt-1 text-xs leading-relaxed text-foreground">{{ hit.text }}</p>
          </div>
        </div>
      </section>

      <!-- Chunks list -->
      <section class="mt-6">
        <div class="flex items-center gap-2">
          <FileText class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-semibold text-foreground">Stored chunks</h3>
          <span class="text-xs text-muted-foreground">({{ chunks.length }})</span>
        </div>
        <div v-if="detailLoading" class="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" /> Loading chunks…
        </div>
        <div v-else-if="!chunks.length" class="mt-3 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No chunks stored. The source may still be processing.
        </div>
        <ul v-else class="mt-3 space-y-2">
          <li
            v-for="c in chunks.slice(0, 20)"
            :key="c.id"
            class="rounded-md border border-border bg-card p-3"
          >
            <div class="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>#{{ c.chunk_index }} · {{ c.section_label || 'chunk' }}</span>
              <span class="tabular-nums">{{ c.token_count }} tokens</span>
            </div>
            <p class="mt-1 line-clamp-3 text-xs leading-relaxed text-foreground">{{ c.text }}</p>
          </li>
          <li v-if="chunks.length > 20" class="text-center text-xs text-muted-foreground">
            + {{ chunks.length - 20 }} more chunks not shown
          </li>
        </ul>
      </section>
    </div>

    <!-- Footer actions -->
    <footer class="flex items-center justify-between gap-2 border-t border-border p-4">
      <button
        v-if="!source.is_paste"
        class="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        :disabled="reingesting"
        @click="reingest"
      >
        <Loader2 v-if="reingesting" class="size-3.5 animate-spin" />
        <RefreshCw v-else class="size-3.5" />
        Reingest
      </button>
      <span v-else class="text-xs text-muted-foreground">
        Paste-uploaded — re-upload to update
      </span>

      <button
        class="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
        @click="del"
      >
        <Trash2 class="size-3.5" /> Delete
      </button>
      </footer>
    </div>
  </div>
</template>
