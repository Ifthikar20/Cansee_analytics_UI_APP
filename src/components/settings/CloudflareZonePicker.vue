<template>
  <BaseModal
    :model-value="modelValue"
    title="Choose a Cloudflare zone"
    subtitle="We could not match your website to a zone this token can read. Pick the one that serves it."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="zones.length" class="space-y-2" role="radiogroup" aria-label="Cloudflare zones">
      <label
        v-for="z in zones"
        :key="z.id"
        class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5 text-sm transition-colors hover:bg-muted"
        :class="{ 'border-primary bg-muted': selected === z.id }"
      >
        <span class="flex min-w-0 items-center gap-2">
          <input v-model="selected" type="radio" name="cf-zone" :value="z.id" class="accent-current" />
          <span class="truncate font-medium">{{ z.name }}</span>
        </span>
        <span v-if="z.paused" class="shrink-0 text-xs text-muted-foreground">Paused</span>
      </label>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      This token can't read any zone. Give it the Zone, Analytics, Read permission, then connect again.
    </p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="emit('update:modelValue', false)">Cancel</Button>
        <Button :disabled="!selected || saving" @click="emit('select', selected)">
          {{ saving ? 'Saving...' : 'Use this zone' }}
        </Button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
// The Cloudflare zones the project's API token can read; the chosen one
// feeds this project's requests, countries and AI crawlers.
import { ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  // [{id, name, status, paused}]
  zones: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'select'])

const selected = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) selected.value = ''
  },
)
</script>
