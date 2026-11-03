import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

// The header logo is a public asset; outside a dev server the SFC compiler
// turns its absolute URL into an import, which the test resolver can't find.
vi.mock('/images/cansee-logo.png', () => ({ default: '/images/cansee-logo.png' }))
vi.mock('@/composables/useShellBootstrap', () => ({ useShellBootstrap: () => {} }))
vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authHeaders: () => ({}),
  refreshAccessToken: async () => '',
}))

const { default: AppShell } = await import('../AppShell.vue')
const { default: ProductSwitch } = await import('@/components/agent/sidebar/ProductSwitch.vue')

const Page = defineComponent({ render: () => h('div', { class: 'test-page' }, 'page') })
const SITES = [
  { id: 'w1', name: 'Wrenfield' },
  { id: 'w2', name: 'Acme' },
]
const mounted = []

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: AppShell,
        children: [
          { path: 'dashboard', name: 'dashboard', component: Page },
          { path: 'projects/:websiteId/prompts/:promptId', name: 'prompt', component: Page },
          { path: 'projects/:websiteId/visibility', name: 'visibility', component: Page },
          { path: 'projects/:websiteId/countries', name: 'countries', component: Page },
          { path: 'projects/:websiteId/traffic', name: 'traffic', component: Page },
          { path: 'projects/:websiteId/ai-traffic', name: 'ai-traffic', component: Page },
          { path: 'projects/:websiteId/sources', name: 'sources-urls', component: Page },
          { path: 'projects/:websiteId/sources/detail', name: 'sources-url-detail', component: Page },
          { path: 'settings', name: 'settings', component: Page },
          { path: 'settings/project', name: 'settings-project', component: Page },
          { path: 'billing', name: 'billing', component: Page },
        ],
      },
      { path: '/agent', name: 'agent', component: Page },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Page },
      { path: '/login', name: 'login', component: Page },
    ],
  })
  // As the app's router does: the URL's project becomes active.
  router.afterEach((to) => {
    const site = useAppStore().websites.find((w) => w.id === to.params.websiteId)
    if (site) useAppStore().setActiveWebsite(site)
  })
  return router
}

async function setup(path, { sites = SITES } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAppStore().setWebsites(sites)
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router, pinia }
}

const topLinks = (wrapper) => wrapper.findAll('.shell-nav a')
const subNav = (wrapper) => wrapper.find('nav[aria-label="Analytics"]')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  document.body.innerHTML = ''
})

describe('AppShell navigation', () => {
  it('has three top destinations', async () => {
    const { wrapper } = await setup('/dashboard')
    expect(topLinks(wrapper).map((a) => a.text())).toEqual(['Analytics', 'Agent', 'Settings'])
    expect(topLinks(wrapper)[1].attributes('href')).toBe('/projects/w1/agent')
  })

  it('shows the Analytics sub-nav on analytics routes only', async () => {
    const { wrapper, router } = await setup('/dashboard')
    const links = subNav(wrapper).findAll('a')
    expect(links.map((a) => a.text())).toEqual(['Overview', 'Visibility', 'Countries', 'Traffic', 'AI traffic', 'Sources'])
    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/dashboard',
      '/projects/w1/visibility',
      '/projects/w1/countries',
      '/projects/w1/traffic',
      '/projects/w1/ai-traffic',
      '/projects/w1/sources',
    ])
    await router.push('/settings')
    await flushPromises()
    expect(subNav(wrapper).exists()).toBe(false)
    expect(wrapper.find('.shell-nav [aria-current="page"]').text()).toBe('Settings')
  })

  it('marks the current section and Analytics as current', async () => {
    const { wrapper, router } = await setup('/projects/w1/countries')
    expect(wrapper.find('.shell-nav [aria-current="page"]').text()).toBe('Analytics')
    expect(subNav(wrapper).find('[aria-current="page"]').text()).toBe('Countries')
    expect(subNav(wrapper).findAll('[aria-current="page"]')).toHaveLength(1)

    await router.push('/projects/w1/prompts/p1')
    await flushPromises()
    expect(subNav(wrapper).find('[aria-current="page"]').text()).toBe('Overview')

    await router.push('/projects/w1/sources/detail?url=x')
    await flushPromises()
    expect(subNav(wrapper).find('[aria-current="page"]').text()).toBe('Sources')
  })

  it('disables project sections when no project is active', async () => {
    const { wrapper } = await setup('/dashboard', { sites: [] })
    expect(subNav(wrapper).findAll('a[href]').map((a) => a.text())).toEqual(['Overview'])
    expect(subNav(wrapper).findAll('[aria-disabled="true"]')).toHaveLength(5)
  })

  it('returns to the section last used for the project, here and in the agent sidebar', async () => {
    const { wrapper, router, pinia } = await setup('/projects/w1/traffic')
    await router.push('/settings')
    await flushPromises()
    expect(topLinks(wrapper)[0].attributes('href')).toBe('/projects/w1/traffic')

    const sidebar = mount(ProductSwitch, { props: { websiteId: 'w1' }, global: { plugins: [pinia, router] } })
    mounted.push(sidebar)
    const [agentLink, analytics] = sidebar.findAll('a')
    expect(agentLink.text()).toBe('Agent')
    expect(analytics.text()).toBe('Analytics')
    expect(analytics.attributes('href')).toBe('/projects/w1/traffic')

    // Another project has its own memory: none yet, so the Overview.
    const other = mount(ProductSwitch, { props: { websiteId: 'w2' }, global: { plugins: [pinia, router] } })
    mounted.push(other)
    expect(other.findAll('a')[1].attributes('href')).toBe('/dashboard')
  })

  it('keeps the section when the project changes, dropping project-only filters', async () => {
    const { wrapper, router } = await setup('/projects/w1/countries?prompt=p1&engine=google&check=1')
    await wrapper.find('button[aria-label="Project menu"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await nextTick()
    const acme = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.includes('Acme'))
    acme.click()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/projects/w2/countries?engine=google')
    expect(useAppStore().activeWebsite.id).toBe('w2')
  })

  it('sends a prompt page and a source detail to their section on a project switch', async () => {
    const choose = async (wrapper, name) => {
      await wrapper.find('button[aria-label="Project menu"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      ;[...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.includes(name)).click()
      await flushPromises()
    }
    const { wrapper, router } = await setup('/projects/w1/prompts/p1')
    await choose(wrapper, 'Acme')
    expect(router.currentRoute.value.name).toBe('dashboard')

    await router.push('/projects/w2/sources/detail?url=x')
    await flushPromises()
    await choose(wrapper, 'Wrenfield')
    expect(router.currentRoute.value.fullPath).toBe('/projects/w1/sources')
  })

  it('lists the sections under Analytics in the mobile sheet', async () => {
    const { wrapper } = await setup('/projects/w1/visibility')
    await wrapper.find('.shell-burger').trigger('click')
    const sheet = wrapper.find('#shell-sheet')
    expect(sheet.findAll('a').map((a) => a.text())).toEqual([
      'Analytics',
      'Overview',
      'Visibility',
      'Countries',
      'Traffic',
      'AI traffic',
      'Sources',
      'Agent',
      'Settings',
    ])
    expect(sheet.findAll('.is-sub')).toHaveLength(6)
    expect(sheet.find('[aria-current="page"]').text()).toBe('Visibility')
  })
})
