import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/stores/agent', async () => {
  const m = await import('./__fixtures__/stores.js')
  return { useAgentStore: m.useAgentStore }
})
vi.mock('@/stores/auth', async () => {
  const m = await import('./__fixtures__/stores.js')
  return { useAuthStore: m.useAuthStore }
})

import SerpView from '../views/SerpView.vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { serpCapture } from './__fixtures__/stores.js'

function render(tab) {
  return mount(SerpView, { props: { tab: { id: 'serp:c1', kind: 'serp', status: 'ready', ...tab } } })
}

describe('SerpView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the query, page range, location and capture source', () => {
    const wrapper = render({ data: serpCapture() })
    expect(wrapper.find('input[type="search"]').element.value).toBe('best note app')
    expect(wrapper.find('input[type="search"]').attributes('readonly')).toBeDefined()
    const meta = wrapper.find('.ag-serp-meta').text()
    expect(meta).toContain('Page 2 · results 11–14')
    expect(meta).toContain('United States')
    expect(meta).toContain('via SerpAPI')
  })

  it('marks your result and competitors', () => {
    const wrapper = render({ data: serpCapture() })
    const rows = wrapper.findAll('.ag-serp-row')
    expect(rows).toHaveLength(3)
    expect(rows[2].classes()).toContain('is-you')
    expect(rows[2].find('.ag-serp-badge.is-you').text()).toBe('You · #14')
    expect(rows[1].classes()).toContain('is-competitor')
    expect(rows[1].find('.ag-serp-badge.is-competitor').text()).toBe('Competitor · Notely')
    expect(rows[0].find('.ag-serp-badge').exists()).toBe(false)
    expect(rows[0].find('.ag-serp-pos').text()).toBe('#11')
    expect(rows[0].find('.ag-serp-avatar').text()).toBe('R')
    expect(wrapper.find('.ag-serp-brand').text()).toBe('Turonote ranks #14 on this page.')
  })

  it('renders the AI Overview flags, people also ask and the footer', () => {
    const wrapper = render({ data: serpCapture() })
    const flags = wrapper.findAll('.ag-serp-flag').map((f) => f.text())
    expect(flags).toEqual(['Mentions you: No', 'Cites you: Yes'])
    expect(wrapper.find('.ag-serp-refs').text()).toContain('turonote.test')
    expect(wrapper.find('.ag-serp-paa').text()).toContain('What is the best free note app?')
    expect(wrapper.find('.ag-serp-foot').text()).toBe(
      'Positions are Google organic results for this query, location and page.'
    )
  })

  it('never loads third-party favicons', () => {
    const wrapper = render({ data: serpCapture() })
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('opens result links in the pane on a plain click only', async () => {
    const wrapper = render({ data: serpCapture() })
    const pane = useAgentPaneStore()
    const link = wrapper.findAll('.ag-serp-title')[2]
    expect(link.attributes('href')).toBe('https://turonote.test/')
    expect(link.attributes('rel')).toBe('noopener noreferrer nofollow')
    await link.trigger('click', { button: 0, ctrlKey: true })
    expect(pane.tabs).toHaveLength(0)
    await link.trigger('click', { button: 0 })
    expect(pane.activeTab.url).toBe('https://turonote.test/')
  })

  it('shows a skeleton while Google is searched', () => {
    const wrapper = render({ status: 'loading', data: { query: 'best note app', page: 1 } })
    expect(wrapper.find('.ag-serp-loading').text()).toContain('Searching Google…')
    expect(wrapper.findAll('.ag-serp-skel')).toHaveLength(6)
    expect(wrapper.find('.ag-serp-row').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  it('says honestly when Google search is not configured', () => {
    const wrapper = render({
      status: 'error',
      data: { query: 'q', page: 1, error: { code: 'serp_not_configured', message: 'SERPAPI_KEY is not set.' } },
    })
    expect(wrapper.find('[role="alert"]').text()).toContain("Google search isn't available yet.")
    expect(wrapper.find('.ag-serp-row').exists()).toBe(false)
  })

  it('shows other errors with their message', () => {
    const wrapper = render({ status: 'error', data: { query: 'q', error: { code: 'upstream', message: 'Quota reached' } } })
    expect(wrapper.find('[role="alert"]').text()).toContain('Quota reached')
  })

  it('reports when the brand is absent and when Google returned nothing', () => {
    const absent = render({ data: serpCapture({ brand_positions: [], results: serpCapture().results.slice(0, 2) }) })
    expect(absent.find('.ag-serp-brand').text()).toBe('Turonote does not appear on this page.')
    const empty = render({ data: serpCapture({ results: [], ai_overview: null, people_also_ask: [] }) })
    expect(empty.text()).toContain('Google returned no organic results on this page.')
  })
})
