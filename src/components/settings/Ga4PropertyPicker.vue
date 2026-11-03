<template>
  <BaseModal
    :model-value="modelValue"
    title="Choose a Google Analytics property"
    subtitle="Pick the Google Analytics 4 property that measures this website."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="properties.length" class="space-y-2" role="radiogroup" aria-label="Google Analytics properties">
      <label
        v-for="p in properties"
        :key="p.property_id"
        class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5 text-sm transition-colors hover:bg-muted"
        :class="{ 'border-primary bg-muted': selected === p.property_id }"
      >
        <span class="flex min-w-0 items-center gap-2">
          <input v-model="selected" type="radio" name="ga4-property" :value="p.property_id" class="accent-current" />
          <span class="truncate font-medium">{{ p.display_name || p.property_id }}</span>
        </span>
        <span v-if="p.account_name" class="shrink-0 text-xs text-muted-foreground">{{ p.account_name }}</span>
      </label>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      This Google account has no Google Analytics 4 property. Create one in Google Analytics, then choose it here.
    </p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="emit('update:modelValue', false)">Cancel</Button>
        <Button :disabled="!selected || saving" @click="emit('select', selected)">
          {{ saving ? 'Saving...' : 'Use this property' }}
        </Button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
// The Google Analytics 4 properties the connected Google account can read;
// the chosen one feeds this project's traffic.
import { ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  // [{property_id, display_name, account_name}]
  properties: { type: Array, default: () => [] },
  // The property in use, preselected.
  current: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'select'])

const selected = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) selected.value = props.current || ''
  },
  { immediate: true },
)
</script>
