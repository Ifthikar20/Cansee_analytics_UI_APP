import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { setLastChat } from '@/lib/agent/storage'
import { useAuthStore } from '@/stores/auth'
import ProductSwitch from '../ProductSwitch.vue'

const Blank = defineComponent({ render: () => h('div') })
const mounted = []

async function setup(props, path = '/projects/w1/agent', { uid = 7 } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = uid === null ? null : { id: uid }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agent', name: 'agent', component: Blank },
      { path: '/agent/projects', name: 'agent-projects', component: Blank },
      { path: '/dashboard', name: 'dashboard', component: Blank, meta: { page: true } },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true } },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: Blank },
      { path: '/projects/:websiteId/analytics', name: 'analytics', component: Blank, meta: { board: true } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(ProductSwitch, { props, global: { plugins: [pinia, router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

const items = (wrapper) => wrapper.findAll('.ag-ps-item')
const state = (a) => [a.classes().includes('is-active'), a.attributes('aria-current')]

beforeEach(() => localStorage.clear())
afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
})

describe('ProductSwitch', () => {
  it('marks Agent current on agent routes', async () => {
    const { wrapper } = await setup({ websiteId: 'w1' }, '/agent/projects')
    const [agent, analytics] = items(wrapper)
    expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Product')
    expect(state(agent)).toEqual([true, 'true'])
    expect(state(analytics)).toEqual([false, undefined])
  })

  it('marks Analytics current on the board and its entry, and neither on Settings', async () => {
    const { wrapper, router } = await setup({ websiteId: 'w1' }, '/projects/w1/analytics?widget=prompts')
    expect(items(wrapper).map(state)).toEqual([
      [false, undefined],
      [true, 'true'],
    ])
    await router.push('/dashboard')
    await flushPromises()
    expect(state(items(wrapper)[1])).toEqual([true, 'true'])
    await router.push('/settings')
    await flushPromises()
    expect(items(wrapper).map(state)).toEqual([
      [false, undefined],
      [false, undefined],
    ])
  })

  it("returns to the project's last chat, else a new chat, else the agent picker", async () => {
    let ctx = await setup({ websiteId: 'w1' })
    expect(items(ctx.wrapper)[0].attributes('href')).toBe('/projects/w1/agent')
    setLastChat(7, 'w1', 'chat-9')
    // Storage is not reactive: the link is read again on the next navigation.
    await ctx.router.push('/projects/w1/analytics')
    await flushPromises()
    expect(items(ctx.wrapper)[0].attributes('href')).toBe('/projects/w1/agent/c/chat-9')

    ctx = await setup({ websiteId: 'w1' }, '/projects/w1/agent', { uid: null })
    expect(items(ctx.wrapper)[0].attributes('href')).toBe('/projects/w1/agent')

    ctx = await setup({ websiteId: null })
    expect(items(ctx.wrapper)[0].attributes('href')).toBe('/agent')
  })

  it('opens the board with no panel, or /dashboard without a project', async () => {
    let ctx = await setup({ websiteId: 'w1' }, '/projects/w1/analytics?widget=countries&engine=claude')
    expect(items(ctx.wrapper)[1].attributes('href')).toBe('/projects/w1/analytics')
    ctx = await setup({ websiteId: null })
    expect(items(ctx.wrapper)[1].attributes('href')).toBe('/dashboard')
  })
})
