import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
const visibility = vi.hoisted(() => ({ dashboard: vi.fn() }))
const countries = vi.hoisted(() => ({ matrix: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('@/api/client', () => ({ default: client, authHeaders: () => ({}), refreshAccessToken: async () => '' }))
vi.mock('@/api/visibility', () => ({ default: visibility }))
vi.mock('@/api/countries', () => ({ default: countries }))
vi.mock('@/api/searchGap', () => ({ default: { checkGoogle: vi.fn() } }))
vi.mock('@/api/promptLibrary', () => ({ default: { setArchived: vi.fn() } }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

import PromptPage from '@/pages/PromptPage.vue'
import { VizChartStub, chartsById } from './__fixtures__/vizStub'
import { PROMPT_ID, WEBSITE_ID, countryMatrix, dashboardPayload, promptDetail } from './__fixtures__/polish'

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })

const HISTORY = [
    { checked_at: '2026-10-08T09:00:00Z', position: 7, depth: 100, page: 1, location: 'gb', error: '' },
    { checked_at: '2026-10-09T09:00:00Z', position: 2, depth: 100, page: 1, location: 'us', error: '' },
    { checked_at: '2026-10-20T09:00:00Z', position: null, depth: 100, page: null, location: 'gb', error: '' },
]

function historyPayload(overrides = {}) {
    return dashboardPayload({ filters: { engine: null, prompt_id: PROMPT_ID }, google_history: HISTORY, ...overrides })
}

async function mountPage({ detail = promptDetail(), history = historyPayload(), matrix = countryMatrix() } = {}) {
    setActivePinia(createPinia())
    client.get.mockImplementation((url) =>
        url === `/search-gap/websites/${WEBSITE_ID}/prompts/${PROMPT_ID}/`
            ? Promise.resolve({ data: detail })
            : Promise.reject(new Error(`unexpected GET ${url}`))
    )
    if (history instanceof Error) visibility.dashboard.mockRejectedValue(history)
    else visibility.dashboard.mockResolvedValue({ data: history })
    if (matrix instanceof Error) countries.matrix.mockRejectedValue(matrix)
    else countries.matrix.mockResolvedValue({ data: matrix })
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/dashboard', name: 'dashboard', component: Blank },
            { path: '/projects/:websiteId/prompts/:promptId', name: 'prompt', component: Blank },
            { path: '/projects/:websiteId/countries', name: 'countries', component: Blank },
            { path: '/settings/connections', name: 'settings-connections', component: Blank },
        ],
    })
    await router.push(`/projects/${WEBSITE_ID}/prompts/${PROMPT_ID}`)
    await router.isReady()
    const wrapper = mount(PromptPage, {
        props: { websiteId: WEBSITE_ID, promptId: PROMPT_ID },
        global: {
            plugins: [router],
            stubs: {
                VizChart: VizChartStub,
                PromptSecurityFindings: true,
                PromptScheduleModal: true,
                ChatDetailModal: true,
            },
        },
        attachTo: document.body,
    })
    await flushPromises()
    return { wrapper, router }
}

const CHECK_LINK = `/projects/${WEBSITE_ID}/countries?prompt=${PROMPT_ID}&check=1`

beforeEach(() => {
    Object.values(client).forEach((fn) => fn.mockReset())
    visibility.dashboard.mockReset()
    countries.matrix.mockReset()
})

describe('PromptPage: how Google searches this prompt', () => {
    it('shows the method as a chip instead of the country', async () => {
        const { wrapper } = await mountPage()
        const meta = wrapper.find('.pp-meta')
        expect(meta.find('.mchip').text()).toBe('Google set to GB, US connection')
        expect(meta.text()).not.toContain('Searched from')
        expect(meta.text()).toContain('· Google checked')
    })

    it('keeps Global for a Global prompt on Google\'s default', async () => {
        const detail = promptDetail(
            { prompt: { ...promptDetail().prompt, location: '' } },
            { method: { method: 'default', label: 'Searched from US (default)' } }
        )
        const { wrapper } = await mountPage({ detail })
        const meta = wrapper.find('.pp-meta')
        expect(meta.find('.mchip').exists()).toBe(false)
        expect(meta.text()).toContain('Global')
    })

    it('falls back to the country when Google is not configured', async () => {
        const { wrapper } = await mountPage({ detail: promptDetail({ serp_configured: false }, { method: null }) })
        const meta = wrapper.find('.pp-meta')
        expect(meta.find('.mchip').exists()).toBe(false)
        expect(meta.text()).toContain('Searched from GB')
    })
})

describe('PromptPage: history', () => {
    it('draws the Google position from this prompt\'s location and the engines\' visibility', async () => {
        const { wrapper } = await mountPage()
        expect(visibility.dashboard).toHaveBeenCalledWith(WEBSITE_ID, { period: '30d', prompt_id: PROMPT_ID })
        expect(wrapper.find('#pp-history-title').text()).toBe('History')
        expect(wrapper.text()).toContain('How this prompt has moved.')

        const charts = chartsById(wrapper)
        const google = charts['prompt.google'].props('spec')
        expect(google).toMatchObject({ title: 'Google position', x: 'time', value: 'rank', representations: ['line', 'table'] })
        expect(google.labels).toEqual(['2026-10-08T09:00:00Z', '2026-10-20T09:00:00Z'])
        expect(google.datasets[0].data).toEqual([7, null])
        expect(google.datasets[0].states).toEqual([null, 'not_found'])
        expect(google.state_labels.not_found).toBe('Not in top 100')

        const engines = charts['prompt.engines'].props('spec')
        expect(engines).toMatchObject({ title: 'AI visibility', x: 'time', value: 'percent' })
        expect(charts['prompt.engines'].props('empty')).toBeNull()
    })

    it('offers 30 and 90 days and reloads for the period chosen', async () => {
        const { wrapper } = await mountPage()
        const select = wrapper.find('.pp-section-head.is-row select')
        expect(select.findAll('option').map((o) => o.text())).toEqual(['Last 30 days', 'Last 90 days'])
        await select.setValue('90d')
        await flushPromises()
        expect(visibility.dashboard).toHaveBeenLastCalledWith(WEBSITE_ID, { period: '90d', prompt_id: PROMPT_ID })
    })

    it('says when there are no Google checks or AI answers in the period', async () => {
        const { wrapper } = await mountPage({ history: historyPayload({ google_history: [], has_data: false, empty_reason: 'no_answers' }) })
        const charts = chartsById(wrapper)
        expect(charts['prompt.google'].props('empty')).toEqual({ title: 'No Google checks in this period.', body: 'Use Check now to record one.' })
        expect(charts['prompt.engines'].props('empty')).toEqual({ title: 'No AI answers for this prompt in this period.' })
    })

    it('shows a failed history inline with Try again', async () => {
        const { wrapper } = await mountPage({ history: new Error('boom') })
        const google = chartsById(wrapper)['prompt.google']
        expect(google.props('error')).toBe("We couldn't load the history.")
        visibility.dashboard.mockResolvedValueOnce({ data: historyPayload() })
        await google.find('.viz-stub-retry').trigger('click')
        await flushPromises()
        expect(chartsById(wrapper)['prompt.google'].props('error')).toBe('')
        expect(chartsById(wrapper)['prompt.google'].props('spec').labels).toHaveLength(2)
    })
})

describe('PromptPage: by country', () => {
    // Each cell's lines (the value, then the method under Google).
    const rows = (wrapper) =>
        wrapper.findAll('.pp-ct tbody tr').map((tr) =>
            tr.findAll('th, td').map((c) => {
                const lines = c.findAll('.pp-ct-value, .pp-ct-note, .gap-badge').map((l) => l.text().trim())
                return lines.length ? lines.join(' / ') : c.text().trim()
            })
        )

    it('lists the latest check in each country with the method and the gap', async () => {
        const { wrapper } = await mountPage()
        expect(countries.matrix).toHaveBeenCalledWith(WEBSITE_ID, { prompt_id: PROMPT_ID })
        expect(wrapper.text()).toContain('The latest check of this prompt in each country.')
        expect(wrapper.findAll('.pp-ct thead th').map((th) => th.text())).toEqual(['Country', 'Google', 'ChatGPT', 'Claude', 'Gap'])
        expect(rows(wrapper)).toEqual([
            ['Germany', 'Not in top 10 / Google set to DE, US connection', 'Not checked', 'Failed', 'Not definite'],
            ['United Kingdom', '#4 / Google set to GB, US connection', 'Named #2', 'Not checked', 'Google ahead'],
        ])
        const link = wrapper.findAll('a').find((a) => a.text() === 'Check countries')
        expect(link.attributes('href')).toBe(CHECK_LINK)
    })

    it('says when the prompt has not been checked in other countries', async () => {
        const { wrapper } = await mountPage({ matrix: countryMatrix({ cells: [], gaps: [] }) })
        expect(wrapper.find('.pp-ct').exists()).toBe(false)
        expect(wrapper.text()).toContain("This prompt hasn't been checked in other countries.")
        const links = wrapper.findAll('a').filter((a) => a.text() === 'Check countries')
        expect(links).toHaveLength(1)
        expect(links[0].attributes('href')).toBe(CHECK_LINK)
    })

    it('shows a failed load with Try again', async () => {
        const { wrapper } = await mountPage({ matrix: new Error('boom') })
        expect(wrapper.text()).toContain("We couldn't load country results.")
        countries.matrix.mockResolvedValueOnce({ data: countryMatrix() })
        await wrapper.findAll('button').find((b) => b.text() === 'Try again').trigger('click')
        await flushPromises()
        expect(rows(wrapper)).toHaveLength(2)
    })
})
