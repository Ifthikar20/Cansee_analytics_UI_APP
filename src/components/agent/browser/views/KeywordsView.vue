<template>
  <div class="ag-kw">
    <div v-if="!websiteId" class="ag-kw-note">
      <p class="ag-kw-text">Open a project to see its tracked keywords.</p>
    </div>

    <template v-else-if="!overview">
      <div v-if="loadError" class="ag-kw-note">
        <p class="ag-kw-text">
          {{
            loadError === 'gone'
              ? 'This project is no longer available.'
              : 'Your tracked keywords could not be loaded.'
          }}
        </p>
        <AgButton
          v-if="loadError === 'error'"
          size="xs"
          :icon="RotateCw"
          @click="load({ force: true })"
          >Retry</AgButton
        >
      </div>
      <div v-else class="ag-kw-skeleton" role="status" aria-label="Loading your tracked keywords">
        <span v-for="n in 6" :key="n" class="ag-kw-bar" :style="{ width: `${94 - n * 8}%` }"></span>
      </div>

      <!-- The tracked list failed: fall back to the keywords searched in this chat. -->
      <section
        v-if="loadError === 'error' && chatRows.length"
        class="ag-kw-fallback"
        aria-labelledby="ag-kw-fallback-title"
      >
        <h3 id="ag-kw-fallback-title" class="ag-kw-heading">Keywords searched in this chat</h3>
        <div class="ag-kw-scroll">
          <table class="ag-kw-table">
            <thead>
              <tr>
                <th scope="col">Keyword</th>
                <th scope="col">Google</th>
                <th scope="col">AI Overview</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in chatRows" :key="row.promptId">
                <th scope="row">{{ row.keyword }}</th>
                <td class="ag-tnum">{{ row.googleText }}</td>
                <td>{{ row.aiText || 'Not read' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-else-if="!prompts.length" class="ag-kw-note">
      <p class="ag-kw-text">
        No tracked keywords yet. Track the questions your buyers ask to rank them here.
      </p>
      <RouterLink
        class="ag-kw-cta"
        :to="{ name: 'analytics', params: { websiteId }, query: { widget: 'prompts' } }"
      >
        Add keywords
      </RouterLink>
    </div>

    <template v-else>
      <p v-if="refreshFailed" class="ag-kw-warn" role="status">
        The list could not be refreshed; it shows the last load.
      </p>
      <p v-if="changesUnknown" class="ag-kw-warn" role="status">
        Changes are unavailable right now. Rankings are still current.
      </p>
      <div class="ag-kw-scroll">
        <table class="ag-kw-table">
          <caption class="ag-sr-only">
            Tracked keywords, sorted by
            {{
              sortName
            }}{{
              tab.changedOnly ? ', changed only' : ''
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              <th scope="col" class="is-num">AI score</th>
              <th scope="col" class="is-num">Google</th>
              <th v-for="engine in engines" :key="engine.key" scope="col">{{ engine.label }}</th>
              <th scope="col">Gap</th>
              <th scope="col">Changed</th>
              <th scope="col">Top fix</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.prompt_id"
              :data-prompt-id="row.prompt_id"
              :class="{ 'is-active': isActive(row) }"
            >
              <th scope="row" class="ag-kw-first">
                <button
                  type="button"
                  class="ag-kw-key"
                  :aria-pressed="isActive(row) ? 'true' : 'false'"
                  :title="
                    isActive(row)
                      ? 'Stop highlighting this keyword'
                      : 'Highlight this keyword in pages'
                  "
                  @click="toggle(row)"
                >
                  {{ row.text }}
                </button>
                <span class="ag-kw-meta">
                  <span v-if="row.location" class="ag-kw-loc">{{
                    String(row.location).toUpperCase()
                  }}</span>
                  <button
                    v-if="inChat(row)"
                    type="button"
                    class="ag-kw-chat"
                    @click="openSearch(inChat(row))"
                  >
                    Searched in this chat · {{ inChat(row).googleText }}
                  </button>
                </span>
              </th>
              <td class="is-num ag-tnum">{{ aiScoreText(row) }}</td>
              <td class="is-num ag-tnum">{{ googleLabel(row.google) }}</td>
              <td v-for="engine in engines" :key="engine.key" class="ag-kw-engine">
                {{ engineText(row.engines && row.engines[engine.key]) }}
              </td>
              <td>
                <span class="ag-kw-gap">{{ gapDisplay(row.gap).label }}</span
                ><template v-if="gapValueText(row.gap)"
                  >{{ ' '
                  }}<span class="ag-kw-gapv ag-tnum">{{ gapValueText(row.gap) }}</span></template
                >
              </td>
              <td>
                <span
                  v-if="change(row)"
                  class="ag-kw-change"
                  :class="`is-${change(row).kind.replace(/_/g, '-')}`"
                  :title="change(row).details.join('\n')"
                >
                  {{ change(row).label
                  }}<span class="ag-sr-only">: {{ change(row).details.join('; ') }}</span>
                </span>
                <span v-else-if="changesUnknown" class="ag-kw-dim">Unavailable</span>
                <span v-else class="ag-kw-dim">No answer in {{ windowDays }} days</span>
              </td>
              <td class="ag-kw-fix">{{ topFix(row) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!rows.length" class="ag-kw-empty">
          {{
            changesUnknown
              ? 'What changed is unavailable right now, so no keyword can be shown as changed.'
              : `No keyword changed in the last ${windowDays} days.`
          }}
        </p>
      </div>
    </template>
  </div>
</template>

<script>
// The newest load of each tab object ({n, pending}), shared by every view of
// it: a view unmounts when its tab goes to the background, its load still
// lands, and a view that mounts meanwhile waits for it instead of fetching.
const loads = new WeakMap()
</script>

<script setup>
// The project's tracked keywords in the pane (tab kind `keywords`): the
// search-gap overview's prompts[] ranked by the Google-vs-AI gap (or another
// sort from the header), with what changed per engine in the last 90 days.
// A row highlights its keyword, brand and competitors in every reader and
// Google results view. What it fetched, and how its last load ended
// (`loadError`, `refreshFailed`), stays on the tab (`data`), so switching tabs
// neither fetches again nor forgets; refresh comes from the header.
import { computed, toRaw, watch } from 'vue'
import { RotateCw } from '@lucide/vue'
import agentApi from '@/api/agent'
import AgButton from '@/components/agent/common/AgButton.vue'
import { errorInfo } from '@/components/agent/message/parts'
import { gapDisplay, gapValueText, googleLabel, ACTION_LABELS } from '@/lib/gap'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import {
  KEYWORDS_WINDOW_DAYS,
  aiScoreText,
  changeSummary,
  changesByPrompt,
  engineText,
  isMoved,
  keywordTerms,
  sortKeywordRows,
  sortLabel,
} from '../keywordsModel'

const props = defineProps({
  // {id: 'keywords', kind: 'keywords', sort, changedOnly, nonce, data}
  tab: { type: Object, required: true },
})

const agent = useAgentStore()
const pane = useAgentPaneStore()

function currentWebsiteId() {
  const wid = agent.websiteId
  return wid === undefined || wid === null || wid === '' ? '' : String(wid)
}

const websiteId = computed(currentWebsiteId)
const data = computed(() =>
  props.tab.data && typeof props.tab.data === 'object' ? props.tab.data : {}
)
const overview = computed(() =>
  data.value.overview && typeof data.value.overview === 'object' ? data.value.overview : null
)
const prompts = computed(() =>
  Array.isArray(overview.value?.prompts) ? overview.value.prompts : []
)
const engines = computed(() =>
  (Array.isArray(overview.value?.engines) ? overview.value.engines : []).filter(
    (e) => e && e.configured
  )
)
// The change list failed or never came: no keyword is shown as changed or unchanged.
const changesUnknown = computed(() => !Array.isArray(data.value.changes?.changes))
const changeMap = computed(() => changesByPrompt(data.value.changes?.changes))
const windowDays = computed(() => Number(data.value.changes?.window_days) || KEYWORDS_WINDOW_DAYS)
const sortName = computed(() => sortLabel(props.tab.sort || 'gap'))

const rows = computed(() => {
  const sorted = sortKeywordRows(prompts.value, props.tab.sort || 'gap', changeMap.value)
  return props.tab.changedOnly ? sorted.filter((row) => isMoved(row, changeMap.value)) : sorted
})

// The keywords searched in this chat (ranked from its Google results), by prompt.
const chatRows = computed(() => pane.chatRanking.rows)

function inChat(row) {
  return pane.chatRanking.byPromptId[String(row.prompt_id)] || null
}

function change(row) {
  return changeSummary(changeMap.value.get(String(row.prompt_id)))
}

function topFix(row) {
  const action = row.top_action
  if (!action) return ''
  return ACTION_LABELS[action.kind] || action.title || ''
}

// ── Highlight ──

// Compared as the pane stores a highlight keyword: spacing collapsed, any case.
function sameKeyword(a, b) {
  const norm = (s) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  return norm(a) === norm(b)
}

function isActive(row) {
  const k = pane.keywordHighlight
  return Boolean(k && sameKeyword(row.text, k.keyword))
}

function toggle(row) {
  if (isActive(row)) pane.clearKeywordHighlight()
  else pane.setKeywordHighlight({ ...keywordTerms(overview.value, row), sourceTabId: props.tab.id })
}

function openSearch(chatRow) {
  const tabId = chatRow.captures && chatRow.captures[0] && chatRow.captures[0].tabId
  if (tabId) pane.openCapture(tabId)
}

// ── Loading ──

const loading = computed(() => props.tab.status === 'loading')
// How the last load without data ended: 'gone' (404) or 'error'; none while loading.
const loadError = computed(() => {
  const e = data.value.loadError
  return !loading.value && (e === 'gone' || e === 'error') ? e : null
})
// A refresh failed and the tab still shows the load before it.
const refreshFailed = computed(() => Boolean(data.value.refreshFailed))

function failed(error) {
  const info = errorInfo(error)
  return info.status === 404 || info.code === 'not_found' ? 'gone' : 'error'
}

async function load({ force = false } = {}) {
  const wid = currentWebsiteId()
  const tab = props.tab
  const key = toRaw(tab)
  const last = loads.get(key)
  // Unforced (a view mounting), a tab that has its data, a load running, or a
  // failed load to show (Retry forces) is left as it is.
  const settled = overview.value || data.value.loadError || (last && last.pending)
  if (!wid || (!force && settled)) return
  const mine = { n: (last ? last.n : 0) + 1, pending: true }
  loads.set(key, mine)
  pane.updateTab(tab.id, { status: 'loading' })
  const [found, changed] = await Promise.allSettled([
    agentApi.trackedPrompts(wid),
    agentApi.keywordChanges(wid, { days: KEYWORDS_WINDOW_DAYS }),
  ])
  mine.pending = false
  // A newer load of the tab, another project, or the tab's closing (a tab
  // opened again is a new object) drops the reply. Everything is read fresh
  // and written to the tab: this view may be unmounted by now.
  if (loads.get(key) !== mine || wid !== currentWebsiteId()) return
  if (!pane.tabs.some((t) => toRaw(t) === key)) return
  if (found.status === 'rejected' || !found.value?.data) {
    if (tab.data && tab.data.overview) {
      pane.updateTab(tab.id, { status: 'ready', data: { refreshFailed: true } })
    } else {
      const loadError = found.status === 'rejected' ? failed(found.reason) : 'error'
      pane.updateTab(tab.id, { status: 'error', data: { loadError } })
    }
    return
  }
  pane.updateTab(tab.id, {
    status: 'ready',
    data: {
      overview: found.value.data,
      changes: changed.status === 'fulfilled' ? changed.value?.data || null : null,
      changesError: changed.status === 'rejected',
      loadedAt: new Date().toISOString(),
      loadError: null,
      refreshFailed: false,
    },
  })
}

load()

// Another tab object in this view (a chat switch keeps the view: the tab id
// is the same) loads its own; the header's Refresh bumps the tab's nonce.
watch(
  () => [toRaw(props.tab), props.tab.nonce],
  ([tab, nonce], [before, nonceBefore]) => {
    if (tab !== before) load()
    else if (nonce !== nonceBefore) load({ force: true })
  }
)
</script>

<style scoped>
.ag-kw {
  box-sizing: border-box;
  min-height: 100%;
  padding: 12px 0 32px;
  color: var(--ag-fg-1);
}

.ag-kw-note {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 24px 20px;
}

.ag-kw-text {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-kw-cta {
  color: var(--ag-serp-title);
  font-size: 13px;
  font-weight: 500;
}

.ag-kw-cta:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-kw-warn {
  margin: 0 16px 10px;
  padding: 8px 12px;
  border: 1px solid var(--ag-divider);
  border-radius: 8px;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-kw-skeleton {
  display: grid;
  gap: 14px;
  padding: 24px 20px;
}

.ag-kw-bar {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: var(--ag-row-hover);
}

.ag-kw-fallback {
  padding: 0 0 12px;
}

.ag-kw-heading {
  margin: 4px 16px 8px;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.ag-kw-scroll {
  /* Keeps the screen-reader text of far columns inside the scroll box. */
  position: relative;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.ag-kw-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  line-height: 18px;
}

.ag-kw-table thead th {
  padding: 6px 10px;
  border-bottom: 1px solid var(--ag-divider);
  background: var(--ag-tab-bg);
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.ag-kw-table tbody :is(th, td) {
  padding: 8px 10px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  font-weight: 400;
  text-align: left;
  vertical-align: top;
}

.ag-kw-table .is-num {
  text-align: right;
  white-space: nowrap;
}

/* The highlighted keyword's row: the keyword highlight's own colours, as a
   row tint and an inset line (not a <mark>, which stays in page text). */
.ag-kw-table tbody tr.is-active > :is(th, td) {
  background: var(--ag-hl-keyword-bg);
}

.ag-kw-table tbody tr.is-active > :first-child {
  box-shadow: inset 2px 0 0 var(--ag-hl-keyword-line);
}

.ag-kw-first {
  min-width: 220px;
  max-width: 340px;
}

.ag-kw-key {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.ag-kw-key:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-kw-key:focus-visible,
.ag-kw-chat:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-kw-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 4px;
}

.ag-kw-loc {
  color: var(--ag-fg-4);
  font-size: 11px;
  line-height: 16px;
}

.ag-kw-chat {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}

.ag-kw-chat:hover {
  color: var(--ag-fg-1);
  text-decoration: underline;
}

.ag-kw-engine,
.ag-kw-fix {
  color: var(--ag-fg-2);
  white-space: nowrap;
}

.ag-kw-gapv {
  margin-left: 2px;
  color: var(--ag-fg-3);
}

.ag-kw-change {
  display: inline-block;
  padding: 0 5px;
  border: 1px solid var(--ag-divider);
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.ag-kw-change.is-named-now,
.ag-kw-change.is-rank-up {
  border-color: var(--ag-you);
  color: var(--ag-you);
}

.ag-kw-change.is-dropped,
.ag-kw-change.is-rank-down {
  border-color: var(--ag-danger);
  color: var(--ag-danger);
}

.ag-kw-dim,
.ag-kw-change.is-first-check,
.ag-kw-change.is-unchanged {
  color: var(--ag-fg-3);
}

.ag-kw-empty {
  margin: 0;
  padding: 16px;
  color: var(--ag-fg-3);
  font-size: 13px;
}
</style>
