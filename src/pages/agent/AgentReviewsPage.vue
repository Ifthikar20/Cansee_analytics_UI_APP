<script setup>
// Reviews (p2_contract.md 13c): drafts waiting for your review, the reviews
// you asked for, and what was approved in the last 90 days. The box is kept
// in ?box=; a row opens the draft, where the review panel is.
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import agentApi from '@/api/agent'
import { useAgentStore } from '@/stores/agent'
import { kindMeta } from '@/lib/agent/agentsMeta'
import { REVIEW_BOXES, reviewPersonLine } from '@/lib/agent/review'
import AgPage from '@/components/agent/common/AgPage.vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgEmptyState from '@/components/agent/common/AgEmptyState.vue'
import ReviewChip from '@/components/agent/review/ReviewChip.vue'
import { asList, errorMessage, relativeTime } from '@/components/agent/common/agentText'

const BOX_KEYS = REVIEW_BOXES.map((b) => b.key)

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const agent = useAgentStore()

const wid = computed(() => props.websiteId || (route.params?.websiteId ? String(route.params.websiteId) : null))

const box = computed({
  get() {
    const raw = route.query.box
    const value = Array.isArray(raw) ? raw[0] : raw
    return BOX_KEYS.includes(value) ? value : 'waiting'
  },
  set(value) {
    const query = { ...route.query }
    if (!value || value === 'waiting') delete query.box
    else query.box = value
    router.replace({ query })
  },
})

const items = ref([])
const loading = ref(true)
const error = ref('')
let request = 0

async function load() {
  const id = wid.value
  if (!id) return
  const mine = ++request
  const which = box.value
  loading.value = true
  error.value = ''
  try {
    const { data } = await agentApi.listReviews(id, which)
    if (mine !== request) return
    items.value = asList(data).filter((a) => a && a.id)
    // The sidebar count follows the list this page just read.
    if (which === 'waiting' && String(agent.websiteId ?? '') === id) agent.reviewsWaiting = items.value.length
  } catch (err) {
    if (mine !== request) return
    items.value = []
    error.value = errorMessage(err, "Couldn't load reviews.")
  } finally {
    if (mine === request) loading.value = false
  }
}

watch(
  () => [wid.value, box.value],
  () => {
    items.value = []
    load()
  },
  { immediate: true },
)

function rowMeta(a) {
  const kind = kindMeta(a.kind).label
  const v = Number(a.review?.version) || Number(a.latest_version) || 0
  return v ? `${kind} · version ${v}` : kind
}

function artifactTo(a) {
  return { name: 'agent-artifact', params: { websiteId: wid.value, artifactId: String(a.id) } }
}

const current = computed(() => REVIEW_BOXES.find((b) => b.key === box.value) || REVIEW_BOXES[0])
</script>

<template>
  <AgPage
    title="Reviews"
    intro="Drafts waiting for your review, the reviews you asked for, and what was approved."
    :busy="loading"
  >
    <TabsRoot v-model="box" class="ag-revs" activation-mode="manual">
      <TabsList class="ag-revs-tabs" aria-label="Reviews">
        <TabsTrigger v-for="b in REVIEW_BOXES" :key="b.key" :value="b.key" class="ag-revs-tab">{{ b.label }}</TabsTrigger>
      </TabsList>

      <TabsContent v-for="b in REVIEW_BOXES" :key="b.key" :value="b.key" class="ag-revs-panel">
        <ul v-if="loading && !items.length" class="ag-revs-list" role="list" aria-hidden="true">
          <li v-for="n in 3" :key="n" class="ag-rev is-skeleton">
            <span class="ag-skel ag-skel-box" />
            <span class="ag-skel-lines">
              <span class="ag-skel ag-skel-line" />
              <span class="ag-skel ag-skel-line is-short" />
            </span>
          </li>
        </ul>

        <AgEmptyState v-else-if="error" tone="error" title="Couldn't load reviews." :body="error">
          <AgButton size="sm" @click="load">Try again</AgButton>
        </AgEmptyState>

        <AgEmptyState v-else-if="!items.length" :title="current.empty" />

        <ul v-else class="ag-revs-list" role="list">
          <li v-for="a in items" :key="a.id" class="ag-rev">
            <RouterLink :to="artifactTo(a)" class="ag-rev-main">
              <span class="ag-rev-icon" :style="{ color: kindMeta(a.kind).color }" aria-hidden="true">
                <component :is="kindMeta(a.kind).icon" :size="14" />
              </span>
              <span class="ag-rev-text">
                <span class="ag-rev-title">{{ a.title || kindMeta(a.kind).label }}</span>
                <span class="ag-rev-meta ag-tnum">
                  {{ rowMeta(a) }}<template v-if="reviewPersonLine(b.key, a)"> · {{ reviewPersonLine(b.key, a) }}</template>
                </span>
              </span>
            </RouterLink>
            <span class="ag-rev-side">
              <ReviewChip :review="a.review || null" plain />
              <time v-if="relativeTime(a.review?.updated_at || a.updated_at)" class="ag-rev-time" :datetime="a.review?.updated_at || a.updated_at">
                {{ relativeTime(a.review?.updated_at || a.updated_at) }}
              </time>
            </span>
          </li>
        </ul>
      </TabsContent>
    </TabsRoot>
  </AgPage>
</template>

<style scoped>
.ag-revs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ag-revs-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.ag-revs-tab {
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.ag-revs-tab:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-revs-tab[data-state='active'] {
  border-color: var(--ag-card-border);
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-revs-tab:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-revs-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  list-style: none;
}

.ag-rev {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  min-height: 64px;
  padding-right: 16px;
  border-top: 1px solid var(--ag-card-border);
}

.ag-rev:first-child {
  border-top: 0;
}

.ag-rev:hover {
  background: var(--ag-row-hover);
}

.ag-rev-main {
  display: flex;
  flex: 1 1 260px;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px 8px 12px 16px;
  color: var(--ag-fg-1);
  text-decoration: none;
}

.ag-rev-main:hover {
  opacity: 1;
}

.ag-rev-main:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -3px;
}

.ag-rev-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: var(--radius);
}

.ag-rev-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ag-rev-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-rev-meta {
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-rev-side {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  padding-left: 58px;
}

.ag-rev-time {
  color: var(--ag-fg-3);
  font-size: 12.5px;
  white-space: nowrap;
}

.ag-rev.is-skeleton {
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
  .ag-rev-side {
    padding: 0 0 12px 58px;
  }
}
</style>
