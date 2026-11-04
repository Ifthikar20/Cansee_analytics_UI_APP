import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { PROJECT_QUERY_KEYS, projectTarget, useProjectSwitch } from '../useProjectSwitch'

const Blank = defineComponent({ render: () => h('div') })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agent/projects', name: 'agent-projects', component: Blank },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: Blank },
      { path: '/projects/:websiteId/agent/context', name: 'agent-context', component: Blank },
      { path: '/projects/:websiteId/agent/reports', name: 'agent-reports', component: Blank },
      { path: '/projects/:websiteId/agent/artifacts/:artifactId', name: 'agent-artifact', component: Blank },
      { path: '/projects/:websiteId/analytics', name: 'analytics', component: Blank, meta: { board: true } },
      { path: '/dashboard', name: 'dashboard', component: Blank, meta: { page: true } },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true } },
      { path: '/settings/project', name: 'settings-project', component: Blank, meta: { settings: true } },
      { path: '/billing', name: 'billing', component: Blank, meta: { settings: true } },
    ],
  })
}

async function setup(path) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  app.setWebsites([
    { id: 'w1', name: 'One' },
    { id: 'w2', name: 'Two' },
  ])
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  let api
  mount(
    defineComponent({
      setup() {
        api = useProjectSwitch()
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia, router] } },
  )
  return { api, router, app }
}

describe('projectTarget', () => {
  it('keeps list sections and sends chats and artifacts home', () => {
    expect(projectTarget('agent-reports', 'w2')).toEqual({ name: 'agent-reports', params: { websiteId: 'w2' } })
    expect(projectTarget('agent-context', 'w2')).toEqual({ name: 'agent-context', params: { websiteId: 'w2' } })
    expect(projectTarget('agent-chat', 'w2')).toEqual({ name: 'agent-home', params: { websiteId: 'w2' } })
    expect(projectTarget('agent-artifact', 'w2')).toEqual({ name: 'agent-home', params: { websiteId: 'w2' } })
    expect(projectTarget('agent-projects', 'w2')).toEqual({ name: 'agent-home', params: { websiteId: 'w2' } })
  })

  it('keeps the board, its panel and filters, and drops the keys that name records', () => {
    const params = { websiteId: 'w2' }
    expect(PROJECT_QUERY_KEYS).toEqual(['prompt', 'check', 'product', 'verdict', 'topic', 'filter', 'url'])
    expect(projectTarget('analytics', 'w2', { widget: 'pages', filter: 'cited', period: '90d' })).toEqual({
      name: 'analytics',
      params,
      query: { widget: 'pages', period: '90d' },
    })
    expect(
      projectTarget('analytics', 'w2', { widget: 'fact-check', verdict: 'contradicted', topic: 'pricing', engine: 'claude', prompt: 'p1' }),
    ).toEqual({ name: 'analytics', params, query: { widget: 'fact-check', engine: 'claude' } })
    expect(projectTarget('analytics', 'w2', { widget: 'countries', prompt: 'p1', check: '1' })).toEqual({
      name: 'analytics',
      params,
      query: { widget: 'countries' },
    })
    expect(projectTarget('analytics', 'w2', { widget: 'citations', url: 'https://a.test/', provider: 'gpt4' })).toEqual({
      name: 'analytics',
      params,
      query: { widget: 'citations', provider: 'gpt4' },
    })
    expect(projectTarget('analytics', 'w2', { widget: 'products', product: 'p1' })).toEqual({
      name: 'analytics',
      params,
      query: { widget: 'products' },
    })
    expect(projectTarget('analytics', 'w2')).toEqual({ name: 'analytics', params, query: {} })
  })

  it('leaves the Analytics entry, Settings and Billing where they are', () => {
    const names = [
      'dashboard',
      'settings',
      'settings-project',
      'settings-connections',
      'settings-brand-facts',
      'settings-command-center',
      'billing',
    ]
    for (const name of names) expect(projectTarget(name, 'w2')).toBeNull()
  })
})

describe('useProjectSwitch', () => {
  it('moves a list page to the same section of the other project', async () => {
    const ctx = await setup('/projects/w1/agent/reports')
    await expect(ctx.api.switchProject('w2')).resolves.toBe(true)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/agent/reports')
    expect(ctx.app.activeWebsite.id).toBe('w2')
  })

  it('opens the project home from a chat or the projects list', async () => {
    let ctx = await setup('/projects/w1/agent/c/c1')
    await ctx.api.switchProject('w2')
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/agent')

    ctx = await setup('/agent/projects')
    await expect(ctx.api.switchProject('w1')).resolves.toBe(true)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w1/agent')
  })

  it('ignores unknown ids and the project already open', async () => {
    const ctx = await setup('/projects/w1/agent/context')
    await expect(ctx.api.switchProject('nope')).resolves.toBe(false)
    await expect(ctx.api.switchProject('w1')).resolves.toBe(false)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w1/agent/context')
  })

  it("keeps the board's panel and filters when switching there", async () => {
    let ctx = await setup('/projects/w1/analytics?widget=pages&filter=cited&period=7d')
    await expect(ctx.api.switchProject('w2')).resolves.toBe(true)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/analytics?widget=pages&period=7d')
    expect(ctx.app.activeWebsite.id).toBe('w2')

    ctx = await setup('/projects/w1/analytics?widget=prompts&prompt=p1')
    await ctx.api.switchProject('w2')
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/analytics?widget=prompts')
  })

  it('changes the project in place on the Analytics entry and Settings', async () => {
    for (const path of ['/dashboard', '/settings', '/settings/project', '/billing']) {
      const ctx = await setup(path)
      ctx.app.setActiveWebsite(ctx.app.websites[0])
      await expect(ctx.api.switchProject('w2')).resolves.toBe(true)
      expect(ctx.router.currentRoute.value.fullPath).toBe(path)
      expect(ctx.app.activeWebsite.id).toBe('w2')
      // The project already active: nothing to do.
      await expect(ctx.api.switchProject('w2')).resolves.toBe(false)
    }
  })

  it('leaves everything in place when a guard cancels the navigation', async () => {
    const ctx = await setup('/projects/w1/agent/context')
    ctx.app.setActiveWebsite(ctx.app.websites[0])
    ctx.router.beforeEach(() => false)
    await expect(ctx.api.switchProject('w2')).resolves.toBe(false)
    expect(ctx.app.activeWebsite.id).toBe('w1')
    expect(ctx.router.currentRoute.value.params.websiteId).toBe('w1')
  })
})

beforeEach(() => {
  localStorage.clear()
})
