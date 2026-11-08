<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay terms-overlay" data-test="terms-modal">
      <div
        ref="cardRef"
        class="modal-card terms-card"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="titleId"
        :aria-describedby="descId"
      >
        <h2 :id="titleId" class="terms-title">Review our updated terms</h2>
        <div :id="descId" class="terms-text">
          <p>
            To keep using Cansee, please review and accept our Terms of Service and Privacy Policy<span v-if="versionLabel">, effective {{ versionLabel }}</span>.
          </p>
          <p>
            <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>
            <span aria-hidden="true"> · </span>
            <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>
            <span class="sr-only"> (open in a new tab)</span>
          </p>
        </div>

        <form data-dialog-body @submit.prevent="accept">
          <label class="terms-check">
            <input
              v-model="agreed"
              type="checkbox"
              required
              :disabled="busy"
              data-test="terms-agree"
            />
            <span>I agree to the Terms of Service and Privacy Policy</span>
          </label>

          <p v-if="error" class="terms-error" role="alert" data-test="terms-error">{{ error }}</p>

          <div class="terms-actions">
            <Button type="button" variant="ghost" :disabled="busy" data-test="terms-signout" @click="signOut">
              Sign out
            </Button>
            <Button type="submit" :disabled="!agreed || busy || !currentVersion" data-test="terms-accept">
              {{ busy ? 'Saving...' : 'Accept' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// Blocking Terms of Service acceptance for signed-in app screens. Shown
// while the session's terms.needs_acceptance is true (lib/legal/terms.js
// decides which routes it covers); it cannot be dismissed, only accepted
// or left by signing out. Mounted once in App.vue.
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { formatTermsVersion, isTermsVersionMismatch, shouldBlockForTerms } from '@/lib/legal/terms'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const cardRef = ref(null)
const titleId = useId()
const descId = useId()
const agreed = ref(false)
const busy = ref(false)
const error = ref('')

const open = computed(() => shouldBlockForTerms({
  isAuthenticated: auth.isAuthenticated,
  session: auth.session,
  route,
}))

const currentVersion = computed(() => auth.session?.terms?.current_version || '')
const versionLabel = computed(() => formatTermsVersion(currentVersion.value))

// A new version means a new agreement: the box starts unticked again.
watch(currentVersion, () => { agreed.value = false })

// Escape is claimed (a no-op) so nothing underneath closes either.
useDialogFocus(cardRef, () => open.value, { onEscape: () => {} })
useBodyScrollLock(open)

// Everything else on the page is unreachable while the gate is up.
function setAppInert(on) {
  const root = document.getElementById('app')
  if (root) root.inert = on
}
watch(open, setAppInert, { immediate: true })
onBeforeUnmount(() => setAppInert(false))

async function accept() {
  if (!agreed.value || busy.value || !currentVersion.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.acceptTerms(currentVersion.value)
  } catch (err) {
    if (isTermsVersionMismatch(err)) {
      // The terms changed since this session loaded: show the new version.
      await auth.fetchSession()
      agreed.value = false
      error.value = 'The terms were updated. Review the new version, then accept again.'
    } else {
      error.value = err?.response?.data?.error?.message
        || 'We could not record your acceptance. Please try again.'
    }
  } finally {
    busy.value = false
  }
}

async function signOut() {
  busy.value = true
  try {
    await auth.logout()
  } finally {
    busy.value = false
    agreed.value = false
    error.value = ''
    router.push('/login').catch(() => {})
  }
}
</script>

<style scoped>
.terms-overlay { z-index: 1100; }
.terms-card { max-width: 480px; }
.terms-card:focus { outline: none; }

.terms-title {
  margin: 0 0 10px;
  font-size: var(--font-lg, 18px);
  font-weight: 600;
  color: var(--text-primary);
}

.terms-text p {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary, var(--muted-foreground));
}

.terms-text a {
  color: var(--text-primary);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.terms-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.terms-check input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: var(--primary);
  cursor: pointer;
}

.terms-error {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--destructive);
}

.terms-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
