<template>
  <section class="ag-facts" :class="{ 'is-collapsed': !open }" :aria-labelledby="titleId">
    <button
      type="button"
      class="ag-facts-toggle"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="bodyId"
      :title="open ? 'Hide SEO facts' : 'Show SEO facts'"
      @click="emit('toggle')"
    >
      <ListChecks class="ag-facts-icon" :size="16" aria-hidden="true" />
      <span :id="titleId" class="ag-facts-title">SEO facts</span>
      <ChevronDown class="ag-facts-chevron" :size="14" aria-hidden="true" />
    </button>

    <div v-show="open" :id="bodyId" class="ag-facts-body">
      <dl class="ag-facts-list">
        <div class="ag-fact">
          <dt>
            Title
            <span class="ag-fact-meta ag-tnum">{{ countLabel(seo.title_length, seo.title) }}</span>
            <HelpTip v-if="titleFlag" :text="titleFlag.hint">
              <span class="ag-fact-flag" :class="titleFlag.tone">{{ titleFlag.label }}</span>
            </HelpTip>
          </dt>
          <dd :class="{ 'is-empty': !seo.title }">{{ seo.title || 'Missing' }}</dd>
        </div>

        <div class="ag-fact">
          <dt>
            Meta description
            <span class="ag-fact-meta ag-tnum">{{ countLabel(seo.meta_description_length, seo.meta_description) }}</span>
            <HelpTip v-if="descriptionFlag" :text="descriptionFlag.hint">
              <span class="ag-fact-flag" :class="descriptionFlag.tone">{{ descriptionFlag.label }}</span>
            </HelpTip>
          </dt>
          <dd :class="{ 'is-empty': !seo.meta_description }">{{ seo.meta_description || 'Missing' }}</dd>
        </div>

        <div class="ag-fact">
          <dt>
            Canonical
            <HelpTip v-if="canonicalElsewhere" text="The canonical URL is not this page's address.">
              <span class="ag-fact-flag is-info">Points elsewhere</span>
            </HelpTip>
          </dt>
          <dd :class="{ 'is-empty': !seo.canonical }" class="is-url">{{ seo.canonical || 'Not set' }}</dd>
        </div>

        <div class="ag-fact">
          <dt>
            Robots
            <HelpTip v-if="noindex" text="This page asks search engines not to index it.">
              <span class="ag-fact-flag is-danger">noindex</span>
            </HelpTip>
          </dt>
          <dd :class="{ 'is-empty': !seo.robots }">{{ seo.robots || 'Not set' }}</dd>
        </div>

        <div v-if="seo.lang !== undefined" class="ag-fact">
          <dt>Language</dt>
          <dd :class="{ 'is-empty': !seo.lang }">{{ seo.lang || 'Not set' }}</dd>
        </div>

        <div class="ag-fact">
          <dt>
            H1
            <span class="ag-fact-meta ag-tnum">{{ h1.length }}</span>
            <span v-if="!h1.length" class="ag-fact-flag is-warning">Missing</span>
          </dt>
          <dd v-if="h1.length">
            <ul class="ag-fact-items">
              <li v-for="(h, i) in h1" :key="i">{{ h }}</li>
            </ul>
          </dd>
          <dd v-else class="is-empty">None</dd>
        </div>

        <div class="ag-fact">
          <dt>
            H2
            <span class="ag-fact-meta ag-tnum">{{ h2.length }}{{ h2.length >= 20 ? '+' : '' }}</span>
          </dt>
          <dd v-if="h2.length">
            <ul class="ag-fact-items">
              <li v-for="(h, i) in h2" :key="i">{{ h }}</li>
            </ul>
          </dd>
          <dd v-else class="is-empty">None</dd>
        </div>

        <div class="ag-fact is-inline">
          <dt>Words</dt>
          <dd class="ag-tnum">{{ numberOr(seo.word_count) }}</dd>
        </div>

        <div class="ag-fact is-inline">
          <dt>Links</dt>
          <dd class="ag-tnum">{{ linksLabel }}</dd>
        </div>

        <div class="ag-fact is-inline">
          <dt>
            Images
            <span v-if="missingAlt > 0" class="ag-fact-flag is-warning ag-tnum">{{ missingAlt }} missing alt</span>
          </dt>
          <dd class="ag-tnum">{{ numberOr(seo.images && seo.images.count) }}</dd>
        </div>

        <div class="ag-fact">
          <dt>Structured data</dt>
          <dd v-if="structured.length" class="ag-fact-chips">
            <span v-for="type in structured" :key="type" class="ag-fact-chip">{{ type }}</span>
          </dd>
          <dd v-else class="is-empty">None found</dd>
        </div>

        <div class="ag-fact">
          <dt>Open Graph</dt>
          <dd v-if="hasOpenGraph">
            <p v-if="og.title" class="ag-fact-line"><span>Title</span>{{ og.title }}</p>
            <p v-if="og.description" class="ag-fact-line"><span>Description</span>{{ og.description }}</p>
            <p v-if="og.image" class="ag-fact-line is-url"><span>Image</span>{{ og.image }}</p>
          </dd>
          <dd v-else class="is-empty">Not set</dd>
        </div>

        <div class="ag-fact">
          <dt>
            Hreflang
            <span v-if="hreflang.length" class="ag-fact-meta ag-tnum">{{ hreflang.length }}</span>
          </dt>
          <dd v-if="hreflang.length">
            <ul class="ag-fact-items">
              <li v-for="(alt, i) in hreflang" :key="i" class="is-url">
                <span class="ag-fact-lang">{{ alt.lang }}</span>{{ alt.url }}
              </li>
            </ul>
          </dd>
          <dd v-else class="is-empty">None</dd>
        </div>

        <div v-if="responseLabel" class="ag-fact is-inline">
          <dt>Response</dt>
          <dd class="ag-tnum">{{ responseLabel }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'
import { ChevronDown, ListChecks } from '@lucide/vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { formatBytes, formatMs, formatNumber } from '../format'

const props = defineProps({
  seo: { type: Object, required: true },
  statusCode: { type: [Number, String], default: null },
  pageUrl: { type: String, default: '' },
  open: { type: Boolean, default: true },
})

const emit = defineEmits(['toggle'])

const uid = useId()
const titleId = `ag-facts-title-${uid}`
const bodyId = `ag-facts-body-${uid}`

const list = (value) => (Array.isArray(value) ? value : [])

const h1 = computed(() => list(props.seo.h1).filter((h) => typeof h === 'string'))
const h2 = computed(() => list(props.seo.h2).filter((h) => typeof h === 'string').slice(0, 20))
const structured = computed(() => [...new Set(list(props.seo.structured_data).filter((t) => typeof t === 'string'))])
const og = computed(() => props.seo.open_graph || {})
const hasOpenGraph = computed(() => Boolean(og.value.title || og.value.description || og.value.image))
const hreflang = computed(() => list(props.seo.hreflang).filter((h) => h && (h.lang || h.url)))
const missingAlt = computed(() => Number(props.seo.images?.missing_alt) || 0)
const noindex = computed(() => /\bnoindex\b/i.test(String(props.seo.robots || '')))

function lengthOf(n, text) {
  const value = Number(n)
  if (Number.isFinite(value)) return value
  return typeof text === 'string' ? Array.from(text).length : 0
}

function countLabel(n, text) {
  if (!text) return ''
  const value = lengthOf(n, text)
  return `${value} ${value === 1 ? 'character' : 'characters'}`
}

const titleFlag = computed(() => {
  if (!props.seo.title) return { label: 'Missing', tone: 'is-danger', hint: 'The page has no title tag.' }
  if (lengthOf(props.seo.title_length, props.seo.title) > 60) {
    return { label: 'Long', tone: 'is-warning', hint: 'Google usually shows about 50 to 60 characters of a title.' }
  }
  return null
})

const descriptionFlag = computed(() => {
  const text = props.seo.meta_description
  if (!text) return { label: 'Missing', tone: 'is-warning', hint: 'Without one, Google writes its own snippet.' }
  const n = lengthOf(props.seo.meta_description_length, text)
  if (n > 160) return { label: 'Long', tone: 'is-warning', hint: 'Google usually shows up to about 160 characters.' }
  if (n < 70) return { label: 'Short', tone: 'is-info', hint: 'Short descriptions are often replaced by Google.' }
  return null
})

function comparable(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`
  } catch {
    return String(url || '')
  }
}

const canonicalElsewhere = computed(
  () => Boolean(props.seo.canonical && props.pageUrl) && comparable(props.seo.canonical) !== comparable(props.pageUrl)
)

function numberOr(value) {
  const text = formatNumber(value)
  return text || 'Not measured'
}

const linksLabel = computed(() => {
  const links = props.seo.links || {}
  const internal = formatNumber(links.internal)
  const external = formatNumber(links.external)
  if (!internal && !external) return 'Not measured'
  return `${internal || 0} internal · ${external || 0} external`
})

const responseLabel = computed(() =>
  [props.statusCode ? `HTTP ${props.statusCode}` : '', formatBytes(props.seo.bytes), formatMs(props.seo.fetch_ms)]
    .filter(Boolean)
    .join(' · ')
)
</script>

<style scoped>
.ag-facts {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  color: var(--ag-fg-1);
}

.ag-facts-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 0;
  border-bottom: 1px solid var(--ag-divider-subtle);
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.ag-facts-toggle:hover {
  background: var(--ag-ghost-hover);
}

.ag-facts-toggle:focus-visible {
  border-radius: 0;
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-facts-icon {
  flex-shrink: 0;
  color: var(--ag-fg-2);
}

.ag-facts-title {
  flex: 1 1 auto;
}

.ag-facts-chevron {
  flex-shrink: 0;
  color: var(--ag-fg-chevron);
  transition: transform 160ms var(--ag-ease);
}

.ag-facts.is-collapsed .ag-facts-chevron {
  transform: rotate(180deg);
}

.ag-facts.is-collapsed .ag-facts-toggle {
  border-bottom: 0;
}

.ag-facts-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ag-facts-list {
  margin: 0;
  padding: 4px 14px 16px;
}

.ag-fact {
  padding: 10px 0;
  border-bottom: 1px solid var(--ag-divider-subtle);
}

.ag-fact:last-child {
  border-bottom: 0;
}

.ag-fact dt {
  --cs-helptip-decoration: none;
  --cs-helptip-radius: var(--radius);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-fact dd {
  margin: 4px 0 0;
  color: var(--ag-fg-1b);
  font-size: 13px;
  line-height: 19px;
  overflow-wrap: anywhere;
}

.ag-fact.is-inline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ag-fact.is-inline dd {
  margin: 0;
  text-align: right;
}

.ag-fact dd.is-empty {
  color: var(--ag-fg-3);
}

.is-url {
  color: var(--ag-fg-2);
  font-size: 12px;
}

.ag-fact-meta {
  color: var(--ag-fg-4);
  font-weight: 400;
}

.ag-fact-flag {
  padding: 0 6px;
  border-radius: var(--radius);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.ag-fact-flag.is-danger {
  background: var(--ag-danger-bg);
  color: var(--ag-danger);
}

.ag-fact-flag.is-warning {
  background: color-mix(in srgb, var(--ag-warning) 12%, transparent);
  color: var(--ag-warning);
}

.ag-fact-flag.is-info {
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
}

.ag-fact-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-fact-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ag-fact-chip {
  padding: 1px 7px;
  border: 1px solid var(--ag-tab-border);
  border-radius: var(--radius);
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-fact-line {
  margin: 0;
}

.ag-fact-line + .ag-fact-line {
  margin-top: 4px;
}

.ag-fact-line > span,
.ag-fact-lang {
  display: inline-block;
  min-width: 0;
  margin-right: 6px;
  color: var(--ag-fg-3);
  font-family: var(--ag-font);
  font-size: 12px;
}

/* Beside the page on wide panes, collapsed to an icon rail. */
@container ag-page (min-width: 720px) {
  .ag-facts.is-collapsed .ag-facts-toggle {
    justify-content: center;
    width: 44px;
    padding: 0;
  }

  .ag-facts.is-collapsed :is(.ag-facts-title, .ag-facts-chevron) {
    display: none;
  }

  .ag-facts-chevron {
    transform: rotate(-90deg);
  }

  .ag-facts.is-collapsed .ag-facts-chevron {
    transform: rotate(90deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ag-facts-chevron {
    transition: none;
  }
}
</style>
