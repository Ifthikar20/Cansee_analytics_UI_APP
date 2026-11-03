<template>
  <div class="ag-strip">
    <div ref="scrollEl" class="ag-strip-scroll" @wheel="onWheel">
      <div
        ref="listEl"
        class="ag-strip-tabs"
        role="tablist"
        aria-label="Browser tabs"
        aria-orientation="horizontal"
        @keydown="onKeydown"
      >
        <div
          v-for="tab in pane.tabs"
          :key="tab.id"
          class="ag-tab"
          :class="{ 'is-active': tab.id === pane.activeId, 'is-narrow': tab.id !== pane.activeId && sizes.narrow }"
          :style="{ width: `${tab.id === pane.activeId ? sizes.active : sizes.other}px` }"
          role="presentation"
          @mousedown.middle.prevent
          @auxclick="onAuxClick($event, tab.id)"
        >
          <AgTooltip :text="pane.titleOf(tab)" :delay="600">
            <button
              :id="tabDomId(tab.id)"
              :ref="(el) => setTabRef(tab.id, el)"
              type="button"
              role="tab"
              class="ag-tab-main"
              :aria-label="pane.titleOf(tab)"
              :aria-selected="tab.id === pane.activeId ? 'true' : 'false'"
              :aria-controls="tab.id === pane.activeId ? PANE_PANEL_ID : undefined"
              :tabindex="tab.id === focusId ? 0 : -1"
              aria-keyshortcuts="Delete"
              @click="activate(tab.id)"
              @focus="focusId = tab.id"
            >
              <TabIcon v-if="!pageInPlaceOfIcon(tab)" :tab="tab" />
              <span v-if="serpPage(tab)" class="ag-tab-page ag-tnum" aria-hidden="true">p{{ serpPage(tab) }}</span>
              <span class="ag-tab-title">{{ tabLabel(tab) }}</span>
            </button>
          </AgTooltip>
          <button
            type="button"
            class="ag-tab-close"
            tabindex="-1"
            aria-hidden="true"
            title="Close tab"
            @click.stop="close(tab.id)"
          >
            <X :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="ag-strip-new">
        <AgIconButton label="New tab" :size="28" muted @click="newTab">
          <Plus :size="16" />
        </AgIconButton>
      </div>
    </div>

    <div class="ag-strip-end">
      <AgIconButton
        v-if="canExpand"
        :label="pane.expanded ? 'Exit full width' : 'Expand browser'"
        :size="28"
        muted
        :pressed="pane.expanded"
        @click="pane.setExpanded(!pane.expanded)"
      >
        <Minimize2 v-if="pane.expanded" :size="16" />
        <Maximize2 v-else :size="16" />
      </AgIconButton>
      <AgIconButton label="Hide browser" :size="28" muted shortcut="mod+\" @click="emit('close-pane')">
        <IconPanelRight :size="16" />
      </AgIconButton>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Maximize2, Minimize2, Plus, X } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { IconPanelRight } from '@/components/agent/icons'
import { useAgentPaneStore } from '@/stores/agentPane'
import { PANE_PANEL_ID, tabDomId } from './ids'
import TabIcon from './TabIcon.vue'

// The pane's tab strip (ui_spec section 10): 48px tall with 8px padding,
// 192x34 tabs, a new-tab button 12px after them, then expand and hide on the
// right. Tabs share the room like browser tabs: 192px while they fit, then
// evenly narrower; narrow inactive tabs show only their icon while the active
// tab keeps at least 136px. Google results tabs carry their page number in a
// badge that never truncates, and the query as their label; a narrow one
// shows the badge in place of its search icon. Roving focus: arrows move
// between tabs, Enter or Space opens one, Delete closes the focused tab.

defineProps({
  canExpand: { type: Boolean, default: true },
})

const emit = defineEmits(['close-pane'])

const TAB_MAX = 192
const TAB_MIN = 34
const ACTIVE_MIN = 136
const TAB_GAP = 4
const NEW_TAB_ROOM = 28 + 12
const NARROW_BELOW = 88

const pane = useAgentPaneStore()
const scrollEl = ref(null)
const listEl = ref(null)
const tabEls = new Map()
const focusId = ref(pane.activeId)
const room = ref(0)

const sizes = computed(() => {
  const n = pane.tabs.length
  if (!n || room.value <= 0) return { active: TAB_MAX, other: TAB_MAX, narrow: false }
  const space = Math.max(0, room.value - NEW_TAB_ROOM - TAB_GAP * (n - 1))
  const even = Math.floor(space / n)
  if (even >= ACTIVE_MIN || n === 1) {
    const width = Math.min(TAB_MAX, Math.max(even, n === 1 ? ACTIVE_MIN : TAB_MIN))
    return { active: width, other: width, narrow: width < NARROW_BELOW }
  }
  const other = Math.max(TAB_MIN, Math.min(TAB_MAX, Math.floor((space - ACTIVE_MIN) / (n - 1))))
  return { active: ACTIVE_MIN, other, narrow: other < NARROW_BELOW }
})

let observer = null
function measure() {
  room.value = scrollEl.value ? scrollEl.value.clientWidth : 0
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'function' && scrollEl.value) {
    observer = new ResizeObserver(measure)
    observer.observe(scrollEl.value)
  }
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})

// The results page a Google tab shows, or null.
function serpPage(tab) {
  if (tab.kind !== 'serp') return null
  const n = Number(tab.data?.page)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Google tabs read as their query (the page is the badge); restored tabs
// whose data has not loaded yet fall back to the title.
function tabLabel(tab) {
  const query = tab.kind === 'serp' ? tab.data?.query : ''
  return typeof query === 'string' && query.trim() ? query : pane.titleOf(tab)
}

// A narrow inactive tab has room for one glyph. While the search loads or
// after it failed that is the status icon; otherwise the page badge.
function pageInPlaceOfIcon(tab) {
  const narrow = tab.id !== pane.activeId && sizes.value.narrow
  return narrow && serpPage(tab) !== null && tab.status !== 'loading' && tab.status !== 'error'
}

function setTabRef(id, el) {
  if (el) tabEls.set(id, el)
  else tabEls.delete(id)
}

function focusTab(id) {
  focusId.value = id
  nextTick(() => tabEls.get(id)?.focus())
}

function activate(id) {
  pane.activateTab(id)
}

function close(id) {
  const hadFocus = listEl.value?.contains(document.activeElement)
  const next = pane.closeTab(id)
  if (hadFocus && next) focusTab(next)
}

function newTab() {
  pane.openNewTab()
}

function onAuxClick(event, id) {
  if (event.button !== 1) return
  event.preventDefault()
  close(id)
}

// A vertical wheel scrolls an overflowing strip sideways.
function onWheel(event) {
  const el = scrollEl.value
  if (!el || el.scrollWidth <= el.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  el.scrollLeft += event.deltaY
  event.preventDefault()
}

function onKeydown(event) {
  const ids = pane.tabs.map((t) => t.id)
  if (!ids.length) return
  const current = ids.includes(focusId.value) ? focusId.value : pane.activeId
  const index = Math.max(0, ids.indexOf(current))
  let next
  switch (event.key) {
    case 'ArrowRight':
      next = ids[(index + 1) % ids.length]
      break
    case 'ArrowLeft':
      next = ids[(index - 1 + ids.length) % ids.length]
      break
    case 'Home':
      next = ids[0]
      break
    case 'End':
      next = ids[ids.length - 1]
      break
    case 'Delete':
      event.preventDefault()
      close(current)
      return
    default:
      return
  }
  event.preventDefault()
  focusTab(next)
}

// Keep the active tab focusable and in view.
watch(
  () => pane.activeId,
  (id) => {
    if (!id) return
    if (!listEl.value?.contains(document.activeElement)) focusId.value = id
    nextTick(() => tabEls.get(id)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
  },
  { immediate: true }
)

watch(
  () => pane.tabs.map((t) => t.id).join('|'),
  () => {
    if (!pane.tabs.some((t) => t.id === focusId.value)) focusId.value = pane.activeId
  }
)
</script>

<style scoped>
.ag-strip {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 48px;
  padding: 0 12px 0 8px;
  background: var(--ag-pane-bg);
}

.ag-strip-scroll {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.ag-strip-scroll::-webkit-scrollbar {
  display: none;
}

.ag-strip-tabs {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.ag-tab {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  box-sizing: border-box;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--ag-fg-2);
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-tab:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-tab.is-active {
  border-color: var(--ag-tab-border);
  background: var(--ag-tab-bg);
  color: var(--ag-fg-tab);
}

.ag-tab-main {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 100%;
  padding: 0 12px 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ag-tab-main:focus-visible {
  border-radius: 9px;
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-tab-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-tab-page {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-2);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.ag-tab.is-active .ag-tab-page {
  background: var(--ag-row-hover);
}

.ag-tab-close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-right: 10px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ag-fg-4);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-tab-close:hover {
  background: var(--ag-row-hover);
  color: var(--ag-fg-1);
}

.ag-tab:not(.is-active):not(:hover) .ag-tab-close {
  opacity: 0;
}

.ag-tab.is-narrow :is(.ag-tab-title, .ag-tab-close) {
  display: none;
}

/* One glyph per narrow tab: the status icon wins over the page badge. */
.ag-tab.is-narrow .ag-tabicon + .ag-tab-page {
  display: none;
}

.ag-tab.is-narrow .ag-tab-main {
  justify-content: center;
  padding: 0;
}

/* Stays in view at the strip's edge when the tabs overflow. */
.ag-strip-new {
  position: sticky;
  right: 0;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  background: var(--ag-pane-bg);
  box-shadow: -6px 0 6px var(--ag-pane-bg);
}

.ag-strip-end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

@media (hover: none) {
  .ag-tab:not(.is-active):not(:hover) .ag-tab-close {
    opacity: 1;
  }
}
</style>
