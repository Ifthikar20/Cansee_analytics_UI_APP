<template>
  <div :id="barId" class="ag-find" role="search" aria-label="Find on page" @keydown.esc="onEscape">
    <div class="ag-find-row">
      <template v-if="mode === 'reader'">
        <label class="ag-find-field">
          <Search class="ag-find-icon" :size="14" aria-hidden="true" />
          <span class="ag-sr-only">Find on page</span>
          <input
            ref="input"
            v-model="draft"
            class="ag-find-input"
            type="text"
            placeholder="Find on page"
            maxlength="200"
            autocomplete="off"
            spellcheck="false"
            :aria-describedby="statusId"
            @keydown="onKeydown"
          />
        </label>
        <span
          :id="statusId"
          class="ag-find-status ag-tnum"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ statusText }}
        </span>
        <AgIconButton label="Previous match" :size="28" muted :disabled="!count" @click="step(-1)">
          <ChevronUp :size="16" aria-hidden="true" />
        </AgIconButton>
        <AgIconButton label="Next match" :size="28" muted :disabled="!count" @click="step(1)">
          <ChevronDown :size="16" aria-hidden="true" />
        </AgIconButton>
      </template>
      <p v-else class="ag-find-live" role="status">
        <span>Highlighting works in the reader view.</span>
        <button type="button" class="ag-find-link" @click="switchToReader">Switch to reader</button>
      </p>

      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            ref="picker"
            type="button"
            class="ag-find-pick"
            :class="{ 'is-on': Boolean(keyword) }"
          >
            <Tag :size="14" aria-hidden="true" />
            <span class="ag-find-pick-text">Keyword</span>
            <ChevronDown :size="14" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <AgMenuContent align="end" :width="320">
          <AgMenuLabel>Highlight a keyword from this chat</AgMenuLabel>
          <DropdownMenuRadioGroup
            v-if="pane.chatKeywords.length"
            :model-value="activeKey"
            @update:model-value="pickKey"
          >
            <DropdownMenuRadioItem
              v-for="k in pane.chatKeywords"
              :key="k.keyword"
              :value="keyOf(k)"
              class="ag-menu-item"
            >
              <span class="ag-menu-text">{{ k.keyword }}</span>
              <span class="ag-menu-trail">
                <DropdownMenuItemIndicator>
                  <Check :size="16" aria-hidden="true" />
                </DropdownMenuItemIndicator>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <AgMenuItem v-else disabled>
            <span class="ag-menu-text">No Google searches in this chat yet.</span>
          </AgMenuItem>
        </AgMenuContent>
      </DropdownMenuRoot>

      <AgIconButton label="Close find bar" :size="28" muted @click="close">
        <X :size="16" aria-hidden="true" />
      </AgIconButton>
    </div>

    <div v-if="keyword" class="ag-find-keyword">
      <span class="ag-find-keyword-text">
        Highlighting <q>{{ keyword.keyword }}</q>
      </span>
      <span class="ag-find-legend">
        <mark class="ag-hl is-keyword">keyword</mark>
        <mark v-if="keyword.brand.length" class="ag-hl is-brand">your brand</mark>
        <mark v-if="keyword.competitors.length" class="ag-hl is-competitor">competitors</mark>
      </span>
      <button type="button" class="ag-find-link" @click="clearKeyword">
        Clear<span class="ag-sr-only"> keyword highlight</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { Check, ChevronDown, ChevronUp, Search, Tag, X } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'
import { MAX_MARKS } from '@/lib/agent/highlight'
import { useAgentPaneStore } from '@/stores/agentPane'
import { findBarId, findToggleId } from './ids'

// The find bar of a page tab, under the header: find text with a match
// count and next/previous, plus the keyword picker that marks a keyword
// from this chat (with its brand and competitor names) in every reader and
// Google results view. Matches show in the reader view only; live pages are
// cross-origin frames that cannot be marked.

const props = defineProps({
  tab: { type: Object, required: true },
  // 'live' or 'reader', from pageMode().
  mode: { type: String, default: 'reader' },
  // Matches next/previous steps through, and every mark on the page.
  count: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  capped: { type: Boolean, default: false },
})

const emit = defineEmits(['reader'])

const TYPING_DELAY_MS = 150

const pane = useAgentPaneStore()
const input = ref(null)
const picker = ref(null)

const barId = computed(() => findBarId(props.tab.id))
const statusId = computed(() => `${barId.value}-status`)
const find = computed(() => pane.findOf(props.tab.id))
const keyword = computed(() => pane.keywordHighlight)

// Typing updates the marks after a short pause, so a long page is not
// re-marked on every keystroke.
const draft = ref(find.value?.text || '')
let timer = null

watch(draft, (value) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    pane.setFindText(props.tab.id, value)
  }, TYPING_DELAY_MS)
})

// Applies typed text now; true when that changed the find text (then the
// view starts over at the first match).
function flush() {
  if (!timer) return false
  clearTimeout(timer)
  timer = null
  const before = find.value ? find.value.text : ''
  pane.setFindText(props.tab.id, draft.value)
  return (find.value ? find.value.text : '') !== before
}

onBeforeUnmount(flush)

// Both modes report a position, so the live region speaks on every step.
const statusText = computed(() => {
  if (props.mode !== 'reader') return ''
  const position = `${((find.value && find.value.index) || 0) + 1} of ${props.count}`
  const shown = props.capped ? `, first ${MAX_MARKS} shown` : ''
  if (find.value && find.value.text.trim()) {
    return props.count ? `${position}${shown}` : 'No matches'
  }
  if (keyword.value) {
    if (!props.count) return 'Not on this page'
    return `${position} ${props.count === 1 ? 'highlight' : 'highlights'}${shown}`
  }
  return ''
})

// Enter right after typing goes to the first match, not the second.
function step(delta) {
  if (flush()) return
  pane.stepFind(props.tab.id, delta)
}

// An IME uses Enter and Escape to commit or cancel a conversion.
function composing(event) {
  return event.isComposing || event.keyCode === 229
}

function onKeydown(event) {
  if (event.key !== 'Enter' || composing(event)) return
  event.preventDefault()
  step(event.shiftKey ? -1 : 1)
}

// Escape from anywhere in the bar closes it, and only it: the workspace
// would otherwise close the whole pane.
function onEscape(event) {
  if (composing(event)) return
  event.preventDefault()
  event.stopPropagation()
  close()
}

function close() {
  if (timer) clearTimeout(timer)
  timer = null
  const id = props.tab.id
  pane.closeFind(id)
  nextTick(() => document.getElementById(findToggleId(id))?.focus())
}

// The reader view replaces the button; carry focus to the find input.
function switchToReader() {
  emit('reader')
  nextTick(() => input.value?.focus())
}

function keyOf(k) {
  return k.keyword.toLowerCase()
}

const activeKey = computed(() => (keyword.value ? keyOf(keyword.value) : ''))

function pickKey(value) {
  const k = pane.chatKeywords.find((item) => keyOf(item) === value)
  if (k) pane.setKeywordHighlight({ ...k, sourceTabId: null })
}

// Clear removes its own row; keep focus in the bar.
function clearKeyword() {
  pane.clearKeywordHighlight()
  nextTick(() => picker.value?.focus())
}
</script>

<style scoped>
.ag-find {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  background: var(--ag-pane-bg);
}

.ag-find-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.ag-find-field {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
}

.ag-find-icon {
  position: absolute;
  left: 10px;
  color: var(--ag-fg-3);
  pointer-events: none;
}

.ag-find-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 30px;
  padding: 0 10px 0 30px;
  border: 1px solid var(--ag-seg-border);
  border-radius: 8px;
  background: var(--ag-seg-track);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  outline: none;
}

.ag-find-input:focus-visible {
  border-color: var(--ag-ring);
  box-shadow: 0 0 0 1px var(--ag-ring);
}

.ag-find-status {
  flex-shrink: 0;
  min-width: 64px;
  padding: 0 4px;
  color: var(--ag-fg-3);
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
}

.ag-find-live {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-find-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-serp-title);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ag-find-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-find-link:focus-visible,
.ag-find-pick:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-find-pick {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 6px 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.ag-find-pick:hover,
.ag-find-pick[data-state='open'] {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-find-pick.is-on {
  border-color: var(--ag-hl-keyword-line);
  color: var(--ag-fg-1);
}

.ag-find-keyword {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-find-keyword-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-find-legend {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

@container ag-page (max-width: 420px) {
  .ag-find-pick-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .ag-find-status {
    min-width: 0;
  }
}
</style>
