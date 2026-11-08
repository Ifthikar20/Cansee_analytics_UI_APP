<script setup>
// Brand Security findings raised from THIS prompt's AI answers, shown next
// to the answers that caused them.
import { ref, computed, watch, onMounted } from 'vue'
import { ShieldAlert, ShieldCheck } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/api/client'
import SeverityBadge from '@/components/brand_security/SeverityBadge.vue'
import { compareSeverity } from '@/constants/severity'

const props = defineProps({
  websiteId: { type: String, required: true },
  promptId: { type: String, required: true },
})

// The alerts list is paginated. Read every page (largest page size the
// API allows) so the list and the open count cover all findings; the cap
// bounds a pathological prompt. `total` is the server's count, used to say
// when the cap cut the list short.
const PAGE_SIZE = 100
const MAX_PAGES = 20

const loading = ref(true)
const alerts = ref([])
const total = ref(0)
const loadFailed = ref(false)
// Ignores a slower earlier load when the prompt changes mid-way.
let loadSeq = 0

const sorted = computed(() => [...alerts.value].sort(compareSeverity))
const openCount = computed(() => sorted.value.filter(a => a.status === 'open').length)

async function load() {
  if (!props.websiteId || !props.promptId) return
  const seq = ++loadSeq
  loading.value = true
  loadFailed.value = false
  try {
    const rows = []
    let count = null
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Silent: a failure renders inline below instead of a toast.
      const res = await api.get(`/brand-security/websites/${props.websiteId}/alerts/`, {
        params: { source_prompt: props.promptId, page, page_size: PAGE_SIZE },
        _silentError: true,
      })
      if (seq !== loadSeq) return
      const data = res?.data
      const batch = Array.isArray(data) ? data : (data?.results ?? [])
      rows.push(...batch)
      if (typeof res?.meta?.count === 'number') count = res.meta.count
      // An unpaginated answer is the whole list; otherwise stop at the
      // last page (no next link) or on an empty page.
      if (!res?.meta || !res.meta.next || !batch.length) break
    }
    alerts.value = rows
    total.value = Math.max(count ?? rows.length, rows.length)
  } catch {
    if (seq !== loadSeq) return
    loadFailed.value = true
    alerts.value = []
    total.value = 0
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(load)
watch(() => props.promptId, load)

function label(issue) {
  return (issue || '').replace(/_/g, ' ')
}
</script>

<template>
  <Card class="overflow-hidden rounded-xl border-border p-0 shadow-none">
    <div class="px-5 pb-3 pt-4">
      <h2 class="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
        <ShieldAlert v-if="openCount" class="size-4 text-severity-high" />
        <ShieldCheck v-else class="size-4 text-[color:var(--chart-2)]" />
        Brand security
      </h2>
      <p class="mt-0.5 text-[11px] text-muted-foreground">
        Findings from the AI answers to this prompt
      </p>
    </div>

    <div class="h-px w-full bg-border" />

    <p v-if="loading" class="px-5 py-6 text-center text-[12px] text-muted-foreground">
      Checking responses…
    </p>

    <div v-else-if="loadFailed" class="flex flex-col items-center gap-2 px-5 py-6 text-center">
      <p class="text-[12px] text-muted-foreground">We couldn't load the findings for this prompt.</p>
      <Button variant="outline" size="sm" @click="load">Try again</Button>
    </div>

    <div v-else-if="!sorted.length" class="px-5 py-6 text-center">
      <p class="text-[13px] font-semibold text-foreground">No findings for this prompt.</p>
      <p class="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
        Findings appear when an AI answer conflicts with your brand facts.
      </p>
    </div>

    <ul v-else>
      <li
        v-for="a in sorted"
        :key="a.id"
        class="flex items-start gap-2 border-b border-border/60 px-5 py-3 last:border-b-0"
      >
        <SeverityBadge :severity="a.severity" size="sm" class="mt-0.5" />
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold text-foreground">{{ a.title || label(a.issue) }}</p>
          <p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
            <span
              v-if="a.reference"
              class="rounded bg-secondary px-1 py-px font-mono text-[10px] text-secondary-foreground"
            >{{ a.reference }}</span>
            <span
              v-if="a.detector_code"
              class="font-mono text-[10px]"
            >{{ a.detector_code }}</span>
            <span>{{ label(a.issue) }}<span v-if="a.model"> · {{ a.model }}</span></span>
          </p>
          <p v-if="a.detail" class="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {{ a.detail }}
          </p>
          <blockquote
            v-if="a.snippet"
            class="mt-2 border-l-2 border-border pl-2.5 text-[11px] italic leading-relaxed text-foreground/80"
          >
            {{ a.snippet.length > 260 ? a.snippet.slice(0, 260) + '…' : a.snippet }}
          </blockquote>
        </div>
      </li>
    </ul>
    <p
      v-if="!loading && !loadFailed && total > sorted.length"
      class="border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground"
      data-test="findings-truncated"
    >
      Showing {{ sorted.length }} of {{ total }} findings.
    </p>
  </Card>
</template>
