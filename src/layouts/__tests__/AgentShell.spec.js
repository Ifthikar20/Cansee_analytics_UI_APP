import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'

const fakeAgent = reactive({})
const fakePane = reactive({ toggleOpen: vi.fn() })
const bootstrap = vi.fn()

vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))
vi.mock('@/stores/agentPane', () => ({ useAgentPaneStore: () => fakePane }))
vi.mock('@/composables/useShellBootstrap', () => ({ useShellBootstrap: () => bootstrap() }))

const { default: AgentShell } = await import('../AgentShell.vue')

const Page = defineComponent({ render: () => h('div', { class: 'test-page' }, 'page') })
const mounted = []
let wide = true
const realMatchMedia = window.matchMedia

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
      { path: '/dashboard', name: 'dashboard', component: Page },
      { path: '/docs', name: 'docs', component: Page },
      { path: '/support', name: 'support', component: Page },
      { path: '/agent', name: 'agent', component: Page },
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
  wide = true
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
