import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { rememberAnalyticsSection } from '@/lib/analyticsNav'
import ProductSwitch from '../ProductSwitch.vue'

const Blank = defineComponent({ render: () => h('div') })
const mounted = []

async function setup(props) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agent', name: 'agent', component: Blank },
      { path: '/dashboard', name: 'dashboard', component: Blank },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/countries', name: 'countries', component: Blank },
    ],
  })
  await router.push('/dashboard')
  await router.isReady()
  const wrapper = mount(ProductSwitch, { props, global: { plugins: [router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
})

describe('ProductSwitch', () => {
  it('marks the Agent side current by default', async () => {
    const { wrapper } = await setup({ websiteId: 'w1' })
    const [agent, analytics] = wrapper.findAll('.ag-ps-item')
    expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Product')
    expect(agent.classes()).toContain('is-active')
    expect(agent.attributes('aria-current')).toBe('true')
    expect(analytics.classes()).not.toContain('is-active')
    expect(analytics.attributes('aria-current')).toBeUndefined()
    expect(agent.attributes('href')).toBe('/projects/w1/agent')
  })

  it('marks the Analytics side current on the analytics side', async () => {
    const { wrapper } = await setup({ websiteId: 'w1', side: 'analytics' })
    const [agent, analytics] = wrapper.findAll('.ag-ps-item')
    expect(analytics.classes()).toContain('is-active')
    expect(analytics.attributes('aria-current')).toBe('true')
    expect(agent.attributes('aria-current')).toBeUndefined()
  })

  it('opens the tab last used for the project, the Overview otherwise, and the agent picker without a project', async () => {
    rememberAnalyticsSection('w1', 'countries')
    let ctx = await setup({ websiteId: 'w1' })
    expect(ctx.wrapper.findAll('.ag-ps-item')[1].attributes('href')).toBe('/projects/w1/countries')

    ctx = await setup({ websiteId: null })
    const [agent, analytics] = ctx.wrapper.findAll('.ag-ps-item')
    expect(agent.attributes('href')).toBe('/agent')
    expect(analytics.attributes('href')).toBe('/dashboard')
  })
})
