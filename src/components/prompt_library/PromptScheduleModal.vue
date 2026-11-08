<script setup>
// Per-prompt run schedule: runs one prompt on a daily/weekly/monthly
// cadence. "Run now" is delegated to the parent's existing scan flow so
// scan state stays in one place.
import { ref, computed, watch } from 'vue'
import { Play } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import BaseModal from '@/components/ui/BaseModal.vue'
import promptLibrary from '@/api/promptLibrary'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  websiteId: { type: String, required: true },
  promptId: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue', 'changed', 'run-now'])

const toast = useToast()
const schedule = ref(null)
const frequency = ref('weekly')
const saving = ref(false)
const removing = ref(false)

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function fmt(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
const lastRun = computed(() => fmt(schedule.value?.last_run_at))
const nextRun = computed(() => fmt(schedule.value?.next_run_at))

async function loadSchedule() {
  try {
    const { data } = await promptLibrary.getPromptSchedule(props.websiteId, props.promptId)
    schedule.value = data?.schedule ?? null
    if (schedule.value?.frequency) frequency.value = schedule.value.frequency
  } catch {
    schedule.value = null
  }
}

// Refetch each time the dialog opens so it reflects any change made elsewhere.
watch(() => props.modelValue, (isOpen) => { if (isOpen) loadSchedule() })

async function save() {
  saving.value = true
  try {
    const { data } = await promptLibrary.savePromptSchedule(props.websiteId, props.promptId, {
      frequency: frequency.value,
      is_enabled: true,
    })
    schedule.value = data?.schedule ?? null
    emit('changed', schedule.value)
    toast.success('Schedule saved. This prompt will run automatically.')
    open.value = false
  } catch {
    /* the client interceptor toasts */
  } finally {
    saving.value = false
  }
}

async function remove() {
  removing.value = true
  try {
    await promptLibrary.deletePromptSchedule(props.websiteId, props.promptId)
    schedule.value = null
    emit('changed', null)
    toast.success('Schedule removed.')
    open.value = false
  } catch {
    /* the client interceptor toasts */
  } finally {
    removing.value = false
  }
}

function runNow() {
  emit('run-now')
  open.value = false
}
</script>

<template>
  <BaseModal v-model="open" title="Schedule this prompt">
    <p class="mb-3 text-sm text-muted-foreground">
      Run this prompt automatically on a schedule.
    </p>

    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs font-semibold text-foreground">Frequency</label>
        <select
          v-model="frequency"
          class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div
        v-if="schedule"
        class="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
      >
        <span v-if="lastRun" class="text-[11px] text-muted-foreground">
          <span class="font-semibold uppercase tracking-wide">Last run</span>
          <span class="ml-1.5 font-bold text-foreground">{{ lastRun }}</span>
        </span>
        <span v-if="nextRun" class="text-[11px] text-muted-foreground">
          <span class="font-semibold uppercase tracking-wide">Next run</span>
          <span class="ml-1.5 font-bold text-foreground">{{ nextRun }}</span>
        </span>
        <span v-if="schedule.is_paused" class="text-[11px] font-semibold text-[#C02926] dark:text-[#f87171]">
          Auto-paused after repeated failures — save to resume.
        </span>
      </div>

      <div class="rounded-lg border border-dashed border-border px-3 py-2.5">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[13px] font-semibold text-foreground">Run once now</p>
            <p class="text-[11px] text-muted-foreground">
              Scan immediately, without waiting for the next scheduled run.
            </p>
          </div>
          <Button size="sm" variant="secondary" @click="runNow">
            <Play class="size-3.5" />
            Run now
          </Button>
        </div>
      </div>
    </div>

    <template #footer>
      <Button v-if="schedule" variant="destructive" class="mr-auto" :disabled="removing" @click="remove">
        {{ removing ? 'Removing…' : 'Remove schedule' }}
      </Button>
      <Button variant="secondary" @click="open = false">Cancel</Button>
      <Button :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : (schedule ? 'Update schedule' : 'Save schedule') }}
      </Button>
    </template>
  </BaseModal>
</template>
