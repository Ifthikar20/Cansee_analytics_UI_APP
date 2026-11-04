import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { RouterView, createRouter, createWebHistory } from 'vue-router'

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }))
vi.mock('@/api/board', () => ({ default: api }))
const sources = vi.hoisted(() => ({ invalidate: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/composables/board/useBoardSource', () => sources)

// Cards and expanded views are stand-ins; a view says what it was given and
// whether it knows it renders in the panel. Products has no view.
vi.mock('@/components/board/widgetComponents', async () => {
  const vue = await import('vue')
  const { IN_PANEL, useBoard } = await import('@/lib/board/context')
  const module = (component) => () => Promise.resolve({ __esModule: true, default: component })
  const Card = vue.defineComponent({
    props: { websiteId: String, size: String },
    setup: (props) => () => vue.h('p', { class: 'stub-card' }, props.websiteId),
  })
  const View = vue.defineComponent({
    props: { websiteId: String, focus: { type: String, default: '' } },
    setup(props) {
      const inPanel = vue.inject(IN_PANEL, false)
      const board = useBoard()
      return () =>
        vue.h('div', { class: 'stub-view', style: 'height: 2000px' }, [
          vue.h('span', { class: 'stub-view-props' }, `${props.websiteId}|${props.focus}|${inPanel}`),
          vue.h('button', { type: 'button', class: 'stub-view-button' }, 'Inside'),
          // A view opening a record of its own (a prompt's detail, say).
          vue.h('button', { type: 'button', class: 'stub-view-open', onClick: () => board.open('traffic', { period: '7d' }) }, 'Record'),
        ])
    },
  })
  const entry = (extra = {}) => ({ card: module(Card), panel: module(View), ...extra })
  return {
    WIDGET_COMPONENTS: {
      summary: entry(),
      prompts: entry(),
      countries: entry(),
      traffic: entry(),
      'ai-crawlers': entry({ panelProps: { focus: 'crawlers' } }),
      'ai-traffic': entry({ panelProps: { focus: 'visits' } }),
    },
  }
})

const { useAppStore } = await import('@/stores/app')
const { useAgentUiStore } = await import('@/stores/agentUi')
const { useBoardStore } = await import('@/stores/board')
const { default: AnalyticsBoardPage } = await import('@/pages/board/AnalyticsBoardPage.vue')

const DEFAULT = [
  { key: 'summary', size: 'full' },
  { key: 'prompts', size: 'full' },
  { key: 'countries', size: 'half' },
  { key: 'traffic', size: 'half' },
]

const mounted = []
// Cleared after each test, so its debounced saves never land in the next one's mocks.
const stores = []
let observers = []
const RealResizeObserver = window.ResizeObserver
const realMatchMedia = window.matchMedia
let phone = false

async function setup(path, { width = 1400 } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAppStore().setWebsites([{ id: 'w1', name: 'Wrenfield' }])
  api.get.mockResolvedValue({ data: { saved: false, version: 0, updated_at: null, widgets: DEFAULT } })
  api.save.mockImplementation((wid, body) => Promise.resolve({ data: { saved: true, version: body.version + 1, widgets: body.widgets } }))
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/projects/:websiteId/analytics', name: 'analytics', component: AnalyticsBoardPage, props: true, meta: { board: true } },
      { path: '/elsewhere', name: 'elsewhere', component: { render: () => null } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  resize(width)
  await flushPromises()
  stores.push(useBoardStore())
  return { wrapper, router, store: useBoardStore(), ui: useAgentUiStore() }
}

function resize(width) {
  for (const o of observers) o.callback([{ contentRect: { width } }])
}

async function settle() {
  await flushPromises()
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
  await flushPromises()
}

const panel = (wrapper) => wrapper.find('aside.bd-panel')
const query = (router) => router.currentRoute.value.query
const main = (wrapper) => wrapper.find('section.bd-main').element
const inert = (el) => el.inert === true || el.hasAttribute('inert')

beforeEach(() => {
  localStorage.clear()
  observers = []
  phone = false
  Object.values(api).forEach((fn) => fn.mockReset())
  Object.values(sources).forEach((fn) => fn.mockReset())
  window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback
      observers.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = (q) => ({
    matches: q === '(max-width: 767px)' ? phone : false,
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  while (stores.length) stores.pop().clear()
  window.ResizeObserver = RealResizeObserver
  window.matchMedia = realMatchMedia
  document.body.innerHTML = ''
})

describe('BoardPanel', () => {
  it('opens the panel of ?widget with its view, its props and the panel flag', async () => {
    const { wrapper, ui } = await setup('/projects/w1/analytics?widget=ai-crawlers&period=7d')
    const aside = panel(wrapper)
    expect(aside.exists()).toBe(true)
    const title = aside.find('h2#bd-panel-title')
    expect(aside.attributes('aria-labelledby')).toBe('bd-panel-title')
    expect(title.text()).toBe('AI crawlers')
    expect(title.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(title.element)
    expect(aside.find('.stub-view-props').text()).toBe('w1|crawlers|true')
    expect(aside.find('button[aria-label="Close AI crawlers"]').exists()).toBe(true)
    expect(ui.politeAnnouncement.text).toBe('Opened AI crawlers.')
    // Inside the board, never teleported, and never a modal dialog.
    expect(wrapper.find('.bd').element.contains(aside.element)).toBe(true)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('docks beside a wide board, and Widen lets it cover the board', async () => {
    const { wrapper } = await setup('/projects/w1/analytics?widget=countries', { width: 1400 })
    const root = wrapper.find('.bd')
    expect(root.classes()).toContain('has-docked')
    expect(panel(wrapper).classes()).toContain('is-docked')
    expect(wrapper.find('.bd-scrim').exists()).toBe(false)
    expect(inert(main(wrapper))).toBe(false)

    const widen = panel(wrapper).find('button[aria-label="Widen"]')
    expect(widen.attributes('aria-pressed')).toBe('false')
    await widen.trigger('click')
    await flushPromises()
    const narrow = panel(wrapper).find('button[aria-label="Narrow"]')
    expect(narrow.attributes('aria-pressed')).toBe('true')
    expect(root.classes()).toContain('is-wide')
    expect(inert(main(wrapper))).toBe(true)
    expect(localStorage.getItem('cs-board-panel-wide')).toBe('1')
    await narrow.trigger('click')
    await flushPromises()
    expect(root.classes()).not.toContain('is-wide')
    expect(localStorage.getItem('cs-board-panel-wide')).toBe('0')
  })

  it('lies over a board under 1100px on a scrim, with the board inert, and fills a phone', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics?widget=countries', { width: 1099 })
    expect(wrapper.find('.bd').classes()).not.toContain('has-docked')
    expect(panel(wrapper).classes()).toContain('is-sheet')
    expect(panel(wrapper).find('button[aria-label="Widen"]').exists()).toBe(false)
    expect(inert(main(wrapper))).toBe(true)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.find('.bd-scrim').trigger('click')
    await settle()
    expect(query(router).widget).toBeUndefined()
    expect(inert(main(wrapper))).toBe(false)

    mounted.pop().unmount()
    phone = true
    const small = await setup('/projects/w1/analytics?widget=countries', { width: 1400 })
    expect(panel(small.wrapper).classes()).toEqual(expect.arrayContaining(['is-sheet', 'is-full']))
  })

  it('closes on Escape and gives focus back to the card that opened it', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics')
    const before = window.history.length
    const open = wrapper.find('.bd-cell[data-widget="traffic"] button.bd-card-open')
    open.element.focus()
    await open.trigger('click')
    await settle()
    expect(query(router).widget).toBe('traffic')
    expect(window.history.length).toBe(before + 1)
    expect(window.history.state.bdPanel).toBe(true)

    panel(wrapper).find('.stub-view-button').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(query(router).widget).toBeUndefined())
    await settle()
    expect(panel(wrapper).exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('.bd-cell[data-widget="traffic"] button.bd-card-open').element)
    // Closing refetches the stale card data in use.
    expect(sources.revalidate).toHaveBeenCalledWith('w1')
  })

  it('leaves Escape to whoever took it, and to an open menu', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics?widget=countries')
    const button = panel(wrapper).find('.stub-view-button').element
    button.addEventListener('keydown', (e) => e.preventDefault())
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    expect(query(router).widget).toBe('countries')
  })

  it('closes a panel opened by a link in place, focusing its card or Add widget', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics?widget=countries&engine=claude')
    await panel(wrapper).find('button[aria-label="Close Countries"]').trigger('click')
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/projects/w1/analytics')
    expect(document.activeElement).toBe(wrapper.find('.bd-cell[data-widget="countries"] button.bd-card-open').element)

    await router.push('/projects/w1/analytics?widget=ai-traffic')
    await settle()
    await panel(wrapper).find('button[aria-label="Close AI traffic"]').trigger('click')
    await settle()
    expect(document.activeElement).toBe(wrapper.find('[data-bd-add]').element)
  })

  it('switches panels in place from an open panel, keeping its history entry', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics')
    await wrapper.find('.bd-cell[data-widget="summary"] button.bd-card-open').trigger('click')
    await settle()
    const length = window.history.length
    // A view opening another widget (Who AI recommends -> Competitors, say).
    await wrapper.find('.bd-cell[data-widget="countries"] button.bd-card-open').trigger('click')
    await settle()
    expect(query(router).widget).toBe('countries')
    expect(window.history.length).toBe(length)
    expect(window.history.state.bdPanel).toBe(true)
    expect(panel(wrapper).find('h2').text()).toBe('Countries')
    expect(document.activeElement).toBe(panel(wrapper).find('h2').element)
  })

  it('gives focus back to the card that switched a docked panel, and keeps the board where it was', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics', { width: 1400 })
    const title = (key) => wrapper.find(`.bd-cell[data-widget="${key}"] button.bd-card-open`)
    title('summary').element.focus()
    await title('summary').trigger('click')
    await settle()
    // The board stays in reach beside a docked panel: another card switches it.
    title('traffic').element.focus()
    await title('traffic').trigger('click')
    await settle()
    expect(query(router).widget).toBe('traffic')
    // A record opened from inside the panel keeps the card that opened it.
    const record = panel(wrapper).find('.stub-view-open')
    record.element.focus()
    await record.trigger('click')
    await settle()
    expect(query(router)).toEqual({ widget: 'traffic', period: '7d' })

    await panel(wrapper).find('button[aria-label="Close Traffic"]').trigger('click')
    await vi.waitFor(() => expect(query(router).widget).toBeUndefined())
    await settle()
    expect(document.activeElement).toBe(title('traffic').element)
  })

  it('offers Add to board only while the widget is off the board', async () => {
    const { wrapper, store, ui } = await setup('/projects/w1/analytics?widget=ai-crawlers')
    const add = panel(wrapper).findAll('button').find((b) => b.text() === 'Add to board')
    expect(add).toBeTruthy()
    await add.trigger('click')
    await flushPromises()
    expect(store.has('w1', 'ai-crawlers')).toBe(true)
    expect(ui.politeAnnouncement.text).toBe('Added AI crawlers to your board.')
    expect(panel(wrapper).findAll('button').some((b) => b.text() === 'Add to board')).toBe(false)
    expect(wrapper.find('.bd-cell[data-widget="ai-crawlers"]').exists()).toBe(true)

    await settle()
    const onBoard = await setup('/projects/w1/analytics?widget=countries')
    expect(panel(onBoard.wrapper).findAll('button').some((b) => b.text() === 'Add to board')).toBe(false)
  })

  it('drops an unknown widget from the address and closes a widget with no view', async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics?widget=nope&period=90d')
    expect(router.currentRoute.value.fullPath).toBe('/projects/w1/analytics?period=90d')
    expect(panel(wrapper).exists()).toBe(false)

    await router.push('/projects/w1/analytics?widget=products')
    await settle()
    expect(query(router).widget).toBeUndefined()
    expect(panel(wrapper).exists()).toBe(false)
  })

  it("titles a prompt's detail Prompt and starts a new record at the top", async () => {
    const { wrapper, router } = await setup('/projects/w1/analytics?widget=prompts')
    const body = panel(wrapper).find('.bd-panel-body').element
    body.scrollTop = 300
    await router.replace('/projects/w1/analytics?widget=prompts&prompt=p1')
    await settle()
    expect(panel(wrapper).find('h2').text()).toBe('Prompt')
    expect(panel(wrapper).find('button[aria-label="Close Prompt"]').exists()).toBe(true)
    expect(body.scrollTop).toBe(0)
  })
})
