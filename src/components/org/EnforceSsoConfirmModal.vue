<template>
  <BaseModal
    :model-value="modelValue"
    title="Require SSO for everyone"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="esm-body">
      <p class="esm-text">
        Turning this on locks the whole organization to Google single sign-on:
      </p>
      <ul class="esm-list">
        <li>Everyone in the org is signed out immediately and must sign back in with Google.</li>
        <li>Password sign-in is disabled for all members.</li>
        <li>Password reset is disabled — there is no password to fall back to.</li>
      </ul>
      <p class="esm-text">
        Type <b>{{ domain }}</b> to confirm. A misclick cannot pass this.
      </p>
      <input
        v-model="typed"
        type="text"
        class="esm-input"
        :placeholder="domain"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter.prevent="tryConfirm"
      />
      <p v-if="error" class="esm-error">{{ error }}</p>
    </div>
    <template #footer>
      <Button variant="outline" size="sm" @click="$emit('update:modelValue', false)">Cancel</Button>
      <Button variant="destructive" size="sm" :disabled="!matches || busy" @click="tryConfirm">
        {{ busy ? 'Enforcing…' : 'Sign everyone out and require SSO' }}
      </Button>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  /** The primary verified domain the owner must type to confirm. */
  domain: { type: String, required: true },
  busy: { type: Boolean, default: false },
  /** Inline error from the enforce call (already mapped to words). */
  error: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const typed = ref('')
const matches = computed(
  () => typed.value.trim().toLowerCase() === props.domain.trim().toLowerCase(),
)

// A reopened modal must never remember the previous confirmation.
watch(() => props.modelValue, (open) => {
  if (open) typed.value = ''
})

function tryConfirm() {
  if (matches.value && !props.busy) emit('confirm')
}
</script>

<style scoped>
.esm-body { display: flex; flex-direction: column; gap: 12px; }
.esm-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--foreground);
}
.esm-list {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--foreground);
}
.esm-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.esm-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}
.esm-error {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--destructive);
}
</style>
