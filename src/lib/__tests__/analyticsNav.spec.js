import { beforeEach, describe, expect, it } from 'vitest'
import * as lucide from '@lucide/vue'
import {
    ANALYTICS_GROUPS,
    ANALYTICS_SECTIONS,
    analyticsHomeRoute,
    analyticsSectionOf,
    rememberAnalyticsSection,
    rememberSidebarSide,
    sectionLabel,
    sectionRoute,
    sectionsByGroup,
    sidebarSide,
} from '../analyticsNav'

beforeEach(() => {
    sessionStorage.clear()
})

describe('analyticsNav', () => {
    it('lists the four groups and the 14 tabs in sidebar order', () => {
        expect(ANALYTICS_GROUPS).toEqual([
            { key: 'search-vs-ai', label: 'Search vs AI' },
            { key: 'answer-engines', label: 'Answer engines' },
            { key: 'your-site', label: 'Your site' },
            { key: 'shopping', label: 'Shopping' },
        ])
        expect(ANALYTICS_SECTIONS.map((s) => [s.key, s.label, s.route])).toEqual([
            ['overview', 'Overview', 'dashboard'],
            ['competitors', 'Competitors', 'competitors'],
            ['countries', 'Countries', 'countries'],
            ['visibility', 'Visibility', 'visibility'],
            ['sentiment', 'Sentiment', 'sentiment'],
            ['fact-check', 'Fact check', 'fact-check'],
            ['sources', 'Citations', 'sources-urls'],
            ['fan-outs', 'Query fan-outs', 'fan-outs'],
            ['prompt-research', 'Prompt research', 'prompt-research'],
            ['pages', 'Pages', 'site-pages'],
            ['crawler-access', 'Crawler access', 'crawler-access'],
            ['ai-traffic', 'AI traffic', 'ai-traffic'],
            ['traffic', 'Traffic', 'traffic'],
            ['products', 'Products', 'products'],
        ])
        expect(sectionsByGroup().map((g) => [g.key, g.sections.map((s) => s.key)])).toEqual([
            ['search-vs-ai', ['overview', 'competitors', 'countries']],
            ['answer-engines', ['visibility', 'sentiment', 'fact-check', 'sources', 'fan-outs', 'prompt-research']],
            ['your-site', ['pages', 'crawler-access', 'ai-traffic', 'traffic']],
            ['shopping', ['products']],
        ])
    })

    it('names an @lucide/vue icon for every tab', () => {
        for (const s of ANALYTICS_SECTIONS) expect(typeof lucide[s.icon], s.key).toBe('function')
    })

    it('labels sections by key', () => {
        expect(sectionLabel('sources')).toBe('Citations')
        expect(sectionLabel('fan-outs')).toBe('Query fan-outs')
        expect(sectionLabel('nope')).toBe('')
        expect(sectionLabel(undefined)).toBe('')
    })

    it('maps route names to their section', () => {
        expect(analyticsSectionOf('dashboard')).toBe('overview')
        expect(analyticsSectionOf('prompt')).toBe('overview')
        expect(analyticsSectionOf('visibility')).toBe('visibility')
        expect(analyticsSectionOf('countries')).toBe('countries')
        expect(analyticsSectionOf('traffic')).toBe('traffic')
        expect(analyticsSectionOf('ai-traffic')).toBe('ai-traffic')
        expect(analyticsSectionOf('sources-urls')).toBe('sources')
        expect(analyticsSectionOf('sources-url-detail')).toBe('sources')
        expect(analyticsSectionOf('site-pages')).toBe('pages')
        expect(analyticsSectionOf('crawler-access')).toBe('crawler-access')
        expect(analyticsSectionOf('products')).toBe('products')
        expect(analyticsSectionOf('settings')).toBeNull()
        expect(analyticsSectionOf('agent-home')).toBeNull()
        expect(analyticsSectionOf(undefined)).toBeNull()
    })

    it('builds section locations; project sections need a project', () => {
        expect(sectionRoute('overview', 'w1')).toEqual({ name: 'dashboard' })
        expect(sectionRoute('overview', null)).toEqual({ name: 'dashboard' })
        expect(sectionRoute('countries', 'w1')).toEqual({ name: 'countries', params: { websiteId: 'w1' } })
        expect(sectionRoute('sources', 7)).toEqual({ name: 'sources-urls', params: { websiteId: '7' } })
        expect(sectionRoute('pages', 'w1')).toEqual({ name: 'site-pages', params: { websiteId: 'w1' } })
        expect(sectionRoute('traffic', null)).toBeNull()
        expect(sectionRoute('nope', 'w1')).toBeNull()
    })

    it('returns to the section last used for each project', () => {
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'dashboard' })
        rememberAnalyticsSection('w1', 'countries')
        rememberAnalyticsSection('w2', 'crawler-access')
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'countries', params: { websiteId: 'w1' } })
        expect(analyticsHomeRoute('w2')).toEqual({ name: 'crawler-access', params: { websiteId: 'w2' } })
        expect(JSON.parse(sessionStorage.getItem('cs-analytics-last'))).toEqual({ w1: 'countries', w2: 'crawler-access' })
        rememberAnalyticsSection('w1', 'overview')
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'dashboard' })
    })

    it('falls back to the Overview without a project, an unknown key or unreadable storage', () => {
        rememberAnalyticsSection('w1', 'nope')
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'dashboard' })
        expect(analyticsHomeRoute(null)).toEqual({ name: 'dashboard' })
        sessionStorage.setItem('cs-analytics-last', '{not json')
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'dashboard' })
        // A broken store is replaced on the next write.
        rememberAnalyticsSection('w1', 'visibility')
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'visibility', params: { websiteId: 'w1' } })
    })

    it('picks the sidebar side from the route, and the side used last elsewhere', () => {
        expect(sidebarSide({ name: 'site-pages', meta: { analytics: 'pages' } })).toBe('analytics')
        expect(sidebarSide({ name: 'dashboard', meta: { analytics: 'overview' } })).toBe('analytics')
        expect(sidebarSide({ name: 'agent-home', meta: {} })).toBe('agent')
        expect(sidebarSide({ name: 'agent-projects', meta: {} })).toBe('agent')
        // Settings: the remembered side, else the agent.
        const settings = { name: 'settings', meta: { settings: true } }
        expect(sidebarSide(settings)).toBe('agent')
        rememberSidebarSide('analytics')
        expect(sessionStorage.getItem('cs-sidebar-side')).toBe('analytics')
        expect(sidebarSide(settings)).toBe('analytics')
        rememberSidebarSide('nope')
        expect(sidebarSide(settings)).toBe('analytics')
        sessionStorage.setItem('cs-sidebar-side', 'garbage')
        expect(sidebarSide(settings)).toBe('agent')
        expect(sidebarSide(null)).toBe('agent')
    })
})
