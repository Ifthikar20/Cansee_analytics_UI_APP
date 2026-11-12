<script setup>
// A labelled native <select> drawn like the shell's chips. Native on
// purpose: keyboard, screen readers and phones get the platform picker.
// options: [{value, label, disabled?}].
import { ChevronDown } from '@lucide/vue'

defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  options: { type: Array, required: true },
  id: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="an-select">
    <span class="an-select-label">{{ label }}</span>
    <span class="an-select-box">
      <select
        :id="id || undefined"
        class="an-select-input"
        :value="modelValue"
        @change="emit('update:modelValue', $event.target.value)"
      >
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
          :disabled="opt.disabled || undefined"
        >{{ opt.label }}</option>
      </select>
      <ChevronDown class="an-select-caret" aria-hidden="true" />
    </span>
  </label>
</template>

<style scoped>
.an-select {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.an-select-label {
  flex-shrink: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 500;
}

.an-select-box {
  position: relative;
  display: inline-flex;
  min-width: 0;
}

.an-select-input {
  min-width: 0;
  max-width: 260px;
  height: 34px;
  padding: 0 32px 0 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.an-select-input:hover {
  border-color: var(--input);
  background: var(--accent);
}

.an-select-input:focus-visible {
  border-color: var(--ring);
  border-radius: var(--radius);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.an-select-input option {
  background: var(--popover);
  color: var(--popover-foreground);
}

.an-select-caret {
  position: absolute;
  top: 50%;
  right: 10px;
  width: 14px;
  height: 14px;
  color: var(--muted-foreground);
  transform: translateY(-50%);
  pointer-events: none;
}

/* The viewport rule serves Settings and the run dialogs; the container
   rule serves the pages in the board's side panel. */
@media (max-width: 640px) {
  .an-select-input {
    max-width: 200px;
  }
}

@container bd-panel (max-width: 480px) {
  .an-select-input {
    max-width: 200px;
  }
}
</style>
