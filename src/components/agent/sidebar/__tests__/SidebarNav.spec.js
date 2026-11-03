import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const fakeAgent = reactive({ artifacts: {}, artifact: (id) => fakeAgent.artifacts[id] || null })
vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))

const { default: SidebarNav } = await import('../SidebarNav.vue')
const { default: ProductSwitch } = await import('../ProductSwitch.vue')

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })

async function setup(component, path, props) {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'dashboard', component: Blank },
      { path: '/agent', name: 'agent', component: Blank },
      { path: '/agent/projects', name: 'agent-projects', component: Blank },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: Blank },
      { path: '/projects/:websiteId/agent/context', name: 'agent-context', component: Blank },
      { path: '/projects/:websiteId/agent/agents', name: 'agent-agents', component: Blank },
      { path: '/projects/:websiteId/agent/reports', name: 'agent-reports', component: Blank },
      { path: '/projects/:websiteId/agent/sheets', name: 'agent-sheets', component: Blank },
      { path: '/projects/:websiteId/agent/documents', name: 'agent-documents', component: Blank },
      { path: '/projects/:websiteId/agent/artifacts/:artifactId', name: 'agent-artifact', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(component, { props, global: { plugins: [router] } })
}

beforeEach(() => {
  fakeAgent.artifacts = {}
})

describe('SidebarNav', () => {
  it('lists the seven sections in order with project links', async () => {
    const w = await setup(SidebarNav, '/projects/w1/agent', { websiteId: 'w1' })
    const links = w.findAll('a.ag-nav-row')
    expect(links.map((a) => a.text())).toEqual(['Agent', 'Projects', 'Context', 'Agents', 'Reports', 'Sheets', 'Documents'])
    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/projects/w1/agent',
      '/agent/projects',
      '/projects/w1/agent/context',
      '/projects/w1/agent/agents',
      '/projects/w1/agent/reports',
      '/projects/w1/agent/sheets',
      '/projects/w1/agent/documents',
    ])
    expect(w.findAll('svg.ag-nav-icon')).toHaveLength(7)
  })

  it('marks the current section and not Agent while a chat is open', async () => {
    let w = await setup(SidebarNav, '/projects/w1/agent/reports', { websiteId: 'w1' })
    expect(w.find('[aria-current="page"]').text()).toBe('Reports')
    w = await setup(SidebarNav, '/projects/w1/agent/c/c1', { websiteId: 'w1' })
    expect(w.find('[aria-current="page"]').exists()).toBe(false)
  })

  it('highlights the list an open artifact belongs to', async () => {
    fakeAgent.artifacts = { a1: { id: 'a1', kind: 'page' } }
    const w = await setup(SidebarNav, '/projects/w1/agent/artifacts/a1', { websiteId: 'w1' })
    expect(w.find('[aria-current="page"]').text()).toBe('Documents')
  })

  it('disables project sections when there is no project', async () => {
    const w = await setup(SidebarNav, '/agent/projects', { websiteId: null })
    expect(w.findAll('a.ag-nav-row').map((a) => a.text())).toEqual(['Projects'])
    expect(w.findAll('[aria-disabled="true"]')).toHaveLength(6)
  })
})

describe('ProductSwitch', () => {
  it('links Agent to the project home and Analytics to the dashboard', async () => {
    const w = await setup(ProductSwitch, '/projects/w1/agent/context', { websiteId: 'w1' })
    const [agentLink, analytics] = w.findAll('a')
    expect(agentLink.text()).toBe('Agent')
    expect(agentLink.attributes('href')).toBe('/projects/w1/agent')
    expect(agentLink.attributes('aria-current')).toBe('true')
    expect(analytics.text()).toBe('Analytics')
    expect(analytics.attributes('href')).toBe('/dashboard')
    expect(w.attributes('role')).toBe('group')
  })

  it('falls back to /agent without a project', async () => {
    const w = await setup(ProductSwitch, '/agent/projects', { websiteId: null })
    expect(w.find('a').attributes('href')).toBe('/agent')
  })
})
