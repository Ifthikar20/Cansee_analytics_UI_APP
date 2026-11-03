import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'

const fakeAgent = reactive({})
vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))
const listWebsites = vi.fn()
vi.mock('@/api/websites', () => ({ default: { list: (...args) => listWebsites(...args) } }))

const { default: AgentProjectsPage } = await import('../AgentProjectsPage.vue')
const { default: AgentAgentsPage } = await import('../AgentAgentsPage.vue')

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })

async function setup(component, path, { websites = null, props = {} } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  if (websites) useAppStore().setWebsites(websites)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agent/projects', name: 'agent-projects', component: Blank },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/agents', name: 'agent-agents', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, { props, global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, ui: useAgentUiStore(), app: useAppStore() }
}

beforeEach(() => {
  listWebsites.mockReset()
  Object.assign(fakeAgent, { websiteId: 'w1', catalog: [], loadCatalog: vi.fn(async () => fakeAgent.catalog) })
})

describe('AgentProjectsPage', () => {
  it('waits for the website list before saying there are no projects', async () => {
    let resolve
    listWebsites.mockReturnValue(new Promise((r) => (resolve = r)))
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/agent/projects', name: 'agent-projects', component: Blank }],
    })
    await router.push('/agent/projects')
    const wrapper = mount(AgentProjectsPage, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toContain('Loading projects')
    expect(wrapper.text()).not.toContain('No projects yet.')
    resolve({ data: [] })
    await flushPromises()
    expect(wrapper.text()).toContain('No projects yet.')
  })

  it('says the list failed to load instead of "No projects yet", and retries', async () => {
    listWebsites.mockRejectedValueOnce(Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 500, data: {} } }))
    const { wrapper } = await setup(AgentProjectsPage, '/agent/projects')
    expect(wrapper.text()).toContain("Couldn't load your projects.")
    expect(wrapper.text()).not.toContain('No projects yet.')

    listWebsites.mockResolvedValueOnce({ data: [{ id: 'w1', name: 'Wrenfield' }] })
    await wrapper.findAll('button').find((b) => b.text() === 'Try again').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('li.ag-project')).toHaveLength(1)
  })

  it('lists projects with the current one marked and opens one', async () => {
    const { wrapper, router, app } = await setup(AgentProjectsPage, '/agent/projects', {
      websites: [
        { id: 'w1', name: 'Wrenfield', url: 'https://www.wrenfield.com', industry: 'E-bikes' },
        { id: 'w2', name: 'Acme', url: 'acme.io' },
      ],
    })
    const cards = wrapper.findAll('li.ag-project')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Wrenfield')
    expect(cards[0].text()).toContain('Current')
    expect(cards[0].text()).toContain('wrenfield.com')
    expect(cards[0].text()).toContain('E-bikes')
    expect(cards[1].text()).not.toContain('Current')
    await cards[1].find('button[aria-label="Open Acme"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/projects/w2/agent')
    expect(app.activeWebsite.id).toBe('w2')
  })

  it('opens the add project dialog', async () => {
    const { wrapper, ui } = await setup(AgentProjectsPage, '/agent/projects', { websites: [{ id: 'w1', name: 'One' }] })
    await wrapper.findAll('button').find((b) => b.text() === 'Add project').trigger('click')
    expect(ui.addProjectOpen).toBe(true)
  })
})

describe('AgentAgentsPage', () => {
  const CATALOG = [
    { key: 'gap_analyst', name: 'Gap Analyst', description: 'Compares Google and AI answers.', output_kind: 'report', starter: 'Research our brand' },
    { key: 'landing_page', name: 'Landing Page Agent', description: 'Builds a page.', output_kind: 'page', starter: '' },
  ]

  it('renders a card per catalog agent with Use linking to a new chat', async () => {
    fakeAgent.catalog = CATALOG
    const { wrapper } = await setup(AgentAgentsPage, '/projects/w1/agent/agents', { props: { websiteId: 'w1' } })
    const cards = wrapper.findAll('li.ag-agent')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('h2').text()).toBe('Gap Analyst')
    expect(cards[0].text()).toContain('Compares Google and AI answers.')
    expect(cards[0].text()).toContain('Research our brand')
    expect(cards[0].find('a').attributes('href')).toBe('/projects/w1/agent?agent=gap_analyst')
    expect(cards[1].find('a').attributes('href')).toBe('/projects/w1/agent?agent=landing_page')
  })

  it('loads the catalog when it is empty and says when there are none', async () => {
    const { wrapper } = await setup(AgentAgentsPage, '/projects/w1/agent/agents', { props: { websiteId: 'w1' } })
    expect(fakeAgent.loadCatalog).toHaveBeenCalled()
    expect(wrapper.text()).toContain('No agents are available.')
  })

  it('shows a load error with a retry', async () => {
    fakeAgent.loadCatalog = vi.fn(async () => {
      throw Object.assign(new Error('x'), { name: 'AgentError', message: 'The agent is temporarily unavailable.' })
    })
    const { wrapper } = await setup(AgentAgentsPage, '/projects/w1/agent/agents', { props: { websiteId: 'w1' } })
    expect(wrapper.text()).toContain("Couldn't load the agents.")
    fakeAgent.loadCatalog = vi.fn(async () => {
      fakeAgent.catalog = CATALOG
      return CATALOG
    })
    await wrapper.find('.ag-empty button').trigger('click')
    await flushPromises()
    expect(fakeAgent.loadCatalog).toHaveBeenCalledWith({ force: true })
    expect(wrapper.findAll('li.ag-agent')).toHaveLength(2)
  })
})
