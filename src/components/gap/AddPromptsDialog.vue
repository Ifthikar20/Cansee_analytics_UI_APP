<template>
  <BaseModal
    :model-value="open"
    title="Add prompts"
    subtitle="Prompts are the questions your buyers ask Google or an AI assistant, one per line. Cansee checks where Google ranks you for each one and asks each AI engine the same question, then tracks the answers. Leave your brand name out: a prompt measures whether AI brings you up on its own."
    @update:model-value="open = $event"
  >
    <div class="apd">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="apd-text"
        rows="6"
        aria-label="Prompts, one per line"
        placeholder="One question per line, for example: best note taking app for small teams"
      ></textarea>

      <div class="apd-row">
        <label class="apd-label" for="apd-location">Search from</label>
        <select id="apd-location" v-model="location" class="apd-select">
          <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">{{ c.label }}</option>
        </select>
        <span class="apd-count">{{ lines.length }} {{ lines.length === 1 ? 'prompt' : 'prompts' }}</span>
      </div>

      <p v-if="costNote" class="apd-cost">{{ costNote }}</p>

      <!-- Lines that read as requests about the user's own data (on Add). -->
      <section v-if="notice" class="apd-notice" role="alert" aria-labelledby="apd-notice-title">
        <p id="apd-notice-title" class="apd-notice-title">{{ notice.title }}</p>
        <ul v-if="notice.lines.length" class="apd-notice-lines">
          <li v-for="(line, i) in notice.lines" :key="i">{{ line }}</li>
        </ul>
        <p v-if="notice.more" class="apd-notice-more">and {{ notice.more }} more</p>
        <p class="apd-notice-body">{{ notice.body }}</p>
        <div class="apd-notice-actions">
          <template v-if="notice.kind === 'all'">
            <Button size="sm" :disabled="busy" @click="askTheAgent">Ask the agent</Button>
            <Button size="sm" variant="outline" :disabled="busy" @click="save(lines)">
              {{ lines.length === 1 ? 'Track as a prompt anyway' : 'Track as prompts anyway' }}
            </Button>
          </template>
          <template v-else>
            <Button size="sm" :disabled="busy" @click="save(notice.questions)">
              Add {{ notice.questions.length }} {{ notice.questions.length === 1 ? 'question' : 'questions' }}
            </Button>
            <Button size="sm" variant="outline" :disabled="busy" @click="save(lines)">Add all {{ lines.length }}</Button>
          </template>
        </div>
      </section>

      <!-- Past the plan's tracked-prompt cap (403 tracked_prompt_limit). The
           server adds all or nothing, so nothing was added; the text stays. -->
      <section v-if="limitNotice" class="apd-notice" role="alert" aria-labelledby="apd-limit-title">
        <p id="apd-limit-title" class="apd-notice-title">Your plan is full.</p>
        <p class="apd-notice-body">{{ limitNotice }}</p>
        <div class="apd-notice-actions">
          <Button as-child size="sm" variant="outline">
            <router-link :to="{ name: 'billing' }">See plans</router-link>
          </Button>
        </div>
      </section>

      <p v-if="error" class="apd-error">{{ error }}</p>
    </div>

    <template #footer>
      <div class="apd-footer">
        <Button variant="ghost" :disabled="busy" @click="suggest">
          <Sparkles class="size-4" />
          {{ suggesting ? 'Suggesting...' : 'Suggest from my site' }}
        </Button>
        <div class="apd-footer-right">
          <Button variant="outline" :disabled="busy" @click="open = false">Cancel</Button>
          <Button v-if="!notice" :disabled="busy || !lines.length" @click="add">{{ saveLabel }}</Button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
// Add prompts (board_contract.md 8): one buyer question per line, the
// country Google and the web-search engines search from, and what adding
// them costs now (each configured engine answers each prompt once; Google
// runs only on Check Google, and nothing repeats without a schedule). On
// Add, lines that read as requests about the user's own data are held
// back with a notice that points to the agent; Ask the agent drafts them
// in a new chat and never sends.
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Sparkles } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'
import api from '@/api/client'
import { useToast } from '@/composables/useToast'
import { askAgent } from '@/lib/agent/askAgent'
import { splitPromptLines } from '@/lib/analytics/promptIntent'
import { useSessionRuns } from '@/composables/useHideUsd'
import { isRunsError, runsErrorText, runsNeeded } from '@/lib/promptRuns'

const props = defineProps({
  websiteId: { type: String, required: true },
  // How many AI engines are configured (the overview's engines); null when unknown.
  engineCount: { type: Number, default: null },
})
const emit = defineEmits(['added'])
const open = defineModel('open', { type: Boolean, default: false })

// ISO-2 codes, matching BrandPrompt.location. Google results and the
// web-search engines both run from this country.
const COUNTRIES = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'ca', label: 'Canada' },
  { code: 'au', label: 'Australia' },
  { code: 'in', label: 'India' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: '', label: 'Global' },
]

// Lines a notice lists before "and {m} more".
const LISTED = 3

const router = useRouter()
const toast = useToast()
const text = ref('')
const location = ref('us')
const saving = ref(false)
const suggesting = ref(false)
const error = ref('')
const textareaRef = ref(null)
// The request notice, set on Add and cleared by any edit.
const notice = ref(null)
// The server's words when the plan's tracked-prompt cap refused the lines.
const limitNotice = ref('')

const busy = computed(() => saving.value || suggesting.value)
const lines = computed(() =>
  [...new Set(text.value.split('\n').map((l) => l.trim()).filter(Boolean))],
)
const saveLabel = computed(() => {
  if (saving.value) return 'Adding...'
  const n = lines.value.length
  if (!n) return 'Add prompts'
  return `Add ${n} ${n === 1 ? 'prompt' : 'prompts'}`
})

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

// A free account's prompt runs (null on paid plans): it sees runs, never
// the AI allowance.
const freeRuns = useSessionRuns()

// What adding costs now: each configured engine answers each prompt once.
const costNote = computed(() => {
  const e = props.engineCount
  const charged = freeRuns.value ? 'one free prompt run per answer' : 'charged to your AI allowance'
  if (e === null || e === undefined || !Number.isFinite(e)) {
    return `Adding prompts asks each connected AI engine now, ${charged}.`
  }
  if (e <= 0) return "AI engines aren't available yet."
  const n = lines.value.length
  if (!n) return ''
  const runs = runsNeeded(n * e, freeRuns.value)
  const cost = runs
    ? runs.enough
      ? ` ${runs.text}`
      : ` ${runs.text} The prompts are still added, but the engines are not asked now.`
    : ', charged to your AI allowance.'
  return (
    `Adding ${plural(n, 'prompt', 'prompts')} asks ${plural(n * e, 'AI answer', 'AI answers')} now ` +
    `(${plural(e, 'engine', 'engines')})${runs ? '.' : ''}${cost} ` +
    'Google is checked when you choose Check Google, and nothing runs again unless you set a schedule.'
  )
})

// What had focus when the dialog opened. BaseModal does not give it back,
// so a keyboard user was left on the page's body after Cancel or Add.
let opener = null

// Closing (the dialog is still in the DOM): focus goes back to the opener,
// unless it has moved on outside the dialog (Ask the agent opens a chat)
// or the opener is gone or out of reach.
function giveFocusBack() {
  const back = opener
  opener = null
  const card = textareaRef.value?.closest('[role="dialog"]')
  const active = document.activeElement
  const inDialog = !active || active === document.body || Boolean(card?.contains(active))
  if (inDialog && back?.isConnected && !back.closest('[inert]')) back.focus()
}

watch(open, async (isOpen) => {
  if (!isOpen) {
    giveFocusBack()
    return
  }
  const active = document.activeElement
  opener = active && active !== document.body ? active : null
  error.value = ''
  notice.value = null
  limitNotice.value = ''
  await nextTick()
  textareaRef.value?.focus()
})

watch([text, location], () => {
  notice.value = null
  limitNotice.value = ''
})

// The API answers some failures with a bare code ({"error": "code"}) and
// others with {"error": {"code", "message"}}.
function errorCode(err) {
  const e = err?.response?.data?.error
  return typeof e === 'string' ? e : e?.code || ''
}

// Add: buyer questions go straight in; requests for the agent wait for a choice.
function add() {
  const all = lines.value
  if (!all.length) return
  const { requests, questions } = splitPromptLines(all)
  if (!requests.length) {
    save(all)
    return
  }
  if (!questions.length) {
    notice.value = {
      kind: 'all',
      title: 'This looks like a request for the agent.',
      body: 'Prompts are questions buyers ask, such as "best CRM for a small team". Cansee asks them to every AI engine and tracks the answers. To ask about your own data, ask the agent.',
      lines: [],
      more: 0,
      questions: [],
    }
    return
  }
  const k = requests.length
  notice.value = {
    kind: 'some',
    title:
      k === 1
        ? '1 of these looks like a request, not a buyer question.'
        : `${k} of these look like requests, not buyer questions.`,
    body: "They won't be tracked unless you choose Add all.",
    lines: requests.slice(0, LISTED),
    more: Math.max(0, k - LISTED),
    questions,
  }
}

// Hands the lines to the agent as a new chat's draft; nothing is saved or sent.
async function askTheAgent() {
  const handed = await askAgent(router, { websiteId: props.websiteId, from: 'prompts', text: lines.value.join('\n') })
  if (handed) open.value = false
}

// Requests are silent: every failure renders inline in the dialog.
async function save(toSave) {
  const list = Array.isArray(toSave) ? toSave : lines.value
  if (!list.length) return
  saving.value = true
  error.value = ''
  limitNotice.value = ''
  try {
    const res = await api.post(
      `/prompt-library/websites/${props.websiteId}/prompts/`,
      { text: list.join('\n'), location: location.value },
      { _silentError: true },
    )
    const added = `Added ${plural(res.data?.created_count ?? list.length, 'prompt', 'prompts')}.`
    // A run is only queued when the API returns its id. Out of free prompt
    // runs, the prompts are saved but not asked: the server says why.
    const scanError = res.data?.scan_error
    if (scanError && isRunsError(scanError.error)) {
      toast.warning(`${added} ${runsErrorText(scanError.error, scanError)}`)
    } else {
      toast.success(res.data?.scan_audit_id ? `${added} The AI engines are being asked now.` : added)
    }
    text.value = ''
    notice.value = null
    open.value = false
    emit('added')
  } catch (err) {
    if (errorCode(err) === 'no_llm_provider_configured') {
      error.value = "AI engines aren't available yet."
      // Refresh the list in case the prompts were saved before the run was refused.
      emit('added')
    } else if (errorCode(err) === 'tracked_prompt_limit') {
      // The request notice gives way; the server's words say what is tracked.
      notice.value = null
      limitNotice.value = err.response?.data?.error?.message || err.displayMessage || ''
    } else {
      error.value = err.displayMessage || "We couldn't add those prompts. Please try again."
    }
  } finally {
    saving.value = false
  }
}

// Saves a starter set built from the project's site, then refreshes.
async function suggest() {
  suggesting.value = true
  error.value = ''
  try {
    const res = await api.post(
      `/prompt-library/websites/${props.websiteId}/prompts/generate-samples/`,
      { count: 10 },
      { _silentError: true },
    )
    const n = res.data?.total ?? res.data?.generated?.length ?? 0
    toast.success(`Added ${plural(n, 'suggested prompt', 'suggested prompts')}.`)
    open.value = false
    emit('added')
  } catch (err) {
    const code = errorCode(err)
    if (code === 'synthesis_not_configured') error.value = "Suggestions aren't available yet."
    else if (code === 'synthesis_failed') error.value = "We couldn't suggest prompts right now."
    else error.value = err.displayMessage || "We couldn't suggest prompts right now."
  } finally {
    suggesting.value = false
  }
}
</script>

<style scoped>
.apd {
  display: grid;
  gap: 14px;
}

.apd-text {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--input);
  border-radius: 12px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
}

.apd-text:focus-visible {
  border-color: var(--ring);
  border-radius: 12px;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.apd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.apd-label {
  color: var(--muted-foreground);
}

.apd-select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--input);
  border-radius: 10px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
}

.apd-count {
  margin-left: auto;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.apd-cost {
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

.apd-notice {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.apd-notice-title {
  color: var(--foreground);
  font-weight: 600;
}

.apd-notice-lines {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-left: 18px;
  color: var(--foreground);
  list-style: disc;
  overflow-wrap: anywhere;
}

.apd-notice-more,
.apd-notice-body {
  color: var(--muted-foreground);
}

.apd-notice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.apd-error {
  color: var(--destructive);
  font-size: 13px;
}

.apd-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.apd-footer-right {
  display: flex;
  gap: 8px;
}
</style>
