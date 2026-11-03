import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
const visibility = vi.hoisted(() => ({ dashboard: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('@/api/client', () => ({ default: client, authHeaders: () => ({}), refreshAccessToken: async () => '' }))
vi.mock('@/api/visibility', () => ({ default: visibility }))
vi.mock('@/api/searchGap', () => ({ default: { checkGoogle: vi.fn() } }))
vi.mock('@/api/websites', () => ({ default: { list: vi.fn() } }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))
// First-run onboarding has its own specs; it only shows for a new account.
vi.mock('@/components/onboarding/OnboardingFlow.vue', async () => {
    const vue = await import('vue')
    return { default: vue.defineComponent({ name: 'OnboardingFlow', render: () => vue.h('div') }) }
})

import OverviewPage from '@/pages/OverviewPage.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { VizChartStub, chartsById } from './__fixtures__/vizStub'
import { WEBSITE_ID, dashboardPayload, overviewPayload } from './__fixtures__/polish'

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })
const GapMapStub = defineComponent({ name: 'GapMap', props: ['prompts'], emits: ['open'], render: () => h('div', { class: 'gap-map-stub' }) })

function makeRouter() {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/dashboard', name: 'dashboard', component: Blank },
            { path: '/projects/:websiteId/prompts/:promptId', name: 'prompt', component: Blank },
            { path: '/projects/:websiteId/visibility', name: 'visibility', component: Blank },
        ],
    })
}

async function mountPage({ overview = overviewPayload(), dashboard = dashboardPayload() } = {}) {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().session = { onboarding: { needs_onboarding: false } }
    const app = useAppStore()
    app.setWebsites([{ id: WEBSITE_ID, name: 'Notion' }])
    app.setActiveWebsite({ id: WEBSITE_ID, name: 'Notion' })
    client.get.mockResolvedValue({ data: overview })
    if (dashboard instanceof Error) visibility.dashboard.mockRejectedValue(dashboard)
    else visibility.dashboard.mockResolvedValue({ data: dashboard })
    const router = makeRouter()
    await router.push('/dashboard')
    await router.isReady()
    const wrapper = mount(OverviewPage, {
        global: {
            plugins: [pinia, router],
            stubs: {
                VizChart: VizChartStub,
                GapMap: GapMapStub,
                OnboardingFlow: true,
                AddPromptsDialog: true,
                AddProjectDialog: true,
            },
        },
        attachTo: document.body,
    })
    await flushPromises()
    return { wrapper, router }
}

const tileTexts = (wrapper) => wrapper.findAll('.ov-kpis .viz-stat').map((t) => t.text().replace(/\s+/g, ' ').trim())
const rowTexts = (wrapper) => wrapper.findAll('.gt-row .gt-prompt-text').map((r) => r.text())

beforeEach(() => {
    localStorage.clear()
    Object.values(client).forEach((fn) => fn.mockReset())
    visibility.dashboard.mockReset()
})

describe('OverviewPage: KPI tiles', () => {
    it('shows the five tiles with the visibility change from the last 30 days', async () => {
        const { wrapper } = await mountPage()
        const tiles = tileTexts(wrapper)
        expect(tiles).toHaveLength(5)
        expect(tiles[0]).toContain('AI visibility')
        expect(tiles[0]).toContain('34%')
        expect(tiles[0]).toContain('+4.1 pts')
        expect(tiles[0]).toContain('vs previous 30 days')
        expect(tiles[0]).toContain('Share of recent AI answers that name you')
        expect(tiles[1]).toContain('#5.3')
        expect(tiles[1]).toContain('3 of 3 checked')
        // A measured zero is 0.
        expect(tiles[3]).toContain('Google ahead')
        expect(tiles[3]).toContain('0')
    })

    it('says what was not measured instead of a number', async () => {
        const overview = overviewPayload()
        overview.kpis = { ...overview.kpis, ai_visibility_pct: null, avg_google_position: null, google_checked: 0 }
        const { wrapper } = await mountPage({ overview, dashboard: dashboardPayload({ headline: { visibility_pct: null, visibility_prev_pct: null } }) })
        const tiles = tileTexts(wrapper)
        expect(tiles[0]).toContain('No answers yet')
        expect(tiles[0]).not.toContain('pts')
        expect(tiles[1]).toContain('Not checked')
        expect(tiles[1]).not.toMatch(/#\d/)
    })
})

describe('OverviewPage: AI visibility trend', () => {
    it('loads the last 30 days after the overview and links to Visibility', async () => {
        const { wrapper } = await mountPage()
        expect(client.get).toHaveBeenCalledWith(`/search-gap/websites/${WEBSITE_ID}/overview/`, { _silentError: true })
        expect(visibility.dashboard).toHaveBeenCalledWith(WEBSITE_ID, { period: '30d' })
        const trend = chartsById(wrapper)['overview.trend']
        expect(trend.props('spec')).toMatchObject({
            title: 'AI visibility over time',
            subtitle: 'Share of answers that name you, last 30 days, by engine.',
            x: 'time',
            value: 'percent',
        })
        expect(trend.props('spec').datasets.map((d) => d.key)).toEqual(['chatgpt', 'claude'])
        expect(trend.props('loading')).toBe(false)
        expect(trend.props('empty')).toBeNull()
        const link = trend.find('a')
        expect(link.text()).toBe('Open Visibility')
        expect(link.attributes('href')).toBe(`/projects/${WEBSITE_ID}/visibility`)
    })

    it('says when there were no answers in the last 30 days', async () => {
        const { wrapper } = await mountPage({ dashboard: dashboardPayload({ has_data: false, empty_reason: 'no_answers' }) })
        expect(chartsById(wrapper)['overview.trend'].props('empty')).toEqual({ title: 'No AI answers in the last 30 days.' })
    })

    it('shows a failed trend inline and tries again', async () => {
        const { wrapper } = await mountPage({ dashboard: new Error('boom') })
        const trend = chartsById(wrapper)['overview.trend']
        expect(trend.props('error')).toBe("We couldn't load the trend.")
        // The rest of the overview is there; the tile has no change to show.
        expect(tileTexts(wrapper)[0]).not.toContain('pts')
        expect(rowTexts(wrapper)).toHaveLength(3)

        visibility.dashboard.mockResolvedValueOnce({ data: dashboardPayload() })
        await trend.find('.viz-stub-retry').trigger('click')
        await flushPromises()
        expect(visibility.dashboard).toHaveBeenCalledTimes(2)
        expect(chartsById(wrapper)['overview.trend'].props('error')).toBe('')
        expect(tileTexts(wrapper)[0]).toContain('+4.1 pts')
    })

    it('does not ask for a trend when no prompt is tracked', async () => {
        const { wrapper } = await mountPage({ overview: overviewPayload({ prompts: [], leaderboard: [] }) })
        expect(visibility.dashboard).not.toHaveBeenCalled()
        expect(chartsById(wrapper)['overview.trend']).toBeUndefined()
        expect(wrapper.text()).toContain('Start with the questions your buyers ask.')
    })
})

describe('OverviewPage: charts', () => {
    it('draws the gap map as a chart with a table and a legend of the gap classes', async () => {
        const { wrapper } = await mountPage()
        const map = chartsById(wrapper)['overview.gap_map']
        expect(map.props('spec')).toMatchObject({ representations: ['custom', 'table'], custom_label: 'Map' })
        expect(map.find('.gap-map-stub').exists()).toBe(true)
        const legend = map.findAll('.viz-legend-label').map((l) => l.text())
        expect(legend).toEqual(['AI ahead', 'Google ahead', 'Strong in both', 'Invisible in both', 'Even'])
    })

    it('shows who AI recommends as a list, with your brand selected for the bars', async () => {
        const { wrapper } = await mountPage()
        const board = chartsById(wrapper)['overview.leaderboard']
        expect(board.props('spec').representations).toEqual(['custom', 'hbar', 'table'])
        expect(board.props('selected')).toBe('Notion')
        expect(board.findAll('.lb-row').map((r) => r.find('.lb-name').text())).toEqual(['Evernote', 'Notion You'])
    })

    it('says when no brand was named yet', async () => {
        const { wrapper } = await mountPage({ overview: overviewPayload({ leaderboard: [] }) })
        expect(chartsById(wrapper)['overview.leaderboard'].props('empty')).toEqual({
            title: 'Brands appear here once the engines have answered your prompts.',
        })
    })

    it('shows engines by prompt as a heatmap and opens the prompt picked', async () => {
        const { wrapper, router } = await mountPage()
        const heatmap = chartsById(wrapper)['overview.engines']
        const spec = heatmap.props('spec')
        expect(spec).toMatchObject({ title: 'Engines by prompt', subtitle: "Share of each engine's recent answers that name you." })
        expect(spec.representations).toEqual(['heatmap', 'table'])
        // Largest absolute gap first.
        expect(spec.labels).toEqual(['p-1', 'p-2', 'p-3'])
        expect(spec.datasets.find((d) => d.key === 'gemini').states).toEqual(['not_configured', 'not_configured', 'not_configured'])

        heatmap.vm.$emit('select', { label: 'p-2', labelIndex: 1 })
        await flushPromises()
        expect(router.currentRoute.value).toMatchObject({ name: 'prompt', params: { websiteId: WEBSITE_ID, promptId: 'p-2' } })
    })
})

describe('OverviewPage: prompt table filters', () => {
    it('searches the prompt text and narrows by country', async () => {
        const { wrapper } = await mountPage()
        expect(rowTexts(wrapper)).toEqual(['best note taking app for teams', 'notion alternatives for startups', 'team wiki software'])

        await wrapper.find('input[type="search"]').setValue('NOTION')
        expect(rowTexts(wrapper)).toEqual(['notion alternatives for startups'])
        await wrapper.find('input[type="search"]').setValue('')

        const [country] = wrapper.findAll('select.gt-select-input')
        expect(country.findAll('option').map((o) => o.text())).toEqual(['All countries', 'United Kingdom', 'United States', 'Global'])
        await country.setValue('__global')
        expect(rowTexts(wrapper)).toEqual(['team wiki software'])
        await country.setValue('gb')
        expect(rowTexts(wrapper)).toEqual(['notion alternatives for startups'])
    })

    it('sorts by Google position, AI score and the newest prompt', async () => {
        const { wrapper } = await mountPage()
        const sort = wrapper.findAll('select.gt-select-input')[1]
        expect(sort.findAll('option').map((o) => o.text())).toEqual(['Biggest gap', 'Best Google position', 'Highest AI score', 'Newest'])
        await sort.setValue('google')
        expect(rowTexts(wrapper)).toEqual(['notion alternatives for startups', 'best note taking app for teams', 'team wiki software'])
        await sort.setValue('ai')
        expect(rowTexts(wrapper)).toEqual(['best note taking app for teams', 'notion alternatives for startups', 'team wiki software'])
        // The dashboard lists prompts oldest first.
        await sort.setValue('newest')
        expect(rowTexts(wrapper)).toEqual(['notion alternatives for startups', 'best note taking app for teams', 'team wiki software'])
    })

    it('offers Newest only once the order the prompts were added in is known', async () => {
        const { wrapper } = await mountPage({ dashboard: new Error('boom') })
        const newest = wrapper.findAll('select.gt-select-input')[1].findAll('option')[3]
        expect(newest.text()).toBe('Newest')
        expect(newest.attributes('disabled')).toBeDefined()
    })

    it('says when nothing matches and clears every filter', async () => {
        const { wrapper } = await mountPage()
        await wrapper.findAll('.gt-chip').find((c) => c.text().startsWith('AI ahead')).trigger('click')
        await wrapper.find('input[type="search"]').setValue('wiki')
        expect(rowTexts(wrapper)).toEqual([])
        expect(wrapper.find('.gt-empty').text()).toContain('No prompts match these filters.')

        await wrapper.find('.gt-clear').trigger('click')
        expect(rowTexts(wrapper)).toHaveLength(3)
        expect(wrapper.find('input[type="search"]').element.value).toBe('')
        expect(wrapper.find('.gt-chip.is-active').text()).toContain('All')
    })
})
