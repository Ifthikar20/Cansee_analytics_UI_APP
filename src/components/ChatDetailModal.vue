<script setup>
import { engineMeta } from '@/lib/engines'
import { ref, computed, watch, useId } from 'vue'
import { X, ExternalLink, ArrowLeft, ArrowRight, Loader2 } from '@lucide/vue'
import api from '@/api/client'
import BrandLogo from '@/components/BrandLogo.vue'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  websiteId: { type: String, required: true },
  resultId: { type: String, default: '' },
  open: { type: Boolean, default: false },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'prev', 'next'])

// Alignment score band -> token-based pill styling (same bands as the
// dashboard breakdown: aligned >= 70, partial 40-69, unaligned < 40).
function alignmentBandClass(score) {
  if (score >= 70) return 'bg-[color:var(--chart-2)]/12 text-[color:var(--chart-2)]'
  if (score >= 40) return 'bg-[color:var(--chart-3)]/12 text-[color:var(--chart-3)]'
  return 'bg-severity-high/10 text-severity-high'
}

function modelStyle(key) {
  if (!key) return { label: 'Model', abbr: '', color: '#8b8b93' }
  const meta = engineMeta(key)
  return { label: meta.label, abbr: meta.label.slice(0, 2), color: meta.color }
}

const loading = ref(false)
const error = ref('')
const detail = ref(null)

function faviconFor(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}
function onFaviconError(e) { e.target.style.visibility = 'hidden' }

const modelLabel = computed(() => modelStyle(detail.value?.model).label)

// Order brands the way the model surfaced them: by position ascending,
// with un-positioned brands last but the tracked brand kept visible.
const rankedBrands = computed(() => {
  const brands = [...(detail.value?.brands || [])]
  return brands.sort((a, b) => {
    const pa = a.position == null ? Infinity : a.position
    const pb = b.position == null ? Infinity : b.position
    return pa - pb
  })
})

// The backend classifies each entity: real brands (companies, branded
// products, cited domains) vs generic information (equipment, categories,
// concepts). Rows without a kind (older payloads) count as brands.
const brandRows = computed(() => rankedBrands.value.filter(b => b.kind !== 'info'))
const infoRows = computed(() => rankedBrands.value.filter(b => b.kind === 'info'))

/* Highlight brand mentions in any text — the tracked brand in green and
   every competitor in its OWN color, so a mention in the answer and the
   same brand's row in the Details panel read as one thing. Colors are
   assigned by the model's ranking order (rankedBrands), so the mapping
   is stable across the prompt bubble, the response, and the panel.
   Escapes HTML first, then renders markdown bold (**text**) as <strong>
   instead of leaking literal asterisks, then wraps whole-word brand
   matches in classed <mark>s (styles live in the <style> block below,
   with dark-theme variants). */
const COMPETITOR_CLASS_COUNT = 8

const brandClassMap = computed(() => {
  const map = new Map()
  const own = (detail.value?.brand || '').trim().toLowerCase()
  // "YNAB (You Need A Budget)"-style names also answer to either half,
  // so bare mentions later in the answer light up in the same color.
  const register = (name, cls) => {
    const key = (name || '').trim().toLowerCase()
    if (!key || map.has(key)) return
    map.set(key, cls)
    const short = key.replace(/\s*\(.*\)\s*$/, '')
    const inner = (key.match(/\(([^)]{3,})\)\s*$/) || [])[1]
    for (const alias of [short, inner]) {
      const a = (alias || '').trim()
      if (a && a.length > 2 && !map.has(a)) map.set(a, cls)
    }
  }
  let i = 0
  for (const b of brandRows.value) {
    const key = (b.name || '').trim().toLowerCase()
    if (!key || map.has(key)) continue
    register(key, key === own ? 'cdm-mark--own' : `cdm-mark--c${i++ % COMPETITOR_CLASS_COUNT}`)
  }
  // Informational terms get a neutral dotted style — visible, but never
  // dressed up as a competitor brand.
  for (const b of infoRows.value) {
    const key = (b.name || '').trim().toLowerCase()
    if (!key || map.has(key)) continue
    register(key, 'cdm-mark--info')
  }
  // The tracked brand is highlightable even when the detector did not
  // list it among this answer's brands (e.g. it only appears in the
  // prompt bubble).
  if (own && !map.has(own)) register(own, 'cdm-mark--own')
  return map
})

function brandMarkClass(name) {
  return brandClassMap.value.get((name || '').trim().toLowerCase()) || ''
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
function highlight(text) {
  let safe = escapeHtml(text || '')
  // Model responses arrive as raw markdown: show **bold** as bold, not
  // as star-star noise around brand names. (Kept per-line: the lazy
  // dot never crosses a newline, so an unmatched ** can't swallow a
  // paragraph.)
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const names = [...brandClassMap.value.keys()]
  if (!names.length) return safe
  names.sort((a, b) => b.length - a.length)
  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Lookarounds instead of \b: a word boundary can never match next to
  // a name that starts/ends in a non-word character ("YNAB (You Need A
  // Budget)" ends in ")"), which silently dropped those highlights.
  const re = new RegExp(`(?<!\\w)(${escaped.join('|')})(?!\\w)`, 'gi')
  return safe.replace(re, (m) => {
    const cls = brandClassMap.value.get(m.toLowerCase())
    return cls ? `<mark class="cdm-mark ${cls}">${m}</mark>` : m
  })
}

async function load() {
  if (!props.resultId || !props.open) return
  loading.value = true
  error.value = ''
  detail.value = null
  try {
    // Silent: the failure renders inside the viewer.
    const res = await api.get(
      `/citations/websites/${props.websiteId}/chats/${props.resultId}/`,
      { _silentError: true },
    )
    detail.value = res.data || null
  } catch {
    error.value = "We couldn't load this answer."
  } finally {
    loading.value = false
  }
}

watch(() => [props.open, props.resultId], load, { immediate: true })

// Scrolling inside the viewer must never scroll the page behind it.
useBodyScrollLock(computed(() => props.open))

// A modal dialog: focus moves in and stays in, returns to the row that
// opened it, and Escape closes only this viewer (not the board panel that
// hosts the page underneath).
const dialogRef = ref(null)
const titleId = useId()
const dialogTitle = computed(() => (detail.value?.model ? `${modelLabel.value} answer` : 'AI answer'))
useDialogFocus(dialogRef, () => props.open, { onEscape: () => emit('close') })
</script>

<template>
  <!-- Teleported: the board's side panel is a size container, which would
       clip and place a fixed overlay inside it. -->
  <Teleport to="body">
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="flex h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none"
    >
      <h2 :id="titleId" class="sr-only">{{ dialogTitle }}</h2>
      <!-- Conversation -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-border px-5 py-3">
          <div class="flex items-center gap-2 text-sm font-medium text-foreground">
            <span class="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              :style="{ background: modelStyle(detail?.model).color }">{{ modelStyle(detail?.model).abbr }}</span>
            {{ modelLabel }}
            <!-- The exact submodel that answered, when the row carries it
                 (per-prompt model selection). -->
            <span v-if="detail?.model_id" class="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{{ detail.model_id }}</span>
            <span v-if="detail?.country" class="ml-1 text-xs text-muted-foreground">{{ detail.country.toUpperCase() }}</span>
          </div>
          <button type="button" class="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close" @click="emit('close')"><X :size="18" aria-hidden="true" /></button>
        </header>

        <div class="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Loading chat…
          </div>
          <div v-else-if="error" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
            {{ error }}
            <button type="button" class="font-medium text-foreground underline underline-offset-2" @click="load">Try again</button>
          </div>
          <template v-else-if="detail">
            <!-- user prompt bubble -->
            <div class="mb-5 flex justify-end">
              <div class="max-w-[80%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground" v-html="highlight(detail.prompt)"></div>
            </div>
            <!-- legend: the tracked brand's swatch, then a mini-stack of
                 the first competitor colors — the full per-brand key is
                 the color-matched Brands list in the Details panel. -->
            <div class="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5"><span class="cdm-swatch cdm-mark--own size-2.5 rounded-sm"></span>{{ detail.brand }}</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="flex">
                  <span class="cdm-swatch cdm-mark--c0 size-2.5 rounded-sm"></span>
                  <span class="cdm-swatch cdm-mark--c1 -ml-0.5 size-2.5 rounded-sm"></span>
                  <span class="cdm-swatch cdm-mark--c2 -ml-0.5 size-2.5 rounded-sm"></span>
                </span>
                Competitors — one color per brand
              </span>
            </div>
            <!-- response -->
            <div class="whitespace-pre-wrap text-sm leading-relaxed text-foreground" v-html="detail.response_text ? highlight(detail.response_text) : 'No response text captured.'"></div>
          </template>
        </div>

        <!-- Only callers that pass a list of answers can step through it. -->
        <footer v-if="hasPrev || hasNext" class="flex items-center justify-between border-t border-border px-5 py-3">
          <button type="button" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="!hasPrev" @click="emit('prev')"><ArrowLeft :size="15" aria-hidden="true" /> Previous</button>
          <button type="button" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="!hasNext" @click="emit('next')">Next <ArrowRight :size="15" aria-hidden="true" /></button>
        </footer>
      </div>

      <!-- Details panel -->
      <aside class="hidden w-80 shrink-0 overflow-y-auto overscroll-contain border-l border-border bg-background px-5 py-4 md:block">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-foreground">Details</h3>
        </div>

        <template v-if="detail">
          <!-- Brands (ordered by the rank the model returned) -->
          <div class="mb-5">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brands</div>
            <div v-for="(b, i) in brandRows" :key="i"
              class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
              :class="b.name === detail.brand ? 'bg-secondary' : ''">
              <span class="flex min-w-0 items-center gap-2">
                <BrandLogo :name="b.name" :domain="b.domain" :size="20" />
                <!-- Same mark styling as the mentions in the answer, so
                     color alone says which highlight is which brand. -->
                <span class="cdm-mark truncate" :class="brandMarkClass(b.name)">{{ b.name }}</span>
                <span v-if="b.name === detail.brand"
                  class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">you</span>
              </span>
              <span class="shrink-0 text-xs font-medium text-muted-foreground">
                {{ b.position != null ? '#' + b.position : '—' }}
              </span>
            </div>
            <div v-if="!brandRows.length" class="text-xs text-muted-foreground">No brands detected.</div>
          </div>

          <!-- Generic terms the answer highlighted: context, not competitors -->
          <div v-if="infoRows.length" class="mb-5">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Information</div>
            <div class="flex flex-wrap gap-1.5 px-2">
              <span v-for="(b, i) in infoRows" :key="i"
                class="cdm-mark cdm-mark--info text-sm">{{ b.name }}</span>
            </div>
            <p class="mt-2 px-2 text-[11px] leading-snug text-muted-foreground">
              Topics and product terms the answer mentions — not brands, so
              they don't count toward competitor rankings.
            </p>
          </div>

          <!-- Similar queries (backend name: fanout) -->
          <div v-if="detail.fanout_queries?.length" class="mb-5">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Similar queries</div>
            <p class="text-sm leading-relaxed text-foreground">{{ detail.fanout_queries.join('  ·  ') }}</p>
          </div>

          <!-- Sources -->
          <div class="mb-5">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</div>
            <a v-for="(s, i) in detail.sources" :key="i" :href="safeHref(s.url)" target="_blank" rel="noopener"
              class="mb-2 flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-secondary">
              <img :src="faviconFor(s.apex_domain)" alt="" class="mt-0.5 size-4 shrink-0 rounded-sm" @error="onFaviconError" />
              <span class="min-w-0">
                <span class="block truncate text-sm text-foreground">{{ s.title }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ s.apex_domain }}</span>
              </span>
              <ExternalLink :size="12" class="ml-auto mt-1 shrink-0 text-muted-foreground" />
            </a>
            <div v-if="!detail.sources.length" class="text-xs text-muted-foreground">No sources cited.</div>
          </div>

          <!-- Brand alignment: how closely this answer reflects the
               brand's own material -->
          <div>
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brand alignment</div>
            <template v-if="detail.alignment && detail.alignment.status === 'scored'">
              <div class="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold"
                :class="alignmentBandClass(detail.alignment.score)">
                {{ Math.round(detail.alignment.score) }} / 100
              </div>
              <div v-if="detail.alignment.reflected?.length" class="mb-2">
                <div class="mb-1 text-[11px] font-semibold text-muted-foreground">Messages reflected</div>
                <p v-for="(m, i) in detail.alignment.reflected" :key="'r' + i"
                  class="mb-1 text-xs leading-relaxed text-foreground/90">{{ m.text }}</p>
              </div>
              <div v-if="detail.alignment.missing?.length" class="mb-2">
                <div class="mb-1 text-[11px] font-semibold text-muted-foreground">Messages missing</div>
                <p v-for="(m, i) in detail.alignment.missing" :key="'m' + i"
                  class="mb-1 text-xs leading-relaxed text-muted-foreground">{{ m.text }}</p>
              </div>
              <div v-if="detail.alignment.unsupported?.length">
                <div class="mb-1 text-[11px] font-semibold text-muted-foreground">Claims not backed by your material</div>
                <p v-for="(m, i) in detail.alignment.unsupported" :key="'u' + i"
                  class="mb-1 text-xs italic leading-relaxed text-foreground/80">{{ m.text }}</p>
              </div>
            </template>
            <p v-else-if="detail.alignment && detail.alignment.status === 'no_brand_input'"
              class="text-xs leading-relaxed text-muted-foreground">
              <router-link :to="{ name: 'settings-brand-facts' }"
                class="font-medium text-foreground hover:underline">Add brand facts in Settings</router-link>
              to compare this answer with your own material.
            </p>
            <p v-else-if="detail.alignment && detail.alignment.status === 'no_brand_claims'"
              class="text-xs leading-relaxed text-muted-foreground">
              This answer never talks about your brand, so there is nothing to benchmark.
            </p>
            <p v-else-if="detail.alignment && detail.alignment.status === 'embeddings_unavailable'"
              class="text-xs leading-relaxed text-muted-foreground">
              Alignment scoring isn't available yet.
            </p>
            <p v-else class="text-xs text-muted-foreground">Not analyzed yet.</p>
          </div>
        </template>
      </aside>
    </div>
  </div>
  </Teleport>
</template>

<!-- Unscoped on purpose: the marks are injected via v-html, which scoped
     CSS cannot reach. Everything is prefixed cdm- to stay collision-free.
     Each color class carries --cdm-a, the opaque variant used by the
     legend swatches; the mark itself uses the translucent background.
     Dark values are tuned for the pure-black theme. -->
<style>
.cdm-mark {
  padding: 0 2px;
  border-radius: 3px;
  font-weight: 600;
}
.cdm-mark--own { --cdm-a: rgba(34, 197, 94, 0.55);  background: rgba(34, 197, 94, 0.18);  color: #15803d; }
.cdm-mark--c0  { --cdm-a: rgba(245, 158, 11, 0.60); background: rgba(245, 158, 11, 0.18); color: #b45309; }
.cdm-mark--c1  { --cdm-a: rgba(139, 92, 246, 0.55); background: rgba(139, 92, 246, 0.16); color: #6d28d9; }
.cdm-mark--c2  { --cdm-a: rgba(14, 165, 233, 0.55); background: rgba(14, 165, 233, 0.16); color: #0369a1; }
.cdm-mark--c3  { --cdm-a: rgba(244, 63, 94, 0.50);  background: rgba(244, 63, 94, 0.14);  color: #be123c; }
.cdm-mark--c4  { --cdm-a: rgba(20, 184, 166, 0.55); background: rgba(20, 184, 166, 0.16); color: #0f766e; }
.cdm-mark--c5  { --cdm-a: rgba(99, 102, 241, 0.55); background: rgba(99, 102, 241, 0.16); color: #4338ca; }
.cdm-mark--c6  { --cdm-a: rgba(249, 115, 22, 0.55); background: rgba(249, 115, 22, 0.16); color: #c2410c; }
.cdm-mark--c7  { --cdm-a: rgba(217, 70, 239, 0.50); background: rgba(217, 70, 239, 0.14); color: #a21caf; }
/* Informational terms: neutral dotted underline, no colored fill — they
   must never read as competitor brands. */
.cdm-mark--info {
  --cdm-a: rgba(113, 113, 122, 0.6);
  background: transparent;
  border-bottom: 1px dotted rgba(113, 113, 122, 0.75);
  border-radius: 0;
  color: #52525b;
  font-weight: 500;
}

[data-theme='dark'] .cdm-mark--own { background: rgba(34, 197, 94, 0.24);  color: #86efac; }
[data-theme='dark'] .cdm-mark--c0  { background: rgba(245, 158, 11, 0.24); color: #fcd34d; }
[data-theme='dark'] .cdm-mark--c1  { background: rgba(139, 92, 246, 0.26); color: #c4b5fd; }
[data-theme='dark'] .cdm-mark--c2  { background: rgba(14, 165, 233, 0.24); color: #7dd3fc; }
[data-theme='dark'] .cdm-mark--c3  { background: rgba(244, 63, 94, 0.24);  color: #fda4af; }
[data-theme='dark'] .cdm-mark--c4  { background: rgba(20, 184, 166, 0.24); color: #5eead4; }
[data-theme='dark'] .cdm-mark--c5  { background: rgba(99, 102, 241, 0.26); color: #a5b4fc; }
[data-theme='dark'] .cdm-mark--c6  { background: rgba(249, 115, 22, 0.24); color: #fdba74; }
[data-theme='dark'] .cdm-mark--c7  { background: rgba(217, 70, 239, 0.24); color: #f0abfc; }
[data-theme='dark'] .cdm-mark--info {
  background: transparent;
  border-bottom-color: rgba(161, 161, 170, 0.6);
  color: #a1a1aa;
}

/* Legend swatches: solid version of the same palette. Declared last so
   its background wins over the color classes at equal specificity; the
   dark-scoped rule matches the dark overrides' higher specificity. */
.cdm-swatch {
  display: inline-block;
  background: var(--cdm-a);
}
[data-theme='dark'] .cdm-swatch {
  background: var(--cdm-a);
}
</style>
