<template>
  <AuthLayout
    title="Enterprise single sign-on"
    subtitle="Sign in with your company identity provider."
  >
    <div class="auth-form flex flex-col gap-6">
      <!-- Step 2: the company was found — offer its identity provider(s).
           The user never has to know whether their company runs Google or
           Microsoft; the domain lookup decided which buttons exist. -->
      <template v-if="org">
        <div class="flex items-center gap-4 rounded-xl border border-input bg-muted/30 p-5">
          <div class="flex size-12 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
            {{ org.org_name?.[0] || '?' }}
          </div>
          <div>
            <p class="text-base font-semibold text-foreground">{{ org.org_name }}</p>
            <p class="text-sm text-muted-foreground">Single sign-on for @{{ org.domain }}</p>
          </div>
        </div>

        <Alert v-if="error" variant="destructive">
          <CircleX />
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <Button
          v-if="org.methods.includes('google')"
          size="lg"
          class="h-14 w-full text-base"
          @click="continueWith('google')"
        >
          Continue with Google
        </Button>
        <Button
          v-if="org.methods.includes('microsoft')"
          size="lg"
          :variant="org.methods.includes('google') ? 'outline' : 'default'"
          class="h-14 w-full text-base"
          @click="continueWith('microsoft')"
        >
          Continue with Microsoft
        </Button>
        <Button
          v-if="org.methods.includes('saml')"
          size="lg"
          :variant="org.methods.length === 1 ? 'default' : 'outline'"
          class="h-14 w-full text-base"
          @click="continueWith('saml')"
        >
          Continue with company SSO
        </Button>

        <button
          type="button"
          class="text-sm font-medium text-muted-foreground underline hover:text-foreground"
          @click="org = null; error = ''"
        >
          Use a different email
        </button>
      </template>

      <!-- Step 1: work email in, identity route out -->
      <form v-else class="flex flex-col gap-6" @submit.prevent="lookup">
        <Alert v-if="error" variant="destructive">
          <CircleX />
          <AlertTitle>We couldn't find your company</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <div>
          <label class="mb-2.5 block text-base font-semibold text-foreground">Work email</label>
          <input
            v-model="email"
            type="email"
            required
            class="h-14 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="you@yourcompany.com"
          />
        </div>

        <Button type="submit" size="lg" class="h-14 w-full text-base" :disabled="busy">
          {{ busy ? 'Looking up your company...' : 'Continue' }}
        </Button>
      </form>

      <p class="text-center text-base text-muted-foreground">
        <router-link to="/login" class="font-medium text-foreground">← Regular sign-in</router-link>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import api from '@/api/client'
import { startGoogleSso, startMicrosoftSso, startSamlSso } from '@/composables/useSsoRedirect'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CircleX } from '@lucide/vue'

const email = ref('')
const busy = ref(false)
const error = ref('')
// {org_name, domain, methods, login_hint} once the domain resolves.
const org = ref(null)

// Cosmetic mirror of the backend's ORG_FEATURES_ENABLED master switch,
// which defaults to off. Unless the build opts in with 'true', deep links
// go back to login (the backend 404s the discovery endpoint regardless).
if (import.meta.env.VITE_ORG_FEATURES_ENABLED !== 'true') {
  useRouter().replace({ name: 'login' })
}

async function lookup() {
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post('/auth/sso/start/', { email: email.value }, { _silentError: true })
    org.value = data
  } catch (e) {
    error.value = e.response?.data?.error?.message
      || "Single sign-on isn't set up for this email domain. Sign in normally, or ask your admin to invite you."
  } finally {
    busy.value = false
  }
}

async function continueWith(method) {
  const opts = { loginHint: org.value?.login_hint || email.value }
  let failure
  if (method === 'saml') {
    // The backend resolves the entered email to its WorkOS connection
    // and hands back the authorize URL — no client-side config needed.
    failure = await startSamlSso(email.value)
  } else if (method === 'microsoft') {
    failure = startMicrosoftSso(opts)
  } else {
    failure = startGoogleSso({ ...opts, hd: org.value?.domain })
  }
  if (failure) error.value = failure
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
