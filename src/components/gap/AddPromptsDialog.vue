<template>
  <BaseModal
    :model-value="open"
    title="Add prompts"
    subtitle="The questions your buyers ask, one per line. Don't include your brand name: a prompt measures whether AI brings you up on its own."
    @update:model-value="open = $event"
  >
    <div class="apd">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="apd-text"
        rows="6"
        placeholder="best crm for small business&#10;crm with built-in email automation&#10;hubspot alternatives for startups"
      ></textarea>

      <div class="apd-row">
        <label class="apd-label" for="apd-location">Search from</label>
        <select id="apd-location" v-model="location" class="apd-select">
          <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">{{ c.label }}</option>
        </select>
        <span class="apd-count">{{ lines.length }} {{ lines.length === 1 ? 'prompt' : 'prompts' }}</span>
      </div>

      <p v-if="error" class="apd-error">{{ error }}</p>
    </div>

    <template #footer>
      <div class="apd-footer">
        <Button variant="ghost" :disabled="busy" @click="suggest">
          <Sparkles class="size-4" />
          {{ suggesting ? 'Generating...' : 'Suggest 10 from my site' }}
        </Button>
        <div class="apd-footer-right">
          <Button variant="outline" :disabled="busy" @click="open = false">Cancel</Button>
          <Button :disabled="busy || !lines.length" @click="save">{{ saveLabel }}</Button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Sparkles } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'
import promptLibrary from '@/api/promptLibrary'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  websiteId: { type: String, required: true },
})
const emit = defineEmits(['added'])
const open = defineModel('open', { type: Boolean, default: false })

// ISO-2 codes, matching BrandPrompt.location. Google results and the
// web-search engines both run from this country.
const COUNTRIES = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'ca', label: 'Canada' },
  { code: 'au', label: 'Australia' },
  { code: 'in', label: 'India' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: '', label: 'Global' },
]

const toast = useToast()
const text = ref('')
const location = ref('us')
const saving = ref(false)
const suggesting = ref(false)
const error = ref('')
const textareaRef = ref(null)

const busy = computed(() => saving.value || suggesting.value)
const lines = computed(() =>
  [...new Set(text.value.split('\n').map((l) => l.trim()).filter(Boolean))],
)
const saveLabel = computed(() => {
  if (saving.value) return 'Adding...'
  const n = lines.value.length
  if (!n) return 'Add prompts'
  return `Add ${n} ${n === 1 ? 'prompt' : 'prompts'}`
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  error.value = ''
  await nextTick()
  textareaRef.value?.focus()
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    await promptLibrary.savePromptToWebsite(props.websiteId, {
      text: lines.value.join('\n'),
      location: location.value,
    })
    toast.success(`Added ${lines.value.length} ${lines.value.length === 1 ? 'prompt' : 'prompts'}. The AI engines are being asked now.`)
    text.value = ''
    open.value = false
    emit('added')
  } catch (err) {
    error.value = err.displayMessage || "We couldn't add those prompts. Please try again."
  } finally {
    saving.value = false
  }
}

// Saves a starter set built from the project's site, then refreshes.
async function suggest() {
  suggesting.value = true
  error.value = ''
  try {
    await promptLibrary.generateSamples(props.websiteId, { count: 10 })
    toast.success('Added 10 suggested prompts from your site.')
    open.value = false
    emit('added')
  } catch (err) {
    error.value = err.displayMessage || "We couldn't generate suggestions right now."
  } finally {
    suggesting.value = false
  }
}
</script>

<style scoped>
.apd {
  display: grid;
  gap: 14px;
}

.apd-text {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--input);
  border-radius: 12px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
}

.apd-text:focus-visible {
  border-color: var(--ring);
  border-radius: 12px;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
}

.apd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.apd-label {
  color: var(--muted-foreground);
}

.apd-select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--input);
  border-radius: 10px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
}

.apd-count {
  margin-left: auto;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.apd-error {
  color: var(--destructive);
  font-size: 13px;
}

.apd-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.apd-footer-right {
  display: flex;
  gap: 8px;
}
</style>
