import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import websitesApi from '@/api/websites'
import { agentRoutes } from './agentRoutes'

/* ── Helper: wrap a signed-in route in the app shell ── */
const protect = (path, name, component, props = false) => ({
    path,
    component: () => import('@/layouts/AppShell.vue'),
    meta: { requiresAuth: true },
    children: [{ path: '', name, component, props }]
})

const routes = [
    /* ── Public Landing Page ── */
    {
        path: '/',
        name: 'landing',
        component: () => import('@/pages/LandingPage.vue'),
        meta: { public: true }
    },
    {
        path: '/welcome',
        redirect: '/'
    },

    /* ── Legal (public) ── */
    {
        path: '/terms',
        name: 'terms',
        component: () => import('@/pages/legal/TermsPage.vue'),
        meta: { public: true }
    },
    {
        path: '/privacy',
        name: 'privacy',
        component: () => import('@/pages/legal/PrivacyPage.vue'),
        meta: { public: true }
    },
    /* ── Support / contact (public so the login + onboarding + paywall
       funnel can always reach it) ── */
    {
        path: '/support',
        name: 'support',
        component: () => import('@/pages/SupportPage.vue'),
        meta: { public: true }
    },
    {
        path: '/dpa',
        name: 'dpa',
        component: () => import('@/pages/info/DpaPage.vue'),
        meta: { public: true }
    },
    {
        path: '/what-we-track',
        name: 'what-we-track',
        component: () => import('@/pages/info/WhatWeTrackPage.vue'),
        meta: { public: true }
    },
    {
        path: '/cookies',
        name: 'cookies',
        component: () => import('@/pages/info/CookiesPage.vue'),
        meta: { public: true }
    },
    {
        path: '/ai-policy',
        name: 'ai-policy',
        component: () => import('@/pages/info/AiPolicyPage.vue'),
        meta: { public: true }
    },

    /* ── Marketing / company (public) ── */
    {
        path: '/about',
        name: 'about',
        component: () => import('@/pages/info/AboutPage.vue'),
        meta: { public: true }
    },
    {
        path: '/contact',
        name: 'contact',
        component: () => import('@/pages/info/ContactPage.vue'),
        meta: { public: true }
    },
    {
        path: '/docs',
        name: 'docs',
        component: () => import('@/pages/DocsPage.vue'),
        meta: { public: true }
    },

    /* ── Public Integrations Showcase ── hidden for now; redirect to landing ── */
    { path: '/integrations',          redirect: '/' },
    { path: '/integration/:slug',     redirect: '/' },

    /* ── Auth (public) ── */
    {
        path: '/login',
        name: 'login',
        component: () => import('@/pages/auth/LoginPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        // Public sign-up is closed — the only path to a real account
        // is admin-driven (scripts/create_test_user.py). Keep the route
        // alive so cached marketing links don't 404, but bounce to
        // /login.
        path: '/register',
        name: 'register',
        redirect: { name: 'login' },
    },
    {
        // Google OAuth return leg. Google redirects here with ?code&state;
        // the page exchanges the code via POST /auth/google/ and signs in.
        path: '/auth/google/callback',
        name: 'google-callback',
        component: () => import('@/pages/auth/GoogleCallbackPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        // Microsoft (Entra ID) OAuth return leg. Same shape as Google:
        // ?code&state in, POST /auth/microsoft/ to exchange and sign in.
        path: '/auth/microsoft/callback',
        name: 'microsoft-callback',
        component: () => import('@/pages/auth/MicrosoftCallbackPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        // SAML return leg. Unlike the OAuth lanes the backend owns the
        // IdP round trip and 302s the browser here with ?c=<one-time code>
        // (or ?err=<code>); the page exchanges c via /auth/token-exchange/.
        path: '/auth/sso/complete',
        name: 'sso-complete',
        component: () => import('@/pages/auth/SsoCompletePage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        path: '/forgot-password',
        name: 'forgot-password',
        component: () => import('@/pages/auth/ForgotPasswordPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        // Enterprise identifier-first sign-in: work email in, company
        // IdP redirect out. The main login page links here.
        path: '/sso',
        name: 'enterprise-sso',
        component: () => import('@/pages/auth/EnterpriseSsoPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        // Reset-with-token landing — the destination of the password
        // reset email's link (?token=...).
        path: '/reset-password',
        name: 'reset-password',
        component: () => import('@/pages/auth/ResetPasswordPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        // Organization invitation landing. `public`, not `guest`: an
        // already-signed-in invitee must reach it too (public routes
        // skip both the guest bounce and the onboarding/paywall funnel).
        path: '/invite/:token',
        name: 'invite',
        component: () => import('@/pages/auth/InviteAcceptPage.vue'),
        meta: { layout: 'auth', public: true }
    },

    /* ── App (signed in; each renders inside AppShell) ──
       Three destinations: the Overview (every prompt, Google vs each AI
       engine), a prompt's own page, and Sources; plus Settings. */
    protect('/dashboard', 'dashboard', () => import('@/pages/OverviewPage.vue')),
    protect('/projects/:websiteId/prompts/:promptId', 'prompt', () => import('@/pages/PromptPage.vue'), true),
    protect('/projects/:websiteId/sources', 'sources-urls', () => import('@/pages/SourcesUrlsPage.vue'), true),
    protect('/projects/:websiteId/sources/detail', 'sources-url-detail', () => import('@/pages/SourcesUrlDetailPage.vue'), true),
    protect('/settings', 'settings', () => import('@/pages/SettingsPage.vue')),
    protect('/settings/project', 'settings-project', () => import('@/pages/settings/ProjectSettings.vue')),
    protect('/settings/connections', 'settings-connections', () => import('@/pages/settings/ConnectionsPage.vue')),
    protect('/settings/brand-facts', 'settings-brand-facts', () => import('@/pages/settings/BrandFactsSettings.vue')),
    // Polar's checkout returns to /billing, so the path stays.
    protect('/billing', 'billing', () => import('@/pages/BillingPage.vue')),
    {
        path: '/paywall',
        name: 'paywall',
        component: () => import('@/pages/PaywallPage.vue'),
        meta: { requiresAuth: true, layout: 'auth' }
    },

    /* ── Agent workspace (its own shell; see agentRoutes.js) ── */
    ...agentRoutes,

    /* ── Old addresses (bookmarks, emails, OAuth returns) ──
       Every page the redesign removed lands somewhere sensible. */
    { path: '/websites', redirect: { name: 'dashboard' } },
    { path: '/websites/:id', redirect: { name: 'settings-project' } },
    { path: '/analytics/:websiteId', redirect: { name: 'dashboard' } },
    // The old Ask Cansee chat is now the agent workspace.
    { path: '/ask/:conversationId?', redirect: { name: 'agent', params: {} } },
    { path: '/app-onboarding', redirect: { name: 'dashboard' } },
    // Search Console's OAuth return used to land here; keep its ?gsc= query.
    { path: '/app/integrations', redirect: to => ({ name: 'settings-connections', query: to.query }) },
    {
        path: '/llm-ranking/:websiteId/prompts/:promptId/detail',
        redirect: to => ({ name: 'prompt', params: { websiteId: to.params.websiteId, promptId: to.params.promptId } }),
    },
    {
        path: '/llm-ranking/:websiteId/urls',
        redirect: to => ({ name: 'sources-urls', params: { websiteId: to.params.websiteId }, query: to.query }),
    },
    {
        path: '/llm-ranking/:websiteId/urls/detail',
        redirect: to => ({ name: 'sources-url-detail', params: { websiteId: to.params.websiteId }, query: to.query }),
    },
    { path: '/llm-ranking/:websiteId/brand-input', redirect: { name: 'settings-brand-facts' } },
    { path: '/llm-ranking/:websiteId/benchmarks', redirect: { name: 'settings-brand-facts' } },
    // Prompt library, brand research, brand security and the rest of the
    // old AI Visibility section all fold into the overview.
    { path: '/llm-ranking/:websiteId/:rest(.*)*', redirect: { name: 'dashboard' } },

    /* ── 404 ── */
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to) {
        // A hash means an in-page anchor (the landing page's #features,
        // #how and #faq). The blanket top: 0 below swallowed every one of
        // them. vue-router ignores scroll-margin-top, so read it off the
        // target and pass it as the offset — that keeps the clearance
        // owned by the page's CSS rather than hard-coded here.
        let target = null
        try {
            target = to.hash ? document.querySelector(to.hash) : null
        } catch {
            // Not a valid selector (say, an id starting with a digit): no anchor.
        }
        if (target) {
            const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0
            return { el: to.hash, top: offset, behavior: 'smooth' }
        }
        return { top: 0 }
    }
})

let sessionRestored = false

// Routes exempt from the onboarding/paywall gate (user is mid-flow fixing their state)
// Dashboard is intentionally included — the onboarding modal renders
// on top of the dashboard for first-run users, so the route gate must
// allow them through. Billing is exempt because it is where an unpaid
// user PAYS: the Polar checkout redirects back to
// /billing?checkout=success&checkout_id=... before the session knows
// about the new subscription — bouncing that load to /paywall would
// drop the checkout_id and strand the activation.
const GATE_EXEMPT = new Set([
    'login', 'register', 'forgot-password',
    'landing', 'terms', 'privacy', 'support',
    'dashboard', 'paywall', 'billing', 'not-found',
])

router.beforeEach(async (to, from, next) => {
    const auth = useAuthStore()

    // On first load, restore the session. Two paths:
    //   1. accessToken hydrated from localStorage — assume it's good
    //      and fetch /auth/me to confirm. If it 401s the interceptor
    //      will trigger a refresh-cookie attempt automatically.
    //   2. No token in storage — try refresh cookie directly.
    // sessionRestored only flips to true once we have a definitive
    // answer (success, or confirmed 401/403). Transient failures
    // leave it false so the next nav retries.
    if (!sessionRestored && !auth.isAuthenticated) {
        const hadSession = localStorage.getItem('cs-session')
        if (hadSession) {
            try {
                await auth.refreshToken()
                if (auth.accessToken) {
                    await auth.fetchSession()
                    sessionRestored = true
                } else if (!localStorage.getItem('cs-session')) {
                    sessionRestored = true
                }
            } catch {
                // belt + braces; refreshToken handles its own errors
            }
        } else {
            sessionRestored = true
        }
    } else if (!sessionRestored && auth.isAuthenticated) {
        // Access token came from localStorage — verify it works.
        // The interceptor handles 401 by attempting a refresh; if
        // that also fails it clears auth and bounces to login.
        sessionRestored = true
        auth.fetchSession().catch(() => {})
    }

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
        return next({ name: 'login', query: { redirect: to.fullPath } })
    }

    // Public pages (like landing) are accessible to everyone
    if (to.meta.public) {
        return next()
    }

    // If guest visits a guest-only page (login/register) but is already
    // logged in, send them to the right next step.
    if (to.meta.guest && auth.isAuthenticated) {
        if (!auth.session) {
            try { await auth.fetchSession() } catch (_) {}
        }
        const route = auth.session?.next_route
        if (route === 'onboarding') return next({ name: 'dashboard' })
        if (route === 'paywall') return next({ name: 'paywall' })
        return next({ name: 'dashboard' })
    }

    // Funnel gate: onboarding first (modal on /dashboard), then paywall
    // (its own route), then the app. The user has to walk through each
    // gate in order — they cannot reach /llm-ranking/* until they have
    // a website AND a paid subscription.
    if (auth.isAuthenticated) {
        if (!auth.session) {
            try { await auth.fetchSession() } catch (_) {}
        }
        const route = auth.session?.next_route
        if (route === 'onboarding' && !GATE_EXEMPT.has(to.name)) {
            return next({ name: 'dashboard' })
        }
        // The paywall gate lets /billing through: it is where an unpaid
        // user pays, and the Polar checkout redirect lands there with
        // the checkout_id that activates the subscription.
        if (route === 'paywall' && to.name !== 'paywall' && to.name !== 'billing') {
            return next({ name: 'paywall' })
        }
    }

    // Guard: a page addressed by :websiteId follows the URL, not a stale
    // store selection, so a shared link to project B behaves the same
    // whether or not project A was active. On a cold load (hard refresh,
    // deep link) the store is empty, so load the list first. The project
    // becomes active in afterEach, once the navigation is confirmed.
    if (to.params.websiteId && auth.isAuthenticated) {
        const app = useAppStore()
        if (!app.websites.length) {
            try {
                const { data } = await websitesApi.list({ _silentError: true })
                app.setWebsites(data || [])
            } catch { /* fall through to the bounce below */ }
        }
        const target = app.websites.find(w => String(w.id) === String(to.params.websiteId))
        if (!target) {
            return next({ name: 'dashboard' })
        }
    }

    next()
})

// Make the URL's project active only after the navigation went through.
// Guards that run after beforeEach (a page's beforeRouteUpdate with
// unsaved edits) can still cancel it, and a cancelled switch must leave
// the page's own project active.
router.afterEach((to, from, failure) => {
    if (failure || !to.params.websiteId) return
    const app = useAppStore()
    const target = app.websites.find(w => String(w.id) === String(to.params.websiteId))
    if (target) app.setActiveWebsite(target)
})

export default router
