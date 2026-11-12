<template>
  <!-- The daily text of one project (autopilot_frontend.md 2b, contract 3a
       and 3b). Consent belongs to the number's owner: turning the text on,
       or sending it to another number, takes the caller's own verified
       number and their own agreement. Any member can turn it off. -->
  <SettingsSection
    title="Daily text"
    description="One text after each run with what ran and which prompts keep you visible."
  >
    <template v-if="state === 'unavailable'">
      <p class="dt-muted">Text messages aren't set up on this server yet.</p>
      <!-- The run still writes its text, so the owner sees what would arrive. -->
      <figure v-if="lastText?.body" class="dt-last">
        <figcaption class="dt-label">The last run's text (not sent)</figcaption>
        <blockquote class="dt-quote">{{ lastText.body }}</blockquote>
      </figure>
    </template>

    <div v-else-if="state === 'no-number'" class="dt-stack">
      <p class="dt-muted">Add and verify your mobile number in Connections to get the daily text.</p>
      <Button as-child variant="outline" class="dt-btn">
        <router-link to="/settings/connections">Open Connections</router-link>
      </Button>
    </div>

    <div v-else class="dt-stack">
      <p v-if="showOthers" class="dt-line">{{ othersLine }}</p>

      <div class="dt-switch-row">
        <input
          id="dt-digest"
          type="checkbox"
          role="switch"
          class="dt-switch"
          :checked="digest"
          :disabled="!digest && !canTurnOn"
          :aria-describedby="errors.sms_digest ? 'dt-digest-error' : undefined"
          @change="toggle($event.target.checked)"
        />
        <label for="dt-digest" class="dt-switch-label">Text me after each run</label>
      </div>
      <p v-if="errors.sms_digest" id="dt-digest-error" class="dt-error">{{ errors.sms_digest }}</p>

      <template v-if="digest">
        <div class="dt-field">
          <label for="dt-number" class="dt-label">Send to</label>
          <select
            id="dt-number"
            v-model="recipient"
            class="dt-select"
            :aria-describedby="errors.sms_subscription_id ? 'dt-number-error' : undefined"
          >
            <option v-for="n in numberOptions" :key="n.id" :value="n.id">{{ n.label }}</option>
          </select>
          <p v-if="errors.sms_subscription_id" id="dt-number-error" class="dt-error">{{ errors.sms_subscription_id }}</p>
        </div>

        <!-- Shown when the text turns on or its number changes (saving then
             stores the consent and the server texts the opt-in message), or
             when the last text waits for the number's owner to agree again. -->
        <div v-if="needsConsent" class="dt-consent">
          <p class="dt-consent-text">{{ sms.consent_text }}</p>
          <p class="dt-consent-links">
            <a href="/terms#sms" target="_blank" rel="noopener">Text message terms</a>
            <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
          </p>
          <label class="dt-agree">
            <input
              v-model="consent"
              type="checkbox"
              :required="consentRequired"
              :aria-describedby="errors.sms_consent ? 'dt-consent-error' : undefined"
            />
            <span>I agree</span>
          </label>
          <p v-if="errors.sms_consent" id="dt-consent-error" class="dt-error">{{ errors.sms_consent }}</p>
        </div>

        <div class="dt-field">
          <p class="dt-quiet">
            <span>Don't text between</span>
            <select v-model="quietStart" class="dt-select" aria-label="Quiet hours start" aria-describedby="dt-quiet-help">
              <option v-for="t in quietStarts" :key="t" :value="t">{{ t }}</option>
            </select>
            <span>and</span>
            <select v-model="quietEnd" class="dt-select" aria-label="Quiet hours end" aria-describedby="dt-quiet-help">
              <option v-for="t in quietEnds" :key="t" :value="t">{{ t }}</option>
            </select>
          </p>
          <p id="dt-quiet-help" class="dt-help">
            A text that is ready during quiet hours waits until they end. Times are in {{ timezone }}.
          </p>
        </div>
      </template>
      <p v-if="errors.quiet_start" class="dt-error">{{ errors.quiet_start }}</p>
      <p v-if="errors.quiet_end" class="dt-error">{{ errors.quiet_end }}</p>

      <figure v-if="lastText?.body" class="dt-last">
        <figcaption class="dt-label">Last text</figcaption>
        <blockquote class="dt-quote">{{ lastText.body }}</blockquote>
        <p v-if="lastTextLine" class="dt-help">{{ lastTextLine }}</p>
      </figure>

      <div v-if="canTest" class="dt-test">
        <Button variant="outline" class="dt-btn" :disabled="testing" @click="sendTest">Send a test text</Button>
        <p v-if="testError" class="dt-error" role="alert">{{ testError }}</p>
      </div>
    </div>

    <template v-if="state === 'ready'" #footer>
      <Button class="dt-btn" :disabled="!dirty || saving" @click="emit('save')">
        {{ saving ? 'Saving...' : 'Save changes' }}
      </Button>
    </template>
  </SettingsSection>
</template>

<script setup>
import { computed, ref } from 'vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import { Button } from '@/components/ui/button'
import autopilotApi from '@/api/autopilot'
import { useToast } from '@/composables/useToast'
import { QUARTER_HOURS, consentNeeded, textStatusLine } from '@/lib/autopilot/format'

const props = defineProps({
  websiteId: { type: String, required: true },
  // The settings payload's `sms` block.
  sms: { type: Object, default: () => ({}) },
  // The saved settings (payload.settings): what the server has now.
  saved: { type: Object, default: () => ({}) },
  // The project's time zone as the form has it.
  timezone: { type: String, default: 'UTC' },
  // Field errors: {sms_digest, sms_subscription_id, sms_consent, quiet_start, quiet_end}.
  errors: { type: Object, default: () => ({}) },
  // The latest run's text: {text (RunSummary text), body}.
  lastText: { type: Object, default: null },
  // The last text was held until the number's owner agrees again: the
  // consent box shows with the text and its number unchanged.
  agreeAgain: { type: Boolean, default: false },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save'])

const digest = defineModel('digest', { type: Boolean, default: false })
const recipient = defineModel('recipient', { type: String, default: null })
const quietStart = defineModel('quietStart', { type: String, default: '21:00' })
const quietEnd = defineModel('quietEnd', { type: String, default: '08:00' })
const consent = defineModel('consent', { type: Boolean, default: false })

const toast = useToast()
const testing = ref(false)
const testError = ref('')

// The caller's own verified numbers.
const own = computed(() => (props.sms?.numbers || []).filter((n) => n && n.yours !== false))
const recipientInfo = computed(() => props.sms?.recipient || null)
const savedOn = computed(() => Boolean(props.saved?.sms_digest))
const savedRecipient = computed(() => props.saved?.sms_subscription_id || null)

// The saved number belongs to another member.
const othersNumber = computed(() => {
  const r = recipientInfo.value
  if (!r) return false
  if (typeof r.yours === 'boolean') return !r.yours
  return !own.value.some((n) => n.id === r.id)
})

const state = computed(() => {
  if (!props.sms?.available) return 'unavailable'
  if (!own.value.length && !(savedOn.value && savedRecipient.value)) return 'no-number'
  return 'ready'
})

// Off, the switch turns on with one of the caller's numbers, or back to the
// number it had when it was on.
const canTurnOn = computed(() => own.value.length > 0 || (savedOn.value && Boolean(savedRecipient.value)))

const showOthers = computed(() => othersNumber.value && digest.value && recipient.value === recipientInfo.value?.id)
const othersLine = computed(() => {
  const r = recipientInfo.value || {}
  return r.set_by_name ? `Texts go to ${r.phone_masked}, set by ${r.set_by_name}.` : `Texts go to ${r.phone_masked}.`
})

// The caller's numbers, plus another member's number while the text goes to
// it (choosing it again changes nothing, so it needs no consent).
const numberOptions = computed(() => {
  const list = own.value.map((n) => ({ id: n.id, label: n.phone_masked }))
  const r = recipientInfo.value
  const keepTheirs = recipient.value === r?.id || (savedOn.value && savedRecipient.value === r?.id)
  if (othersNumber.value && r && keepTheirs) list.unshift({ id: r.id, label: r.phone_masked })
  return list
})

// Turning the text on or moving it to another number needs the agreement.
const consentRequired = computed(() =>
  consentNeeded({ sms_digest: digest.value, sms_subscription_id: recipient.value }, props.saved),
)
const needsConsent = computed(() => consentRequired.value || props.agreeAgain)

function withValue(list, value) {
  return value && !list.includes(value) ? [...list, value].sort() : list
}
const quietStarts = computed(() => withValue(QUARTER_HOURS, quietStart.value))
const quietEnds = computed(() => withValue(QUARTER_HOURS, quietEnd.value))

function toggle(on) {
  if (on) {
    if (savedOn.value && savedRecipient.value && (!recipient.value || recipient.value === savedRecipient.value)) {
      recipient.value = savedRecipient.value
    } else if (!own.value.some((n) => n.id === recipient.value)) {
      recipient.value = own.value[0]?.id || null
    }
  } else {
    // Off keeps the saved number (turning the text off clears nothing).
    recipient.value = savedRecipient.value
  }
  digest.value = on
}

const lastTextLine = computed(() =>
  props.lastText ? textStatusLine(props.lastText.text, props.saved?.timezone || props.timezone) : '',
)

// The test goes to the saved number.
const canTest = computed(() => Boolean(savedRecipient.value && recipientInfo.value))

async function sendTest() {
  if (testing.value) return
  testing.value = true
  testError.value = ''
  try {
    await autopilotApi.testText(props.websiteId)
    toast.success(`Test text sent to ${recipientInfo.value?.phone_masked}.`)
  } catch (e) {
    testError.value = e?.response?.data?.error?.message || e?.displayMessage || "We couldn't send the test text."
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.dt-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dt-muted {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.dt-stack > .dt-muted + .dt-btn {
  align-self: flex-start;
}

.dt-line {
  margin: 0;
  color: var(--foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.dt-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dt-switch-label {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

/* Same anatomy as the switches of the other settings pages. */
.dt-switch {
  appearance: none;
  -webkit-appearance: none;
  flex: none;
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  border: 0;
  border-radius: var(--radius);
  background: var(--input);
  cursor: pointer;
  transition: background-color 160ms ease;
}

.dt-switch::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 0;
  background: var(--background);
  box-shadow: none;
  transition: transform 160ms ease;
}

[data-theme='dark'] .dt-switch:not(:checked) {
  background: var(--bar);
}

.dt-switch:checked {
  background: var(--primary);
}

.dt-switch:checked::before {
  transform: translateX(16px);
}

.dt-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dt-switch:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.dt-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dt-label {
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
}

.dt-select {
  height: 36px;
  max-width: 100%;
  padding: 0 10px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13.5px;
}

.dt-select:focus-visible {
  border-color: var(--ring);
  border-radius: var(--radius);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}

#dt-number {
  align-self: flex-start;
  min-width: 200px;
}

.dt-consent {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--muted);
}

.dt-consent-text {
  margin: 0;
  color: var(--foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.dt-consent-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  font-size: 13px;
}

.dt-consent-links a {
  color: var(--foreground);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.dt-agree {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.dt-agree input {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.dt-quiet {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--foreground);
  font-size: 13.5px;
}

.dt-help {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12.5px;
  line-height: 1.5;
}

.dt-error {
  margin: 0;
  color: var(--destructive);
  font-size: 12.5px;
  line-height: 1.5;
}

.dt-last {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.dt-muted + .dt-last {
  margin-top: 12px;
}

.dt-quote {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--border);
  background: var(--muted);
  border-radius: 0 var(--radius) var(--radius) 0;
  color: var(--foreground);
  font-size: 13.5px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.dt-test {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.dt-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius);
  font-size: 13px;
}
</style>
