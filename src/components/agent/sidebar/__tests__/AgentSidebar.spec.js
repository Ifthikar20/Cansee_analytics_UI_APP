import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ANALYTICS_SECTIONS, rememberAnalyticsSection, rememberSidebarSide, sectionLabel } from '@/lib/analyticsNav'
import { useAppStore } from '@/stores/app'

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
const at = (key) => ({ analytics: key, title: sectionLabel(key) })
const pathOf = (name) => (name === 'site-pages' ? 'pages' : name === 'sources-urls' ? 'sources' : name)

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/docs', name: 'docs', component: Blank },
      { path: '/support', name: 'support', component: Blank },
      { path: '/agent', name: 'agent', component: Blank },
      { path: '/dashboard', name: 'dashboard', component: Blank, meta: at('overview') },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true, title: 'Settings' } },
      { path: '/billing', name: 'billing', component: Blank, meta: { settings: true, title: 'Billing' } },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/context', name: 'agent-context', component: Blank },
      { path: '/projects/:websiteId/prompts/:promptId', name: 'prompt', component: Blank, meta: at('overview') },
      { path: '/projects/:websiteId/sources/detail', name: 'sources-url-detail', component: Blank, meta: at('sources') },
      ...ANALYTICS_SECTIONS.filter((s) => s.key !== 'overview').map((s) => ({
        path: `/projects/:websiteId/${pathOf(s.route)}`,
        name: s.route,
        component: Blank,
        meta: at(s.key),
      })),
    ],
  })
}

const mounted = []

async function setup(path) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAppStore().setWebsites([{ id: 'w1', name: 'Wrenfield' }])
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AgentSidebar, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

const switchItems = (wrapper) => wrapper.findAll('.ag-ps-item')
const currentSide = (wrapper) => wrapper.find('.ag-ps-item.is-active').text()

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  document.body.innerHTML = ''
})

describe('AgentSidebar', () => {
  it('shows the agent sections and recents on the Agent side', async () => {
    const { wrapper } = await setup('/projects/w1/agent/context')
    expect(currentSide(wrapper)).toBe('Agent')
    expect(wrapper.find('.stub-agent-nav').exists()).toBe(true)
    expect(wrapper.find('.stub-recents').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Analytics"][role="group"]').exists()).toBe(false)
    expect(wrapper.find('.stub-switcher').exists()).toBe(true)
    expect(wrapper.find('.stub-activity').exists()).toBe(true)
  })

  it('keeps the same sidebar on the Analytics side, with no list of analytics tabs', async () => {
    const { wrapper } = await setup('/projects/w1/crawler-access')
    expect(currentSide(wrapper)).toBe('Analytics')
    expect(wrapper.find('[aria-label="Analytics"][role="group"]').exists()).toBe(false)
    expect(wrapper.find('.stub-agent-nav').exists()).toBe(true)
    expect(wrapper.find('.stub-recents').exists()).toBe(true)
    // The switcher, inbox and footer stay.
    expect(wrapper.find('.stub-switcher').exists()).toBe(true)
    expect(wrapper.find('.ag-sb-footer').exists()).toBe(true)
  })

  it('follows the route between the sides', async () => {
    const { wrapper, router } = await setup('/projects/w1/agent')
    expect(currentSide(wrapper)).toBe('Agent')
    await router.push('/dashboard')
    await flushPromises()
    expect(currentSide(wrapper)).toBe('Analytics')
    expect(wrapper.find('.stub-recents').exists()).toBe(true)
  })

  it('shows the side used last on Settings, with no tab current and the footer Settings current', async () => {
    rememberSidebarSide('analytics')
    const { wrapper, router } = await setup('/settings')
    expect(currentSide(wrapper)).toBe('Analytics')
    expect(wrapper.findAll('.ag-an [aria-current="page"]')).toHaveLength(0)
    const settings = wrapper.find('.ag-sb-footer a[aria-label="Settings"]')
    expect(settings.attributes('href')).toBe('/settings')
    expect(settings.attributes('aria-current')).toBe('page')

    rememberSidebarSide('agent')
    await router.push('/billing')
    await flushPromises()
    expect(currentSide(wrapper)).toBe('Agent')
    expect(wrapper.find('.ag-sb-footer a[aria-label="Settings"]').attributes('aria-current')).toBe('page')

    await router.push('/projects/w1/agent')
    await flushPromises()
    expect(wrapper.find('.ag-sb-footer a[aria-label="Settings"]').attributes('aria-current')).toBeUndefined()
  })

  it('points the Analytics switch at the tab last used for the project', async () => {
    const { wrapper, router } = await setup('/projects/w1/agent')
    const analytics = () => switchItems(wrapper)[1]
    expect(analytics().attributes('href')).toBe('/dashboard')
    rememberAnalyticsSection('w1', 'products')
    await router.push('/projects/w1/agent/context')
    await flushPromises()
    expect(analytics().attributes('href')).toBe('/projects/w1/products')
    expect(switchItems(wrapper)[0].attributes('href')).toBe('/projects/w1/agent')
  })
})
