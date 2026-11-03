<template>
  <form class="ag-urlbar" :class="{ 'is-compact': compact, 'has-error': Boolean(error) }" @submit.prevent="submit">
    <label :for="inputId" class="ag-sr-only">Web address</label>
    <Globe class="ag-urlbar-icon" :size="compact ? 14 : 16" aria-hidden="true" />
    <input
      :id="inputId"
      ref="input"
      v-model="text"
      class="ag-urlbar-input"
      type="text"
      inputmode="url"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="go"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : 'false'"
      :aria-describedby="error ? errorId : undefined"
      @focus="onFocus"
      @keydown.esc="onEscape"
    />
    <button v-if="!compact" type="submit" class="ag-urlbar-go" :disabled="!text.trim()">Open</button>
    <p v-if="error" :id="errorId" class="ag-urlbar-error" role="alert">{{ error }}</p>
  </form>
</template>

<script setup>
import { onMounted, ref, useId, watch } from 'vue'
import { Globe } from '@lucide/vue'
import { normalizeAddress } from '@/lib/agent/url'

const props = defineProps({
  value: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Enter a web address' },
})

const emit = defineEmits(['submit'])

const uid = useId()
const inputId = `ag-urlbar-${uid}`
const errorId = `ag-urlbar-err-${uid}`
const input = ref(null)
const text = ref(props.value)
const error = ref('')

watch(
  () => props.value,
  (value) => {
    if (document.activeElement !== input.value) text.value = value
  }
)

watch(text, () => {
  error.value = ''
})

function submit() {
  const raw = text.value.trim()
  if (!raw) return
  const url = normalizeAddress(raw)
  if (!url) {
    error.value = 'Enter a full web address, for example yourcompany.com/pricing.'
    return
  }
  error.value = ''
  text.value = url
  emit('submit', url)
  input.value?.blur()
}

function onFocus() {
  input.value?.select()
}

function onEscape(event) {
  if (text.value === props.value && !error.value) return
  event.stopPropagation()
  text.value = props.value
  error.value = ''
}

onMounted(() => {
  if (props.autofocus) input.value?.focus()
})

defineExpose({ focus: () => input.value?.focus() })
</script>

<style scoped>
.ag-urlbar {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
}

.ag-urlbar-icon {
  position: absolute;
  top: 14px;
  left: 16px;
  color: var(--ag-fg-3);
  pointer-events: none;
}

.ag-urlbar-input {
  flex: 1 1 200px;
  box-sizing: border-box;
  min-width: 0;
  height: 44px;
  padding: 0 14px 0 42px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 12px;
  background: var(--ag-composer-bg);
  box-shadow: var(--ag-composer-shadow);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 15px;
  line-height: 24px;
  outline: none;
  transition: border-color 120ms ease;
}

.ag-urlbar-input::placeholder {
  color: var(--ag-placeholder);
}

.ag-urlbar-input:focus-visible {
  border-color: var(--ag-ring);
}

.ag-urlbar.has-error .ag-urlbar-input {
  border-color: var(--ag-danger);
}

.ag-urlbar-go {
  flex-shrink: 0;
  height: 44px;
  padding: 0 16px;
  border: 1px solid var(--ag-send-bg);
  border-radius: 12px;
  background: var(--ag-send-bg);
  color: var(--ag-send-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.ag-urlbar-go:disabled {
  border-color: var(--ag-btn-border);
  background: var(--ag-send-disabled-bg);
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-urlbar-go:focus-visible {
  border-radius: 12px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-urlbar-error {
  flex: 1 0 100%;
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

/* In the pane header. */
.ag-urlbar.is-compact {
  flex-wrap: nowrap;
}

.ag-urlbar.is-compact .ag-urlbar-icon {
  top: 9px;
  left: 10px;
}

.ag-urlbar.is-compact .ag-urlbar-input {
  height: 32px;
  padding: 0 10px 0 30px;
  border-color: var(--ag-btn-border);
  border-radius: 8px;
  background: var(--ag-tab-bg);
  box-shadow: none;
  font-size: 13px;
  line-height: 20px;
}

.ag-urlbar.is-compact .ag-urlbar-input:focus-visible {
  border-color: var(--ag-ring);
  background: var(--ag-composer-bg);
}

.ag-urlbar.is-compact .ag-urlbar-error {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 2;
  padding: 6px 10px;
  border: 1px solid var(--ag-menu-border);
  border-radius: 8px;
  background: var(--ag-menu-bg);
  box-shadow: var(--ag-shadow-pop);
  font-size: 12px;
  white-space: nowrap;
}
</style>
