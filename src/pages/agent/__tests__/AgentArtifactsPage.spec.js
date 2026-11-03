import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const fakeAgent = reactive({})
vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))

const { default: AgentArtifactsPage } = await import('../AgentArtifactsPage.vue')

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })

async function setup(name, kinds, extraRoutes = []) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: Blank },
      { path: '/projects/:websiteId/agent/reports', name: 'agent-reports', component: Blank },
      { path: '/projects/:websiteId/agent/documents', name: 'agent-documents', component: Blank },
      { path: '/projects/:websiteId/agent/sheets', name: 'agent-sheets', component: Blank },
      { path: '/projects/:websiteId/agent/artifacts/:artifactId', name: 'agent-artifact', component: Blank },
      ...extraRoutes,
    ],
  })
  await router.push({ name, params: { websiteId: 'w1' } })
  await router.isReady()
  const wrapper = mount(AgentArtifactsPage, {
    props: { websiteId: 'w1', kinds },
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  Object.assign(fakeAgent, {
    websiteId: 'w1',
    loadArtifacts: vi.fn(async () => []),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AgentArtifactsPage', () => {
  it.each([
    ['agent-reports', ['report'], 'Reports', 'No reports yet.', 'Ask the agent to research a brand, then save the report.'],
    ['agent-documents', ['document', 'page'], 'Documents', 'No documents yet.', ''],
    ['agent-sheets', ['sheet'], 'Sheets', 'No sheets yet.', ''],
  ])('%s shows an honest empty state', async (name, kinds, title, empty, body) => {
    const { wrapper } = await setup(name, kinds)
    expect(fakeAgent.loadArtifacts).toHaveBeenCalledWith(kinds, '')
    expect(wrapper.find('h1').text()).toBe(title)
    expect(wrapper.text()).toContain(empty)
    if (body) expect(wrapper.text()).toContain(body)
    expect(wrapper.find('ul.ag-arts').exists()).toBe(false)
  })

  it('derives kinds from the route when the prop is missing', async () => {
    await setup('agent-sheets', null)
    expect(fakeAgent.loadArtifacts).toHaveBeenCalledWith(['sheet'], '')
  })

  it('lists artifacts with version, update time, author and links', async () => {
    fakeAgent.loadArtifacts = vi.fn(async () => [
      {
        id: 'a1',
        kind: 'page',
        title: 'Battery landing page',
        latest_version: 3,
        updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        created_by_name: 'Sam',
        source_chat_id: 'c7',
      },
      { id: 'a2', kind: 'document', title: 'Battery guide', latest_version: 1, updated_at: null, source_chat_id: null },
    ])
    const { wrapper } = await setup('agent-documents', ['document', 'page'])
    const rows = wrapper.findAll('li.ag-art')
    expect(rows).toHaveLength(2)
    const main = rows[0].find('a.ag-art-main')
    expect(main.attributes('href')).toBe('/projects/w1/agent/artifacts/a1')
    expect(main.text()).toContain('Battery landing page')
    expect(main.find('.ag-art-meta').text()).toBe('Landing page · v3 · Updated 2 hours ago · Sam')
    const chat = rows[0].find('a.ag-art-chat')
    expect(chat.attributes('href')).toBe('/projects/w1/agent/c/c7?artifact=a1')
    expect(rows[1].find('a.ag-art-chat').exists()).toBe(false)
  })

  it('searches after a pause and says when nothing matches', async () => {
    const { wrapper } = await setup('agent-reports', ['report'])
    vi.useFakeTimers()
    await wrapper.find('input[type="search"]').setValue('turonote')
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    await flushPromises()
    expect(fakeAgent.loadArtifacts).toHaveBeenLastCalledWith(['report'], 'turonote')
    expect(wrapper.text()).toContain('No reports match "turonote".')
  })

  it('shows the error with a retry', async () => {
    fakeAgent.loadArtifacts = vi.fn(async () => {
      throw Object.assign(new Error('x'), { name: 'AgentError', message: 'The agent is temporarily unavailable.' })
    })
    const { wrapper } = await setup('agent-reports', ['report'])
    expect(wrapper.text()).toContain("Couldn't load reports.")
    expect(wrapper.text()).toContain('The agent is temporarily unavailable.')
    fakeAgent.loadArtifacts = vi.fn(async () => [])
    await wrapper.find('.ag-empty button').trigger('click')
    await flushPromises()
    expect(fakeAgent.loadArtifacts).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('No reports yet.')
  })
})
