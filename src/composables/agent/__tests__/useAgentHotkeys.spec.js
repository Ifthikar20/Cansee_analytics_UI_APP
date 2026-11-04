import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'

const fakeAgent = reactive({ busy: {}, stop: vi.fn(), isChatBusy: (id) => Boolean(fakeAgent.busy[id]) })
const fakePane = reactive({ open: false, toggleOpen: vi.fn(() => (fakePane.open = !fakePane.open)) })

vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))
vi.mock('@/stores/agentPane', () => ({ useAgentPaneStore: () => fakePane }))

const { matchShortcut, useAgentHotkeys } = await import('../useAgentHotkeys')

const Blank = defineComponent({ render: () => h('div') })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'root', component: Blank },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: Blank },
      { path: '/projects/:websiteId/agent/context', name: 'agent-context', component: Blank },
      { path: '/projects/:websiteId/analytics', name: 'analytics', component: Blank, meta: { board: true } },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true } },
    ],
  })
}

async function setup(path) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const Host = defineComponent({
    setup() {
      useAgentHotkeys()
      return () => h('div')
    },
  })
  const wrapper = mount(Host, { global: { plugins: [pinia, router] }, attachTo: document.body })
  const ui = useAgentUiStore()
  ui.setDocked(true)
  return { wrapper, router, ui, app: useAppStore() }
}

function press(init, target = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const ctrl = (key, extra = {}) => ({ key, ctrlKey: true, ...extra })

let wrapper

beforeEach(() => {
  localStorage.clear()
  fakeAgent.busy = {}
  fakeAgent.stop.mockClear()
  fakePane.open = false
  fakePane.toggleOpen.mockClear()
  Object.defineProperty(window.navigator, 'platform', { value: 'Win32', configurable: true })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('matchShortcut', () => {
  it('maps the documented keys', () => {
    expect(matchShortcut({ key: 'O', code: 'KeyO', ctrlKey: true, shiftKey: true }, false)).toBe('new-chat')
    expect(matchShortcut({ key: 'k', code: 'KeyK', ctrlKey: true }, false)).toBe('search')
    expect(matchShortcut({ key: 'b', code: 'KeyB', ctrlKey: true }, false)).toBe('sidebar')
    expect(matchShortcut({ key: '\\', code: 'Backslash', ctrlKey: true }, false)).toBe('pane')
    expect(matchShortcut({ key: '/', code: 'Slash', ctrlKey: true }, false)).toBe('shortcuts')
    expect(matchShortcut({ key: 'Escape' }, false)).toBe('escape')
  })

  it('uses Cmd on a Mac and ignores IME composition', () => {
    expect(matchShortcut({ key: 'k', metaKey: true }, true)).toBe('search')
    expect(matchShortcut({ key: 'k', ctrlKey: true }, true)).toBeNull()
    expect(matchShortcut({ key: 'k', ctrlKey: true, isComposing: true }, false)).toBeNull()
    expect(matchShortcut({ key: 'k', ctrlKey: true, keyCode: 229 }, false)).toBeNull()
    expect(matchShortcut({ key: 'k' }, false)).toBeNull()
    expect(matchShortcut({ key: 'b', ctrlKey: true, shiftKey: true }, false)).toBeNull()
  })
})

describe('useAgentHotkeys', () => {
  it('toggles the sidebar, the shortcuts dialog and opens chat search', async () => {
    const ctx = await setup('/projects/w1/agent')
    wrapper = ctx.wrapper
    expect(press(ctrl('b', { code: 'KeyB' })).defaultPrevented).toBe(true)
    expect(ctx.ui.sidebarCollapsed).toBe(true)
    press(ctrl('/', { code: 'Slash' }))
    expect(ctx.ui.shortcutsOpen).toBe(true)
    press(ctrl('k', { code: 'KeyK' }))
    expect(ctx.ui.filterOpen).toBe(true)
    expect(ctx.ui.sidebarCollapsed).toBe(false)
  })

  it('opens chat search in place on the board and in Settings, whose sidebar shows Recents too', async () => {
    const ctx = await setup('/projects/w1/analytics?widget=countries')
    wrapper = ctx.wrapper
    expect(press(ctrl('k', { code: 'KeyK' })).defaultPrevented).toBe(true)
    expect(ctx.ui.filterOpen).toBe(true)
    await Promise.resolve()
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w1/analytics?widget=countries')

    ctx.ui.setFilterOpen(false)
    await ctx.router.push('/settings')
    press(ctrl('k', { code: 'KeyK' }))
    expect(ctx.ui.filterOpen).toBe(true)
    expect(ctx.router.currentRoute.value.name).toBe('settings')
  })

  it('toggles the sidebar and opens the shortcuts on the board too', async () => {
    const ctx = await setup('/projects/w1/analytics')
    wrapper = ctx.wrapper
    press(ctrl('b', { code: 'KeyB' }))
    expect(ctx.ui.sidebarCollapsed).toBe(true)
    press(ctrl('/', { code: 'Slash' }))
    expect(ctx.ui.shortcutsOpen).toBe(true)
    // The browser pane exists only beside a chat.
    expect(press(ctrl('\\', { code: 'Backslash' })).defaultPrevented).toBe(false)
  })

  it('toggles the pane only on chat routes', async () => {
    const ctx = await setup('/projects/w1/agent/context')
    wrapper = ctx.wrapper
    const ignored = press(ctrl('\\', { code: 'Backslash' }))
    expect(ignored.defaultPrevented).toBe(false)
    expect(fakePane.toggleOpen).not.toHaveBeenCalled()
    await ctx.router.push('/projects/w1/agent/c/c9')
    expect(press(ctrl('\\', { code: 'Backslash' })).defaultPrevented).toBe(true)
    expect(fakePane.toggleOpen).toHaveBeenCalledTimes(1)
  })

  it('starts a new chat in the current project', async () => {
    const ctx = await setup('/projects/w1/agent/c/c9')
    wrapper = ctx.wrapper
    press(ctrl('O', { code: 'KeyO', shiftKey: true }))
    await vi.waitFor(() => expect(ctx.router.currentRoute.value.name).toBe('agent-home'))
    expect(ctx.router.currentRoute.value.params.websiteId).toBe('w1')
  })

  it('stops the busy chat on Escape and leaves idle chats alone', async () => {
    const ctx = await setup('/projects/w1/agent/c/c9')
    wrapper = ctx.wrapper
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(false)
    expect(fakeAgent.stop).not.toHaveBeenCalled()
    fakeAgent.busy = { c9: true }
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(true)
    expect(fakeAgent.stop).toHaveBeenCalledWith('c9')
    expect(ctx.ui.politeAnnouncement.text).toBe('Stopping the agent')
  })

  it('stops a first message still being sent from the new-chat view', async () => {
    const ctx = await setup('/projects/w1/agent')
    wrapper = ctx.wrapper
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(false)
    fakeAgent.busy = { new: true }
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(true)
    expect(fakeAgent.stop).toHaveBeenCalledWith('new')
  })

  it('leaves Escape to an open menu or dialog, and to handlers that took it', async () => {
    const ctx = await setup('/projects/w1/agent/c/c9')
    wrapper = ctx.wrapper
    fakeAgent.busy = { c9: true }
    const layer = document.createElement('div')
    layer.setAttribute('data-dismissable-layer', '')
    document.body.appendChild(layer)
    press({ key: 'Escape' })
    expect(fakeAgent.stop).not.toHaveBeenCalled()
    layer.remove()

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.addEventListener('keydown', (e) => e.preventDefault())
    press({ key: 'Escape' }, input)
    expect(fakeAgent.stop).not.toHaveBeenCalled()
  })

  it('closes the drawer on Escape when narrow', async () => {
    const ctx = await setup('/projects/w1/agent')
    wrapper = ctx.wrapper
    ctx.ui.setDocked(false)
    ctx.ui.openDrawer()
    press({ key: 'Escape' })
    expect(ctx.ui.drawerOpen).toBe(false)
  })

  it('stops listening on unmount', async () => {
    const ctx = await setup('/projects/w1/agent')
    ctx.wrapper.unmount()
    press(ctrl('b', { code: 'KeyB' }))
    expect(ctx.ui.sidebarCollapsed).toBe(false)
  })
})
