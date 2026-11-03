import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { RouterView, onBeforeRouteUpdate } from 'vue-router'

vi.mock('@/api/client', () => ({
    default: {
        get: vi.fn(async () => ({ data: { next_route: 'app' } })),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
    authHeaders: () => ({}),
    refreshAccessToken: async () => '',
}))
vi.mock('@/api/websites', () => ({ default: { list: vi.fn() } }))
vi.mock('@/api/agent', () => ({
    default: {
        status: vi.fn(),
        agents: vi.fn(),
        listChats: vi.fn(),
        getContext: vi.fn(),
        putContext: vi.fn(),
    },
}))

import agentApi from '@/api/agent'
import router from '@/router'
import { useAgentStore } from '@/stores/agent'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import AgentContextPage from '@/pages/agent/AgentContextPage.vue'

// Two test routes under the app's real router and its global guards.
let blocked = false
const Guarded = defineComponent({
    setup() {
        onBeforeRouteUpdate(() => !blocked)
        return () => h('div', { class: 'guarded' })
    },
})
router.addRoute({ path: '/test-guarded/:websiteId', name: 'test-guarded', component: Guarded, meta: { requiresAuth: true } })
router.addRoute({
    path: '/test-context/:websiteId',
    name: 'test-context',
    component: AgentContextPage,
    props: true,
    meta: { requiresAuth: true },
})

const ok = (data) => ({ success: true, data })
const mounted = []
let pinia

beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    blocked = false
    const auth = useAuthStore()
    auth.accessToken = 'token'
    auth.user = { id: 7 }
    useAppStore().setWebsites([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
    ])
    agentApi.status.mockResolvedValue(ok({ enabled: true, live_available: true }))
    agentApi.agents.mockResolvedValue(ok([]))
    agentApi.listChats.mockResolvedValue(ok({ results: [], next_cursor: null }))
    agentApi.getContext.mockImplementation(async (wid) =>
        ok({ website_id: wid, audience: '', voice: '', offerings: [], rules: [], revision: 0 })
    )
    agentApi.putContext.mockReset()
    agentApi.putContext.mockImplementation(async (wid, body) => ok({ ...body, website_id: wid, revision: 1 }))
})

afterEach(() => {
    while (mounted.length) mounted.pop().unmount()
    document.body.innerHTML = ''
})

async function open(path) {
    await router.push(path)
    await router.isReady()
    const wrapper = mount(RouterView, { global: { plugins: [pinia, router] }, attachTo: document.body })
    mounted.push(wrapper)
    await flushPromises()
    return wrapper
}

describe('the active project follows confirmed navigations', () => {
    it('makes the URL project active once the navigation goes through', async () => {
        const app = useAppStore()
        await open('/test-guarded/1')
        expect(app.activeWebsite.id).toBe(1)
        await router.push('/test-guarded/2')
        expect(app.activeWebsite.id).toBe(2)
    })

    it('leaves the active project alone when a page cancels the switch', async () => {
        const app = useAppStore()
        await open('/test-guarded/1')
        blocked = true
        await router.push('/test-guarded/2')
        expect(router.currentRoute.value.params.websiteId).toBe('1')
        expect(app.activeWebsite.id).toBe(1)
    })

    it('keeps saving the Context form to its own project after "Keep editing"', async () => {
        const app = useAppStore()
        const agent = useAgentStore()
        await router.push('/test-context/1')
        // AgentShell scopes the store to the project in the URL.
        await agent.init('1')
        const wrapper = await open('/test-context/1')
        await wrapper.find('#ag-ctx-audience').setValue('Alpha audience')

        // Choose project Beta from the switcher: the page asks first.
        await router.push('/test-context/2')
        await flushPromises()
        expect(document.body.querySelector('[role="alertdialog"]').textContent).toContain('Leave without saving?')
        ;[...document.body.querySelectorAll('[role="alertdialog"] button')]
            .find((b) => b.textContent.trim() === 'Keep editing')
            .click()
        await flushPromises()

        expect(router.currentRoute.value.params.websiteId).toBe('1')
        expect(app.activeWebsite.id).toBe(1)
        expect(agent.websiteId).toBe('1')

        await wrapper.findAll('.ag-ctx-bar button').find((b) => b.text() === 'Save').trigger('click')
        await flushPromises()
        expect(agentApi.putContext).toHaveBeenCalledTimes(1)
        expect(agentApi.putContext.mock.calls[0][0]).toBe('1')
        expect(agentApi.putContext.mock.calls[0][1]).toMatchObject({ audience: 'Alpha audience', revision: 0 })
    })
})
