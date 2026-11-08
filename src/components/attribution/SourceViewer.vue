<script setup>
// The source viewer (attribution_contract.md 2 and 3): the page a finding
// points to, in reader view, with the cited passage highlighted and
// scrolled into view. Opens over the chat viewer as a side panel; Escape or
// the close button returns to the answer.
//
// Page text is untrusted: every block renders as text nodes, never v-html.
// When the page could not be read (page_anchor is null), the viewer shows
// the passage the engine cited instead.
import { computed, nextTick, ref, useId, watch } from 'vue'
import { ExternalLink, Loader2, RefreshCw, X } from '@lucide/vue'
import citationsApi from '@/api/citations'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { locatePassage, readerBlocks } from '@/lib/attribution/reader'
import { confidenceMeta, sourceStyle } from '@/lib/attribution/sourceTypes'
import { textFragmentUrl } from '@/lib/attribution/textFragment'
import PassageMark from './PassageMark.vue'
import './attribution.css'

const props = defineProps({
  websiteId: { type: String, required: true },
  finding: { type: Object, required: true },
  // The finding's number in the answer.
  number: { type: Number, default: 0 },
  engineLabel: { type: String, default: 'The AI engine' },
})
const emit = defineEmits(['close'])

const source = computed(() => props.finding.source || {})
const style = computed(() => sourceStyle(source.value))
const confidence = computed(() => confidenceMeta(props.finding.confidence))
const originalHref = computed(() =>
  textFragmentUrl(source.value.final_url || source.value.url, props.finding.page_quote),
)

const snapshot = ref(null)
const loading = ref(false)
const loadError = ref('')

// Without an anchor the page could not be read: there is nothing to fetch.
const readable = computed(() => props.finding.page_anchor != null)
const passage = computed(() =>
  snapshot.value ? locatePassage(snapshot.value.blocks, props.finding.page_anchor, props.finding.page_quote) : null,
)
const blocks = computed(() => readerBlocks(snapshot.value?.blocks, passage.value))
const title = computed(() => snapshot.value?.title || source.value.title || source.value.domain || 'Source page')
const capturedAt = computed(() => {
  const t = snapshot.value?.captured_at ? new Date(snapshot.value.captured_at) : null
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''
})

const bodyRef = ref(null)

async function revealPassage() {
  await nextTick()
  const mark = bodyRef.value?.querySelector('[data-passage]')
  if (mark && typeof mark.scrollIntoView === 'function') mark.scrollIntoView({ block: 'center' })
}

let request = 0
async function load() {
  const id = ++request
  snapshot.value = null
  loadError.value = ''
  if (!readable.value || !source.value.url) return
  loading.value = true
  try {
    const res = await citationsApi.pageSnapshot(props.websiteId, source.value.url)
    if (id !== request) return
    snapshot.value = res?.data || null
    revealPassage()
  } catch (error) {
    if (id !== request) return
    loadError.value =
      error?.response?.status === 404 ? "This page isn't available to view here." : "We couldn't load this page."
  } finally {
    if (id === request) loading.value = false
  }
}

watch(() => [props.finding.id, source.value.url], load, { immediate: true })

// A dialog over the chat viewer: focus moves in and is trapped here, and
// Escape closes this panel only.
const rootRef = ref(null)
const titleId = useId()
useDialogFocus(rootRef, () => true, { onEscape: () => emit('close') })

const HEADING_TAGS = ['h4', 'h4', 'h5', 'h5', 'h6', 'h6']
const headingTag = (level) => HEADING_TAGS[(level || 2) - 1] || 'h5'
</script>

<template>
  <section
    ref="rootRef"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    tabindex="-1"
    class="sv-panel"
  >
    <header class="sv-head">
      <div class="min-w-0 flex-1">
        <div class="sv-kind">
          <span v-if="number" class="sv-num" :class="style.ownerClass">{{ number }}</span>
          <component :is="style.icon" :size="14" aria-hidden="true" />
          <span>{{ style.label }}</span>
          <span class="att-owner" :class="style.ownerClass">{{ style.ownerLabel }}</span>
          <span class="att-conf" :class="confidence.className" :title="confidence.hint">{{ confidence.label }}</span>
        </div>
        <h3 :id="titleId" class="sv-title">{{ title }}</h3>
        <div class="sv-sub">
          <span v-if="source.domain">{{ source.domain }}</span>
          <span v-if="capturedAt"> · Read {{ capturedAt }}</span>
        </div>
      </div>
      <div class="sv-actions">
        <a
          v-if="originalHref"
          :href="originalHref"
          target="_blank"
          rel="noopener noreferrer"
          class="sv-btn"
        >Open original <ExternalLink :size="13" aria-hidden="true" /></a>
        <button type="button" class="sv-icon-btn" aria-label="Close source" @click="emit('close')">
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div ref="bodyRef" class="sv-body" data-dialog-body>
      <p v-if="finding.reason" class="sv-reason">{{ finding.reason }}</p>

      <p v-if="loading" class="sv-note" role="status">
        <Loader2 :size="14" class="animate-spin" aria-hidden="true" /> Loading the page
      </p>

      <!-- No reader view: the page could not be read, failed to load, or
           no longer contains the passage. Show what the engine cited. -->
      <template v-else-if="!snapshot || !passage">
        <div class="sv-note" :role="loadError ? 'alert' : undefined">
          <span v-if="!readable">
            We couldn't read this page, so this is the passage {{ engineLabel }} cited.
          </span>
          <span v-else-if="loadError">{{ loadError }}</span>
          <span v-else>We couldn't find this passage on the page as we last read it.</span>
          <button v-if="loadError" type="button" class="sv-retry" @click="load">
            <RefreshCw :size="13" aria-hidden="true" /> Try again
          </button>
        </div>
        <blockquote v-if="finding.page_quote" class="sv-cited">
          <PassageMark :finding="finding" :engine-label="engineLabel">{{ finding.page_quote }}</PassageMark>
        </blockquote>
        <p v-else-if="!readable" class="sv-note">The engine did not quote the page either. Open the original to read it.</p>
      </template>

      <article v-if="snapshot && !loading" class="sv-reader" :aria-label="`Reader view of ${title}`">
        <template v-for="b in blocks" :key="b.key">
          <component :is="headingTag(b.level)" v-if="b.type === 'heading'" class="sv-h">
            <template v-for="(p, i) in b.parts" :key="i">
              <PassageMark v-if="p.mark" :finding="finding" :engine-label="engineLabel">{{ p.text }}</PassageMark>
              <template v-else>{{ p.text }}</template>
            </template>
          </component>
          <component :is="b.type === 'quote' ? 'blockquote' : 'p'" v-else-if="b.type === 'paragraph' || b.type === 'quote'" :class="b.type === 'quote' ? 'sv-q' : 'sv-p'">
            <template v-for="(p, i) in b.parts" :key="i">
              <PassageMark v-if="p.mark" :finding="finding" :engine-label="engineLabel">{{ p.text }}</PassageMark>
              <template v-else>{{ p.text }}</template>
            </template>
          </component>
          <pre v-else-if="b.type === 'code'" class="sv-code"><code><template v-for="(p, i) in b.parts" :key="i"><PassageMark v-if="p.mark" :finding="finding" :engine-label="engineLabel">{{ p.text }}</PassageMark><template v-else>{{ p.text }}</template></template></code></pre>
          <component :is="b.ordered ? 'ol' : 'ul'" v-else-if="b.type === 'list'" :class="b.ordered ? 'sv-ol' : 'sv-ul'">
            <li v-for="(parts, j) in b.items" :key="j">
              <template v-for="(p, i) in parts" :key="i">
                <PassageMark v-if="p.mark" :finding="finding" :engine-label="engineLabel">{{ p.text }}</PassageMark>
                <template v-else>{{ p.text }}</template>
              </template>
            </li>
          </component>
          <div v-else-if="b.type === 'table'" class="sv-table-wrap">
            <table class="sv-table">
              <tbody>
                <tr v-for="(row, r) in b.rows" :key="r">
                  <td v-for="(cell, c) in row" :key="c">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p v-if="!blocks.length" class="sv-note">This page has no readable text.</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.sv-panel {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 20;
  display: flex;
  width: 100%;
  max-width: 36rem;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--card);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.12);
  outline: none;
}
.sv-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-bottom: 1px solid var(--border);
  padding: 0.75rem 1.25rem;
}
.sv-kind {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.sv-num {
  display: inline-flex;
  width: 1.125rem;
  height: 1.125rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--att-c);
  background: color-mix(in srgb, var(--att-c) 14%, transparent);
}
.sv-title {
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--foreground);
}
.sv-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.sv-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
}
.sv-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--foreground);
}
.sv-btn:hover {
  background: var(--secondary);
}
.sv-icon-btn {
  border-radius: 0.375rem;
  color: var(--muted-foreground);
}
.sv-icon-btn:hover {
  color: var(--foreground);
}
.sv-btn:focus-visible,
.sv-icon-btn:focus-visible,
.sv-retry:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.sv-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1.25rem 1.5rem 2rem;
}
.sv-reason {
  margin-bottom: 1rem;
  border-radius: 0.625rem;
  background: var(--secondary);
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--foreground);
}
.sv-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.sv-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.sv-cited {
  margin-bottom: 1.25rem;
  border-left: 3px solid var(--border);
  padding-left: 0.875rem;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--foreground);
}
.sv-reader {
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--foreground);
  overflow-wrap: anywhere;
}
.sv-h {
  margin: 1.25rem 0 0.5rem;
  font-weight: 600;
  line-height: 1.35;
}
h4.sv-h {
  font-size: 1.0625rem;
}
h5.sv-h {
  font-size: 0.9375rem;
}
h6.sv-h {
  font-size: 0.875rem;
}
.sv-p {
  margin: 0 0 0.75rem;
}
.sv-q {
  margin: 0 0 0.75rem;
  border-left: 3px solid var(--border);
  padding-left: 0.875rem;
  color: var(--muted-foreground);
}
.sv-code {
  margin: 0 0 0.75rem;
  overflow-x: auto;
  border-radius: 0.5rem;
  background: var(--secondary);
  padding: 0.625rem 0.75rem;
  font-size: 0.75rem;
  white-space: pre-wrap;
}
.sv-ul,
.sv-ol {
  margin: 0 0 0.75rem 1.25rem;
}
.sv-ul {
  list-style: disc;
}
.sv-ol {
  list-style: decimal;
}
.sv-table-wrap {
  margin: 0 0 0.75rem;
  overflow-x: auto;
}
.sv-table {
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.sv-table td {
  border: 1px solid var(--border);
  padding: 0.25rem 0.5rem;
  vertical-align: top;
}
</style>
