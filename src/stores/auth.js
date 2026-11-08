import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import api from '@/api/client'
import authApi from '@/api/auth'
import { describeSubscription } from '@/lib/plan'
import { clearUserData as clearAgentUserData } from '@/lib/agent/storage'
import { useAppStore } from '@/stores/app'

// localStorage key for the access token. We persist it here so a
// page reload doesn't kick the user out when the refresh cookie is
// flaky (cross-port over Vite proxy, browser cookie policy, etc).
// The token is short-lived JWT — leaking it from localStorage is
// no worse than what every "remember me" app does. The refresh
// cookie remains the source of truth for long-term re-auth.
const ACCESS_TOKEN_KEY = 'cs-access'

export const useAuthStore = defineStore('auth', () => {
    // Hydrate the access token from localStorage on store init so the
    // first request after a reload already has Authorization set.
    const accessToken = ref(localStorage.getItem(ACCESS_TOKEN_KEY) || null)
    const user = ref(null)
    const session = ref(null)

    // Keep localStorage in sync with the in-memory token.
    watch(accessToken, (v) => {
        if (v) localStorage.setItem(ACCESS_TOKEN_KEY, v)
        else localStorage.removeItem(ACCESS_TOKEN_KEY)
    })

    const isAuthenticated = computed(() => !!accessToken.value)
    // Plan words for every surface (Settings, Add project, Billing).
    // Derived from the session's subscription block — never from
    // user.plan, which is denormalized and defaults to a paid tier.
    const planState = computed(() => describeSubscription(session.value?.subscription))

    // Organization identity lives on the session payload — single source.
    // Null for B2C users, so `v-if="authStore.org"` hides all org UI.
    const org = computed(() => session.value?.org || null)
    const orgRole = computed(() => org.value?.role || '')
    const isOrgAdmin = computed(() => ['owner', 'admin'].includes(orgRole.value))
    const isOrgOwner = computed(() => orgRole.value === 'owner')
    const userInitials = computed(() => {
        if (!user.value?.full_name) return '?'
        return user.value.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    })

    // One code path for every endpoint that answers login-shaped
    // ({access, user, ...} + refresh cookie): password login, Google,
    // and invitation register all adopt the session identically.
    function adoptTokens(result) {
        accessToken.value = result.access
        user.value = result.user
        localStorage.setItem('cs-session', '1')
        return result
    }

    async function login(email, password) {
        // _silentError: the login page renders errors inline (incl. the
        // structured sso_required panel) — a global toast would double up.
        const { data: result } = await api.post('/auth/login/', { email, password }, { _silentError: true })
        return adoptTokens(result)
    }

    async function googleLogin(code, redirectUri, inviteToken = '') {
        const payload = { code, redirect_uri: redirectUri }
        if (inviteToken) payload.invite_token = inviteToken
        const { data: result } = await api.post('/auth/google/', payload, { _silentError: true })
        return adoptTokens(result)
    }

    async function microsoftLogin(code, redirectUri, inviteToken = '') {
        const payload = { code, redirect_uri: redirectUri }
        if (inviteToken) payload.invite_token = inviteToken
        const { data: result } = await api.post('/auth/microsoft/', payload, { _silentError: true })
        return adoptTokens(result)
    }

    // SAML lane: the backend finishes the IdP round trip itself and hands
    // the browser a one-time code on /auth/sso/complete. Exchanging it
    // answers login-shaped, so it adopts the session like every other lane.
    async function exchangeSsoCode(code) {
        const { data: result } = await api.post('/auth/token-exchange/', { code }, { _silentError: true })
        return adoptTokens(result)
    }

    async function logout() {
        try {
            await api.post('/auth/logout/')
        } catch { /* ignore */ }
        clearAuth()
        localStorage.removeItem('cs-session')
    }

    async function fetchMe() {
        try {
            const { data } = await api.get('/auth/me/', { _silentError: true })
            user.value = data
            return user.value
        } catch (err) {
            // Only clear auth on a real auth failure (401). Network blips,
            // 500s, or transient errors should NOT log the user out — the
            // axios interceptor already handles 401-driven refresh; if that
            // fails it clears auth itself. Anything else, ignore here.
            const status = err?.response?.status
            if (status === 401 || status === 403) {
                clearAuth()
            }
        }
    }

    async function fetchSession() {
        try {
            const { data } = await api.get('/auth/session/', { _silentError: true })
            session.value = data
            if (session.value?.user) user.value = session.value.user
            // Plan limits are resolved server-side (trial-aware); mirror
            // them into the app store so gates like canCreateProject use
            // the real allowance instead of a hardcoded default.
            if (session.value?.limits) {
                useAppStore().setProjectLimit(session.value.limits.projects ?? -1)
            }
            return session.value
        } catch {
            session.value = null
            return null
        }
    }

    // Record acceptance of the current Terms of Service and keep the
    // session's terms block in step, which closes the acceptance modal.
    // Rejects on failure; a terms_version_mismatch error means the terms
    // changed meanwhile, and the caller reloads the session.
    async function acceptTerms(version) {
        const { data } = await authApi.acceptTerms(version)
        if (data?.terms && session.value) {
            session.value = { ...session.value, terms: data.terms }
        }
        return data?.terms || null
    }

    async function refreshToken() {
        try {
            const { data: result } = await api.post('/auth/refresh/', {}, { _silentError: true })
            accessToken.value = result.access
            localStorage.setItem('cs-session', '1')
            return result.access
        } catch (err) {
            // Only clear auth when the server actively says the
            // refresh cookie is no longer valid (401 / 403). Network
            // hiccups, 5xx blips, browser delays — none of those mean
            // the user is signed out, and clearing cs-session here
            // makes every subsequent page load skip the refresh attempt
            // entirely. Stay logged-in until the server says otherwise.
            const status = err?.response?.status
            if (status === 401 || status === 403) {
                clearAuth()
                localStorage.removeItem('cs-session')
            }
            // For anything else, leave cs-session alone so the next
            // navigation can retry the refresh.
            return null
        }
    }

    // Run after clearAuth (logout, expired session) so stores holding
    // per-user data can drop it. Returns an unsubscribe function.
    const clearAuthHooks = new Set()
    function onClearAuth(fn) {
        clearAuthHooks.add(fn)
        return () => clearAuthHooks.delete(fn)
    }

    function clearAuth() {
        const uid = user.value?.id ?? null
        accessToken.value = null  // watcher above clears the localStorage copy
        user.value = null
        session.value = null
        localStorage.removeItem('cs-session')
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        // Agent workspace keys (last chat, drafts, pane tabs) of every user
        // of this browser; the signed-in user may be unknown by now.
        clearAgentUserData()
        // The project list belongs to the user who just left. Without this
        // the next sign-in in the same tab is routed to their projects
        // (ensureWebsites and the route guard skip loading a non-empty list).
        useAppStore().reset()
        clearAuthHooks.forEach((fn) => {
            try { fn(uid) } catch { /* a hook must not block sign-out */ }
        })
    }

    return {
        accessToken,
        user,
        session,
        isAuthenticated,
        userInitials,
        planState,
        org,
        orgRole,
        isOrgAdmin,
        isOrgOwner,
        adoptTokens,
        login,
        googleLogin,
        microsoftLogin,
        exchangeSsoCode,
        logout,
        fetchMe,
        fetchSession,
        acceptTerms,
        refreshToken,
        clearAuth,
        onClearAuth,
    }
})
