<template>
  <AuthLayout>
    <div class="flex flex-col items-center gap-4 py-16 text-center">
      <!-- In progress -->
      <template v-if="state === 'working'">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
        <p class="text-base text-muted-foreground">Signing you in with Microsoft...</p>
      </template>

      <!-- First-time JIT/invite join: one beat of orientation -->
      <template v-else-if="state === 'joined'">
        <div class="flex size-14 items-center justify-center rounded-xl bg-foreground text-xl font-bold text-background">
          {{ orgName?.[0] || '?' }}
        </div>
        <h2 class="text-xl font-semibold text-foreground">You've joined {{ orgName }}</h2>
        <p class="max-w-md text-base text-muted-foreground">
          Your team's projects, dashboards, and knowledge base are ready.
        </p>
        <button
          class="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          @click="enterWorkspace"
        >
          Open workspace
        </button>
      </template>

      <!-- Workspace account, but the company isn't on Cansee yet -->
      <template v-else-if="state === 'claim_domain'">
        <h2 class="text-xl font-semibold text-foreground">Bring your team to Cansee</h2>
        <p class="max-w-md text-base text-muted-foreground">
          You signed in with a <span class="font-medium text-foreground">@{{ domain }}</span>
          workspace account, but {{ domain }} isn't set up on Cansee yet.
        </p>
        <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
          <a :href="teamHref" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Talk to us about your team
          </a>
          <router-link to="/login" class="text-sm font-medium underline">Back to sign in</router-link>
        </div>
      </template>

      <!-- Closed signup: the account has no Cansee account -->
      <template v-else-if="state === 'account_required'">
        <h2 class="text-xl font-semibold text-foreground">You need a Cansee account first</h2>
        <p class="max-w-md text-base text-muted-foreground">{{ message }}</p>
        <p class="max-w-md text-sm text-muted-foreground">
          To request access, email us at {{ SALES_EMAIL }}.
        </p>
        <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
          <a :href="accessHref" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Request access
          </a>
          <router-link to="/login" class="text-sm font-medium underline">Back to sign in</router-link>
        </div>
      </template>

      <!-- Generic failure (cancelled, expired state, exchange error) -->
      <template v-else>
        <p class="text-base text-foreground">{{ message }}</p>
        <router-link to="/login" class="text-sm font-medium underline">Back to sign in</router-link>
      </template>
    </div>
  </AuthLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { SALES_EMAIL } from '@/constants/support'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// working | joined | claim_domain | account_required | failed
const state = ref('working')
const message = ref('')
const orgName = ref('')
const domain = ref('')

const accessHref = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Cansee access request')}`
const teamHref = computed(() =>
  `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`Cansee for ${domain.value || 'our team'}`)}`,
)

function fail(text) {
  state.value = 'failed'
  message.value = text
}

async function routeAfterLogin() {
  const session = await authStore.fetchSession()
  // A deep link stashed before the full-page Microsoft round trip wins.
  const stashed = sessionStorage.getItem('cs-post-auth-redirect')
  sessionStorage.removeItem('cs-post-auth-redirect')
  if (stashed) {
    router.replace(stashed)
    return
  }
  const next = session?.next_route
  if (next === 'paywall') {
    router.replace('/paywall')
  } else {
    router.replace('/dashboard')
  }
}

function enterWorkspace() {
  routeAfterLogin()
}

onMounted(async () => {
  const { code, state: stateParam, error } = route.query

  if (error) {
    fail('Microsoft sign-in was cancelled.')
    return
  }
  if (!code) {
    fail('Microsoft did not return an authorization code. Please try again.')
    return
  }

  const expectedState = sessionStorage.getItem('ms-oauth-state')
  sessionStorage.removeItem('ms-oauth-state')
  if (!expectedState || stateParam !== expectedState) {
    fail('This sign-in link expired. Please try again.')
    return
  }

  // Set by the invite page: lets the backend provision/link the account
  // and accept the invitation atomically in the same exchange.
  const inviteToken = sessionStorage.getItem('cs-invite-token') || ''
  sessionStorage.removeItem('cs-invite-token')

  try {
    const result = await authStore.microsoftLogin(
      code, `${window.location.origin}/auth/microsoft/callback`, inviteToken
    )
    if (result?.joined_org && result?.is_new_user) {
      // Deliberate pause: a first-time team member gets one beat of
      // orientation before landing in a workspace they've never seen.
      orgName.value = result.org?.name || 'your team'
      state.value = 'joined'
      return
    }
    await routeAfterLogin()
  } catch (e) {
    const err = e?.response?.data?.error
    const backendMessage = err?.message
    if (err?.code === 'domain_unclaimed') {
      domain.value = err.details?.domain || ''
      state.value = 'claim_domain'
    } else if (e?.response?.status === 403) {
      // Closed signup: the backend rejected an email with no account.
      state.value = 'account_required'
      message.value = backendMessage || 'No Cansee account exists for this email.'
    } else {
      fail(backendMessage || 'Microsoft sign-in failed. Please try again.')
    }
  }
})
</script>
