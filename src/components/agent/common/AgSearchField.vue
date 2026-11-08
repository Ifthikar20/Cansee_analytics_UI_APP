<script setup>
// Search input with a leading icon and a clear button. v-model updates on
// every keystroke; `search` fires debounced with the trimmed value.
import { onBeforeUnmount, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'

const model = defineModel({ type: String, default: '' })

const props = defineProps({
  label: { type: String, required: true },
  placeholder: { type: String, default: '' },
  debounce: { type: Number, default: 250 },
})

const emit = defineEmits(['search'])

const inputEl = ref(null)
let timer = null

watch(model, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('search', String(value || '').trim()), props.debounce)
})

onBeforeUnmount(() => clearTimeout(timer))

function clear() {
  model.value = ''
  inputEl.value?.focus()
}

function onKeydown(event) {
  if (event.key === 'Escape' && model.value) {
    event.preventDefault()
    event.stopPropagation()
    model.value = ''
  }
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<template>
  <div class="ag-search" role="search">
    <Search class="ag-search-icon" :size="16" aria-hidden="true" />
    <input
      ref="inputEl"
      v-model="model"
      class="ag-search-input"
      type="search"
      :placeholder="placeholder || label"
      :aria-label="label"
      autocomplete="off"
      spellcheck="false"
      @keydown="onKeydown"
    />
    <button v-if="model" type="button" class="ag-search-clear" aria-label="Clear search" @click="clear">
      <X :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.ag-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.ag-search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--ag-fg-3);
  pointer-events: none;
}

.ag-search-input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 0 36px 0 38px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 10px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.ag-search-input::placeholder {
  color: var(--ag-placeholder);
}

.ag-search-input::-webkit-search-cancel-button {
  display: none;
}

.ag-search-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: 10px;
  outline: none;
}

.ag-search-clear {
  position: absolute;
  right: 6px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-3);
  cursor: pointer;
}

.ag-search-clear:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-search-clear:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 0;
}

@media (pointer: coarse) {
  .ag-search-input {
    font-size: 16px;
  }
}
</style>
