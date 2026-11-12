<template>
  <span class="relative inline-flex">
    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8 text-muted-foreground"
      title="Help & feedback"
      :aria-label="triggerLabel"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      @click="openWidget"
    >
      <Headphones class="size-4" aria-hidden="true" />
    </Button>
    <span
      v-if="unreadCount"
      class="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-destructive px-1 text-[10px] font-bold leading-none text-white"
      aria-hidden="true"
    >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
  </span>

  <!-- A modal dialog: focus moves in and is trapped, Escape and a click
       outside close it, and focus returns to what opened it. -->
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[300] bg-black/40 backdrop-blur-[2px]" />
      <DialogContent
        class="fw-card fixed left-1/2 top-1/2 z-[301] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl outline-none"
      >
        <!-- Home: pick a category, and your requests -->
        <template v-if="view === 'home'">
          <div class="mb-1 flex items-center gap-2">
            <Headphones class="size-5 text-foreground" aria-hidden="true" />
            <DialogTitle class="text-lg font-semibold text-foreground">Help & feedback</DialogTitle>
            <DialogClose
              class="ml-auto grid size-8 place-items-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Close"
            >
              <X class="size-4" aria-hidden="true" />
            </DialogClose>
          </div>
          <DialogDescription class="mb-4 text-sm text-muted-foreground">
            Ask for help, report a problem, or share an idea.
          </DialogDescription>

          <h3 id="fw-start-title" class="mb-2 text-xs font-medium font-mono uppercase tracking-wide text-muted-foreground">Start a request</h3>
          <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-labelledby="fw-start-title">
            <button
              v-for="cat in CATEGORIES"
              :key="cat.id"
              type="button"
              class="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary"
              @click="startCompose(cat.id)"
            >
              <span class="flex size-9 flex-shrink-0 items-center justify-center bg-muted text-foreground" aria-hidden="true">
                <component :is="cat.icon" class="size-4" />
              </span>
              <span class="text-sm font-semibold text-foreground">{{ cat.label }}</span>
            </button>
          </div>

          <template v-if="tickets.length">
            <h3 id="fw-requests-title" class="mb-2 text-xs font-medium font-mono uppercase tracking-wide text-muted-foreground">Your requests</h3>
            <ul class="mb-3 max-h-52 overflow-y-auto rounded-xl border border-border" aria-labelledby="fw-requests-title">
              <li v-for="t in tickets" :key="t.id" class="border-b border-border last:border-b-0">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                  @click="openThread(t)"
                >
                  <span class="flex size-7 flex-shrink-0 items-center justify-center bg-muted text-foreground" aria-hidden="true">
                    <component :is="catFor(t.category).icon" class="size-3.5" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm text-foreground" :class="{ 'font-semibold': isUnread(t) }">{{ t.last_message_preview }}</span>
                    <span class="block text-xs text-muted-foreground">
                      {{ t.last_message_author === 'agent' ? 'Support replied' : 'You' }} · {{ shortDate(t.updated_at) }}
                      <span v-if="t.status === 'closed'"> · closed</span>
                    </span>
                  </span>
                  <span v-if="isUnread(t)" class="size-2 flex-shrink-0 rounded-full bg-destructive" aria-hidden="true"></span>
                  <span v-if="isUnread(t)" class="sr-only">Unread reply</span>
                </button>
              </li>
            </ul>
          </template>

          <p v-if="error" class="mb-2 text-sm text-destructive" role="alert">{{ error }}</p>
          <p class="text-xs text-muted-foreground">
            Replies show up here, on this browser, until you sign out.
          </p>
        </template>

        <!-- Compose -->
        <template v-else-if="view === 'compose'">
          <div class="mb-3 flex items-center gap-2">
            <button
              type="button"
              class="flex size-8 items-center justify-center border border-border text-foreground hover:bg-secondary"
              aria-label="Back to Help & feedback"
              @click="backToHome"
            >
              <ChevronLeft class="size-4" aria-hidden="true" />
            </button>
            <span class="flex size-8 items-center justify-center bg-muted text-foreground" aria-hidden="true">
              <component :is="activeCat.icon" class="size-4" />
            </span>
            <DialogTitle class="text-base font-semibold text-foreground">{{ activeCat.label }}</DialogTitle>
          </div>
          <DialogDescription as="label" for="fw-compose" class="mb-2 block text-sm text-muted-foreground">
            {{ activeCat.prompt }}
          </DialogDescription>
          <textarea
            id="fw-compose"
            v-model="draft"
            class="mb-2 min-h-32 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :placeholder="activeCat.placeholder"
          ></textarea>
          <p v-if="error" class="mb-2 text-sm text-destructive" role="alert">{{ error }}</p>
          <button
            type="button"
            class="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            :disabled="draft.trim().length < 2 || sending"
            @click="submit"
          >{{ sending ? 'Sending…' : 'Send message' }}</button>
        </template>

        <!-- Thread -->
        <template v-else-if="view === 'thread' && thread">
          <div class="mb-3 flex items-center gap-2">
            <button
              type="button"
              class="flex size-8 items-center justify-center border border-border text-foreground hover:bg-secondary"
              aria-label="Back to Help & feedback"
              @click="backToHome"
            >
              <ChevronLeft class="size-4" aria-hidden="true" />
            </button>
            <span class="flex size-8 items-center justify-center bg-muted text-foreground" aria-hidden="true">
              <component :is="catFor(thread.category).icon" class="size-4" />
            </span>
            <DialogTitle class="text-base font-semibold text-foreground">{{ catFor(thread.category).label }}</DialogTitle>
            <span v-if="thread.status === 'closed'" class="ml-auto bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Closed</span>
          </div>
          <DialogDescription class="mb-2 text-sm text-muted-foreground">
            Replies show up here, on this browser, until you sign out.
          </DialogDescription>

          <ol class="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-3" aria-label="Messages">
            <li v-for="m in thread.messages" :key="m.id" class="flex" :class="m.author === 'user' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[85%]">
                <div
                  class="whitespace-pre-wrap rounded-xl px-3 py-2 text-sm"
                  :class="m.author === 'user' ? 'bg-foreground text-background' : 'bg-secondary text-foreground'"
                >{{ m.body }}</div>
                <div class="mt-0.5 text-[11px] text-muted-foreground" :class="m.author === 'user' ? 'text-right' : ''">
                  {{ m.author === 'user' ? 'You' : 'Support' }} · {{ shortDate(m.created_at) }}
                </div>
              </div>
            </li>
          </ol>

          <label for="fw-reply" class="sr-only">Your reply</label>
          <textarea
            id="fw-reply"
            v-model="draft"
            class="mb-2 min-h-20 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Write a reply…"
          ></textarea>
          <p v-if="error" class="mb-2 text-sm text-destructive" role="alert">{{ error }}</p>
          <button
            type="button"
            class="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            :disabled="draft.trim().length < 1 || sending"
            @click="sendReply"
          >{{ sending ? 'Sending…' : 'Send message' }}</button>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
// The Help & feedback button and its dialog: start a request, or read the
// requests this user sent from this browser and reply. Tickets live in the
// stand-alone feedback service; their tokens are kept per user here
// (feedbackClient), so another account on this browser never sees or adds
// to them. The help drawer opens the dialog through the help store.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Bug, ChevronLeft, CreditCard, Headphones, Lightbulb, LifeBuoy, X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useHelpStore } from '@/stores/help'
import { diagnosticsSnapshot } from '@/lib/diagnostics'
import feedback, { loadSeen, loadTokens, rememberToken, saveSeen } from '@/api/feedbackClient'

const CATEGORIES = [
  {
    id: 'bug', label: 'Bug report', icon: Bug,
    prompt: 'What went wrong?',
    placeholder: 'What happened, and what did you expect instead?',
  },
  {
    id: 'idea', label: 'Feature idea', icon: Lightbulb,
    prompt: 'What should we build?',
    placeholder: 'Describe the idea and the problem it would solve for you…',
  },
  {
    id: 'help', label: 'Help request', icon: LifeBuoy,
    prompt: 'What are you trying to do?',
    placeholder: 'Tell us what you need help with…',
  },
  {
    id: 'billing', label: 'Billing & account', icon: CreditCard,
    prompt: 'What can we sort out?',
    placeholder: 'Plans, invoices, account access — ask away…',
  },
]

const route = useRoute()
const authStore = useAuthStore()
const help = useHelpStore()

const uid = computed(() => authStore.user?.id ?? null)

const open = ref(false)
const view = ref('home')          // 'home' | 'compose' | 'thread'
const activeCategory = ref('help')
const draft = ref('')
const sending = ref(false)
const error = ref('')
const tickets = ref([])
const thread = ref(null)
const threadToken = ref('')

const activeCat = computed(() => catFor(activeCategory.value))
function catFor(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[2]
}

/* Unread tracking: per-thread "messages seen" count, per user, in this
 * browser. A thread is unread when Support spoke last and there are more
 * messages than the user has viewed. The badge polls quietly. */
const seen = ref(loadSeen(uid.value))

function markSeen(ticketId, messageCount) {
  seen.value = { ...seen.value, [ticketId]: messageCount }
  saveSeen(uid.value, seen.value)
}

function isUnread(t) {
  return t.last_message_author === 'agent'
    && t.message_count > (seen.value[t.id] ?? 0)
}

const unreadCount = computed(() => tickets.value.filter(isUnread).length)
const triggerLabel = computed(() => {
  const n = unreadCount.value
  if (!n) return 'Help & feedback'
  return `Help & feedback, ${n} unread ${n === 1 ? 'reply' : 'replies'}`
})

const POLL_MS = 60_000
let pollTimer = null
let unregister = null
// Bumped per inbox request: a reply for an account no longer signed in is dropped.
let inboxRequest = 0
onMounted(() => {
  refreshInbox()
  pollTimer = setInterval(refreshInbox, POLL_MS)
  unregister = help.setFeedbackOpener(openWidget)
})
onBeforeUnmount(() => {
  clearInterval(pollTimer)
  unregister?.()
})

// Another account signed in: drop everything of the previous one.
watch(uid, (next) => {
  open.value = false
  view.value = 'home'
  thread.value = null
  threadToken.value = ''
  draft.value = ''
  error.value = ''
  tickets.value = []
  seen.value = loadSeen(next)
  refreshInbox()
})

function shortDate(d) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

async function openWidget() {
  open.value = true
  view.value = 'home'
  error.value = ''
  await refreshInbox()
}

async function refreshInbox() {
  const mine = ++inboxRequest
  const tokens = loadTokens(uid.value)
  if (!tokens.length) { tickets.value = []; return }
  try {
    const { tickets: list } = await feedback.summaries(tokens)
    if (mine === inboxRequest) tickets.value = Array.isArray(list) ? list : []
  } catch { /* the inbox is a convenience: leave whatever we had */ }
}

// Page + diagnostics snapshot: this is what lets support match a ticket
// to the exact server log lines (client_id) and see recent JS errors and
// failed API calls from this browser session.
function buildContext() {
  return { app: 'cansee', page: route.fullPath, ...diagnosticsSnapshot() }
}

function startCompose(categoryId) {
  activeCategory.value = categoryId
  draft.value = ''
  error.value = ''
  view.value = 'compose'
}

async function submit() {
  if (sending.value) return
  sending.value = true
  error.value = ''
  try {
    const { token, ticket } = await feedback.createTicket({
      category: activeCategory.value,
      message: draft.value.trim(),
      email: authStore.user?.email || '',
      name: authStore.user?.full_name || '',
      context: buildContext(),
      // This user's tokens: if one points at an open ticket, the service
      // appends there instead of opening a second conversation.
      tokens: loadTokens(uid.value),
    })
    rememberToken(uid.value, token)
    threadToken.value = token
    thread.value = ticket
    markSeen(ticket.id, ticket.messages.length)
    draft.value = ''
    view.value = 'thread'
    refreshInbox()
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}

async function openThread(summary) {
  error.value = ''
  try {
    thread.value = await feedback.getTicket(summary.id, summary.token)
    threadToken.value = summary.token
    markSeen(thread.value.id, thread.value.messages.length)
    draft.value = ''
    view.value = 'thread'
  } catch (e) {
    error.value = e.message
  }
}

async function sendReply() {
  if (sending.value || !thread.value) return
  sending.value = true
  error.value = ''
  try {
    await feedback.reply(thread.value.id, threadToken.value, draft.value.trim(), buildContext())
    thread.value = await feedback.getTicket(thread.value.id, threadToken.value)
    markSeen(thread.value.id, thread.value.messages.length)
    draft.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}

function backToHome() {
  view.value = 'home'
  thread.value = null
  refreshInbox()
}
</script>
