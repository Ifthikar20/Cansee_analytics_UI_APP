<template>
  <div class="ag-msg-error" role="alert">
    <CircleAlert class="ag-msg-error-icon" aria-hidden="true" />
    <div class="ag-msg-error-text">
      <p class="ag-msg-error-title">{{ copy.title }}</p>
      <p v-if="copy.body" class="ag-msg-error-body">{{ copy.body }}</p>
      <p v-if="hint" class="ag-msg-error-body">{{ hint }}</p>
      <div v-if="showRetry || showReload || copy.billing || newChatTo" class="ag-msg-error-actions">
        <button v-if="showReload" type="button" class="ag-msg-error-btn" @click="emit('reload')">
          <RefreshCw aria-hidden="true" />
          Reload chat
        </button>
        <button v-if="showRetry" type="button" class="ag-msg-error-btn" :disabled="busy" @click="emit('retry')">
          <RotateCcw aria-hidden="true" />
          Retry
        </button>
        <router-link v-if="copy.billing" class="ag-msg-error-link" to="/billing">See plans</router-link>
        <router-link v-if="newChatTo" class="ag-msg-error-link" :to="newChatTo">Start a new chat</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
// A reply that failed or was interrupted: copy specific to the error code,
// the server's own message for codes the UI does not know, and Retry when
// trying again can help, or Reload chat when this tab lost track of the
// reply (it may still be running on the server).
import { computed } from 'vue'
import { CircleAlert, RefreshCw, RotateCcw } from '@lucide/vue'
import { errorCopy } from './parts'

const props = defineProps({
  code: { type: String, default: '' },
  message: { type: String, default: '' },
  status: { type: String, default: 'failed' },
  canRetry: { type: Boolean, default: true },
  // run.failed's `retryable` while the run is in the store; null falls back
  // to the code's copy (a reply loaded from the server has no flag).
  retryable: { type: Boolean, default: null },
  websiteId: { type: [String, Number], default: null },
  busy: { type: Boolean, default: false },
  // An extra line for staff (the setting to change), or ''.
  hint: { type: String, default: '' },
  // The parent can reload the chat (it listens for `reload`).
  canReload: { type: Boolean, default: false },
})

const emit = defineEmits(['retry', 'reload'])

const copy = computed(() => errorCopy(props.code, props.message, props.status))
const showRetry = computed(() => props.canRetry && (props.retryable ?? copy.value.retry))
const showReload = computed(() => props.canReload && Boolean(copy.value.reload))
const newChatTo = computed(() =>
  copy.value.newChat && props.websiteId !== null && props.websiteId !== ''
    ? { name: 'agent-home', params: { websiteId: String(props.websiteId) } }
    : null
)
</script>

<style scoped>
.ag-msg-error {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--ag-danger) 28%, transparent);
  border-radius: 12px;
  background: var(--ag-danger-bg);
}

.ag-msg-error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--ag-danger);
}

.ag-msg-error-text {
  min-width: 0;
}

.ag-msg-error-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-msg-error-body {
  margin: 2px 0 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.ag-msg-error-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.ag-msg-error-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 8px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.ag-msg-error-btn:hover:not(:disabled) {
  background: var(--ag-btn-hover);
}

.ag-msg-error-btn:disabled {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-msg-error-btn svg {
  width: 14px;
  height: 14px;
}

.ag-msg-error-link {
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ag-msg-error-link:hover {
  opacity: 1;
}

.ag-msg-error-btn:focus-visible,
.ag-msg-error-link:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
