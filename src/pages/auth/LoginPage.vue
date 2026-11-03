<template>
  <AuthLayout title="Welcome back" subtitle="Sign in to your Cansee account.">
    <!-- SSO-enforced org: the password form is replaced, not decorated —
         a password cannot work for this account, so don't offer one. -->
    <div v-if="ssoRequired" class="flex flex-col gap-6">
      <Alert v-if="error" variant="destructive">
        <CircleX />
        <AlertTitle>Sign in failed</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
      <SsoRequiredPanel
        :domain="ssoRequired.domain"
        :org-name="ssoRequired.org_name"
        :email="ssoRequired.email"
        :methods="ssoRequired.methods || ['google']"
        @continue="handleSsoContinue"
        @reset="ssoRequired = null; password = ''; error = ''"
      />
    </div>

    <form v-else @submit.prevent="handleLogin" class="flex flex-col gap-5">
      <Alert v-if="error" variant="destructive">
        <CircleX />
        <AlertTitle>Sign in failed</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <div>
        <label for="login-email" class="mb-2 block text-sm font-medium text-foreground">Email</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          class="login-input"
          placeholder="you@company.com"
          autocomplete="email"
          required
        />
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <label for="login-password" class="text-sm font-medium text-foreground">Password</label>
          <router-link to="/forgot-password" class="login-link text-sm">Forgot password?</router-link>
        </div>
        <div class="relative flex">
          <input
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="login-input pr-12"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg text-muted-foreground"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-[18px]" />
            <Eye v-else class="size-[18px]" />
          </Button>
        </div>
      </div>

      <Button type="submit" class="login-btn mt-1 h-12 w-full text-[15px] font-semibold" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </Button>

      <div class="flex items-center gap-4 text-xs uppercase tracking-[0.12em] text-muted-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']"><span>or</span></div>

      <Button type="button" variant="outline" class="login-btn h-12 w-full gap-3 bg-transparent text-[15px] font-semibold" @click="handleGoogleLogin()">
        <svg class="size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
        </svg>
        Continue with Google
      </Button>

      <!-- Enterprise users get their own identifier-first flow: type a
           work email on /sso and get routed to the company IdP. A quiet
           link, not another provider button — B2C users never need it.
           Hidden while business features are off (the backend is the real
           gate; VITE_ORG_FEATURES_ENABLED=false just removes the door). -->
      <p v-if="orgFeaturesEnabled" class="text-center text-sm">
        <router-link to="/sso" class="login-link login-link--underline">
          Enterprise single sign-on
        </router-link>
      </p>
    </form>
  </AuthLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthLayout from '@/layouts/AuthLayout.vue'
import SsoRequiredPanel from '@/components/auth/SsoRequiredPanel.vue'
import { startGoogleSso, startMicrosoftSso, startSamlSso } from '@/composables/useSsoRedirect'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CircleX, Eye, EyeOff } from '@lucide/vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
// Set when the backend answers 403 sso_required: {org_name, domain, methods, email}
const ssoRequired = ref(null)
// Cosmetic mirror of the backend's ORG_FEATURES_ENABLED master switch:
// on unless the build explicitly says false.
const orgFeaturesEnabled = import.meta.env.VITE_ORG_FEATURES_ENABLED !== 'false'

// Auto-login from the local dev-login script (scripts/login.sh).
// DEV-ONLY: import.meta.env.DEV is statically false in production builds, so
// Vite/Rollup tree-shakes this entire block out of the shipped bundle. Never
// remove the guard — without it, a link like /login?auto_token=<attacker JWT>
// would silently install an attacker-controlled session in a victim's browser.
onMounted(async () => {
  if (!import.meta.env.DEV) return
  const autoToken = route.query.auto_token
  if (autoToken) {
    authStore.accessToken = autoToken
    try {
      const session = await authStore.fetchSession()
      const next = session?.next_route
      if (next === 'onboarding') {
        router.replace('/dashboard')
      } else if (next === 'paywall') {
        router.replace('/paywall')
      } else {
        router.replace('/dashboard')
      }
    } catch {
      authStore.accessToken = null
    }
  }
})

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await authStore.login(email.value, password.value)
    const session = await authStore.fetchSession()
    const next = session?.next_route
    if (route.query.redirect) {
      router.push(route.query.redirect)
    } else if (next === 'onboarding') {
      router.push('/dashboard')
    } else if (next === 'paywall') {
      router.push('/paywall')
    } else {
      router.push('/dashboard')
    }
  } catch (e) {
    const err = e.response?.data?.error
    if (err?.code === 'sso_required') {
      ssoRequired.value = { ...(err.details || {}), email: email.value }
      return
    }
    error.value = err?.message || e.displayMessage || "We couldn't sign you in. Please try again."
  } finally {
    loading.value = false
  }
}

function handleGoogleLogin({ loginHint = '', hd = '' } = {}) {
  const failure = startGoogleSso({
    loginHint,
    hd,
    // Deep links used to die on the IdP round trip — the full-page
    // redirect loses route.query.redirect. Stash it for the callback.
    postAuthRedirect: route.query.redirect || '',
  })
  if (failure) error.value = failure
}

// The SSO panel emits the method the user picked
// ('google' | 'microsoft' | 'saml').
async function handleSsoContinue(method) {
  if (method === 'saml') {
    const failure = await startSamlSso(ssoRequired.value?.email, {
      postAuthRedirect: route.query.redirect || '',
    })
    if (failure) error.value = failure
  } else if (method === 'microsoft') {
    const failure = startMicrosoftSso({
      loginHint: ssoRequired.value?.email,
      postAuthRedirect: route.query.redirect || '',
    })
    if (failure) error.value = failure
  } else {
    handleGoogleLogin({ loginHint: ssoRequired.value?.email, hd: ssoRequired.value?.domain })
  }
}
</script>

<style scoped>
/* Plain CSS rather than utilities: base.css has unlayered rules for
   `a` (colour, weight, hover fade) and *:focus-visible (outline + small
   radius) that beat any Tailwind class, so links would render white and
   rounded controls would square off on focus. */
.login-link {
  color: var(--muted-foreground);
  font-weight: 400;
  transition: color 0.15s ease;
}

.login-link:hover {
  color: var(--foreground);
  opacity: 1;
}

.login-link--underline {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.login-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--input);
  border-radius: 12px;
  background: var(--card);
  color: var(--foreground);
  font-size: 15px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.login-input.pr-12 {
  padding-right: 48px;
}

.login-input::placeholder {
  color: var(--muted-foreground);
  opacity: 0.6;
}

.login-input:hover {
  border-color: rgba(255, 255, 255, 0.24);
}

.login-input:focus-visible {
  outline: none;
  border-radius: 12px;
  border-color: var(--ring);
  box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.18);
}

.login-btn {
  border-radius: 999px;
}

.login-btn:focus-visible {
  border-radius: 999px;
  outline-offset: 3px;
}
</style>
