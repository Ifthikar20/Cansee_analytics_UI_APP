<template>
  <div class="ag-actions" :class="{ 'is-pinned': pinned || reasonOpen }" role="group" aria-label="Reply actions">
    <AgIconButton
      :label="copied ? 'Copied' : 'Copy'"
      :icon="copied ? Check : Copy"
      :size="28"
      muted
      tooltip-side="top"
      @click="copy"
    />
    <AgIconButton
      v-if="canRegenerate"
      label="Regenerate"
      :icon="RotateCcw"
      :size="28"
      muted
      tooltip-side="top"
      :disabled="busy"
      @click="emit('regenerate')"
    />
    <AgIconButton
      label="Good response"
      :icon="ThumbsUp"
      :size="28"
      muted
      tooltip-side="top"
      :pressed="feedback === 1"
      @click="rate(1)"
    />
    <PopoverRoot :open="reasonOpen" @update:open="onReasonOpen">
      <PopoverAnchor as-child>
        <span class="ag-actions-anchor">
          <AgIconButton
            label="Bad response"
            :icon="ThumbsDown"
            :size="28"
            muted
            tooltip-side="top"
            :pressed="feedback === -1"
            @click="rateDown"
          />
        </span>
      </PopoverAnchor>
      <PopoverPortal>
        <PopoverContent
          class="ag-portal ag-popover ag-feedback"
          side="top"
          align="start"
          :side-offset="6"
          :collision-padding="8"
          aria-label="What went wrong"
          @open-auto-focus="focusFirstReason"
        >
          <form class="ag-feedback-form" @submit.prevent="submitReason">
            <p class="ag-feedback-title">What went wrong?</p>
            <div ref="reasonsEl" class="ag-feedback-reasons" role="group" aria-label="Reasons">
              <button
                v-for="r in REASONS"
                :key="r.key"
                type="button"
                class="ag-feedback-reason"
                :aria-pressed="reason === r.key ? 'true' : 'false'"
                @click="reason = reason === r.key ? '' : r.key"
              >
                {{ r.label }}
              </button>
            </div>
            <label class="ag-feedback-label" :for="commentId">Details (optional)</label>
            <textarea
              :id="commentId"
              v-model="comment"
              class="ag-feedback-comment"
              rows="3"
              maxlength="1000"
              placeholder="What should the reply have done?"
            ></textarea>
            <div class="ag-feedback-actions">
              <PopoverClose class="ag-btn" type="button">Skip</PopoverClose>
              <button type="submit" class="ag-btn is-primary" :disabled="sending || (!reason && !comment.trim())">
                {{ sending ? 'Sending' : 'Send' }}
              </button>
            </div>
          </form>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <SaveReportButton
      v-if="canSave"
      :message-id="message.id"
      :website-id="websiteId"
      :saved-report-id="message.saved_report_id || null"
    />
    <BranchNav
      v-if="siblings.count > 1"
      class="ag-actions-branch"
      :index="siblings.index"
      :count="siblings.count"
      :disabled="busy"
      @prev="emit('branch', -1)"
      @next="emit('branch', 1)"
    />
  </div>
</template>

<script setup>
// Copy, Regenerate, thumbs (a thumbs down asks why), Save report and the
// version switcher under an assistant reply.
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { PopoverAnchor, PopoverClose, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import BranchNav from './BranchNav.vue'
import SaveReportButton from './SaveReportButton.vue'
import { messageText } from './parts'
import { copyText } from '@/lib/agent/download'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  message: { type: Object, required: true },
  websiteId: { type: [String, Number], required: true },
  busy: { type: Boolean, default: false },
  // Keep the row visible (latest reply); otherwise it shows on hover/focus.
  pinned: { type: Boolean, default: false },
  canRegenerate: { type: Boolean, default: true },
  canSave: { type: Boolean, default: false },
  siblings: { type: Object, default: () => ({ index: 1, count: 1 }) },
})

const emit = defineEmits(['regenerate', 'branch'])

const REASONS = [
  { key: 'inaccurate', label: 'Not accurate' },
  { key: 'incomplete', label: 'Missing information' },
  { key: 'instructions', label: "Didn't follow instructions" },
  { key: 'verbose', label: 'Too long' },
  { key: 'other', label: 'Other' },
]

const store = useAgentStore()
const ui = useAgentUiStore()
const toast = useToast()
const commentId = `ag-fb-${useId()}`

const copied = ref(false)
const reasonOpen = ref(false)
const reason = ref('')
const comment = ref('')
const sending = ref(false)
const reasonsEl = ref(null)
let copyTimer = 0

const feedback = computed(() => Number(props.message.feedback) || 0)

async function copy() {
  const ok = await copyText(messageText(props.message))
  if (!ok) {
    toast.error('Copy failed. Select the text and copy it instead.')
    return
  }
  copied.value = true
  ui.announce('Copied')
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

async function send(value, extra) {
  try {
    await store.sendFeedback(props.message.id, value, extra)
    return true
  } catch {
    toast.error('Feedback could not be sent. Try again.')
    return false
  }
}

function rate(value) {
  const next = feedback.value === value ? 0 : value
  send(next)
}

function rateDown() {
  if (feedback.value === -1) {
    reasonOpen.value = false
    send(0)
    return
  }
  reason.value = ''
  comment.value = ''
  send(-1)
  reasonOpen.value = true
}

function onReasonOpen(value) {
  reasonOpen.value = value
}

function focusFirstReason(event) {
  const first = reasonsEl.value?.querySelector('button')
  if (first) {
    event.preventDefault()
    first.focus()
  }
}

async function submitReason() {
  if (sending.value) return
  sending.value = true
  const ok = await send(-1, { reason: reason.value || undefined, comment: comment.value.trim() || undefined })
  sending.value = false
  if (ok) {
    reasonOpen.value = false
    ui.announce('Thanks for the feedback')
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<style scoped>
.ag-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  margin-left: -6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ag-actions.is-pinned,
.ag-actions:focus-within {
  opacity: 1;
}

@media (hover: none) {
  .ag-actions {
    opacity: 1;
  }
}

.ag-actions-anchor {
  display: inline-flex;
}

.ag-actions-branch {
  margin-left: 4px;
}

.ag-feedback-form {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.ag-feedback-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-feedback-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ag-feedback-reason {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 999px;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.ag-feedback-reason:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-feedback-reason[aria-pressed='true'] {
  border-color: var(--ag-fg-1);
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-feedback-reason:focus-visible,
.ag-feedback-comment:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
  border-radius: 999px;
}

.ag-feedback-label {
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-feedback-comment {
  width: 100%;
  min-height: 64px;
  padding: 8px 10px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 8px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  resize: vertical;
}

.ag-feedback-comment::placeholder {
  color: var(--ag-placeholder);
}

.ag-feedback-comment:focus-visible {
  border-radius: 8px;
}

.ag-feedback-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Only the last compound is scoped, so the turn wrapper can be any element. */
@media (hover: hover) {
  .ag-turn:hover .ag-actions {
    opacity: 1;
  }
}
</style>
