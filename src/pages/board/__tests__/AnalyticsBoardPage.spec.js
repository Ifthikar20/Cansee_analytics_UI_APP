import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }))
vi.mock('@/api/board', () => ({ default: api }))
const sources = vi.hoisted(() => ({ invalidate: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/composables/board/useBoardSource', () => sources)
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const loaded = vi.hoisted(() => [])
vi.mock('@/components/board/widgetComponents', async () => {
  const vue = await import('vue')
  const Card = vue.defineComponent({
    props: { websiteId: String, size: String },
    setup: (props) => () => vue.h('p', { class: 'stub-card' }, props.websiteId),
  })
  const View = vue.defineComponent({
    props: { websiteId: String },
    setup: (props) => () => vue.h('div', { class: 'stub-view' }, props.websiteId),
  })
  const entry = (key) => ({
    card: () => {
      loaded.push(key)
      return Promise.resolve({ __esModule: true, default: Card })
    },
    panel: () => Promise.resolve({ __esModule: true, default: View }),
  })
  const { WIDGETS } = await import('@/lib/board/widgets')
  return { WIDGET_COMPONENTS: Object.fromEntries(WIDGETS.map((w) => [w.key, entry(w.key)])) }
})

const { useAppStore } = await import('@/stores/app')
const { useAuthStore } = await import('@/stores/auth')
const { useBoardStore } = await import('@/stores/board')
const { default: AnalyticsBoardPage } = await import('../AnalyticsBoardPage.vue')

// The default board (autopilot_contract.md 6): Ask AI, then Prompt ranking.
const DEFAULT = [
  { key: 'prompt-box', size: 'full' },
  { key: 'ranking', size: 'full' },
]
const DEFAULT_KEYS = DEFAULT.map((w) => w.key)
const payload = (widgets = DEFAULT, version = 0) => ({ data: { saved: version > 0, version, updated_at: null, widgets } })

const mounted = []
// Cleared after each test, so its debounced saves never land in the next one's mocks.
const stores = []

async function setup(path = '/projects/w1/analytics') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { id: 7 }
  useAppStore().setWebsites([
    { id: 'w1', name: 'Wrenfield' },
    { id: 'w2', name: 'Acme' },
  ])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:websiteId/analytics', name: 'analytics', component: AnalyticsBoardPage, props: true, meta: { board: true } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  stores.push(useBoardStore())
  await flushPromises()
  return { wrapper, router, store: useBoardStore() }
}

async function settle() {
  await flushPromises()
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
  await flushPromises()
}

const cells = (wrapper) => wrapper.findAll('.bd-cell').map((c) => c.attributes('data-widget'))
const addButton = (wrapper) => wrapper.find('button[data-bd-add]')
const saveStates = (wrapper) => wrapper.findAll('.bd-save').map((s) => s.text())

beforeEach(() => {
  localStorage.clear()
  loaded.length = 0
  Object.values(api).forEach((fn) => fn.mockReset())
  Object.values(sources).forEach((fn) => fn.mockReset())
  Object.values(toast).forEach((fn) => fn.mockReset())
  api.save.mockImplementation((wid, body) => Promise.resolve(payload(body.widgets, body.version + 1)))
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  while (stores.length) stores.pop().clear()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('AnalyticsBoardPage', () => {
  it('shows skeleton cards of the default board, and asks for no data, until the layout is known', async () => {
    let answer
    api.get.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const { wrapper } = await setup()
    const header = wrapper.find('header.ag-page-header')
    expect(header.find('h1#bd-title').text()).toBe('Analytics')
    expect(wrapper.find('section.bd-main').attributes('aria-labelledby')).toBe('bd-title')
    expect(cells(wrapper)).toEqual(['prompt-box', 'ranking'])
    expect(wrapper.findAll('.bd-skel')).toHaveLength(2)
    expect(loaded).toEqual([])
    expect(addButton(wrapper).attributes('disabled')).toBeDefined()

    answer(payload([{ key: 'traffic', size: 'third' }, { key: 'sentiment', size: 'third' }], 2))
    await flushPromises()
    expect(cells(wrapper)).toEqual(['traffic', 'sentiment'])
    // Each card's code loads once the layout is known (in whatever order Vue mounts them).
    expect([...loaded].sort()).toEqual(['sentiment', 'traffic'])
    expect(addButton(wrapper).attributes('disabled')).toBeUndefined()
    expect(addButton(wrapper).attributes('aria-label')).toBe('Add widget')
    expect(addButton(wrapper).text()).toBe('Add widget')
  })

  it('opens a panel from ?widget and saves nothing, even for a widget off the board', async () => {
    api.get.mockResolvedValue(payload())
    const { wrapper, store } = await setup('/projects/w1/analytics?widget=products')
    await settle()
    expect(wrapper.find('aside.bd-panel h2').text()).toBe('Products')
    expect(store.has('w1', 'products')).toBe(false)
    expect(cells(wrapper)).toEqual(DEFAULT_KEYS)
    await new Promise((r) => setTimeout(r, 500))
    expect(api.save).not.toHaveBeenCalled()
  })

  it('says when the board is empty and offers Add widget', async () => {
    api.get.mockResolvedValue(payload([], 4))
    const { wrapper } = await setup()
    const empty = wrapper.find('.ag-empty')
    expect(empty.text()).toContain('Your board is empty.')
    expect(empty.text()).toContain('Add a widget to start.')
    await empty.find('button').trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('.ag-portal.ag-dialog')
    expect(dialog.querySelector('.ag-dialog-title').textContent).toBe('Add a widget')
  })

  it('adds from the catalog, then scrolls to and focuses the card added last', async () => {
    api.get.mockResolvedValue(payload())
    const { wrapper } = await setup()
    await addButton(wrapper).trigger('click')
    await flushPromises()
    const row = [...document.body.querySelectorAll('li.bd-cat-row')].find((r) => r.textContent.includes('AI crawlers'))
    row.querySelector('button').click()
    await flushPromises()
    document.body.querySelector('.ag-dialog .ag-dlg-close').click()
    await settle()
    expect(cells(wrapper).at(-1)).toBe('ai-crawlers')
    expect(document.activeElement).toBe(wrapper.find('.bd-cell[data-widget="ai-crawlers"] button.bd-card-open').element)
  })

  it('asks before resetting, then shows the default with the answered version', async () => {
    api.get.mockResolvedValue(payload([{ key: 'pages', size: 'full' }], 3))
    api.reset.mockResolvedValue({ data: { saved: true, version: 4, updated_at: '2026-11-04T10:12:00Z', widgets: DEFAULT } })
    const { wrapper, store } = await setup()
    await wrapper.find('button[aria-label="Board options"]').trigger('click')
    await flushPromises()
    const reset = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.includes('Reset board'))
    reset.click()
    await settle()
    const dialog = document.body.querySelector('[role="alertdialog"]')
    expect(dialog.textContent).toContain('Reset this board?')
    expect(dialog.textContent).toContain(
      'Your board goes back to Ask AI and Prompt ranking. Widgets you added are removed; their data is not touched.',
    )
    expect(api.reset).not.toHaveBeenCalled()
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Reset board').click()
    await settle()
    expect(api.reset).toHaveBeenCalledWith('w1')
    expect(cells(wrapper)).toEqual(DEFAULT_KEYS)
    expect(store.layoutOf('w1').version).toBe(4)
    // The dialog gives focus back to the menu button it came from.
    expect(document.activeElement).toBe(wrapper.find('button[aria-label="Board options"]').element)
  })

  it('titles the browser tab with the project, and the open panel first', async () => {
    api.get.mockResolvedValue(payload())
    const { router } = await setup()
    expect(document.title).toBe('Analytics — Wrenfield — Cansee')
    await router.push('/projects/w1/analytics?widget=countries')
    await settle()
    expect(document.title).toBe('Countries — Analytics — Wrenfield — Cansee')
    await router.replace('/projects/w1/analytics?widget=prompts&prompt=p9')
    await settle()
    expect(document.title).toBe('Prompt — Analytics — Wrenfield — Cansee')
  })

  it("loads the other project's board on a project change, from the top", async () => {
    api.get.mockImplementation((wid) =>
      Promise.resolve(wid === 'w2' ? payload([{ key: 'products', size: 'half' }], 1) : payload()),
    )
    const { wrapper, router } = await setup()
    const scroller = wrapper.find('.bd-scroll').element
    scroller.scrollTop = 400
    await router.push('/projects/w2/analytics')
    await settle()
    expect(api.get).toHaveBeenLastCalledWith('w2')
    expect(cells(wrapper)).toEqual(['products'])
    expect(scroller.scrollTop).toBe(0)
    expect(document.title).toBe('Analytics — Acme — Cansee')
  })

  it('says Saving... only after 600ms, and offers Try again when a save fails', async () => {
    api.get.mockResolvedValue(payload())
    const { wrapper, store } = await setup()
    vi.useFakeTimers()
    let answer
    api.save.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    store.add('w1', 'pages')
    await vi.advanceTimersByTimeAsync(400)
    expect(store.layoutOf('w1').save).toBe('saving')
    await vi.advanceTimersByTimeAsync(599)
    expect(saveStates(wrapper).join('')).toBe('')
    await vi.advanceTimersByTimeAsync(1)
    expect(saveStates(wrapper)[0]).toBe('Saving...')
    answer(payload([...DEFAULT, { key: 'pages', size: 'half' }], 1))
    await vi.advanceTimersByTimeAsync(0)
    expect(saveStates(wrapper).join('')).toBe('')

    api.save.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('500'), { response: { status: 500, data: { error: { code: 'error' } } } })),
    )
    store.remove('w1', 'pages')
    await vi.advanceTimersByTimeAsync(400)
    expect(saveStates(wrapper)[0]).toContain("Couldn't save your board.")
    // Still on fake time: Vue drops a click stamped before its handler was attached.
    const retry = wrapper.find('.bd-save-head').findAll('button').find((b) => b.text() === 'Try again')
    await retry.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(api.save).toHaveBeenCalledTimes(3)
    expect(saveStates(wrapper).join('')).toBe('')
  })

  it('says when the saved board could not be loaded, and Try again asks again', async () => {
    api.get.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('500'), { response: { status: 500 } })))
    const { wrapper } = await setup()
    expect(cells(wrapper)).toEqual(DEFAULT_KEYS)
    expect(wrapper.findAll('.bd-skel')).toHaveLength(0)
    const state = wrapper.find('.bd-save-head')
    expect(state.text()).toContain("We couldn't load your saved board. Showing the default.")
    expect(state.attributes('role')).toBe('status')
    api.get.mockResolvedValueOnce(payload([{ key: 'pages', size: 'half' }], 2))
    await state.findAll('button').find((b) => b.text() === 'Try again').trigger('click')
    await flushPromises()
    expect(cells(wrapper)).toEqual(['pages'])
    expect(wrapper.find('.bd-save-head').text()).toBe('')
  })
})
