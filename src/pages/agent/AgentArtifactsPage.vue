<script setup>
// Reports, Documents and Sheets: the project's artifacts of the given kinds,
// searchable and filtered by review state. A row opens the artifact; "Open
// in chat" returns to the chat that made it with the artifact open in the
// browser pane. Reports also show the report template gallery first.
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronDown, MessageSquare } from '@lucide/vue'
import { useAgentStore } from '@/stores/agent'
import { useAppStore } from '@/stores/app'
import { kindMeta } from '@/lib/agent/agentsMeta'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import AgSearchField from '@/components/agent/common/AgSearchField.vue'
import { IconDocuments, IconReports, IconSheets } from '@/components/agent/icons'
import { errorMessage, relativeTime } from '@/components/agent/common/agentText'
import ReviewChip from '@/components/agent/review/ReviewChip.vue'
import ReportTemplateGallery from '@/components/agent/reports/ReportTemplateGallery.vue'
import { REVIEW_FILTERS, effectiveState } from '@/lib/agent/review'

const ROUTE_KINDS = {
  'agent-reports': ['report'],
  'agent-documents': ['document', 'page'],
  'agent-sheets': ['sheet'],
}

const SECTIONS = {
  report: {
    title: 'Reports',
    noun: 'reports',
    // A report keeps each engine's verdict on the brand, not the answer text.
    intro:
      'Research saved from chats. Each report keeps the Google results and the AI engine checks (named or not, rank, sentiment) it was written from.',
    empty: 'No reports yet.',
    emptyBody: 'Ask the agent to research a brand, then save the report.',
    agent: 'gap_analyst',
    cta: 'Research with the agent',
    icon: IconReports,
  },
  document: {
    title: 'Documents',
    noun: 'documents',
    intro: 'Articles and landing pages the agents wrote for this project.',
    empty: 'No documents yet.',
    emptyBody: 'Ask the agent for an article or a landing page; it lands here when the agent finishes.',
    agent: 'aeo_article',
    cta: 'Write with the agent',
    icon: IconDocuments,
  },
  sheet: {
    title: 'Sheets',
    noun: 'sheets',
    intro: 'Ad campaigns the agents built for this project, ready to export.',
    empty: 'No sheets yet.',
    emptyBody: 'Ask the agent to build an ad campaign; the sheet lands here when it finishes.',
    agent: 'ad_campaign',
    cta: 'Build a campaign',
    icon: IconSheets,
  },
}

const props = defineProps({
  kinds: { type: Array, default: null },
  websiteId: { type: String, default: null },
})

const route = useRoute()
const agent = useAgentStore()
const app = useAppStore()

const kindList = computed(() => {
  if (Array.isArray(props.kinds) && props.kinds.length) return [...props.kinds]
  return ROUTE_KINDS[route.name] || ['report']
})
const section = computed(() => {
  const kinds = kindList.value
  if (kinds.includes('report')) return SECTIONS.report
  if (kinds.includes('sheet')) return SECTIONS.sheet
  return SECTIONS.document
})
const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))
const isReports = computed(() => kindList.value.includes('report'))
// The project, for the template gallery's drafted request.
const website = computed(() => {
  const id = wid.value
  if (!id) return null
  const active = app.activeWebsite
  if (active && String(active.id) === id) return active
  return (app.websites || []).find((w) => String(w.id) === id) || null
})

const items = ref([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const searched = ref('')
// '' = All, else a review state (p2_contract.md 13a), on the effective state.
const reviewFilter = ref('')
let request = 0

const shown = computed(() =>
  reviewFilter.value ? items.value.filter((a) => effectiveState(a.review) === reviewFilter.value) : items.value,
)
const filterLabel = computed(() => REVIEW_FILTERS.find((f) => f.value === reviewFilter.value)?.label || '')

async function load(q = searched.value) {
  if (typeof agent.loadArtifacts !== 'function' || !wid.value) return
  const token = ++request
  loading.value = true
  error.value = ''
  try {
    const list = await agent.loadArtifacts(kindList.value, q)
    if (token !== request) return
    items.value = Array.isArray(list) ? list.filter((a) => a && a.id !== undefined && a.id !== null) : []
    searched.value = q
  } catch (err) {
    if (token !== request) return
    error.value = errorMessage(err, `Couldn't load ${section.value.noun}.`)
  } finally {
    if (token === request) loading.value = false
  }
}

watch(
  () => [wid.value, kindList.value.join(',')],
  () => {
    query.value = ''
    searched.value = ''
    reviewFilter.value = ''
    items.value = []
    load('')
  },
  { immediate: true },
)

function onSearch(q) {
  if (q === searched.value && !error.value) return
  load(q)
}

function artifactTo(a) {
  return { name: 'agent-artifact', params: { websiteId: wid.value, artifactId: String(a.id) } }
}

function chatTo(a) {
  return {
    name: 'agent-chat',
    params: { websiteId: wid.value, chatId: String(a.source_chat_id) },
    query: { artifact: String(a.id) },
  }
}

function metaFor(a) {
  const bits = []
  if (kindList.value.length > 1) bits.push(kindMeta(a.kind).label)
  if (a.latest_version) bits.push(`v${a.latest_version}`)
  const when = relativeTime(a.updated_at || a.created_at)
  if (when) bits.push(`Updated ${when}`)
  if (a.created_by_name) bits.push(a.created_by_name)
  return bits.join(' · ')
}

const ctaTo = computed(() =>
  wid.value ? { name: 'agent-home', params: { websiteId: wid.value }, query: { agent: section.value.agent } } : null,
)
</script>

<template>
  <AgPage :title="section.title" :intro="section.intro" :busy="loading">
    <ReportTemplateGallery v-if="isReports" :website-id="wid" :website="website" />

    <div class="ag-arts-search">
      <AgSearchField v-model="query" :label="`Search ${section.noun}`" @search="onSearch" />
      <label class="ag-arts-filter">
        <span class="ag-arts-filter-label">Review</span>
        <span class="ag-arts-filter-box">
          <select v-model="reviewFilter" class="ag-arts-filter-input">
            <option v-for="f in REVIEW_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
          <ChevronDown class="ag-arts-filter-icon" :size="14" aria-hidden="true" />
        </span>
      </label>
    </div>

    <ul v-if="loading && !items.length" class="ag-arts" role="list" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="ag-art is-skeleton">
        <span class="ag-skel ag-skel-box" />
        <span class="ag-skel-lines">
          <span class="ag-skel ag-skel-line" />
          <span class="ag-skel ag-skel-line is-short" />
        </span>
      </li>
    </ul>

    <AgEmptyState
      v-else-if="error && !items.length"
      :icon="section.icon"
      tone="error"
      :title="`Couldn't load ${section.noun}.`"
      :body="error"
    >
      <AgButton size="sm" @click="load()">Try again</AgButton>
    </AgEmptyState>

    <p v-else-if="!items.length && searched" class="ag-arts-none">No {{ section.noun }} match "{{ searched }}".</p>

    <p v-else-if="items.length && !shown.length" class="ag-arts-none">No {{ section.noun }} match "{{ filterLabel }}".</p>

    <AgEmptyState v-else-if="!items.length" :icon="section.icon" :title="section.empty" :body="section.emptyBody">
      <AgButton v-if="ctaTo" size="sm" :to="ctaTo">{{ section.cta }}</AgButton>
    </AgEmptyState>

    <ul v-else class="ag-arts" role="list">
      <li v-for="a in shown" :key="a.id" class="ag-art">
        <RouterLink :to="artifactTo(a)" class="ag-art-main">
          <span class="ag-art-icon" :style="{ color: kindMeta(a.kind).color }" aria-hidden="true">
            <component :is="kindMeta(a.kind).icon" :size="14" />
          </span>
          <span class="ag-art-text">
            <span class="ag-art-head">
              <span class="ag-art-title">{{ a.title || kindMeta(a.kind).label }}</span>
              <ReviewChip :review="a.review || null" plain />
            </span>
            <span v-if="metaFor(a)" class="ag-art-meta ag-tnum">{{ metaFor(a) }}</span>
          </span>
        </RouterLink>
        <AgButton
          v-if="a.source_chat_id"
          class="ag-art-chat"
          variant="ghost"
          size="xs"
          :icon="MessageSquare"
          :to="chatTo(a)"
          :aria-label="`Open ${a.title || 'this artifact'} in its chat`"
        >
          Open in chat
        </AgButton>
      </li>
    </ul>
  </AgPage>
</template>

<style scoped>
.ag-arts-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-bottom: 16px;
}

.ag-arts-search > :first-child {
  flex: 1 1 240px;
  min-width: 0;
}

.ag-arts-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ag-arts-filter-label {
  color: var(--ag-fg-3);
  font-size: 13px;
  font-weight: 500;
}

.ag-arts-filter-box {
  position: relative;
  display: inline-flex;
}

.ag-arts-filter-input {
  height: 32px;
  padding: 0 30px 0 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: var(--radius);
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.ag-arts-filter-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-arts-filter-icon {
  position: absolute;
  top: 50%;
  right: 10px;
  color: var(--ag-fg-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-arts-none {
  margin: 0;
  padding: 24px 4px;
  color: var(--ag-fg-3);
  font-size: 14px;
}

.ag-arts {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  list-style: none;
  overflow: hidden;
}

.ag-art {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 64px;
  padding-right: 12px;
  border-top: 1px solid var(--ag-card-border);
}

.ag-art:first-child {
  border-top: 0;
}

.ag-art:hover {
  background: var(--ag-row-hover);
}

.ag-art-main {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 64px;
  padding: 12px 8px 12px 16px;
  color: var(--ag-fg-1);
  text-decoration: none;
}

.ag-art-main:hover {
  opacity: 1;
}

.ag-art-main:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -3px;
}

.ag-art-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: var(--radius);
}

.ag-art-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ag-art-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ag-art-title {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-art-meta {
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-art.is-skeleton {
  gap: 12px;
  padding: 12px 16px;
}

.ag-skel-lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
}

.ag-skel {
  display: block;
  border-radius: var(--radius);
  background: var(--ag-row-hover);
  animation: ag-pulse 1.4s ease-in-out infinite;
}

.ag-skel-box {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
}

.ag-skel-line {
  width: 60%;
  height: 12px;
}

.ag-skel-line.is-short {
  width: 35%;
}

@media (prefers-reduced-motion: reduce) {
  .ag-skel {
    animation: none;
  }
}

@media (max-width: 520px) {
  .ag-art :deep(.ag-art-chat .ag-button-text) {
    display: none;
  }
}
</style>
