<template>
  <div class="ag-user" :class="{ 'is-sending': sending, 'is-failed': sendFailed }">
    <p class="ag-user-bubble">{{ text }}</p>
    <div v-if="sendFailed" class="ag-user-failed" role="alert">
      <CircleAlert class="ag-user-failed-icon" aria-hidden="true" />
      <span>{{ failure.text }}</span>
      <button v-if="failure.retry" type="button" class="ag-user-retry" :disabled="busy" @click="emit('retry')">Retry</button>
    </div>
    <div v-else class="ag-user-actions" :class="{ 'has-branches': siblings.count > 1 }">
      <BranchNav
        v-if="siblings.count > 1"
        :index="siblings.index"
        :count="siblings.count"
        :disabled="busy"
        @prev="emit('branch', -1)"
        @next="emit('branch', 1)"
      />
      <AgIconButton
        v-if="canEdit"
        label="Edit message"
        :icon="Pencil"
        :size="28"
        muted
        tooltip-side="top"
        :disabled="busy"
        @click="emit('edit')"
      />
      <AgIconButton
        :label="copied ? 'Copied' : 'Copy message'"
        :icon="copied ? Check : Copy"
        :size="28"
        muted
        tooltip-side="top"
        @click="copy"
      />
    </div>
  </div>
</template>

<script setup>
// The user's turn: a right-aligned bubble (plain text, never Markdown), with
// copy, edit (latest message) and the version switcher after edits.
import { computed, onBeforeUnmount, ref } from 'vue'
import { Check, CircleAlert, Copy, Pencil } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import BranchNav from './BranchNav.vue'
import { errorCopy } from './parts'
import { copyText } from '@/lib/agent/download'

const props = defineProps({
  message: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  siblings: { type: Object, default: () => ({ index: 1, count: 1 }) },
})

const emit = defineEmits(['edit', 'retry', 'branch'])

const copied = ref(false)
let timer = 0

const text = computed(() => {
  const parts = Array.isArray(props.message.parts) ? props.message.parts : []
  const part = parts.find((p) => p && p.type === 'text')
  return part?.text ?? props.message.text ?? ''
})

const sending = computed(() => props.message.status === 'sending')
const sendFailed = computed(() => props.message.status === 'send_failed')

// A refused send keeps the server's reason (too long, chat deleted, sending
// too fast); the code's copy stands in only when there is none. Retry re-posts
// the same text, so it is offered only when that can succeed.
const failure = computed(() => {
  const err = props.message.send?.error || {}
  const code = err.code || props.message.error_code || ''
  const message = String(err.message || props.message.error_message || '').trim()
  const copy = errorCopy(code, message, 'failed')
  const reason = message || (code ? copy.title : '')
  return {
    text: reason ? `Not sent. ${reason}` : 'Not sent.',
    retry: copy.retry && err.retryable !== false,
  }
})

async function copy() {
  if (!(await copyText(text.value))) return
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.ag-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
}

/* The reference's one-line bubble is 416 of a 520 column with no slack, so
   80% would wrap it on sub-pixel text widths; 85% keeps it on one line. */
.ag-user-bubble {
  max-width: 85%;
  margin: 0;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--ag-bubble-bg);
  color: var(--ag-fg-1);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-user.is-sending .ag-user-bubble {
  opacity: 0.72;
}

.ag-user-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  margin-top: 4px;
  margin-right: -6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ag-user-actions:focus-within,
.ag-user-actions.has-branches {
  opacity: 1;
}

@media (hover: hover) {
  .ag-turn:hover .ag-user-actions {
    opacity: 1;
  }
}

@media (hover: none) {
  .ag-user-actions {
    opacity: 1;
  }
}

.ag-user-failed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-height: 28px;
  margin-top: 4px;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
  text-align: right;
}

.ag-user-failed-icon {
  width: 14px;
  height: 14px;
}

.ag-user-retry {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 6px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.ag-user-retry:hover:not(:disabled) {
  background: var(--ag-btn-hover);
}

.ag-user-retry:disabled {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-user-retry:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
  border-radius: 6px;
}
</style>
