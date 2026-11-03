import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }))

vi.mock('@/api/client', () => ({ default: client, authHeaders: () => ({}), refreshAccessToken: async () => '' }))

import SourcesUrlsPage from '@/pages/SourcesUrlsPage.vue'
import { VizChartStub, chartsById } from './__fixtures__/vizStub'
import { WEBSITE_ID } from './__fixtures__/polish'

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })

// GET /citations/websites/<id>/urls/: the parts the charts read.
function urlsPayload(domains, overrides = {}) {
    return {
        period_start: '2026-11-01',
        period_end: '2026-11-03',
        total_retrievals: 12,
        unique_urls: 3,
        topics: [],
        selected_topic: null,
        overview: {
            labels: ['Nov 01', 'Nov 02', 'Nov 03'],
            series: domains.map((d, i) => ({ key: d, label: d, color: '#475569', data: [i, 1, 2] })),
        },
        movers: { Top: [], New: [], Trending: [], Losing: [] },
        url_types: [
            { type: 'Listicle', count: 8, pct: 67, color: '#5b8def' },
            { type: 'Comparison', count: 4, pct: 33, color: '#8b5cf6' },
        ],
        urls: [],
        traffic_summary: null,
        opportunities: null,
        ...overrides,
    }
}

async function mountPage() {
    setActivePinia(createPinia())
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/dashboard', component: Blank },
            { path: '/settings/connections', component: Blank },
            { path: '/projects/:websiteId/sources', name: 'sources-urls', component: Blank },
            { path: '/projects/:websiteId/sources/detail', name: 'sources-url-detail', component: Blank },
        ],
    })
    await router.push(`/projects/${WEBSITE_ID}/sources`)
    await router.isReady()
    const wrapper = mount(SourcesUrlsPage, {
        // MetricInfo's tooltip needs the app's TooltipProvider; it is not under test.
        global: { plugins: [router], stubs: { VizChart: VizChartStub, MetricInfo: true } },
        attachTo: document.body,
    })
    await flushPromises()
    return wrapper
}

const entities = (wrapper) =>
    Object.fromEntries(chartsById(wrapper)['sources.retrievals'].props('spec').datasets.map((d) => [d.key, d.entity]))

beforeEach(() => {
    Object.values(client).forEach((fn) => fn.mockReset())
})

describe('SourcesUrlsPage: charts', () => {
    it('draws retrievals per domain over the period\'s days', async () => {
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com', 'reddit.com']) })
        const wrapper = await mountPage()
        const spec = chartsById(wrapper)['sources.retrievals'].props('spec')
        expect(spec).toMatchObject({
            title: 'Retrievals over time',
            subtitle: 'Daily retrievals for the five most-used domains in this period',
            x: 'time',
            labels: ['2026-11-01', '2026-11-02', '2026-11-03'],
            stacked: true,
            representations: ['line', 'area', 'stacked_bar', 'heatmap', 'table'],
        })
        expect(entities(wrapper)).toEqual({ 'g2.com': 'slot:1', 'reddit.com': 'slot:2' })
    })

    it('keeps each domain\'s colour across a filter change', async () => {
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com', 'reddit.com', 'zapier.com']) })
        const wrapper = await mountPage()
        expect(entities(wrapper)).toEqual({ 'g2.com': 'slot:1', 'reddit.com': 'slot:2', 'zapier.com': 'slot:3' })

        // A model filter: g2.com drops out, a new domain comes in.
        client.get.mockResolvedValueOnce({ data: urlsPayload(['zapier.com', 'notion.so', 'reddit.com']) })
        await wrapper.findAll('[data-filter-menu] button')[1].trigger('click')
        await wrapper.findAll('[data-filter-menu] button').find((b) => b.text().trim() === 'Claude').trigger('click')
        await flushPromises()
        expect(client.get).toHaveBeenLastCalledWith(`/citations/websites/${WEBSITE_ID}/urls/`, {
            params: { period_days: 30, provider: 'claude' },
            _silentError: true,
        })
        expect(entities(wrapper)).toEqual({ 'zapier.com': 'slot:3', 'notion.so': 'slot:4', 'reddit.com': 'slot:2' })
    })

    it('shows URL types as a share of retrievals, with their empty states', async () => {
        client.get.mockResolvedValueOnce({ data: urlsPayload([], { url_types: [] }) })
        const wrapper = await mountPage()
        const charts = chartsById(wrapper)
        expect(charts['sources.retrievals'].props('empty')).toEqual({
            title: 'No retrievals in this period yet',
            body: 'Retrievals appear as the AI engines answer the prompts you track.',
            action: { label: 'Add prompts', to: '/dashboard' },
        })
        expect(charts['sources.url_types'].props('empty')).toEqual({
            title: 'No retrievals in this period',
            body: 'URL types break down which content formats AI reaches for once sources are collected.',
        })
    })

    it('draws URL types with their share and the total', async () => {
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        const types = chartsById(wrapper)['sources.url_types']
        expect(types.props('spec')).toMatchObject({ value: 'percent', labels: ['Listicle', 'Comparison'], stacked: true })
        expect(types.props('spec').datasets[0].data).toEqual([67, 33])
        expect(types.props('empty')).toBeNull()
        expect(types.text()).toContain('Total retrievals: 12')
    })
})
