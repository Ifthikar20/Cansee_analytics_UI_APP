<template>
  <!-- Run now (autopilot_frontend.md 2b, contract 3a): the server's estimate
       first, then a run that sends exactly the estimate's `confirm`. A
       blocker replaces the button with its message; if the cost moved in
       between (409 estimate_changed) the new estimate replaces the old one. -->
  <AgDialog v-model:open="open" title="Run Autopilot now?" :description="sentence" wide>
    <div class="rnd" :aria-busy="loading ? 'true' : 'false'">
      <p v-if="loading" class="rnd-muted">Estimating the cost...</p>
      <p v-else-if="loadError" class="rnd-error" role="alert">{{ loadError }}</p>
      <template v-else-if="estimate">
        <p v-if="limited" class="rnd-note">{{ limited }}</p>
        <dl class="rnd-rows">
          <div class="rnd-row">
            <dt>AI answers</dt>
            <dd>up to {{ count(estimate.answers_max) }}</dd>
          </div>
          <div v-if="usd(estimate.usd_max)" class="rnd-row">
            <dt>AI cost</dt>
            <dd>
              up to {{ usd(estimate.usd_max) }}<template v-if="usd(estimate.usd_expected)">, about {{ usd(estimate.usd_expected) }}</template>
            </dd>
          </div>
          <div v-if="pagesMax > 0" class="rnd-row">
            <dt>Google pages</dt>
            <dd>
              up to {{ count(pagesMax) }}<template v-if="hasCredits"> ({{ count(estimate.credits_max) }} ScraperAPI credits)</template>
            </dd>
          </div>
          <div v-if="allowanceLeft" class="rnd-row">
            <dt>Allowance left</dt>
            <dd>{{ allowanceLeft }}</dd>
          </div>
        </dl>
        <p v-if="changedNote" class="rnd-note" role="status">{{ changedNote }}</p>
        <div v-if="blockers.length" class="rnd-blockers" role="alert">
          <p v-for="b in blockers" :key="b.code" class="rnd-error">{{ b.message }}</p>
        </div>
        <p v-if="runError" class="rnd-error" role="alert">{{ runError }}</p>
      </template>
    </div>

    <template #actions>
      <AgButton variant="secondary" @click="open = false">Cancel</AgButton>
      <AgButton v-if="showRun" variant="primary" :disabled="!canRun" :loading="submitting" @click="run">Run now</AgButton>
    </template>
  </AgDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgDialog from '@/components/agent/common/AgDialog.vue'
import autopilotApi from '@/api/autopilot'
import { count, limitedLine, runNowSentence, usd } from '@/lib/autopilot/format'

const props = defineProps({
  websiteId: { type: String, required: true },
  // Whether the saved settings analyze new answers (the sentence names it).
  analysis: { type: Boolean, default: true },
})
const emit = defineEmits(['started'])
const open = defineModel('open', { type: Boolean, default: false })

const estimate = ref(null)
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const runError = ref('')
const changedNote = ref('')
// Set by a 409 run_today_exists: nothing can run until tomorrow.
const refused = ref(false)

const sentence = computed(() => (estimate.value ? runNowSentence(estimate.value, { analysis: props.analysis }) : ''))
const limited = computed(() => limitedLine(estimate.value))
const blockers = computed(() => estimate.value?.blockers || [])
const pagesMax = computed(() => Number(estimate.value?.pages_max) || 0)
const hasCredits = computed(() => estimate.value?.credits_max !== null && estimate.value?.credits_max !== undefined)
// '' (row left out) when the server sent no allowance.
const allowanceLeft = computed(() => {
  const a = estimate.value?.allowance || {}
  if (a.unlimited) return 'Unlimited'
  return usd(a.left_usd)
})

const showRun = computed(() => Boolean(estimate.value) && !blockers.value.length && !refused.value)
const canRun = computed(() => showRun.value && !loading.value && !submitting.value && estimate.value?.can_run !== false)

function serverError(e) {
  return e?.response?.data?.error || null
}

async function loadEstimate() {
  loading.value = true
  loadError.value = ''
  estimate.value = null
  const id = props.websiteId
  try {
    const { data } = await autopilotApi.estimate(id)
    if (!open.value || id !== props.websiteId) return
    estimate.value = data || null
  } catch (e) {
    loadError.value = serverError(e)?.message || e?.displayMessage || "We couldn't estimate the run."
  } finally {
    loading.value = false
  }
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    runError.value = ''
    changedNote.value = ''
    refused.value = false
    loadEstimate()
  },
  { immediate: true },
)

async function run() {
  if (!canRun.value) return
  submitting.value = true
  runError.value = ''
  changedNote.value = ''
  try {
    const { data } = await autopilotApi.runNow(props.websiteId, estimate.value.confirm)
    emit('started', data)
    open.value = false
  } catch (e) {
    const err = serverError(e)
    if (err?.code === 'estimate_changed' && err.details?.estimate) {
      // The cost moved: show the new estimate and its words; the user confirms again.
      estimate.value = err.details.estimate
      changedNote.value = err.message || ''
    } else {
      if (err?.code === 'run_today_exists') refused.value = true
      runError.value = err?.message || e?.displayMessage || "We couldn't start the run."
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.rnd {
  display: grid;
  gap: 12px;
  font-size: 14px;
  line-height: 1.5;
}

.rnd-muted {
  margin: 0;
  color: var(--ag-fg-2);
}

.rnd-note {
  margin: 0;
  color: var(--ag-fg-1);
  font-weight: 500;
}

.rnd-error {
  margin: 0;
  color: var(--ag-danger);
}

.rnd-blockers {
  display: grid;
  gap: 6px;
}

.rnd-rows {
  display: grid;
  gap: 0;
  margin: 0;
  border: 1px solid var(--ag-menu-border);
  border-radius: var(--radius);
}

.rnd-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
  padding: 10px 14px;
}

.rnd-row + .rnd-row {
  border-top: 1px solid var(--ag-menu-border);
}

.rnd-row dt {
  color: var(--ag-fg-2);
}

.rnd-row dd {
  margin: 0;
  color: var(--ag-fg-1);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
