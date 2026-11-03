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

  it('leaves everything in place when a guard cancels the navigation', async () => {
    ctx = await setup('/projects/w1/agent/context')
    ctx.app.setActiveWebsite(ctx.app.websites[0])
    ctx.router.beforeEach(() => false)
    await expect(ctx.api.switchProject('w2')).resolves.toBe(false)
    expect(ctx.app.activeWebsite.id).toBe('w1')
    expect(ctx.router.currentRoute.value.params.websiteId).toBe('w1')
  })
})
