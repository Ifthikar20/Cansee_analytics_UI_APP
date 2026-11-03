import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useFirstResearch } from '@/composables/agent/useFirstResearch'

const fakeAgent = reactive({})
vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))

const fakePane = reactive({})
vi.mock('@/stores/agentPane', () => ({ useAgentPaneStore: () => fakePane }))

const fakeUi = { announce: vi.fn() }
vi.mock('@/stores/agentUi', () => ({ useAgentUiStore: () => fakeUi }))

const fakeAuth = reactive({ user: { id: 7 } })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => fakeAuth }))

const fakeApp = reactive({ activeWebsite: { id: 'w1', name: 'Notion' }, websites: [{ id: 'w1', name: 'Notion' }] })
vi.mock('@/stores/app', () => ({ useAppStore: () => fakeApp }))

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

// The chat column, the pane and the split belong to other builders; the
// page only wires them. The chat stub records each mount and its props.
const chatMounts = []
vi.mock('@/components/agent/chat/ChatPane.vue', async () => {
  const vue = await import('vue')
  return {
    default: vue.defineComponent({
      name: 'ChatPane',
      props: ['websiteId', 'chatId', 'projectName', 'initialAgent', 'paneDomId'],
      emits: ['created'],
      setup(props) {
        chatMounts.push({ chatId: props.chatId, initialAgent: props.initialAgent })
        return () => vue.h('div', { class: 'chat-stub', 'data-agent': props.initialAgent || '' })
      },
    }),
  }
})
vi.mock('@/components/agent/browser/BrowserPane.vue', async () => {
  const vue = await import('vue')
  return { default: vue.defineComponent({ name: 'BrowserPane', props: ['layout'], setup: () => () => vue.h('aside') }) }
})
vi.mock('@/components/agent/workspace/AgentWorkspaceSplit.vue', async () => {
  const vue = await import('vue')
  return {
    default: vue.defineComponent({
      name: 'AgentWorkspaceSplit',
      setup: (_, { slots }) => () =>
        vue.h('div', { class: 'split-stub' }, [slots.chat?.({ layout: 'split' }), slots.pane?.({ layout: 'split' })]),
    }),
  }
})

const { default: AgentChatPage } = await import('../AgentChatPage.vue')

const mounted = []

const TEXT = [
  'Research Notion (notion.so) on Google and the AI engines for these prompts:',
  '1. best note taking app for teams',
  '2. notion alternatives for startups',
  'Search from United States (us).',
  'Competitors to compare: Evernote (evernote.com).',
].join('\n')

function resetStores(overrides = {}) {
  for (const key of Object.keys(fakeAgent)) delete fakeAgent[key]
  Object.assign(fakeAgent, {
    websiteId: 'w1',
    chats: { byId: {} },
    chatState: {},
    init: vi.fn((wid) => {
      fakeAgent.websiteId = wid
    }),
    openChat: vi.fn(async () => {}),
    loadSuggestions: vi.fn(async () => {}),
    send: vi.fn(async () => 'c9'),
    setViewingChat: vi.fn(),
    ...overrides,
  })
  for (const key of Object.keys(fakePane)) delete fakePane[key]
  Object.assign(fakePane, {
    bindChat: vi.fn(),
    openArtifact: vi.fn(),
    openCapture: vi.fn((id) => id),
  })
}

async function setup(path) {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: AgentChatPage, props: true },
      { path: '/projects/:websiteId/agent/c/:chatId', name: 'agent-chat', component: AgentChatPage, props: true },
    ],
  })
  await router.push(path)
  await router.isReady()
  // Rendered by a router view, as in the app: one page instance serves
  // both the new-chat and the chat route.
  const App = defineComponent({ render: () => h(RouterView) })
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

const draftKey = (cid = 'new') => `cs-agent-draft-v1:7:w1:${cid}`
const buttonByText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text)

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  chatMounts.length = 0
  resetStores()
  fakeUi.announce.mockReset()
  Object.values(toast).forEach((fn) => fn.mockReset())
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  document.body.innerHTML = ''
})

describe('AgentChatPage first research', () => {
  it('sends the stashed research once with the research agent and moves to its chat', async () => {
    useFirstResearch().stash({ websiteId: 'w1', text: TEXT })
    const { router } = await setup('/projects/w1/agent?start=first-research')

    expect(fakeAgent.send).toHaveBeenCalledTimes(1)
    expect(fakeAgent.send).toHaveBeenCalledWith({ chatId: null, text: TEXT, agent: 'gap_analyst' })
    expect(router.currentRoute.value.name).toBe('agent-chat')
    expect(router.currentRoute.value.params.chatId).toBe('c9')
    expect(router.currentRoute.value.query).toEqual({})
    expect(useFirstResearch().peek('w1')).toBeNull()

    // Nothing sends it again: not another project round trip, not a reload of the store.
    fakeAgent.websiteId = 'w2'
    await nextTick()
    fakeAgent.websiteId = 'w1'
    await flushPromises()
    expect(fakeAgent.send).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('waits until the agent store is on the project', async () => {
    resetStores({ websiteId: null, init: vi.fn() })
    useFirstResearch().stash({ websiteId: 'w1', text: TEXT })
    await setup('/projects/w1/agent?start=first-research')
    expect(fakeAgent.send).not.toHaveBeenCalled()

    fakeAgent.websiteId = 'w1'
    await flushPromises()
    expect(fakeAgent.send).toHaveBeenCalledTimes(1)
  })

  it('keeps the message in the new chat composer when the send fails', async () => {
    resetStores({
      send: vi.fn(async () => {
        throw Object.assign(new Error('x'), {
          name: 'AgentError',
          status: 503,
          code: 'agent_disabled',
          message: 'The agent is turned off for this workspace.',
        })
      }),
    })
    useFirstResearch().stash({ websiteId: 'w1', text: TEXT })
    const { router, wrapper } = await setup('/projects/w1/agent?start=first-research')

    expect(toast.error).toHaveBeenCalledWith('The agent is turned off for this workspace.')
    expect(fakeUi.announce).toHaveBeenCalledWith('The agent is turned off for this workspace.', 'assertive')
    expect(localStorage.getItem(draftKey())).toBe(TEXT)
    // Still the new chat, now with the research agent picked.
    expect(router.currentRoute.value.name).toBe('agent-home')
    expect(router.currentRoute.value.query).toEqual({ agent: 'gap_analyst' })
    // The chat column mounted again, so its composer reads the draft.
    expect(chatMounts.length).toBe(2)
    expect(wrapper.find('.chat-stub').attributes('data-agent')).toBe('gap_analyst')
    expect(useFirstResearch().peek('w1')).toBeNull()
    expect(fakeAgent.send).toHaveBeenCalledTimes(1)
  })

  it('offers the research in a dialog when the page opens without the start query', async () => {
    useFirstResearch().stash({ websiteId: 'w1', text: TEXT })
    const { router } = await setup('/projects/w1/agent')
    expect(fakeAgent.send).not.toHaveBeenCalled()

    const dialog = document.body.querySelector('[role="alertdialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('Run your first research?')
    expect(dialog.textContent).toContain('Research Notion (notion.so) on Google and the AI engines for these prompts:')
    expect([...dialog.querySelectorAll('ol li')].map((li) => li.textContent)).toEqual([
      'best note taking app for teams',
      'notion alternatives for startups',
    ])

    buttonByText(dialog, 'Start research').click()
    await flushPromises()
    expect(fakeAgent.send).toHaveBeenCalledWith({ chatId: null, text: TEXT, agent: 'gap_analyst' })
    expect(router.currentRoute.value.name).toBe('agent-chat')
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
    expect(useFirstResearch().peek('w1')).toBeNull()
  })

  it('discards the research with Not now', async () => {
    useFirstResearch().stash({ websiteId: 'w1', text: TEXT })
    await setup('/projects/w1/agent')
    const dialog = document.body.querySelector('[role="alertdialog"]')
    buttonByText(dialog, 'Not now').click()
    await flushPromises()
    expect(fakeAgent.send).not.toHaveBeenCalled()
    expect(useFirstResearch().peek('w1')).toBeNull()
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it("leaves another project's research alone and drops the start query", async () => {
    useFirstResearch().stash({ websiteId: 'w2', text: TEXT })
    const { router } = await setup('/projects/w1/agent?start=first-research')
    expect(fakeAgent.send).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({})
    expect(useFirstResearch().peek('w2')).not.toBeNull()
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('does nothing on an existing chat', async () => {
    useFirstResearch().stash({ websiteId: 'w1', text: TEXT })
    await setup('/projects/w1/agent/c/c1')
    expect(fakeAgent.send).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
    expect(useFirstResearch().peek('w1')).not.toBeNull()
  })
})

describe('AgentChatPage ?tab=', () => {
  it('opens the capture once the chat has loaded, then drops the query', async () => {
    resetStores({ chatState: { c1: { loaded: false, loading: true, error: null } } })
    const { router } = await setup('/projects/w1/agent/c/c1?tab=serp:3f2a9c1d0e7b')
    expect(fakePane.openCapture).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.tab).toBe('serp:3f2a9c1d0e7b')

    fakeAgent.chatState.c1 = { loaded: true, loading: false, error: null }
    await flushPromises()
    expect(fakePane.openCapture).toHaveBeenCalledTimes(1)
    expect(fakePane.openCapture).toHaveBeenCalledWith('serp:3f2a9c1d0e7b', { activate: true })
    expect(router.currentRoute.value.query).toEqual({})
    expect(fakePane.bindChat).toHaveBeenCalledWith('c1')
  })

  it('opens it right away for a chat that is already loaded', async () => {
    resetStores({ chatState: { c1: { loaded: true, loading: false, error: null } } })
    await setup('/projects/w1/agent/c/c1?tab=page:0a1b2c3d4e5f')
    expect(fakePane.openCapture).toHaveBeenCalledWith('page:0a1b2c3d4e5f', { activate: true })
  })

  it('drops the query without opening anything for a chat that failed or a bad id', async () => {
    resetStores({ chatState: { c1: { loaded: false, loading: false, error: { status: 404 } } } })
    let ctx = await setup('/projects/w1/agent/c/c1?tab=serp:3f2a9c1d0e7b')
    expect(fakePane.openCapture).not.toHaveBeenCalled()
    expect(ctx.router.currentRoute.value.query).toEqual({})

    resetStores({ chatState: { c1: { loaded: true, loading: false, error: null } } })
    ctx = await setup('/projects/w1/agent/c/c1?tab=artifact:a1')
    expect(fakePane.openCapture).not.toHaveBeenCalled()
    expect(ctx.router.currentRoute.value.query).toEqual({})
  })

  it('keeps opening ?artifact= as before', async () => {
    const { router } = await setup('/projects/w1/agent/c/c1?artifact=a7')
    expect(fakePane.openArtifact).toHaveBeenCalledWith('a7', { activate: true })
    expect(router.currentRoute.value.query).toEqual({})
  })
})
