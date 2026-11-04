// Analytics and Settings routes, rendered inside the workspace shell
// (AgentShell) like the agent pages. The shell import resolves to the same
// component as agentRoutes.js, so moving between the Agent and Analytics
// tabs keeps one shell instance (sidebar, drawer, toasts).
//
// Analytics is one page, the board (board_contract.md 2). Its route has
// meta.board and renders unwrapped on the agent surface, like the chat; it
// titles itself. Every older analytics address redirects to the board and
// opens a widget's side panel with ?widget=, keeping its query and hash.
// The redirect records keep their names, so router.push({name: 'prompt'})
// and every RouterLink still work: they now open a panel. meta.page (the
// /dashboard entry) and meta.settings make the shell render the page area;
// meta.title is the tab title there.
import { resolveAnalyticsEntry } from './analyticsEntry'

const AgentShell = () => import('@/layouts/AgentShell.vue')

const AnalyticsBoardPage = () => import('@/pages/board/AnalyticsBoardPage.vue')
const AnalyticsEntryPage = () => import('@/pages/board/AnalyticsEntryPage.vue')

const SettingsPage = () => import('@/pages/SettingsPage.vue')
const ProjectSettings = () => import('@/pages/settings/ProjectSettings.vue')
const ConnectionsPage = () => import('@/pages/settings/ConnectionsPage.vue')
const BrandFactsSettings = () => import('@/pages/settings/BrandFactsSettings.vue')
const CommandCenterPage = () => import('@/pages/settings/CommandCenterPage.vue')
const BillingPage = () => import('@/pages/BillingPage.vue')

const meta = { requiresAuth: true, workspace: true }
const settings = (title) => ({ settings: true, title })

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
        component: AgentShell,
        meta,
        children: [
            {
                path: '',
                name: 'dashboard',
                component: AnalyticsEntryPage,
                beforeEnter: resolveAnalyticsEntry,
                meta: { page: true, title: 'Analytics' },
            },
        ],
    },
    {
        path: '/projects/:websiteId',
        component: AgentShell,
        meta,
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
            { path: 'analytics', name: 'analytics', component: AnalyticsBoardPage, props: true, meta: { board: true } },
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
        component: AgentShell,
        meta,
        children: [
            { path: '', name: 'settings', component: SettingsPage, meta: settings('Settings') },
            { path: 'project', name: 'settings-project', component: ProjectSettings, meta: settings('Project settings') },
            { path: 'connections', name: 'settings-connections', component: ConnectionsPage, meta: settings('Connections') },
            { path: 'brand-facts', name: 'settings-brand-facts', component: BrandFactsSettings, meta: settings('Brand facts') },
            // "Command Center" is the design's working name; people see "Usage dashboard".
            {
                path: 'usage-dashboard',
                name: 'settings-command-center',
                component: CommandCenterPage,
                meta: settings('Usage dashboard'),
            },
        ],
    },
    // Polar's checkout returns to /billing, so the path stays.
    {
        path: '/billing',
        component: AgentShell,
        meta,
        children: [{ path: '', name: 'billing', component: BillingPage, meta: settings('Billing') }],
    },
]
