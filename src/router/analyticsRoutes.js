// Analytics and Settings routes, rendered inside the workspace shell
// (AgentShell) like the agent pages. The shell import resolves to the same
// component as agentRoutes.js, so moving between the Agent and Analytics
// sides keeps one shell instance (sidebar, drawer, toasts).
//
// meta.analytics names the section (lib/analyticsNav.js) and meta.settings
// marks a settings page; both make the shell render the page area (main-app
// look, page bar on narrow screens). meta.title is the tab title.
import { sectionLabel } from '@/lib/analyticsNav'

const AgentShell = () => import('@/layouts/AgentShell.vue')

const OverviewPage = () => import('@/pages/OverviewPage.vue')
const PromptPage = () => import('@/pages/PromptPage.vue')
const CompetitorsPage = () => import('@/pages/analytics/CompetitorsPage.vue')
const CountriesPage = () => import('@/pages/analytics/CountriesPage.vue')
const VisibilityPage = () => import('@/pages/analytics/VisibilityPage.vue')
const SentimentPage = () => import('@/pages/analytics/SentimentPage.vue')
const FactCheckPage = () => import('@/pages/analytics/FactCheckPage.vue')
const SourcesUrlsPage = () => import('@/pages/SourcesUrlsPage.vue')
const SourcesUrlDetailPage = () => import('@/pages/SourcesUrlDetailPage.vue')
const FanoutsPage = () => import('@/pages/analytics/FanoutsPage.vue')
const PromptResearchPage = () => import('@/pages/analytics/PromptResearchPage.vue')
const SitePagesPage = () => import('@/pages/analytics/SitePagesPage.vue')
const CrawlerAccessPage = () => import('@/pages/analytics/CrawlerAccessPage.vue')
const AiTrafficPage = () => import('@/pages/analytics/AiTrafficPage.vue')
const TrafficPage = () => import('@/pages/analytics/TrafficPage.vue')
const ProductsPage = () => import('@/pages/analytics/ProductsPage.vue')

const SettingsPage = () => import('@/pages/SettingsPage.vue')
const ProjectSettings = () => import('@/pages/settings/ProjectSettings.vue')
const ConnectionsPage = () => import('@/pages/settings/ConnectionsPage.vue')
const BrandFactsSettings = () => import('@/pages/settings/BrandFactsSettings.vue')
const CommandCenterPage = () => import('@/pages/settings/CommandCenterPage.vue')
const BillingPage = () => import('@/pages/BillingPage.vue')

const meta = { requiresAuth: true, workspace: true }
const at = (section, extra = {}) => ({ analytics: section, title: sectionLabel(section), ...extra })
const settings = (title) => ({ settings: true, title })

// One child per section addressed by a project; the page gets websiteId as a prop.
const projectPage = (path, name, component, section) => ({ path, name, component, props: true, meta: at(section) })

export const analyticsRoutes = [
    {
        path: '/dashboard',
        component: AgentShell,
        meta,
        children: [{ path: '', name: 'dashboard', component: OverviewPage, meta: at('overview') }],
    },
    {
        path: '/projects/:websiteId',
        component: AgentShell,
        meta,
        children: [
            // The bare project address has no page of its own.
            { path: '', redirect: { name: 'dashboard' } },
            projectPage('prompts/:promptId', 'prompt', PromptPage, 'overview'),
            projectPage('competitors', 'competitors', CompetitorsPage, 'competitors'),
            // ?prompt=<id>&check=1 opens the run dialog.
            projectPage('countries', 'countries', CountriesPage, 'countries'),
            projectPage('visibility', 'visibility', VisibilityPage, 'visibility'),
            projectPage('sentiment', 'sentiment', SentimentPage, 'sentiment'),
            projectPage('fact-check', 'fact-check', FactCheckPage, 'fact-check'),
            projectPage('sources', 'sources-urls', SourcesUrlsPage, 'sources'),
            projectPage('sources/detail', 'sources-url-detail', SourcesUrlDetailPage, 'sources'),
            projectPage('fan-outs', 'fan-outs', FanoutsPage, 'fan-outs'),
            projectPage('prompt-research', 'prompt-research', PromptResearchPage, 'prompt-research'),
            projectPage('pages', 'site-pages', SitePagesPage, 'pages'),
            projectPage('crawler-access', 'crawler-access', CrawlerAccessPage, 'crawler-access'),
            projectPage('ai-traffic', 'ai-traffic', AiTrafficPage, 'ai-traffic'),
            projectPage('traffic', 'traffic', TrafficPage, 'traffic'),
            projectPage('products', 'products', ProductsPage, 'products'),
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
