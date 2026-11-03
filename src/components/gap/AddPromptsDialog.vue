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
        placeholder="One question per line"
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
          {{ suggesting ? 'Suggesting...' : 'Suggest from my site' }}
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
import api from '@/api/client'
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

// The API answers some failures with a bare code ({"error": "code"}) and
// others with {"error": {"code", "message"}}.
function errorCode(err) {
  const e = err?.response?.data?.error
  return typeof e === 'string' ? e : e?.code || ''
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

// Requests are silent: every failure renders inline in the dialog.
async function save() {
  saving.value = true
  error.value = ''
  try {
    const res = await api.post(
      `/prompt-library/websites/${props.websiteId}/prompts/`,
      { text: lines.value.join('\n'), location: location.value },
      { _silentError: true },
    )
    const added = `Added ${plural(res.data?.created_count ?? lines.value.length, 'prompt', 'prompts')}.`
    // A run is only queued when the API returns its id.
    toast.success(res.data?.scan_audit_id ? `${added} The AI engines are being asked now.` : added)
    text.value = ''
    open.value = false
    emit('added')
  } catch (err) {
    if (errorCode(err) === 'no_llm_provider_configured') {
      error.value = "AI engines aren't available yet."
      // Refresh the list in case the prompts were saved before the run was refused.
      emit('added')
    } else {
      error.value = err.displayMessage || "We couldn't add those prompts. Please try again."
    }
  } finally {
    saving.value = false
  }
}

// Saves a starter set built from the project's site, then refreshes.
async function suggest() {
  suggesting.value = true
  error.value = ''
  try {
    const res = await api.post(
      `/prompt-library/websites/${props.websiteId}/prompts/generate-samples/`,
      { count: 10 },
      { _silentError: true },
    )
    const n = res.data?.total ?? res.data?.generated?.length ?? 0
    toast.success(`Added ${plural(n, 'suggested prompt', 'suggested prompts')}.`)
    open.value = false
    emit('added')
  } catch (err) {
    const code = errorCode(err)
    if (code === 'synthesis_not_configured') error.value = "Suggestions aren't available yet."
    else if (code === 'synthesis_failed') error.value = "We couldn't suggest prompts right now."
    else error.value = err.displayMessage || "We couldn't suggest prompts right now."
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
