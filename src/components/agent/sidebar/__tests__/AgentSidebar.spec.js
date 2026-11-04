import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { setLastChat } from '@/lib/agent/storage'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

// The switcher, inbox, agent sections and recents belong to other files;
// these stand-ins say where each one renders.
const { stub } = vi.hoisted(() => ({
  stub: (cls) => async () => {
    const vue = await import('vue')
    return { default: vue.defineComponent({ props: ['websiteId', 'website'], setup: () => () => vue.h('div', { class: cls }) }) }
  },
}))
vi.mock('../WorkspaceSwitcher.vue', stub('stub-switcher'))
vi.mock('../ActivityButton.vue', stub('stub-activity'))
vi.mock('../SidebarNav.vue', stub('stub-agent-nav'))
vi.mock('../SidebarRecents.vue', stub('stub-recents'))

const { default: AgentSidebar } = await import('../AgentSidebar.vue')

const Blank = defineComponent({ render: () => h('div') })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/docs', name: 'docs', component: Blank },
      { path: '/agent', name: 'agent', component: Blank },
      { path: '/dashboard', name: 'dashboard', component: Blank, meta: { page: true, title: 'Analytics' } },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true, title: 'Settings' } },
      { path: '/billing', name: 'billing', component: Blank, meta: { settings: true, title: 'Billing' } },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: Blank },
      { path: '/projects/:websiteId/agent/context', name: 'agent-context', component: Blank },
      { path: '/projects/:websiteId/analytics', name: 'analytics', component: Blank, meta: { board: true } },
    ],
  })
}

const mounted = []

async function setup(path) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAppStore().setWebsites([{ id: 'w1', name: 'Wrenfield' }])
  useAuthStore().user = { id: 7 }
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AgentSidebar, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

const switchItems = (wrapper) => wrapper.findAll('.ag-ps-item')
const current = (wrapper) => wrapper.findAll('.ag-ps-item.is-active').map((a) => a.text())

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  document.body.innerHTML = ''
})

describe('AgentSidebar', () => {
  it('shows the same sidebar on the Agent and Analytics tabs', async () => {
    const { wrapper, router } = await setup('/projects/w1/agent/context')
    expect(current(wrapper)).toEqual(['Agent'])
    const parts = () => ['.stub-switcher', '.stub-activity', '.stub-agent-nav', '.stub-recents', '.ag-sb-footer'].map((s) => wrapper.find(s).exists())
    expect(parts()).toEqual([true, true, true, true, true])

    await router.push('/projects/w1/analytics?widget=countries')
    await flushPromises()
    expect(current(wrapper)).toEqual(['Analytics'])
    expect(parts()).toEqual([true, true, true, true, true])
    // No list of analytics tabs on either side.
    expect(wrapper.find('[aria-label="Analytics"][role="group"]').exists()).toBe(false)
  })

  it('marks neither tab on Settings and Billing, and the footer Settings as current', async () => {
    const { wrapper, router } = await setup('/settings')
    expect(current(wrapper)).toEqual([])
    const settings = wrapper.find('.ag-sb-footer a[aria-label="Settings"]')
    expect(settings.attributes('href')).toBe('/settings')
    expect(settings.attributes('aria-current')).toBe('page')

    await router.push('/billing')
    await flushPromises()
    expect(current(wrapper)).toEqual([])

    await router.push('/dashboard')
    await flushPromises()
    expect(current(wrapper)).toEqual(['Analytics'])
  })

  it("links Agent to the project's last chat and Analytics to its board", async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics?widget=traffic')
    const [agent, analytics] = switchItems(wrapper)
    expect(agent.attributes('href')).toBe('/projects/w1/agent')
    expect(analytics.attributes('href')).toBe('/projects/w1/analytics')
    setLastChat(7, 'w1', 'c42')
    await router.push('/projects/w1/analytics')
    await flushPromises()
    expect(switchItems(wrapper)[0].attributes('href')).toBe('/projects/w1/agent/c/c42')
  })
})
