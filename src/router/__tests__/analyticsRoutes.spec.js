import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    authHeaders: () => ({}),
    refreshAccessToken: async () => '',
}))
vi.mock('@/api/websites', () => ({ default: { list: vi.fn() } }))

const { default: router } = await import('@/router')

const PAGES = [
    ['visibility', '/projects/w1/visibility'],
    ['countries', '/projects/w1/countries'],
    ['traffic', '/projects/w1/traffic'],
    ['ai-traffic', '/projects/w1/ai-traffic'],
]

describe('analytics routes', () => {
    it.each(PAGES)('%s is a signed-in page of a project, loaded lazily', (name, path) => {
        const target = router.resolve({ name, params: { websiteId: 'w1' } })
        expect(target.path).toBe(path)
        expect(target.params).toEqual({ websiteId: 'w1' })
        expect(target.meta.requiresAuth).toBe(true)
        expect(router.resolve(path).name).toBe(name)
        const page = target.matched.at(-1)
        // The page receives websiteId as a prop.
        expect(page.props.default).toBe(true)
        // Inside the app shell, as a lazy chunk.
        expect(target.matched[0].components.default).toBeTypeOf('function')
        expect(page.components.default).toBeTypeOf('function')
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
