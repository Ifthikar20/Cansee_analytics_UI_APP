import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import websitesApi from '@/api/websites'

/* ── Helper: wrap a protected route in AppLayout ── */
const protect = (path, name, component, props = false) => ({
    path,
    component: () => import('@/layouts/AppLayout.vue'),
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
        path: '/demo',
        name: 'demo',
        component: () => import('@/pages/info/BookDemoPage.vue'),
        meta: { public: true }
    },
    {
        path: '/blog',
        name: 'blog',
        component: () => import('@/pages/info/BlogPage.vue'),
        meta: { public: true }
    },
    {
        path: '/changelog',
        name: 'changelog',
        component: () => import('@/pages/info/ChangelogPage.vue'),
        meta: { public: true }
    },
    {
        path: '/status',
        name: 'status',
        component: () => import('@/pages/info/StatusPage.vue'),
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
    {
        path: '/verify-email',
        name: 'verify-email',
        component: () => import('@/pages/auth/VerifyEmailPage.vue'),
        meta: { layout: 'auth', guest: true }
    },

    /* ── App (protected — each uses AppLayout) ── */
    protect('/dashboard', 'dashboard', () => import('@/pages/DashboardPage.vue')),
    protect('/websites', 'websites', () => import('@/pages/WebsitesListPage.vue')),
    protect('/websites/:id', 'website-detail', () => import('@/pages/WebsiteDetailPage.vue'), true),
    protect('/analytics/:websiteId', 'analytics', () => import('@/pages/AnalyticsPage.vue'), true),
    // The LLM Dashboard page was removed — its Overview block duplicated the
    // main Dashboard, and scheduling moved there. Bare /llm-ranking/:id now
    // redirects to Prompts, the most useful surviving child page.
    {
      path: '/llm-ranking/:websiteId',
      redirect: to => ({ path: `/llm-ranking/${to.params.websiteId}/prompts` }),
    },
    protect('/llm-ranking/:websiteId/prompts', 'prompt-library', () => import('@/pages/PromptLibraryPage.vue'), true),
    protect('/llm-ranking/:websiteId/prompts/:promptId/detail', 'prompt-detail', () => import('@/pages/PromptDetailPage.vue'), true),
    // /saved-prompts is preserved as a redirect to the Prompt Library 'Saved' tab
    {
        path: '/llm-ranking/:websiteId/saved-prompts',
        redirect: to => ({ path: `/llm-ranking/${to.params.websiteId}/prompts`, query: { tab: 'saved' } }),
    },
    protect('/llm-ranking/:websiteId/urls', 'sources-urls', () => import('@/pages/SourcesUrlsPage.vue'), true),
    protect('/llm-ranking/:websiteId/urls/detail', 'sources-url-detail', () => import('@/pages/SourcesUrlDetailPage.vue'), true),
    protect('/llm-ranking/:websiteId/brand-research', 'brand-research', () => import('@/pages/BrandResearchPage.vue'), true),
    // Ask Cansee. The conversation id is optional: /ask is a new thread,
    // /ask/<id> reopens a stored one, so a thread survives reload and is
    // linkable.
    protect('/ask/:conversationId?', 'ask-cansee', () => import('@/pages/AskCanseePage.vue'), true),
    // Two generations of old paths kept as redirects (bookmarks, stale OAuth
    // returns). search-performance was the GSC-era name, search-insights the
    // one before the Brand Research rename. Both point at the live path
    // directly rather than chaining, so neither costs an extra hop.
    {
        path: '/llm-ranking/:websiteId/search-insights',
        redirect: to => ({ path: `/llm-ranking/${to.params.websiteId}/brand-research`, query: to.query }),
    },
    {
        path: '/llm-ranking/:websiteId/search-performance',
        redirect: to => ({ path: `/llm-ranking/${to.params.websiteId}/brand-research`, query: to.query }),
    },
    protect('/llm-ranking/:websiteId/brand-security', 'brand-security', () => import('@/pages/BrandSecurityPage.vue'), true),
    // Benchmarks was absorbed into Brand Input (its URL/markdown intake now
    // feeds the RAG knowledge base there); keep the path as a redirect.
    {
        path: '/llm-ranking/:websiteId/benchmarks',
        redirect: to => ({ path: `/llm-ranking/${to.params.websiteId}/brand-input` }),
    },
    protect('/llm-ranking/:websiteId/brand-input', 'brand-input', () => import('@/pages/BrandInputPage.vue'), true),
    // Old brand-vault path redirects so bookmarks keep working.
    {
        path: '/llm-ranking/:websiteId/brand-vault',
        redirect: to => ({ path: `/llm-ranking/${to.params.websiteId}/brand-security`, query: to.query }),
    },
    // Legacy /app-onboarding redirects to the dashboard. The
    // onboarding flow is now a modal overlay rendered by
    // DashboardPage when the session marks the user as needing
    // onboarding.
    { path: '/app-onboarding', redirect: { name: 'dashboard' } },
    {
        path: '/paywall',
        name: 'paywall',
        component: () => import('@/pages/PaywallPage.vue'),
        meta: { requiresAuth: true, layout: 'auth' }
    },
    protect('/app/integrations', 'integrations', () => import('@/pages/IntegrationsPage.vue')),
    protect('/billing', 'billing', () => import('@/pages/BillingPage.vue')),
    protect('/settings', 'settings', () => import('@/pages/SettingsPage.vue')),

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
        const target = to.hash && document.querySelector(to.hash)
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
    'login', 'register', 'forgot-password', 'verify-email',
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

    // Guard: project-specific pages require an active project. On a cold
    // load (hard refresh, shared deep link) the store starts empty, so
    // load the website list here and derive the active website from the
    // URL instead of bouncing every deep link to /websites. The URL wins
    // over a stale store selection so a link to website B behaves the
    // same whether or not website A was active.
    const projectPages = ['analytics', 'llm-ranking', 'website-detail', 'brand-research', 'sources-urls', 'prompt-library', 'brand-security', 'brand-input']
    const needsProject = projectPages.includes(to.name) || !!to.params.websiteId
    if (needsProject && auth.isAuthenticated) {
        const app = useAppStore()
        if (!app.websites.length) {
            try {
                const { data } = await websitesApi.list({ _silentError: true })
                app.setWebsites(data || [])
            } catch { /* fall through to the empty-store bounce below */ }
        }
        // website-detail names its param `id`, not `websiteId` — without
        // this the sidebar switcher never follows /websites/<id> pages.
        const wid = to.params.websiteId
            || (to.name === 'website-detail' ? to.params.id : null)
        if (wid) {
            const target = app.websites.find(w => String(w.id) === String(wid))
            if (!target) {
                return next({ name: 'websites' })
            }
            app.setActiveWebsite(target)
        }
        if (!app.activeWebsite) {
            return next({ name: 'websites' })
        }
    }

    next()
})

export default router
