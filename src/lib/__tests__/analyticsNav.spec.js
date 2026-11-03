import { beforeEach, describe, expect, it } from 'vitest'
import {
    ANALYTICS_SECTIONS,
    analyticsHomeRoute,
    analyticsSectionOf,
    rememberAnalyticsSection,
    sectionRoute,
} from '../analyticsNav'

beforeEach(() => {
    sessionStorage.clear()
})

describe('analyticsNav', () => {
    it('lists the six sections in sub-nav order', () => {
        expect(ANALYTICS_SECTIONS.map((s) => s.label)).toEqual([
            'Overview',
            'Visibility',
            'Countries',
            'Traffic',
            'AI traffic',
            'Sources',
        ])
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
        expect(analyticsSectionOf('settings')).toBeNull()
        expect(analyticsSectionOf('agent-home')).toBeNull()
        expect(analyticsSectionOf(undefined)).toBeNull()
    })

    it('builds section locations; project sections need a project', () => {
        expect(sectionRoute('overview', 'w1')).toEqual({ name: 'dashboard' })
        expect(sectionRoute('overview', null)).toEqual({ name: 'dashboard' })
        expect(sectionRoute('countries', 'w1')).toEqual({ name: 'countries', params: { websiteId: 'w1' } })
        expect(sectionRoute('sources', 7)).toEqual({ name: 'sources-urls', params: { websiteId: '7' } })
        expect(sectionRoute('traffic', null)).toBeNull()
        expect(sectionRoute('nope', 'w1')).toBeNull()
    })

    it('returns to the section last used for each project', () => {
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'dashboard' })
        rememberAnalyticsSection('w1', 'countries')
        rememberAnalyticsSection('w2', 'traffic')
        expect(analyticsHomeRoute('w1')).toEqual({ name: 'countries', params: { websiteId: 'w1' } })
        expect(analyticsHomeRoute('w2')).toEqual({ name: 'traffic', params: { websiteId: 'w2' } })
        expect(JSON.parse(sessionStorage.getItem('cs-analytics-last'))).toEqual({ w1: 'countries', w2: 'traffic' })
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
})
