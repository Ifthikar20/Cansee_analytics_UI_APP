<script>
// Per UI store, the last Ctrl/Cmd+K request a list has taken. Below 1024px
// that key opens the drawer, which mounts this list fresh; the list takes the
// request on mount so the search field, not the drawer's first control, gets
// focus. Shared across instances on purpose.
const handledSearchRequests = new WeakMap()
</script>

<script setup>
// Recent chats of the current project: collapsible header, search filter,
// paginated list, delete confirmation. The store flags each summary with
// `running` and `unseen` (a run that finished while another chat was open).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, Search, Settings2, X } from '@lucide/vue'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { asList, errorMessage } from '@/components/agent/common/agentText'
import RecentChatItem from './RecentChatItem.vue'

const SEARCH_DEBOUNCE_MS = 250

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const router = useRouter()
const agent = useAgentStore()
const ui = useAgentUiStore()
const toast = useToast()

const listId = 'ag-recents-list'
const searchEl = ref(null)
const query = ref(String(agent.chats?.search || ''))
const loadError = ref('')
const moreLoading = ref(false)

const chats = computed(() => asList(agent.recents).filter((chat) => chat && chat.id !== undefined && chat.id !== null))
const loading = computed(() => Boolean(agent.chats?.loading))
const loaded = computed(() => Boolean(agent.chats?.loaded))
const hasMore = computed(() => Boolean(agent.chats?.hasMore))
const searching = computed(() => Boolean(String(agent.chats?.search || '').trim()))
const storeReady = computed(() => Boolean(props.websiteId) && String(agent.websiteId ?? '') === props.websiteId)
const openChatId = computed(() => (route.params?.chatId ? String(route.params.chatId) : null))
const errorText = computed(() => {
  if (agent.chats?.error) return errorMessage(agent.chats.error, "Couldn't load your chats.")
  return loadError.value
})

function isBusy(chat) {
  if (typeof chat.running === 'boolean') return chat.running
  if (typeof agent.isChatBusy === 'function') return Boolean(agent.isChatBusy(String(chat.id)))
  return Boolean(chat.active_run_id)
}

function isUnseen(chat) {
  return Boolean(chat.unseen) || ui.isUnseen(chat.id)
}

async function load(options = {}) {
  if (typeof agent.loadChats !== 'function') return
  loadError.value = ''
  try {
    await agent.loadChats(options)
  } catch (err) {
    loadError.value = errorMessage(err, "Couldn't load your chats.")
  }
}

// The store's init() loads the first page; this covers a store scoped to the
// project without it (and never loops on a failed load).
watch(
  [storeReady, loaded, loading],
  () => {
    if (storeReady.value && !loaded.value && !loading.value && !errorText.value) load()
  },
  { immediate: true },
)

watch(
  () => props.websiteId,
  () => {
    loadError.value = ''
    query.value = ''
  },
)

async function showMore() {
  if (moreLoading.value) return
  moreLoading.value = true
  try {
    await load({ more: true })
  } finally {
    moreLoading.value = false
  }
}

/* ── Search ── */

let searchTimer = null

watch(query, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const q = value.trim()
    if (q === String(agent.chats?.search || '').trim()) return
    load({ q })
  }, SEARCH_DEBOUNCE_MS)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

function closeFilter() {
  ui.setFilterOpen(false)
  if (query.value) query.value = ''
}

function onSearchKeydown(event) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  if (query.value) query.value = ''
  else closeFilter()
}

watch(
  () => ui.searchRequest,
  async (request) => {
    handledSearchRequests.set(ui, request)
    await nextTick()
    searchEl.value?.focus()
    searchEl.value?.select()
  },
)

onMounted(() => {
  if (ui.filterOpen && ui.searchRequest > (handledSearchRequests.get(ui) || 0)) {
    handledSearchRequests.set(ui, ui.searchRequest)
    searchEl.value?.focus()
  }
})

watch(
  () => ui.filterOpen,
  async (open) => {
    if (open) {
      await nextTick()
      searchEl.value?.focus()
    } else if (query.value) {
      query.value = ''
    }
  },
)

/* ── Rename and delete ── */

async function rename({ chat, title }) {
  if (typeof agent.renameChat !== 'function') return
  try {
    await agent.renameChat(String(chat.id), title)
    ui.announce('Chat renamed')
  } catch (err) {
    toast.error(errorMessage(err, "Couldn't rename the chat."))
  }
}

const pendingDelete = ref(null)
const confirmOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const deleteDescription = computed(() => {
  const title = (pendingDelete.value?.title || '').trim() || 'New chat'
  return `This permanently deletes "${title}" and its messages. Reports, pages and sheets it created stay in the project.`
})

function askDelete(chat) {
  pendingDelete.value = chat
  deleteError.value = ''
  confirmOpen.value = true
}

async function confirmDelete() {
  const chat = pendingDelete.value
  if (!chat || deleting.value || typeof agent.deleteChat !== 'function') return
  deleting.value = true
  deleteError.value = ''
  try {
    await agent.deleteChat(String(chat.id))
    confirmOpen.value = false
    pendingDelete.value = null
    ui.markSeen(chat.id)
    ui.announce('Chat deleted')
    if (openChatId.value === String(chat.id) && props.websiteId) {
      router.replace({ name: 'agent-home', params: { websiteId: props.websiteId } }).catch(() => {})
    }
  } catch (err) {
    deleteError.value = errorMessage(err, "Couldn't delete this chat. Try again.")
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="ag-recents" aria-labelledby="ag-recents-heading">
    <div class="ag-recents-head">
      <h2 id="ag-recents-heading" class="ag-recents-heading">
        <button
          type="button"
          class="ag-recents-toggle"
          :aria-expanded="ui.recentsCollapsed ? 'false' : 'true'"
          :aria-controls="listId"
          @click="ui.toggleRecents()"
        >
          <span>Recents</span>
          <ChevronDown class="ag-recents-chevron" :class="{ 'is-collapsed': ui.recentsCollapsed }" :size="12" aria-hidden="true" />
        </button>
      </h2>
      <AgIconButton
        v-if="!ui.recentsCollapsed"
        :label="ui.filterOpen ? 'Close chat search' : 'Search chats'"
        :size="24"
        :icon-size="14"
        :pressed="ui.filterOpen"
        shortcut="mod+k"
        @click="ui.filterOpen ? closeFilter() : ui.setFilterOpen(true)"
      >
        <Settings2 />
      </AgIconButton>
    </div>

    <div v-show="!ui.recentsCollapsed" :id="listId" class="ag-recents-body">
      <div v-if="ui.filterOpen" class="ag-recents-search" role="search">
        <Search class="ag-recents-search-icon" :size="14" aria-hidden="true" />
        <input
          ref="searchEl"
          v-model="query"
          class="ag-recents-search-input"
          type="search"
          placeholder="Search chats"
          aria-label="Search chats"
          autocomplete="off"
          spellcheck="false"
          @keydown="onSearchKeydown"
        />
        <button v-if="query" type="button" class="ag-recents-clear" aria-label="Clear search" @click="query = ''">
          <X :size="14" aria-hidden="true" />
        </button>
      </div>

      <p v-if="!websiteId" class="ag-recents-note">Add a project to start a chat.</p>
      <div v-else-if="errorText && !chats.length && !loading" class="ag-recents-note" role="alert">
        <span>{{ errorText }}</span>
        <button type="button" class="ag-recents-link" @click="load()">Try again</button>
      </div>
      <ul v-else-if="chats.length" class="ag-recents-list" role="list" aria-label="Recent chats">
        <RecentChatItem
          v-for="chat in chats"
          :key="chat.id"
          :chat="chat"
          :website-id="websiteId"
          :active="openChatId === String(chat.id)"
          :busy="isBusy(chat)"
          :unseen="isUnseen(chat)"
          @rename="rename"
          @delete="askDelete"
        />
      </ul>
      <div v-else-if="loading || !loaded" class="ag-recents-note" aria-live="polite">
        <AgSpinner :size="12" />
        <span>Loading chats</span>
      </div>
      <p v-else-if="searching" class="ag-recents-note">No chats match "{{ String(agent.chats?.search || '').trim() }}".</p>
      <p v-else class="ag-recents-note">No chats yet.</p>

      <button
        v-if="websiteId && chats.length && hasMore"
        type="button"
        class="ag-recents-more"
        :disabled="moreLoading || loading"
        @click="showMore"
      >
        <AgSpinner v-if="moreLoading" :size="12" />
        <span>{{ moreLoading ? 'Loading' : 'Show more' }}</span>
      </button>
    </div>

    <AgConfirmDialog
      v-model:open="confirmOpen"
      title="Delete chat?"
      :description="deleteDescription"
      confirm-label="Delete"
      busy-label="Deleting"
      destructive
      :busy="deleting"
      :error="deleteError"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.ag-recents {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 140px;
  margin-top: 18px;
}

.ag-recents-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px;
}

.ag-recents-heading {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.ag-recents-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  margin-left: -4px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
}

.ag-recents-toggle:hover {
  color: var(--ag-fg-1);
}

.ag-recents-toggle:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 0;
}

.ag-recents-chevron {
  width: 12px;
  height: 12px;
  transition: transform 160ms var(--ag-ease);
}

.ag-recents-chevron.is-collapsed {
  transform: rotate(-90deg);
}

.ag-recents-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  margin: 0 -13px 0 -12px;
  padding: 0 13px 4px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ag-recents-search {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin: 2px 0 6px;
}

.ag-recents-search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--ag-fg-3);
  pointer-events: none;
}

.ag-recents-search-input {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 30px 0 31px;
  border: 1px solid var(--ag-composer-border);
  border-radius: var(--radius);
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.ag-recents-search-input::placeholder {
  color: var(--ag-placeholder);
}

.ag-recents-search-input::-webkit-search-cancel-button {
  display: none;
}

.ag-recents-search-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

.ag-recents-clear {
  position: absolute;
  right: 4px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-3);
  cursor: pointer;
}

.ag-recents-clear:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-recents-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
}

.ag-recents-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 7px 8px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}

.ag-recents-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.ag-recents-more {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  height: 32px;
  margin-top: 2px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-3);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.ag-recents-more:hover:not(:disabled) {
  background: var(--ag-row-hover);
  color: var(--ag-fg-1);
}

.ag-recents-more:disabled {
  cursor: default;
}

.ag-recents-more:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}
</style>
