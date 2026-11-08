<script setup>
// The help center: a sheet from the right with a search over the questions,
// the questions that fit the page in view, every question by topic, and
// ways to reach us. Mounted once in AppShell, and by the public Support and
// Docs pages, which sit outside it. Opened through the help store.
//
// Focus goes to the search field on open (or to the question it was opened
// at) and back to the opener on close. Escape in a search with text clears
// it; the next Escape closes. A footer action that opens something else
// (the shortcuts, the feedback dialog, the tips) runs once the drawer has
// closed and handed focus back, so that dialog returns focus there too.
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search } from '@lucide/vue'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useHelpStore } from '@/stores/help'
import { FAQ_GROUPS, faqById, searchFaq } from '@/lib/help/faq'
import { helpContextFor } from '@/lib/help/context'
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '@/constants/support'
import HelpFaqList from './HelpFaqList.vue'

const props = defineProps({
  // Opens the keyboard shortcuts dialog (AppShell only); hidden when null.
  openShortcuts: { type: Function, default: null },
  // Shows the first-visit tips again (resetHints from stores/hints.js,
  // passed by AppShell); hidden when null.
  resetTips: { type: Function, default: null },
})

const help = useHelpStore()
const route = useRoute()
const router = useRouter()

const searchEl = ref(null)
const bodyEl = ref(null)
// Open questions per list ('results', 'page' or a group id).
const expanded = reactive({})
// Run after the drawer has closed and returned focus.
let afterClose = null
let pendingAnchor = null

const query = computed({
  get: () => help.query,
  set: (value) => help.setQuery(value),
})
const searching = computed(() => help.query.trim().length > 0)
const results = computed(() => (searching.value ? searchFaq(help.query) : []))
const countText = computed(() => {
  if (!searching.value) return ''
  const n = results.value.length
  if (!n) return 'No answers match'
  return n === 1 ? '1 answer' : `${n} answers`
})

const contextItems = computed(() => helpContextFor(route).map(faqById).filter(Boolean))

const onDocsPage = computed(() => route.name === 'docs')
const onSupportPage = computed(() => route.name === 'support')

const docsHref = computed(() => router.resolve({ name: 'docs' }).href)
const supportHref = computed(() => router.resolve({ name: 'support' }).href)

const mailHref = computed(() => {
  const where = route.meta?.title || route.name
  const subject = where ? `${SUPPORT_SUBJECT} (${where})` : SUPPORT_SUBJECT
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
})

function docsLink(anchor) {
  if (onDocsPage.value) return { href: `#${anchor}` }
  return { href: `${docsHref.value}#${anchor}`, target: '_blank' }
}

function onDocs({ event, faq }) {
  if (!onDocsPage.value) return
  event.preventDefault()
  pendingAnchor = faq.docs
  help.close()
}

const listOpen = (listId) => expanded[listId] || []
function setListOpen(listId, value) {
  expanded[listId] = Array.isArray(value) ? value : []
}

function groupOf(id) {
  return FAQ_GROUPS.find((g) => g.items.some((it) => it.id === id)) || null
}

function onOpenAutoFocus(event) {
  event.preventDefault()
  const id = help.focusId
  const target = id ? groupOf(id) : null
  if (!target) {
    searchEl.value?.focus({ preventScroll: true })
    return
  }
  const current = listOpen(target.id)
  if (!current.includes(id)) setListOpen(target.id, [...current, id])
  help.clearFocus()
  nextTick(() => {
    const trigger = document.getElementById(`help-${target.id}-${id}`)
    if (!trigger) {
      searchEl.value?.focus({ preventScroll: true })
      return
    }
    trigger.focus({ preventScroll: true })
    trigger.scrollIntoView?.({ block: 'start' })
  })
}

function onEscapeKeyDown(event) {
  if (!searching.value) return
  event.preventDefault()
  help.setQuery('')
  searchEl.value?.focus({ preventScroll: true })
}

function onCloseAutoFocus(event) {
  const anchor = pendingAnchor
  const action = afterClose
  pendingAnchor = null
  afterClose = null
  if (anchor) {
    const el = document.getElementById(anchor)
    if (el) {
      event.preventDefault()
      el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }
  }
  if (action) {
    // After reka has moved focus back to the opener.
    setTimeout(() => {
      try {
        action()
      } catch {
        // The other dialog failing to open leaves focus on the opener.
      }
    }, 0)
  }
}

function closeThen(action) {
  afterClose = action
  help.close()
}

const sendFeedback = () => {
  const open = help.feedbackOpener
  if (open) closeThen(open)
}
const showShortcuts = () => props.openShortcuts && closeThen(props.openShortcuts)
const showTips = () => props.resetTips && closeThen(props.resetTips)

// A new page closes the drawer; a query or hash change on the same page
// (a panel, a Docs anchor) does not.
watch(
  () => route.path,
  () => help.close(),
)

// A fresh search starts at the top of the list.
watch(
  () => help.query,
  () => {
    if (bodyEl.value) bodyEl.value.scrollTop = 0
  },
)
</script>

<template>
  <Sheet :open="help.isOpen" @update:open="help.setOpen">
    <SheetContent
      class="help-drawer"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus="onCloseAutoFocus"
      @escape-key-down="onEscapeKeyDown"
    >
      <SheetHeader>
        <div class="min-w-0 flex-1">
          <SheetTitle>Help</SheetTitle>
          <SheetDescription>Search the answers to common questions, or get in touch.</SheetDescription>
        </div>
        <SheetClose label="Close help" />
      </SheetHeader>

      <div class="help-search">
        <label for="help-search-input" class="sr-only">Search help</label>
        <Search class="help-search-icon" aria-hidden="true" />
        <input
          id="help-search-input"
          ref="searchEl"
          v-model="query"
          type="search"
          class="help-search-input"
          placeholder="Search questions"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="help-search-count"
        />
        <p id="help-search-count" class="help-search-count" :class="{ 'sr-only': !searching }" aria-live="polite">
          {{ countText }}
        </p>
      </div>

      <div ref="bodyEl" class="help-body">
        <template v-if="searching">
          <section v-if="results.length" aria-labelledby="help-results-title">
            <h3 id="help-results-title" class="sr-only">Search results</h3>
            <HelpFaqList
              list-id="results"
              :items="results"
              :model-value="listOpen('results')"
              :docs-link="docsLink"
              @update:model-value="setListOpen('results', $event)"
              @docs="onDocs"
            />
          </section>
          <div v-else class="help-empty">
            <p class="help-empty-title">No answers match "{{ help.query.trim() }}".</p>
            <p class="help-empty-sub">
              Try other words, or email
              <a :href="mailHref" class="help-link">{{ SUPPORT_EMAIL }}</a>.
            </p>
          </div>
        </template>

        <template v-else>
          <section v-if="contextItems.length" class="help-group" aria-labelledby="help-page-title">
            <h3 id="help-page-title" class="help-group-title">On this page</h3>
            <HelpFaqList
              list-id="page"
              :items="contextItems"
              :model-value="listOpen('page')"
              :docs-link="docsLink"
              @update:model-value="setListOpen('page', $event)"
              @docs="onDocs"
            />
          </section>
          <section
            v-for="group in FAQ_GROUPS"
            :key="group.id"
            class="help-group"
            :aria-labelledby="`help-group-${group.id}`"
          >
            <h3 :id="`help-group-${group.id}`" class="help-group-title">{{ group.title }}</h3>
            <HelpFaqList
              :list-id="group.id"
              :items="group.items"
              :model-value="listOpen(group.id)"
              :docs-link="docsLink"
              @update:model-value="setListOpen(group.id, $event)"
              @docs="onDocs"
            />
          </section>
        </template>
      </div>

      <nav class="help-foot" aria-label="More help">
        <a :href="mailHref" class="help-foot-row">Email support</a>
        <button v-if="help.feedbackOpener" type="button" class="help-foot-row" @click="sendFeedback">
          Send feedback
        </button>
        <button v-if="openShortcuts" type="button" class="help-foot-row" @click="showShortcuts">
          Keyboard shortcuts
        </button>
        <button v-if="resetTips" type="button" class="help-foot-row" @click="showTips">Show tips again</button>
        <a v-if="!onDocsPage" :href="docsHref" target="_blank" rel="noopener" class="help-foot-row">Docs</a>
        <a v-if="!onSupportPage" :href="supportHref" target="_blank" rel="noopener" class="help-foot-row">Support</a>
      </nav>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.help-drawer {
  font-family: var(--font-family, inherit);
  font-feature-settings: normal;
  line-height: 1.5;
}

.help-search {
  position: relative;
  padding: 14px 20px 6px;
}

.help-search-icon {
  position: absolute;
  top: 25px;
  left: 31px;
  width: 15px;
  height: 15px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.help-search-input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--input);
  border-radius: 10px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.help-search-input::placeholder {
  color: var(--muted-foreground);
}

.help-search-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent);
}

.help-search-count {
  margin: 6px 2px 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.help-body {
  flex: 1;
  min-height: 0;
  padding: 4px 20px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.help-group {
  padding-top: 14px;
}

.help-group-title {
  margin: 0 0 2px;
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.help-empty {
  padding: 24px 2px;
}

.help-empty-title {
  margin: 0 0 4px;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.help-empty-sub {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.help-link {
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.help-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border);
}

.help-foot-row {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.help-foot-row:hover {
  background: var(--accent);
  color: var(--foreground);
}

.help-foot-row:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
</style>
