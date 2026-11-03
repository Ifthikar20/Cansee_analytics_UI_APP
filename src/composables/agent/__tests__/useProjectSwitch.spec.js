import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { projectTarget, useProjectSwitch } from '../useProjectSwitch'

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
      { path: '/dashboard', name: 'dashboard', component: Blank, meta: { analytics: 'overview' } },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true } },
      { path: '/settings/project', name: 'settings-project', component: Blank, meta: { settings: true } },
      { path: '/billing', name: 'billing', component: Blank, meta: { settings: true } },
      { path: '/projects/:websiteId/prompts/:promptId', name: 'prompt', component: Blank, meta: { analytics: 'overview' } },
      { path: '/projects/:websiteId/sources', name: 'sources-urls', component: Blank, meta: { analytics: 'sources' } },
      {
        path: '/projects/:websiteId/sources/detail',
        name: 'sources-url-detail',
        component: Blank,
        meta: { analytics: 'sources' },
      },
      { path: '/projects/:websiteId/fact-check', name: 'fact-check', component: Blank, meta: { analytics: 'fact-check' } },
      { path: '/projects/:websiteId/pages', name: 'site-pages', component: Blank, meta: { analytics: 'pages' } },
      { path: '/projects/:websiteId/countries', name: 'countries', component: Blank, meta: { analytics: 'countries' } },
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

  it('keeps an analytics tab on the new project, without the queries that name its records', () => {
    const params = { websiteId: 'w2' }
    expect(projectTarget('site-pages', 'w2', { filter: 'cited', period: '90d' })).toEqual({
      name: 'site-pages',
      params,
      query: { period: '90d' },
    })
    expect(
      projectTarget('fact-check', 'w2', { verdict: 'contradicted', topic: 'pricing', engine: 'claude', prompt: 'p1' }),
    ).toEqual({ name: 'fact-check', params, query: { engine: 'claude' } })
    expect(projectTarget('countries', 'w2', { prompt: 'p1', check: '1' })).toEqual({ name: 'countries', params, query: {} })
    expect(projectTarget('products', 'w2', { product: 'p1' })).toEqual({ name: 'products', params, query: {} })
    expect(projectTarget('crawler-access', 'w2')).toEqual({ name: 'crawler-access', params, query: {} })
  })

  it("sends a prompt's page to the Overview and a source's detail to Citations", () => {
    expect(projectTarget('prompt', 'w2', { x: '1' })).toEqual({ name: 'dashboard' })
    expect(projectTarget('sources-url-detail', 'w2', { url: 'https://a.test/' })).toEqual({
      name: 'sources-urls',
      params: { websiteId: 'w2' },
    })
  })

  it('leaves the Overview, Settings and Billing where they are', () => {
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
  let ctx

  beforeEach(async () => {
    ctx = null
  })

  it('moves a list page to the same section of the other project', async () => {
    ctx = await setup('/projects/w1/agent/reports')
    await expect(ctx.api.switchProject('w2')).resolves.toBe(true)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/agent/reports')
    expect(ctx.app.activeWebsite.id).toBe('w2')
  })

  it('opens the project home from a chat or the projects list', async () => {
    ctx = await setup('/projects/w1/agent/c/c1')
    await ctx.api.switchProject('w2')
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/agent')

    ctx = await setup('/agent/projects')
    await expect(ctx.api.switchProject('w1')).resolves.toBe(true)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w1/agent')
  })

  it('ignores unknown ids and the project already open', async () => {
    ctx = await setup('/projects/w1/agent/context')
    await expect(ctx.api.switchProject('nope')).resolves.toBe(false)
    await expect(ctx.api.switchProject('w1')).resolves.toBe(false)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w1/agent/context')
  })

  it('keeps the analytics tab and drops record queries when switching there', async () => {
    ctx = await setup('/projects/w1/pages?filter=cited&period=7d')
    await expect(ctx.api.switchProject('w2')).resolves.toBe(true)
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/pages?period=7d')
    expect(ctx.app.activeWebsite.id).toBe('w2')

    ctx = await setup('/projects/w1/prompts/p1')
    await ctx.api.switchProject('w2')
    expect(ctx.router.currentRoute.value.fullPath).toBe('/dashboard')
    expect(ctx.app.activeWebsite.id).toBe('w2')

    ctx = await setup('/projects/w1/sources/detail?url=https%3A%2F%2Fa.test%2F')
    await ctx.api.switchProject('w2')
    expect(ctx.router.currentRoute.value.fullPath).toBe('/projects/w2/sources')
  })

  it('changes the project in place on the Overview and Settings', async () => {
    for (const path of ['/dashboard', '/settings', '/settings/project', '/billing']) {
      ctx = await setup(path)
      ctx.app.setActiveWebsite(ctx.app.websites[0])
      await expect(ctx.api.switchProject('w2')).resolves.toBe(true)
      expect(ctx.router.currentRoute.value.fullPath).toBe(path)
      expect(ctx.app.activeWebsite.id).toBe('w2')
      // The project already active: nothing to do.
      await expect(ctx.api.switchProject('w2')).resolves.toBe(false)
    }
  })

  it('leaves everything in place when a guard cancels the navigation', async () => {
    ctx = await setup('/projects/w1/agent/context')
    ctx.app.setActiveWebsite(ctx.app.websites[0])
    ctx.router.beforeEach(() => false)
    await expect(ctx.api.switchProject('w2')).resolves.toBe(false)
    expect(ctx.app.activeWebsite.id).toBe('w1')
    expect(ctx.router.currentRoute.value.params.websiteId).toBe('w1')
  })
})
