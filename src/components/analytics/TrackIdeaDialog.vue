<script setup>
// "Track this prompt?" (contract 7 Track): adds an idea to the tracked
// prompts and asks the AI engines now, after the user confirms the most it
// can cost. The confirm sent is the amount shown; if the server now needs
// more (409 estimate_changed) the dialog shows the new amount and waits for
// a second confirm. Nothing is tracked without one.
import { computed, ref, watch } from 'vue'
import { CircleAlert, X } from '@lucide/vue'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import insightsApi from '@/api/insights'
import { useToast } from '@/composables/useToast'
import { listText } from '@/lib/analytics/askTemplates'
import { money } from '@/lib/analytics/countrySpecs'
import { useHideUsd } from '@/composables/useHideUsd'
import { estimateRuns } from '@/lib/promptRuns'
import { engineMeta } from '@/lib/engines'
import { Button } from '@/components/ui/button'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  websiteId: { type: String, required: true },
  // The idea to track (contract 7 `ideas[]`).
  idea: { type: Object, default: null },
  // The payload's `track` block: {engines, usd_max_per_prompt, allowance, prompt_runs}.
  track: { type: Object, default: null },
})
const emit = defineEmits(['tracked'])

const toast = useToast()

// The block the dialog shows and confirms: the page's, until the server
// answers with a newer one.
const shown = ref(null)
const submitting = ref(false)
const error = ref('')
const changed = ref(false)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    shown.value = props.track
    submitting.value = false
    error.value = ''
    changed.value = false
  },
  { immediate: true },
)

// Free accounts see prompt runs, never dollars.
const hideUsd = useHideUsd(() => shown.value)

const body = computed(() => {
  const t = shown.value
  if (!t || !props.idea) return ''
  const engines = listText((t.engines || []).map((e) => e.label || engineMeta(e.key).label))
  if (hideUsd.value) {
    const runs = estimateRuns(t.prompt_runs)
    const head = `Cansee adds "${props.idea.text}" to your tracked prompts and asks ${engines} now.`
    return runs ? `${head} ${runs.text}` : head
  }
  const head = `Cansee adds "${props.idea.text}" to your tracked prompts and asks ${engines} now: up to ${money(t.usd_max_per_prompt)} of your AI allowance`
  const allowance = t.allowance || {}
  return allowance.unlimited ? `${head}.` : `${head} (${money(allowance.left_usd)} left this month).`
})

function errorBody(err) {
  const raw = err?.response?.data?.error
  return raw && typeof raw === 'object' ? raw : { code: typeof raw === 'string' ? raw : '', message: '' }
}

async function confirm() {
  if (submitting.value || !props.idea || !shown.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await insightsApi.trackIdea(props.websiteId, props.idea.id, {
      confirm: { ai_usd_max: shown.value.usd_max_per_prompt },
    })
    toast.success(`Tracking "${props.idea.text}". The AI engines are being asked now.`)
    open.value = false
    emit('tracked', res.data)
  } catch (err) {
    const b = errorBody(err)
    if (err?.response?.status === 409 && b.code === 'estimate_changed' && b.details?.track) {
      shown.value = b.details.track
      changed.value = true
    } else {
      changed.value = false
      error.value = b.message || err?.displayMessage || "We couldn't track this prompt. Try again."
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="tid-overlay" />
      <DialogContent class="tid">
        <div class="tid-head">
          <DialogTitle class="tid-title">Track this prompt?</DialogTitle>
          <DialogClose class="tid-close" aria-label="Close">
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </div>
        <DialogDescription class="tid-body">{{ body }}</DialogDescription>
        <p v-if="changed" class="tid-note" role="status">The cost changed. Check the new amount and confirm again.</p>
        <p v-if="error" class="tid-error" role="alert">
          <CircleAlert class="tid-icon" aria-hidden="true" />
          <span>{{ error }}</span>
        </p>
        <div class="tid-foot">
          <Button variant="outline" @click="open = false">Cancel</Button>
          <Button :disabled="submitting || !shown" @click="confirm">Track and check</Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.tid-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--scrim);
}

.tid {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  display: grid;
  gap: 14px;
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 22px 24px 20px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: none;
  transform: translate(-50%, -50%);
  outline: none;
}

.tid-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tid-title {
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.tid-close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.tid-close:hover {
  background: var(--accent);
  color: var(--foreground);
}

.tid-body {
  color: var(--foreground);
  font-size: 14px;
  line-height: 1.55;
}

.tid-note {
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
}

.tid-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--destructive);
  font-size: 13px;
}

.tid-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.tid-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
</style>
