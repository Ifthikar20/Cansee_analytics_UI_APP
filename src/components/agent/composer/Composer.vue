<template>
  <form
    class="ag-composer"
    :class="{ 'is-disabled': blocked, 'has-agent': Boolean(agent) }"
    :aria-label="label"
    @submit.prevent="submit"
    @click="focusFromChrome"
  >
    <div v-if="agent" class="ag-composer-agent">
      <AgentChip :agent="agent" :catalog="catalog" @remove="emit('update:agent', null)" />
      <span v-if="agentUnavailable" class="ag-composer-agent-why">{{ agentUnavailable }}</span>
    </div>
    <label :for="fieldId" class="ag-sr-only">{{ label }}</label>
    <textarea
      :id="fieldId"
      ref="field"
      class="ag-composer-input"
      :value="modelValue"
      rows="1"
      :placeholder="placeholderText"
      :aria-describedby="hintId"
      :readonly="blocked"
      enterkeyhint="send"
      autocomplete="off"
      spellcheck="true"
      @input="onInput"
      @keydown="onKeydown"
      @compositionstart="ime.onCompositionstart"
      @compositionend="ime.onCompositionend"
    ></textarea>
    <p :id="hintId" class="ag-sr-only">{{ hint }}</p>
    <div class="ag-composer-footer">
      <PlusMenu
        :agents="agents"
        :agent="agent || ''"
        :disabled="blocked"
        @select-agent="emit('update:agent', $event)"
        @open-page="emit('open-page')"
      />
      <span v-if="dictationText" class="ag-composer-interim" aria-hidden="true">{{ dictationText }}</span>
      <span class="ag-composer-spacer"></span>
      <span v-if="lengthText" class="ag-composer-count" :class="{ 'is-over': length.over }" aria-hidden="true">
        {{ lengthText.short }}
      </span>
      <DictationButton :disabled="blocked" @text="insertDictation" @interim="dictationText = $event" />
      <SendStopButton :busy="busy" :stopping="stopping" :disabled="!canSubmit" @stop="emit('stop')" />
    </div>
  </form>
</template>

<script setup>
// The message box: selected agent chip, auto-growing textarea, and a footer
// with "+", the length counter near the server's limit, dictation and the
// round Send / Stop button. Presentational: the dock owns the text, the
// agent and what Send and Stop do.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import AgentChip from './AgentChip.vue'
import DictationButton from './DictationButton.vue'
import PlusMenu from './PlusMenu.vue'
import SendStopButton from './SendStopButton.vue'
import { lengthCopy, messageLength } from './messageLimit'
import { useImeSafeEnter } from '@/composables/agent/useImeSafeEnter'
import { usePlatform } from '@/composables/agent/usePlatform'
import { agentMeta } from '@/lib/agent/agentsMeta'
import { useAgentUiStore } from '@/stores/agentUi'

const props = defineProps({
  modelValue: { type: String, default: '' },
  agent: { type: String, default: null },
  // [{key, name, icon, starter, unavailable}] from agentList(catalog, status)
  agents: { type: Array, default: () => [] },
  catalog: { type: Array, default: null },
  // The agent is working on this chat (Send becomes Stop).
  busy: { type: Boolean, default: false },
  stopping: { type: Boolean, default: false },
  // Sending is not possible (agent off, allowance used up...).
  blocked: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Ask a question or make a change' },
  label: { type: String, default: 'Message the agent' },
  // Up in an empty composer edits the last message when allowed.
  canEditLast: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'update:agent', 'submit', 'stop', 'open-page', 'edit-last'])

const MAX_HEIGHT = 280

const ui = useAgentUiStore()
const { coarse } = usePlatform()
const uid = useId()
const fieldId = `ag-composer-${uid}`
const hintId = `ag-composer-hint-${uid}`
const field = ref(null)
const dictationText = ref('')

// A message over the server's limit would only come back refused.
const length = computed(() => messageLength(props.modelValue))
const lengthText = computed(() => (length.value.near ? lengthCopy(length.value) : null))

// A picked writing agent the allowance cannot start would fail only after the
// orchestrator's turn was paid for, so Send waits until it is removed.
const agentUnavailable = computed(() =>
  props.agent ? props.agents.find((a) => a && a.key === props.agent)?.unavailable || '' : ''
)

const canSubmit = computed(
  () => !props.blocked && !agentUnavailable.value && !length.value.over && props.modelValue.trim().length > 0
)

const hint = computed(() => {
  const keys = coarse.value ? 'Use the Send button to send.' : 'Enter sends, Shift+Enter adds a new line.'
  const notes = [agentUnavailable.value, lengthText.value?.long].filter(Boolean)
  return [...notes, keys].join(' ')
})

const placeholderText = computed(() => {
  if (props.agent) {
    const meta = agentMeta(props.agent, props.catalog)
    if (meta.starter) return meta.starter
  }
  return props.placeholder
})

const ime = useImeSafeEnter({
  onSubmit: () => submit(),
  enterSends: () => !coarse.value,
})

function submit() {
  if (props.busy) return
  if (agentUnavailable.value && !props.blocked) {
    ui.announce(agentUnavailable.value, 'assertive')
    return
  }
  if (length.value.over && !props.blocked) {
    ui.announce(lengthText.value.long, 'assertive')
    return
  }
  if (!canSubmit.value) return
  emit('submit', props.modelValue.trim())
}

function grow() {
  const el = field.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_HEIGHT)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
}

function onInput(event) {
  emit('update:modelValue', event.target.value)
  grow()
}

function onKeydown(event) {
  if (event.key === 'ArrowUp' && !props.modelValue && props.canEditLast && !ime.isComposing(event)) {
    if (!event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      emit('edit-last')
      return
    }
  }
  ime.onKeydown(event)
}

function insertDictation(text) {
  const current = props.modelValue
  const el = field.value
  const start = el ? el.selectionStart ?? current.length : current.length
  const end = el ? el.selectionEnd ?? current.length : current.length
  const before = current.slice(0, start)
  const after = current.slice(end)
  const pad = before && !/\s$/.test(before) ? ' ' : ''
  const value = `${before}${pad}${text}${after}`
  emit('update:modelValue', value)
  nextTick(() => {
    grow()
    const caret = before.length + pad.length + text.length
    el?.setSelectionRange(caret, caret)
  })
}

// Clicks on the composer's padding focus the textarea, as in a native field.
function focusFromChrome(event) {
  if (event.target === event.currentTarget || event.target.classList?.contains('ag-composer-footer')) focus()
}

function focus() {
  const el = field.value
  if (!el) return false
  try {
    el.focus({ preventScroll: true })
  } catch {
    el.focus()
  }
  return true
}

watch(
  () => props.modelValue,
  () => nextTick(grow)
)

let unregister = () => {}
onMounted(() => {
  grow()
  unregister = ui.registerComposer(focus)
})
onBeforeUnmount(() => unregister())

defineExpose({ focus })
</script>

<style scoped>
.ag-composer {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid var(--ag-composer-border);
  border-radius: 16px;
  background: var(--ag-composer-bg);
  box-shadow: var(--ag-composer-shadow);
  cursor: text;
  transition: border-color 0.15s ease;
}

.ag-composer:focus-within {
  border-color: color-mix(in srgb, var(--ag-composer-border) 40%, var(--ag-fg-3));
}

.ag-composer-agent {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding: 12px 16px 0;
  cursor: default;
}

.ag-composer-agent-why {
  min-width: 0;
  color: var(--ag-warning);
  font-size: 12px;
  line-height: 16px;
}

/* 16 top padding + one 24px line + room below: 72 with the 8px bottom pad,
   which with the 30px footer and 12px margin gives the reference's 116. */
.ag-composer-input {
  display: block;
  width: 100%;
  min-height: 72px;
  max-height: 280px;
  margin: 0;
  padding: 16px 16px 8px;
  overflow-y: hidden;
  border: 0;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 15px;
  font-weight: 400;
  line-height: 24px;
  resize: none;
  outline: none;
}

.ag-composer.has-agent .ag-composer-input {
  min-height: 66px;
  padding-top: 10px;
}

.ag-composer-input::placeholder {
  color: var(--ag-placeholder);
  opacity: 1;
}

.ag-composer-input:focus-visible {
  outline: none;
}

.ag-composer.is-disabled .ag-composer-input {
  color: var(--ag-fg-3);
  cursor: default;
}

.ag-composer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  margin: 0 12px 12px;
  cursor: default;
}

.ag-composer-spacer {
  flex: 1;
}

.ag-composer-interim {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-4);
  font-size: 13px;
  font-style: italic;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-composer-count {
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-composer-count.is-over {
  color: var(--ag-danger);
  font-weight: 500;
}

@media (pointer: coarse) {
  .ag-composer-input {
    font-size: 16px;
  }
}
</style>
