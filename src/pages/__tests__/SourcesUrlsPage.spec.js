import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
// Citation analytics reads its own endpoint, so the client mock above
// serves the Sources table alone.
const insights = vi.hoisted(() => ({ citations: vi.fn() }))
const ask = vi.hoisted(() => ({ askAgent: vi.fn(async () => true) }))

vi.mock('@/api/client', () => ({ default: client, authHeaders: () => ({}), refreshAccessToken: async () => '' }))
vi.mock('@/api/insights', () => ({ default: insights }))
vi.mock('@/lib/agent/askAgent', () => ask)

import SourcesUrlsPage from '@/pages/SourcesUrlsPage.vue'
import { VizChartStub, chartsById } from './__fixtures__/vizStub'
import { WEBSITE_ID } from './__fixtures__/polish'
import { apiError, citationsPayload } from '@/pages/analytics/__tests__/__fixtures__/measurementPayloads'

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
            { path: '/projects/:websiteId/sources', name: 'sources-urls', component: Blank, meta: { analytics: 'sources' } },
            { path: '/projects/:websiteId/sources/detail', name: 'sources-url-detail', component: Blank },
            { path: '/projects/:websiteId/prompts/:promptId', name: 'prompt', component: Blank },
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
    insights.citations.mockReset()
    insights.citations.mockResolvedValue({ data: citationsPayload() })
    ask.askAgent.mockClear()
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

describe('SourcesUrlsPage: citation analytics', () => {
    const section = (wrapper) => wrapper.find('[aria-labelledby="ca-title"]')

    it('comes first, with its own filters, tiles, charts and tables', async () => {
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        expect(insights.citations).toHaveBeenCalledWith(WEBSITE_ID, { period: '30d' })
        const ca = section(wrapper)
        expect(ca.find('h2').text()).toBe('Citation analytics')
        expect(ca.text()).toContain('Which sources the engines rely on, and where you and your competitors are cited.')
        expect(ca.findAll('.viz-stat').map((t) => t.text())).toEqual([
            'Answers with sources80 of 120',
            'Sources listed340',
            'Cited in the answer text210 of 340',
            'Your pages cited31',
        ])
        expect(ca.text()).toContain(
            'Here every source an answer lists counts once. The table below calls that a retrieval and counts a citation each time the answer text points to the source.',
        )
        const charts = chartsById(wrapper)
        expect(charts['citations.classes'].props('spec').title).toBe('Sources by type')
        expect(charts['citations.engines'].props('spec').title).toBe('Sources by engine')
        expect(ca.find('#ca-yours-title').text()).toBe('Your cited pages')
        expect(ca.find('#ca-theirs-title').text()).toBe('Competitor pages cited')
        expect(ca.find('#ca-gaps-title').text()).toBe('Prompts where only competitors are cited')
        expect(ca.text()).toContain(
            'Retrieved only: the engine fetched the page while answering, but its answer text never pointed to it.',
        )
        // The Sources table below still loads on its own.
        expect(client.get).toHaveBeenCalledWith(`/citations/websites/${WEBSITE_ID}/urls/`, {
            params: { period_days: 30 },
            _silentError: true,
        })
    })

    it('sends its own period and engine, leaving the Sources table alone', async () => {
        client.get.mockResolvedValue({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        const [period, engine] = section(wrapper).findAll('select')
        await period.setValue('7d')
        await flushPromises()
        await engine.setValue('claude')
        await flushPromises()
        expect(insights.citations).toHaveBeenLastCalledWith(WEBSITE_ID, { period: '7d', engine: 'claude' })
        expect(client.get).toHaveBeenCalledTimes(1)
    })

    it('asks the agent for a page where only competitors are cited', async () => {
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        await section(wrapper).find('[aria-labelledby="ca-gaps-title"] .ask-btn').trigger('click')
        await flushPromises()
        const [, options] = ask.askAgent.mock.calls[0]
        expect(options).toMatchObject({ websiteId: WEBSITE_ID, agent: 'aeo_article', from: 'sources' })
        expect(options.text).toBe(
            'For "best note taking app for teams", AI engines cited competitor pages 6 times and ours never. Most cited domains: g2.com and reddit.com.\n' +
                'Draft a page that answers this prompt well enough to be cited.',
        )
    })

    it('says when the answers listed no sources', async () => {
        insights.citations.mockResolvedValue({
            data: citationsPayload({
                has_data: false,
                totals: null,
                by_class: [],
                by_engine: [],
                your_pages: [],
                competitor_pages: [],
                gaps: [],
            }),
        })
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        const ca = section(wrapper)
        expect(ca.find('.viz-state-title').text()).toBe('No cited sources were recorded for these answers.')
        expect(ca.find('.viz-state-body').text()).toBe(
            'Engines list sources when they search the web: Perplexity always, ChatGPT and Claude when web search is on.',
        )
        expect(ca.findAll('.viz-stat')).toHaveLength(0)
    })

    it('says when insights are turned off on the server', async () => {
        insights.citations.mockRejectedValue(apiError(503, 'insights_disabled', 'Insights are turned off on this server.'))
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        expect(section(wrapper).find('.viz-state-title').text()).toBe('Insights are turned off on this server.')
        // The rest of the page still works.
        expect(chartsById(wrapper)['sources.retrievals']).toBeTruthy()
    })

    it('shows its own load error with Try again', async () => {
        insights.citations.mockRejectedValue(apiError(500))
        client.get.mockResolvedValueOnce({ data: urlsPayload(['g2.com']) })
        const wrapper = await mountPage()
        const ca = section(wrapper)
        expect(ca.find('.viz-state-title').text()).toBe("We couldn't load citation analytics.")
        insights.citations.mockResolvedValue({ data: citationsPayload() })
        await ca.find('.viz-state button').trigger('click')
        await flushPromises()
        expect(section(wrapper).findAll('.viz-stat')).toHaveLength(4)
    })
})
