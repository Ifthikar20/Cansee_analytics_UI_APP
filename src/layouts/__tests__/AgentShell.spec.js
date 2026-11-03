import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { ANALYTICS_SECTIONS, sectionLabel } from '@/lib/analyticsNav'

const fakeAgent = reactive({})
const fakePane = reactive({ toggleOpen: vi.fn() })
const bootstrap = vi.fn()

vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))
vi.mock('@/stores/agentPane', () => ({ useAgentPaneStore: () => fakePane }))
vi.mock('@/composables/useShellBootstrap', () => ({ useShellBootstrap: () => bootstrap() }))

const { default: AgentShell } = await import('../AgentShell.vue')

const Page = defineComponent({ render: () => h('div', { class: 'test-page' }, 'page') })
// A page tall enough to scroll, and one that counts its mounts.
let pageMounts = 0
const CountedPage = defineComponent({
  setup() {
    pageMounts += 1
    return () => h('div', { class: 'test-page', id: 'anchor-target' }, 'counted')
  },
})
const mounted = []
let wide = true
const realMatchMedia = window.matchMedia

const at = (key) => ({ analytics: key, title: sectionLabel(key) })

// Every analytics route name the sidebar links to, as in analyticsRoutes.js.
const projectChildren = [
  { path: 'prompts/:promptId', name: 'prompt', component: Page, meta: at('overview') },
  { path: 'sources/detail', name: 'sources-url-detail', component: Page, meta: at('sources') },
  ...ANALYTICS_SECTIONS.filter((s) => s.key !== 'overview').map((s) => ({
    path: s.route === 'site-pages' ? 'pages' : s.route === 'sources-urls' ? 'sources' : s.route,
    name: s.route,
    component: s.key === 'crawler-access' ? CountedPage : Page,
    meta: at(s.key),
  })),
]

async function setup(path = '/projects/w1/agent') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAppStore().setWebsites([
    { id: 'w1', name: 'Wrenfield' },
    { id: 'w2', name: 'Acme' },
  ])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/docs', name: 'docs', component: Page },
      { path: '/support', name: 'support', component: Page },
      { path: '/agent', name: 'agent', component: Page },
      {
        path: '/dashboard',
        component: AgentShell,
        children: [{ path: '', name: 'dashboard', component: Page, meta: at('overview') }],
      },
      { path: '/projects/:websiteId', component: AgentShell, children: projectChildren },
      {
        path: '/settings',
        component: AgentShell,
        children: [
          { path: '', name: 'settings', component: Page, meta: { settings: true, title: 'Settings' } },
          {
            path: 'usage-dashboard',
            name: 'settings-command-center',
            component: Page,
            meta: { settings: true, title: 'Usage dashboard' },
          },
        ],
      },
      {
        path: '/agent/projects',
        component: AgentShell,
        children: [{ path: '', name: 'agent-projects', component: Page }],
      },
      {
        path: '/projects/:websiteId/agent',
        component: AgentShell,
        children: [
          { path: '', name: 'agent-home', component: Page },
          { path: 'c/:chatId', name: 'agent-chat', component: Page },
          { path: 'context', name: 'agent-context', component: Page },
          { path: 'agents', name: 'agent-agents', component: Page },
          { path: 'findings', name: 'agent-findings', component: Page },
          { path: 'reviews', name: 'agent-reviews', component: Page },
          { path: 'reports', name: 'agent-reports', component: Page },
          { path: 'documents', name: 'agent-documents', component: Page },
          { path: 'sheets', name: 'agent-sheets', component: Page },
          { path: 'artifacts/:artifactId', name: 'agent-artifact', component: Page },
        ],
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router, ui: useAgentUiStore() }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  wide = true
  pageMounts = 0
  bootstrap.mockClear()
  window.matchMedia = (query) => ({
    matches: query === '(min-width: 1024px)' ? wide : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
  Object.assign(fakeAgent, {
    websiteId: null,
    chats: { loading: false, loaded: true, hasMore: false, search: '', error: null },
    recents: [],
    runs: {},
    messages: {},
    activity: [],
    catalog: [],
    init: vi.fn((wid) => {
      fakeAgent.websiteId = wid
      return Promise.resolve()
    }),
    loadChats: vi.fn(async () => {}),
    loadActivity: vi.fn(async () => []),
    isChatBusy: () => false,
  })
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  window.matchMedia = realMatchMedia
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
})

describe('AgentShell', () => {
  it('lays out the docked sidebar and the routed page, and scopes the store', async () => {
    const { wrapper } = await setup()
    const root = wrapper.find('.ag-root')
    expect(root.classes()).toContain('is-docked')
    expect(wrapper.find('nav[aria-label="Workspace"]').exists()).toBe(true)
    expect(wrapper.find('main#ag-main .test-page').exists()).toBe(true)
    expect(bootstrap).toHaveBeenCalledTimes(1)
    expect(fakeAgent.init).toHaveBeenCalledWith('w1')
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
    expect(wrapper.find('[aria-live="assertive"]').exists()).toBe(true)
    expect(wrapper.find('.ag-ws-name').text()).toBe('Wrenfield')
  })

  it('locks the document scroll while mounted', async () => {
    const { wrapper } = await setup()
    expect(document.body.style.overflow).toBe('hidden')
    mounted.splice(mounted.indexOf(wrapper), 1)
    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('re-scopes the store when the URL moves to another project', async () => {
    const { router } = await setup()
    await router.push('/projects/w2/agent/reports')
    await flushPromises()
    expect(fakeAgent.init).toHaveBeenLastCalledWith('w2')
  })

  it('uses the active project on the projects page', async () => {
    await setup('/agent/projects')
    expect(fakeAgent.init).toHaveBeenCalledWith('w1')
  })

  it('collapses the docked sidebar out of the tab order', async () => {
    const { wrapper, ui } = await setup()
    ui.toggleSidebar()
    await nextTick()
    const rail = wrapper.find('.ag-shell-rail')
    expect(wrapper.find('.ag-root').classes()).toContain('is-collapsed')
    // Browsers take the inert property; jsdom has no such property, so Vue writes the attribute.
    expect(rail.element.inert === true || rail.element.hasAttribute('inert')).toBe(true)
    expect(rail.attributes('aria-hidden')).toBe('true')
    ui.toggleSidebar()
    await nextTick()
    expect(rail.element.inert === true || rail.element.hasAttribute('inert')).toBe(false)
  })

  it('puts the sidebar in a drawer below 1024px and closes it on navigation', async () => {
    wide = false
    const { wrapper, ui, router } = await setup()
    expect(wrapper.find('.ag-root').classes()).not.toContain('is-docked')
    expect(wrapper.find('.ag-shell-rail').exists()).toBe(false)
    expect(ui.docked).toBe(false)
    ui.openDrawer()
    await flushPromises()
    const drawer = document.body.querySelector('.ag-portal.ag-drawer')
    expect(drawer).not.toBeNull()
    expect(drawer.querySelector('nav[aria-label="Workspace"]')).not.toBeNull()
    await router.push('/projects/w1/agent/context')
    await flushPromises()
    expect(ui.drawerOpen).toBe(false)
  })

  it('opens the shortcuts dialog from the store', async () => {
    const { ui } = await setup()
    ui.openShortcuts()
    await flushPromises()
    const dialog = document.body.querySelector('.ag-portal.ag-dialog')
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('Keyboard shortcuts')
    expect(dialog.textContent).toContain('New chat')
  })
})

describe('AgentShell page area', () => {
  it('renders analytics and settings pages in the page area, agent pages as they are', async () => {
    const { wrapper, router } = await setup('/projects/w1/pages')
    const main = wrapper.find('main#ag-main')
    expect(main.classes()).toContain('is-page')
    expect(main.find('.ws-page .ws-page-body .test-page').exists()).toBe(true)

    await router.push('/settings')
    await flushPromises()
    expect(wrapper.find('main#ag-main').classes()).toContain('is-page')
    expect(wrapper.find('.ws-page-body .test-page').exists()).toBe(true)

    await router.push('/projects/w1/agent')
    await flushPromises()
    expect(wrapper.find('main#ag-main').classes()).not.toContain('is-page')
    expect(wrapper.find('.ws-page').exists()).toBe(false)
    expect(wrapper.find('main#ag-main > .test-page').exists()).toBe(true)
    // One shell across both sides.
    expect(bootstrap).toHaveBeenCalledTimes(1)
  })

  it('shows the page bar only while the sidebar is out of view, and it brings the sidebar back', async () => {
    const { wrapper, ui, router } = await setup('/projects/w1/pages')
    expect(wrapper.find('.ws-bar').exists()).toBe(false)

    ui.setSidebarCollapsed(true)
    await nextTick()
    const bar = wrapper.find('.ws-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('Analytics · Pages')
    await bar.find('button[aria-label="Open sidebar"]').trigger('click')
    expect(ui.sidebarCollapsed).toBe(false)

    await router.push('/settings')
    ui.setDocked(false)
    await flushPromises()
    expect(wrapper.find('.ws-bar').text()).toContain('Settings')
    await wrapper.find('.ws-bar button[aria-label="Open sidebar"]').trigger('click')
    expect(ui.drawerOpen).toBe(true)
  })

  it('remembers the tab per project and the side, and titles the browser tab', async () => {
    const { router } = await setup('/projects/w1/pages')
    expect(JSON.parse(sessionStorage.getItem('cs-analytics-last'))).toEqual({ w1: 'pages' })
    expect(sessionStorage.getItem('cs-sidebar-side')).toBe('analytics')
    expect(document.title).toBe('Pages — Wrenfield — Cansee')

    await router.push('/projects/w2/crawler-access')
    await flushPromises()
    expect(JSON.parse(sessionStorage.getItem('cs-analytics-last'))).toEqual({ w1: 'pages', w2: 'crawler-access' })
    expect(document.title).toBe('Crawler access — Acme — Cansee')

    await router.push('/projects/w2/agent/context')
    await flushPromises()
    expect(sessionStorage.getItem('cs-sidebar-side')).toBe('agent')

    // Settings remember nothing.
    await router.push('/settings')
    await flushPromises()
    expect(sessionStorage.getItem('cs-sidebar-side')).toBe('agent')
    expect(document.title).toBe('Settings — Cansee')
  })

  it('starts a new page at the top and keeps the place for a filter change', async () => {
    const { wrapper, router } = await setup('/projects/w1/pages')
    const main = wrapper.find('main#ag-main').element
    main.scrollTop = 240
    await router.push({ path: '/projects/w1/pages', query: { filter: 'cited' } })
    await flushPromises()
    expect(main.scrollTop).toBe(240)

    await router.push('/projects/w1/visibility')
    await flushPromises()
    expect(main.scrollTop).toBe(0)
  })

  it('scrolls a hash target into view inside the page area', async () => {
    const { router } = await setup('/projects/w1/pages')
    const original = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    try {
      await router.push('/projects/w1/crawler-access#anchor-target')
      await flushPromises()
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect(scrollIntoView.mock.contexts[0].id).toBe('anchor-target')
    } finally {
      HTMLElement.prototype.scrollIntoView = original
    }
  })

  it('mounts a page again when the project changes', async () => {
    const { router } = await setup('/projects/w1/crawler-access')
    expect(pageMounts).toBe(1)
    await router.push('/projects/w2/crawler-access')
    await flushPromises()
    expect(pageMounts).toBe(2)
  })
})
