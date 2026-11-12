<template>
  <article ref="root" class="ag-reader" :aria-label="title ? `Reader view: ${title}` : 'Reader view'">
    <header v-if="title || sourceLabel" class="ag-rd-head">
      <h1 v-if="showTitle" class="ag-rd-title">
        <HighlightedText :text="title" :segments="marked?.title" :current="current" />
      </h1>
      <p v-if="sourceLabel" class="ag-rd-source">{{ sourceLabel }}</p>
    </header>

    <template v-for="(block, i) in blocks" :key="i">
      <component
        :is="headingTag(block.level)"
        v-if="block.type === 'heading'"
        class="ag-rd-heading"
        :class="`is-l${headingLevel(block.level)}`"
      >
        <HighlightedText :text="textOf(block)" :segments="marked?.blocks[i]?.text" :current="current" />
      </component>
      <p v-else-if="block.type === 'paragraph'" class="ag-rd-p">
        <HighlightedText :text="textOf(block)" :segments="marked?.blocks[i]?.text" :current="current" />
      </p>
      <ol v-else-if="block.type === 'list' && block.ordered" class="ag-rd-list">
        <li v-for="(item, j) in listItems(block)" :key="j">
          <HighlightedText :text="item" :segments="marked?.blocks[i]?.items?.[j]" :current="current" />
        </li>
      </ol>
      <ul v-else-if="block.type === 'list'" class="ag-rd-list">
        <li v-for="(item, j) in listItems(block)" :key="j">
          <HighlightedText :text="item" :segments="marked?.blocks[i]?.items?.[j]" :current="current" />
        </li>
      </ul>
      <blockquote v-else-if="block.type === 'quote'" class="ag-rd-quote">
        <HighlightedText :text="textOf(block)" :segments="marked?.blocks[i]?.text" :current="current" />
      </blockquote>
      <pre
        v-else-if="block.type === 'code'"
        class="ag-rd-code"
      ><code><HighlightedText :text="textOf(block)" :segments="marked?.blocks[i]?.text" :current="current" /></code></pre>
      <div v-else-if="block.type === 'table' && tableRows(block).length" class="ag-rd-table">
        <table>
          <tbody>
            <tr v-for="(row, r) in tableRows(block)" :key="r">
              <template v-for="(cell, c) in row" :key="c">
                <th v-if="r === 0 && tableRows(block).length > 1" scope="col">
                  <HighlightedText :text="cell" :segments="marked?.blocks[i]?.rows?.[r]?.[c]" :current="current" />
                </th>
                <td v-else>
                  <HighlightedText :text="cell" :segments="marked?.blocks[i]?.rows?.[r]?.[c]" :current="current" />
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p v-if="!blocks.length" class="ag-rd-empty">No readable text was found on this page.</p>

    <section v-if="links.length" class="ag-rd-links" aria-labelledby="ag-rd-links-title">
      <h2 id="ag-rd-links-title" class="ag-rd-links-title">Links on this page</h2>
      <ul>
        <li v-for="(link, i) in links" :key="`${i}-${link.url}`">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="ag-rd-link"
            @click="onLinkClick($event, link.url)"
          >
            <HighlightedText :text="link.text" :segments="marked?.links[i]" :current="current" />
          </a>
          <span class="ag-rd-link-host">{{ link.host }}</span>
        </li>
      </ul>
    </section>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { createMarker } from '@/lib/agent/highlight'
import { displayUrl, hostOf, resolveHref } from '@/lib/agent/url'
import HighlightedText from '../HighlightedText.js'

// Renders captured page text as Vue elements only: every string is a text
// node, so markup inside the captured page can never become live HTML.
// Highlighting keeps that contract: it only splits strings into more text
// nodes, some of them inside <mark>.

const props = defineProps({
  reader: { type: Object, default: null },
  baseUrl: { type: String, default: '' },
  sourceLabel: { type: String, default: '' },
  // Terms to mark, from lib/agent/highlight compileTerms; empty marks nothing.
  terms: { type: Array, default: () => [] },
  // The match next/previous points at, and a counter that changes on every
  // jump (the view scrolls the match into view then).
  current: { type: Number, default: -1 },
  navToken: { type: Number, default: 0 },
})

// matches: {count, total, capped}, whenever the marks change. count is what
// next/previous steps through; total counts every mark.
const emit = defineEmits(['navigate', 'matches'])

const root = ref(null)

const title = computed(() => (typeof props.reader?.title === 'string' ? props.reader.title.trim() : ''))

const blocks = computed(() =>
  Array.isArray(props.reader?.blocks) ? props.reader.blocks.filter((b) => b && typeof b === 'object') : []
)

// Skip the title when the page's first heading repeats it.
const showTitle = computed(() => {
  if (!title.value) return false
  const first = blocks.value.find((b) => b.type === 'heading')
  return !(first && String(first.text || '').trim() === title.value)
})

const links = computed(() => {
  const list = Array.isArray(props.reader?.links) ? props.reader.links : []
  const out = []
  for (const link of list) {
    const url = resolveHref(link?.href, props.baseUrl || undefined)
    if (!url) continue
    const text = String(link.text || '').trim() || displayUrl(url)
    out.push({ url, text, host: hostOf(url) })
  }
  return out
})

// Marks for every string the template renders, in reading order (title,
// blocks, links) so match indexes follow the page; null when no terms.
const marked = computed(() => {
  if (!props.terms.length) return null
  const marker = createMarker(props.terms)
  const titleMarks = showTitle.value ? marker.mark(title.value) : null
  const blockMarks = blocks.value.map((block) => {
    if (block.type === 'list') return { items: listItems(block).map((item) => marker.mark(item)) }
    if (block.type === 'table') {
      return { rows: tableRows(block).map((row) => row.map((cell) => marker.mark(cell))) }
    }
    return { text: marker.mark(textOf(block)) }
  })
  const linkMarks = links.value.map((link) => marker.mark(link.text))
  return {
    title: titleMarks,
    blocks: blockMarks,
    links: linkMarks,
    count: marker.count,
    total: marker.total,
    capped: marker.capped,
  }
})

watch(
  () => {
    const m = marked.value
    return m ? `${m.count}|${m.total}|${m.capped}` : ''
  },
  () => {
    const m = marked.value
    emit('matches', { count: m ? m.count : 0, total: m ? m.total : 0, capped: Boolean(m && m.capped) })
  },
  { immediate: true }
)

watch(
  () => props.navToken,
  () => {
    if (props.current < 0 || !root.value) return
    const el = root.value.querySelector(`mark[data-hl-index="${props.current}"]`)
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
  },
  { flush: 'post' }
)

function textOf(block) {
  return block.text === undefined || block.text === null ? '' : String(block.text)
}

function headingLevel(level) {
  const n = Number(level)
  return Number.isFinite(n) ? Math.min(6, Math.max(1, Math.round(n))) : 2
}

// The article title is the h1, so page headings sit one level below it.
function headingTag(level) {
  return `h${Math.min(6, headingLevel(level) + 1)}`
}

function listItems(block) {
  return Array.isArray(block.items) ? block.items.map((item) => String(item ?? '')) : []
}

function tableRows(block) {
  return Array.isArray(block.rows) ? block.rows.filter(Array.isArray).map((row) => row.map((c) => String(c ?? ''))) : []
}

function onLinkClick(event, url) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  emit('navigate', url)
}
</script>

<style scoped>
.ag-reader {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 28px 48px;
  color: var(--ag-fg-1);
  font-size: 16px;
  line-height: 26px;
  overflow-wrap: break-word;
}

.ag-rd-head {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

.ag-rd-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 34px;
}

.ag-rd-source {
  margin: 6px 0 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-rd-heading {
  margin: 28px 0 10px;
  color: var(--ag-fg-1);
  font-weight: 600;
}

.ag-rd-heading.is-l1 {
  font-size: 24px;
  line-height: 32px;
}

.ag-rd-heading.is-l2 {
  font-size: 20px;
  line-height: 28px;
}

.ag-rd-heading.is-l3 {
  font-size: 17px;
  line-height: 26px;
}

.ag-rd-heading:is(.is-l4, .is-l5, .is-l6) {
  font-size: 16px;
  line-height: 24px;
}

.ag-rd-p,
.ag-rd-list,
.ag-rd-quote,
.ag-rd-code,
.ag-rd-table {
  margin: 0 0 16px;
}

.ag-rd-list {
  padding-left: 22px;
}

ul.ag-rd-list {
  list-style: disc;
}

ol.ag-rd-list {
  list-style: decimal;
}

.ag-rd-list li::marker {
  color: var(--ag-fg-3);
}

.ag-rd-list li + li {
  margin-top: 4px;
}

.ag-rd-quote {
  padding-left: 14px;
  border-left: 2px solid var(--ag-divider);
  color: var(--ag-fg-2);
}

.ag-rd-code {
  overflow-x: auto;
  padding: 12px 14px;
  border: 1px solid var(--ag-code-border);
  border-radius: var(--radius);
  background: var(--ag-code-bg);
  font-family: var(--ag-font-mono);
  font-size: 13px;
  line-height: 20px;
  white-space: pre;
}

.ag-rd-table {
  overflow-x: auto;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.ag-rd-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 20px;
}

.ag-rd-table :is(th, td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  text-align: left;
  vertical-align: top;
}

.ag-rd-table th {
  background: var(--ag-code-bg);
  color: var(--ag-fg-2);
  font-weight: 500;
}

.ag-rd-table tr:last-child :is(th, td) {
  border-bottom: 0;
}

.ag-rd-empty {
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-rd-links {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--ag-divider-subtle);
}

.ag-rd-links-title {
  margin: 0 0 10px;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.ag-rd-links ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-rd-links li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 4px 0;
  font-size: 14px;
  line-height: 20px;
}

.ag-rd-link {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-serp-title);
  font-weight: 400;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-rd-link:hover {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-rd-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-rd-link-host {
  flex-shrink: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
}
</style>
