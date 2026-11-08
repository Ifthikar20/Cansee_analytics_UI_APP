// Analytics and Settings routes, rendered in AppShell under the header like
// the agent pages. The shell import resolves to the same component as
// agentRoutes.js, so moving between Analytics, Agent and Settings keeps one
// shell instance (header, toasts). meta.section on each AppShell parent picks
// the frame's layout and the header's current link; meta.title is the tab
// title of a page that does not set its own.
//
// Analytics is one page, the board (board_contract.md 2); it titles itself.
// Every older analytics address redirects to the board and opens a widget's
// side panel with ?widget=, keeping its query and hash. The redirect records
// keep their names, so router.push({name: 'prompt'}) and every RouterLink
// still work: they now open a panel.
import { resolveAnalyticsEntry } from './analyticsEntry'

const AppShell = () => import('@/layouts/AppShell.vue')

const AnalyticsBoardPage = () => import('@/pages/board/AnalyticsBoardPage.vue')
const AnalyticsEntryPage = () => import('@/pages/board/AnalyticsEntryPage.vue')

const SettingsPage = () => import('@/pages/SettingsPage.vue')
const ProjectSettings = () => import('@/pages/settings/ProjectSettings.vue')
const AutopilotSettings = () => import('@/pages/settings/AutopilotSettings.vue')
const ConnectionsPage = () => import('@/pages/settings/ConnectionsPage.vue')
const BrandFactsSettings = () => import('@/pages/settings/BrandFactsSettings.vue')
const CommandCenterPage = () => import('@/pages/settings/CommandCenterPage.vue')
const BillingPage = () => import('@/pages/BillingPage.vue')

const analytics = { requiresAuth: true, section: 'analytics' }
const settings = { requiresAuth: true, section: 'settings' }
const titled = (title) => ({ title })

// The board of the address's project with `widget`'s panel open. The
// incoming query and hash stay; `extra` adds keys taken from the path
// (a prompt's id); `widget` is set last, so it always wins.
const board =
    (widget, extra = () => ({})) =>
    (to) => ({
        name: 'analytics',
        params: { websiteId: to.params.websiteId },
        query: { ...to.query, ...extra(to), widget },
        hash: to.hash,
    })

const toBoard = (path, name, widget) => ({ path, name, redirect: board(widget) })

export const analyticsRoutes = [
    {
        path: '/dashboard',
        component: AppShell,
        meta: analytics,
        children: [
            {
                path: '',
                name: 'dashboard',
                component: AnalyticsEntryPage,
                beforeEnter: resolveAnalyticsEntry,
                meta: titled('Analytics'),
            },
        ],
    },
    {
        path: '/projects/:websiteId',
        component: AppShell,
        meta: analytics,
        children: [
            // The bare project address opens its board.
            {
                path: '',
                redirect: (to) => ({
                    name: 'analytics',
                    params: { websiteId: to.params.websiteId },
                    query: to.query,
                    hash: to.hash,
                }),
            },
            { path: 'analytics', name: 'analytics', component: AnalyticsBoardPage, props: true },
            {
                path: 'prompts/:promptId',
                name: 'prompt',
                redirect: board('prompts', (to) => ({ prompt: to.params.promptId })),
            },
            toBoard('competitors', 'competitors', 'competitors'),
            // ?prompt=<id>&check=1 opens the countries run dialog in the panel.
            toBoard('countries', 'countries', 'countries'),
            toBoard('visibility', 'visibility', 'visibility'),
            toBoard('sentiment', 'sentiment', 'sentiment'),
            toBoard('fact-check', 'fact-check', 'fact-check'),
            toBoard('sources', 'sources-urls', 'citations'),
            // Keeps url, topic and provider: the citations panel shows that URL.
            toBoard('sources/detail', 'sources-url-detail', 'citations'),
            toBoard('fan-outs', 'fan-outs', 'fan-outs'),
            toBoard('prompt-research', 'prompt-research', 'prompt-research'),
            toBoard('pages', 'site-pages', 'pages'),
            toBoard('crawler-access', 'crawler-access', 'crawler-access'),
            toBoard('ai-traffic', 'ai-traffic', 'ai-traffic'),
            toBoard('traffic', 'traffic', 'traffic'),
            toBoard('products', 'products', 'products'),
        ],
    },
]

export const settingsRoutes = [
    {
        path: '/settings',
        component: AppShell,
        meta: settings,
        children: [
            { path: '', name: 'settings', component: SettingsPage, meta: titled('Settings') },
            { path: 'project', name: 'settings-project', component: ProjectSettings, meta: titled('Project settings') },
            // The active project's daily run, its text and the runs so far.
            { path: 'autopilot', name: 'settings-autopilot', component: AutopilotSettings, meta: titled('Autopilot') },
            { path: 'connections', name: 'settings-connections', component: ConnectionsPage, meta: titled('Connections') },
            { path: 'brand-facts', name: 'settings-brand-facts', component: BrandFactsSettings, meta: titled('Brand facts') },
            // "Command Center" is the design's working name; people see "Usage dashboard".
            {
                path: 'usage-dashboard',
                name: 'settings-command-center',
                component: CommandCenterPage,
                meta: titled('Usage dashboard'),
            },
        ],
    },
    // Polar's checkout returns to /billing, so the path stays.
    {
        path: '/billing',
        component: AppShell,
        meta: settings,
        children: [{ path: '', name: 'billing', component: BillingPage, meta: titled('Billing') }],
    },
]
