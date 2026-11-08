<template>
  <AuthLayout>
    <div class="auth-form flex flex-col gap-6">
      <!-- Loading -->
      <div v-if="state === 'loading'" class="flex flex-col items-center gap-4 py-16 text-center">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
        <p class="text-base text-muted-foreground">Loading your invitation...</p>
      </div>

      <!-- Invalid / expired / revoked -->
      <div v-else-if="state === 'invalid'" class="flex flex-col items-center gap-3 py-12 text-center">
        <h2 class="text-xl font-semibold text-foreground">This invitation is no longer valid</h2>
        <p class="max-w-md text-base text-muted-foreground">
          It may have expired, been revoked, or already been used.
          Ask your admin to send a new one.
        </p>
        <router-link to="/login" class="mt-2 text-sm font-medium underline">Go to sign in</router-link>
      </div>

      <!-- The preview request failed for a reason other than a bad token -->
      <div v-else-if="state === 'load_failed'" class="flex flex-col items-center gap-3 py-12 text-center">
        <h2 class="text-xl font-semibold text-foreground">We couldn't load this invitation</h2>
        <Button variant="outline" class="mt-2" @click="loadInvite">Try again</Button>
      </div>

      <template v-else>
        <!-- Org card: who is inviting you, into what, as which role -->
        <div class="flex items-center gap-4 rounded-xl border border-input bg-muted/30 p-5">
          <img
            v-if="invite.org.logo_url"
            :src="invite.org.logo_url"
            alt=""
            class="size-12 rounded-lg object-cover"
          />
          <div v-else class="flex size-12 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
            {{ invite.org.name?.[0] || '?' }}
          </div>
          <div>
            <p class="text-base font-semibold text-foreground">{{ invite.org.name }}</p>
            <p class="text-sm text-muted-foreground">
              {{ invite.invited_by_name || 'A teammate' }} invited you to join as {{ invite.role }}
            </p>
          </div>
        </div>

        <Alert v-if="error" variant="destructive">
          <CircleX />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <!-- Signed in as the invited account: one-click join -->
        <template v-if="state === 'accept'">
          <p class="text-base text-muted-foreground">
            You're signed in as <span class="font-medium text-foreground">{{ authStore.user?.email }}</span>.
          </p>
          <Button size="lg" class="h-14 w-full text-base" :disabled="busy" @click="acceptExisting">
            {{ busy ? 'Joining...' : `Join ${invite.org.name}` }}
          </Button>
        </template>

        <!-- Signed in as someone else -->
        <template v-else-if="state === 'wrong_account'">
          <p class="text-base text-muted-foreground">
            This invite is for <span class="font-medium text-foreground">{{ invite.email }}</span>,
            but you're signed in as <span class="font-medium text-foreground">{{ authStore.user?.email }}</span>.
          </p>
          <Button size="lg" variant="outline" class="h-14 w-full text-base" :disabled="busy" @click="switchAccount">
            Sign out and continue
          </Button>
        </template>

        <!-- Account exists, not signed in -->
        <template v-else-if="state === 'sign_in'">
          <p class="text-base text-muted-foreground">
            Sign in as <span class="font-medium text-foreground">{{ invite.email }}</span> to accept.
          </p>
          <Button v-if="!invite.sso_enforced" size="lg" class="h-14 w-full text-base" @click="goToLogin">
            Sign in with password
          </Button>
          <Button size="lg" :variant="invite.sso_enforced ? 'default' : 'outline'" class="h-14 w-full text-base" @click="googleFromInvite">
            Continue with Google
          </Button>
          <Button v-if="msConfigured" size="lg" variant="outline" class="h-14 w-full text-base" @click="microsoftFromInvite">
            Continue with Microsoft
          </Button>
        </template>

        <!-- New account: register locked to the invited email -->
        <template v-else-if="state === 'register'">
          <div>
            <label class="mb-2.5 block text-base font-semibold text-foreground">Email</label>
            <input :value="invite.email" type="email" disabled class="h-14 w-full rounded-xl border border-input bg-muted px-4 text-base text-muted-foreground" />
          </div>
          <form v-if="!invite.sso_enforced" class="flex flex-col gap-6" @submit.prevent="registerNew">
            <div>
              <label class="mb-2.5 block text-base font-semibold text-foreground">Full name</label>
              <input v-model="fullName" type="text" required class="h-14 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Full name" />
            </div>
            <div>
              <label class="mb-2.5 block text-base font-semibold text-foreground">Password</label>
              <input v-model="passwordField" type="password" required minlength="12" autocomplete="new-password" class="h-14 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="At least 12 characters" />
            </div>
            <Button type="submit" size="lg" class="h-14 w-full text-base" :disabled="busy">
              {{ busy ? 'Creating account...' : `Join ${invite.org.name}` }}
            </Button>
          </form>
          <div v-if="!invite.sso_enforced" class="flex items-center gap-4 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']"><span>or</span></div>
          <Button type="button" :variant="invite.sso_enforced ? 'default' : 'outline'" class="h-14 w-full text-base" @click="googleFromInvite">
            Continue with Google
          </Button>
          <Button v-if="msConfigured" type="button" variant="outline" class="h-14 w-full text-base" @click="microsoftFromInvite">
            Continue with Microsoft
          </Button>
        </template>
      </template>
    </div>
  </AuthLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import orgsApi from '@/api/orgs'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CircleX } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// loading | invalid | load_failed | accept | wrong_account | sign_in | register
const state = ref('loading')
const invite = ref(null)
const error = ref('')
const busy = ref(false)
const fullName = ref('')
const passwordField = ref('')

const token = route.params.token

// Unlike Google (whose button errors inline when unconfigured), the
// Microsoft button simply hides on deployments without a client id —
// no point stacking two error-prone buttons.
const msConfigured = !!import.meta.env.VITE_MICROSOFT_CLIENT_ID

async function loadInvite() {
  state.value = 'loading'
  error.value = ''
  try {
    const { data } = await orgsApi.previewInvitation(token)
    invite.value = data
    const myEmail = (authStore.user?.email || '').toLowerCase()
    if (authStore.isAuthenticated && myEmail) {
      state.value = myEmail === data.email.toLowerCase() ? 'accept' : 'wrong_account'
    } else {
      state.value = data.user_exists ? 'sign_in' : 'register'
    }
  } catch (e) {
    // A bad, expired or revoked token answers 404; anything else (network,
    // server error) says nothing about the invitation itself.
    const status = e?.response?.status
    state.value = status === 404 || status === 410 ? 'invalid' : 'load_failed'
  }
}

onMounted(async () => {
  // A stored token without a loaded user (cold start) — resolve who we
  // are first, or the accept/wrong-account branch can't be decided.
  if (authStore.isAuthenticated && !authStore.user) {
    await authStore.fetchMe()
  }
  await loadInvite()
})

async function acceptExisting() {
  busy.value = true
  error.value = ''
  try {
    await orgsApi.acceptInvitation(token)
    await authStore.fetchSession()
    router.replace('/dashboard')
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Could not accept the invitation.'
  } finally {
    busy.value = false
  }
}

async function switchAccount() {
  busy.value = true
  await authStore.logout()
  busy.value = false
  await loadInvite()
}

function goToLogin() {
  router.push({ name: 'login', query: { redirect: route.fullPath } })
}

async function registerNew() {
  busy.value = true
  error.value = ''
  try {
    const { data } = await orgsApi.registerViaInvitation(token, {
      full_name: fullName.value,
      password: passwordField.value,
    })
    authStore.adoptTokens(data)
    await authStore.fetchSession()
    router.replace('/dashboard')
  } catch (e) {
    const err = e.response?.data?.error
    if (err?.code === 'user_exists') {
      state.value = 'sign_in'
      return
    }
    error.value = err?.message || 'Could not create your account.'
  } finally {
    busy.value = false
  }
}

function googleFromInvite() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    error.value = "Google sign-in isn't available yet."
    return
  }
  const state_ = crypto.randomUUID()
  sessionStorage.setItem('google-oauth-state', state_)
  // The callback page sends this with the code so the backend can
  // provision/link the account and accept the invite atomically.
  sessionStorage.setItem('cs-invite-token', token)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state: state_,
    login_hint: invite.value?.email || '',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

function microsoftFromInvite() {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID
  if (!clientId) return
  const state_ = crypto.randomUUID()
  sessionStorage.setItem('ms-oauth-state', state_)
  // The callback page sends this with the code so the backend can
  // provision/link the account and accept the invite atomically.
  sessionStorage.setItem('cs-invite-token', token)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    response_mode: 'query',
    state: state_,
    login_hint: invite.value?.email || '',
  })
  // `organizations` authority = work accounts only (no personal MSAs).
  window.location.href = `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?${params}`
}
</script>

<style scoped>
.auth-form,
.auth-form :deep(input),
.auth-form :deep(button),
.auth-form :deep(label),
.auth-form :deep(a) {
  font-family: var(--font-display);
}
</style>
