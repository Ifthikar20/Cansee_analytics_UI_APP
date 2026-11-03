import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    authHeaders: () => ({}),
    refreshAccessToken: async () => '',
}))
vi.mock('@/api/websites', () => ({ default: { list: vi.fn() } }))

// The shell and every page are stand-ins: these tests check which module
// each route loads, not the pages themselves.
const stub = (name) => ({ default: { name, render: () => null } })
vi.mock('@/layouts/AgentShell.vue', () => stub('AgentShell'))
vi.mock('@/pages/OverviewPage.vue', () => stub('OverviewPage'))
vi.mock('@/pages/PromptPage.vue', () => stub('PromptPage'))
vi.mock('@/pages/SourcesUrlsPage.vue', () => stub('SourcesUrlsPage'))
vi.mock('@/pages/SourcesUrlDetailPage.vue', () => stub('SourcesUrlDetailPage'))
vi.mock('@/pages/analytics/CompetitorsPage.vue', () => stub('CompetitorsPage'))
vi.mock('@/pages/analytics/CountriesPage.vue', () => stub('CountriesPage'))
vi.mock('@/pages/analytics/VisibilityPage.vue', () => stub('VisibilityPage'))
vi.mock('@/pages/analytics/SentimentPage.vue', () => stub('SentimentPage'))
vi.mock('@/pages/analytics/FactCheckPage.vue', () => stub('FactCheckPage'))
vi.mock('@/pages/analytics/FanoutsPage.vue', () => stub('FanoutsPage'))
vi.mock('@/pages/analytics/PromptResearchPage.vue', () => stub('PromptResearchPage'))
vi.mock('@/pages/analytics/SitePagesPage.vue', () => stub('SitePagesPage'))
vi.mock('@/pages/analytics/CrawlerAccessPage.vue', () => stub('CrawlerAccessPage'))
vi.mock('@/pages/analytics/AiTrafficPage.vue', () => stub('AiTrafficPage'))
vi.mock('@/pages/analytics/TrafficPage.vue', () => stub('TrafficPage'))
vi.mock('@/pages/analytics/ProductsPage.vue', () => stub('ProductsPage'))
vi.mock('@/pages/SettingsPage.vue', () => stub('SettingsPage'))
vi.mock('@/pages/settings/ProjectSettings.vue', () => stub('ProjectSettings'))
vi.mock('@/pages/settings/ConnectionsPage.vue', () => stub('ConnectionsPage'))
vi.mock('@/pages/settings/BrandFactsSettings.vue', () => stub('BrandFactsSettings'))
vi.mock('@/pages/settings/CommandCenterPage.vue', () => stub('CommandCenterPage'))
vi.mock('@/pages/BillingPage.vue', () => stub('BillingPage'))

const { default: router } = await import('@/router')
const { analyticsRoutes, settingsRoutes } = await import('../analyticsRoutes')

// [name, path, page module, section]
const PROJECT_PAGES = [
    ['competitors', '/projects/w1/competitors', 'CompetitorsPage', 'competitors'],
    ['countries', '/projects/w1/countries', 'CountriesPage', 'countries'],
    ['visibility', '/projects/w1/visibility', 'VisibilityPage', 'visibility'],
    ['sentiment', '/projects/w1/sentiment', 'SentimentPage', 'sentiment'],
    ['fact-check', '/projects/w1/fact-check', 'FactCheckPage', 'fact-check'],
    ['sources-urls', '/projects/w1/sources', 'SourcesUrlsPage', 'sources'],
    ['sources-url-detail', '/projects/w1/sources/detail', 'SourcesUrlDetailPage', 'sources'],
    ['fan-outs', '/projects/w1/fan-outs', 'FanoutsPage', 'fan-outs'],
    ['prompt-research', '/projects/w1/prompt-research', 'PromptResearchPage', 'prompt-research'],
    ['site-pages', '/projects/w1/pages', 'SitePagesPage', 'pages'],
    ['crawler-access', '/projects/w1/crawler-access', 'CrawlerAccessPage', 'crawler-access'],
    ['ai-traffic', '/projects/w1/ai-traffic', 'AiTrafficPage', 'ai-traffic'],
    ['traffic', '/projects/w1/traffic', 'TrafficPage', 'traffic'],
    ['products', '/projects/w1/products', 'ProductsPage', 'products'],
]

// [name, path, page module, tab title]
const SETTINGS_PAGES = [
    ['settings', '/settings', 'SettingsPage', 'Settings'],
    ['settings-project', '/settings/project', 'ProjectSettings', 'Project settings'],
    ['settings-connections', '/settings/connections', 'ConnectionsPage', 'Connections'],
    ['settings-brand-facts', '/settings/brand-facts', 'BrandFactsSettings', 'Brand facts'],
    ['settings-command-center', '/settings/usage-dashboard', 'CommandCenterPage', 'Usage dashboard'],
    ['billing', '/billing', 'BillingPage', 'Billing'],
]

async function loaded(record) {
    const component = record.components.default
    expect(component).toBeTypeOf('function')
    const mod = await component()
    return (mod.default || mod).name
}

describe('analytics routes', () => {
    it.each(PROJECT_PAGES)('%s is a lazy page of a project inside the workspace shell', async (name, path, page, section) => {
        const target = router.resolve({ name, params: { websiteId: 'w1' } })
        expect(target.path).toBe(path)
        expect(target.params).toEqual({ websiteId: 'w1' })
        expect(router.resolve(path).name).toBe(name)
        expect(target.meta.requiresAuth).toBe(true)
        expect(target.meta.analytics).toBe(section)
        expect(target.meta.settings).toBeUndefined()
        const record = target.matched.at(-1)
        // The page receives websiteId as a prop.
        expect(record.props.default).toBe(true)
        expect(await loaded(record)).toBe(page)
        expect(await loaded(target.matched[0])).toBe('AgentShell')
    })

    it('keeps the Overview and a prompt page under Overview', async () => {
        const overview = router.resolve({ name: 'dashboard' })
        expect(overview.path).toBe('/dashboard')
        expect(overview.meta).toMatchObject({ requiresAuth: true, analytics: 'overview', title: 'Overview' })
        expect(await loaded(overview.matched.at(-1))).toBe('OverviewPage')
        expect(await loaded(overview.matched[0])).toBe('AgentShell')

        const prompt = router.resolve({ name: 'prompt', params: { websiteId: 'w1', promptId: 'p1' } })
        expect(prompt.path).toBe('/projects/w1/prompts/p1')
        expect(prompt.meta.analytics).toBe('overview')
        expect(prompt.matched.at(-1).props.default).toBe(true)
        expect(await loaded(prompt.matched.at(-1))).toBe('PromptPage')
    })

    it('titles each tab with its label', () => {
        expect(router.resolve({ name: 'site-pages', params: { websiteId: 'w1' } }).meta.title).toBe('Pages')
        expect(router.resolve({ name: 'sources-urls', params: { websiteId: 'w1' } }).meta.title).toBe('Citations')
        expect(router.resolve({ name: 'fan-outs', params: { websiteId: 'w1' } }).meta.title).toBe('Query fan-outs')
    })

    it.each(SETTINGS_PAGES)('%s is a settings page inside the workspace shell', async (name, path, page, title) => {
        const target = router.resolve({ name })
        expect(target.path).toBe(path)
        expect(router.resolve(path).name).toBe(name)
        expect(target.meta).toMatchObject({ requiresAuth: true, settings: true, title })
        expect(target.meta.analytics).toBeUndefined()
        expect(await loaded(target.matched.at(-1))).toBe(page)
        expect(await loaded(target.matched[0])).toBe('AgentShell')
    })

    it('has no route left in the old app shell', async () => {
        const parents = [...analyticsRoutes, ...settingsRoutes]
        for (const record of parents) expect(await loaded({ components: { default: record.component } })).toBe('AgentShell')
        for (const route of router.getRoutes()) {
            const source = String(route.components?.default || '')
            expect(source).not.toContain('AppShell')
        }
    })

    it('sends the bare project address to the Overview', () => {
        expect(router.resolve('/projects/w1').matched.at(-1).redirect).toEqual({ name: 'dashboard' })
    })

    it('keeps the query a page reads (prompt and check on Countries)', () => {
        const target = router.resolve({
            name: 'countries',
            params: { websiteId: 'w1' },
            query: { prompt: 'p1', check: '1' },
        })
        expect(target.fullPath).toBe('/projects/w1/countries?prompt=p1&check=1')
    })

    it('sends old Google Analytics returns to Connections, and the rest to project settings', () => {
        const record = router.getRoutes().find((r) => r.path === '/websites/:id')
        const to = (query) => ({ params: { id: 'w9' }, query })
        expect(record.redirect(to({ ga4: 'connected' }))).toEqual({
            name: 'settings-connections',
            query: { ga4: 'connected', website: 'w9' },
        })
        expect(record.redirect(to({ ga4: 'error', reason: 'denied' }))).toEqual({
            name: 'settings-connections',
            query: { ga4: 'error', reason: 'denied', website: 'w9' },
        })
        expect(record.redirect(to({}))).toEqual({ name: 'settings-project' })
    })
})
