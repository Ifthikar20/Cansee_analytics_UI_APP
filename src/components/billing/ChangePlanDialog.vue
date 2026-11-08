<template>
  <!-- Moving a paid subscription to the other plan (autopilot_frontend.md
       1c). The change happens now: Polar charges the difference going up
       and credits the unused part going down. The parent refreshes the
       billing payload on `changed`. -->
  <BaseModal
    :model-value="open"
    :title="plan ? `Move to ${plan.name}?` : ''"
    max-width="460px"
    @update:model-value="close"
  >
    <div v-if="plan" class="cpd">
      <p class="cpd-text">{{ body }}</p>
      <p v-if="overLine" class="cpd-text">{{ overLine }}</p>
      <p v-if="error" class="cpd-error" role="alert">{{ error }}</p>
    </div>

    <template #footer>
      <Button variant="outline" :disabled="busy" @click="close(false)">Cancel</Button>
      <Button :disabled="busy || !plan" @click="confirm">{{ plan ? `Move to ${plan.name}` : '' }}</Button>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'
import billingApi from '@/api/billing'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  // The plan to move to (a GET /billing/plans/ entry).
  plan: { type: Object, default: null },
  // The monthly price of the plan the account is on now (45 for legacy Pro).
  currentPrice: { type: Number, default: null },
  // How many prompts the account tracks (billing limits.tracked_prompts.used).
  trackedUsed: { type: Number, default: null },
})
const emit = defineEmits(['changed'])
const open = defineModel('open', { type: Boolean, default: false })

const authStore = useAuthStore()
const toast = useToast()
const busy = ref(false)
const error = ref('')

const goingUp = computed(() => {
  const now = Number(props.currentPrice)
  if (!Number.isFinite(now) || props.currentPrice === null) return true
  return Number(props.plan?.price_monthly) > now
})

const body = computed(() =>
  goingUp.value
    ? 'Your plan changes now. Polar charges the difference for the rest of this billing month.'
    : 'Your plan changes now. Polar credits the unused part to your next invoice.',
)

// Down to a plan that tracks fewer prompts than the account does: nothing is
// archived, Autopilot checks the oldest ones the new plan covers.
const overLine = computed(() => {
  if (goingUp.value) return ''
  const limit = Number(props.plan?.limits?.tracked_prompts)
  const used = Number(props.trackedUsed)
  if (props.trackedUsed === null || !Number.isFinite(limit) || limit < 0 || !(used > limit)) return ''
  return `You track ${used} prompts. Autopilot will check the ${limit} oldest until you archive ${used - limit}.`
})

watch(open, (isOpen) => {
  if (isOpen) error.value = ''
})

function close(value) {
  if (value === false && !busy.value) open.value = false
}

async function confirm() {
  if (!props.plan || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await billingApi.changePlan({ plan: props.plan.id }, { _silentError: true, _noRetry429: true })
    // Plan words and limits flip everywhere once the session knows.
    try { await authStore.fetchSession() } catch { /* the page refreshes the billing payload */ }
    toast.success(`You're on ${props.plan.name}.`)
    emit('changed', props.plan.id)
    open.value = false
  } catch (e) {
    error.value = e?.response?.data?.error?.message || e?.displayMessage || "We couldn't change your plan. Please try again."
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.cpd {
  display: grid;
  gap: 10px;
}

.cpd-text {
  margin: 0;
  color: var(--foreground);
  font-size: 14px;
  line-height: 1.55;
}

.cpd-error {
  margin: 0;
  color: var(--destructive);
  font-size: 13px;
  line-height: 1.5;
}
</style>
