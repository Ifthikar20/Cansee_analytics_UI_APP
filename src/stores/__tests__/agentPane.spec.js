import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('@/stores/agent', async () => {
  const m = await import('@/components/agent/browser/__tests__/__fixtures__/stores.js')
  return { useAgentStore: m.useAgentStore }
})
vi.mock('@/stores/auth', async () => {
  const m = await import('@/components/agent/browser/__tests__/__fixtures__/stores.js')
  return { useAuthStore: m.useAuthStore }
})

import { MAX_TABS, researchTabs, useAgentPaneStore } from '../agentPane'
import { useAgentStore } from '@/stores/agent'
import { serpCapture } from '@/components/agent/browser/__tests__/__fixtures__/stores.js'

const TABS_KEY = 'cs-agent-tabs-v1:7:w1'

function serpSpec(id, status = 'loading', data = {}) {
  return { id: `serp:${id}`, kind: 'serp', title: `Google · q${id}`, status, data: { capture_id: id, query: `q${id}`, page: 1, ...data } }
}

function assistant(id, parts, research = { serp: {}, pages: {} }) {
  return { id, role: 'assistant', parts, research }
}

describe('agentPane store', () => {
  let pane
  let agent

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    agent = useAgentStore()
    pane = useAgentPaneStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('tabs', () => {
    it('opens a Google results tab and activates it only when asked', () => {
      pane.openSerp(serpSpec('a'), { activate: false })
      expect(pane.tabs).toHaveLength(1)
      expect(pane.activeId).toBe(null)
      expect(pane.open).toBe(false)

      pane.openSerp(serpSpec('b'), { activate: true })
      expect(pane.activeId).toBe('serp:b')
      expect(pane.open).toBe(true)
      expect(pane.activeTab.kind).toBe('serp')
    })

    it('accepts a bare SerpCapture', () => {
      const id = pane.openSerp(serpCapture(), { activate: true })
      expect(id).toBe('serp:c1')
      expect(pane.activeTab.status).toBe('ready')
      expect(pane.titleOf(pane.activeTab)).toBe('Google · best note app · p2')
    })

    it('titles every results page with its number, as the server does', () => {
      pane.openSerp(serpCapture({ capture_id: 'p1', page: 1 }))
      expect(pane.titleOf(pane.tabs[0])).toBe('Google · best note app · p1')
    })

    it('merges browser.update patches into data (reducer and contract shapes)', () => {
      pane.openSerp(serpSpec('a'), { activate: true })
      pane.updateTab('serp:a', { data: { results: [], brand_positions: [] }, status: 'ready' })
      expect(pane.activeTab.status).toBe('ready')
      expect(pane.activeTab.data.query).toBe('qa')

      pane.openSerp(serpSpec('b'))
      pane.updateTab('serp:b', { results: [{ position: 1 }] })
      const tab = pane.tabs.find((t) => t.id === 'serp:b')
      expect(tab.data.results).toHaveLength(1)
      expect(tab.status).toBe('ready')

      pane.updateTab('serp:b', { error: { code: 'serp_not_configured', message: 'x' } })
      expect(tab.status).toBe('error')
    })

    it('closes to the right neighbour, then the left, and hides the pane when empty', () => {
      for (const id of ['a', 'b', 'c']) pane.openSerp(serpSpec(id))
      pane.activateTab('serp:b')
      expect(pane.closeTab('serp:b')).toBe('serp:c')
      expect(pane.closeTab('serp:c')).toBe('serp:a')
      pane.closeTab('serp:a')
      expect(pane.tabs).toHaveLength(0)
      expect(pane.open).toBe(false)
    })

    it(`keeps at most ${MAX_TABS} tabs and evicts the least recently used inactive one`, () => {
      pane.openSerp(serpSpec('first'), { activate: true })
      for (let i = 0; i < MAX_TABS; i++) pane.openSerp(serpSpec(`n${i}`))
      expect(pane.tabs).toHaveLength(MAX_TABS)
      expect(pane.tabs.some((t) => t.id === 'serp:first')).toBe(true)
      expect(pane.tabs.some((t) => t.id === 'serp:n0')).toBe(false)
    })

    it('normalizes, reuses and refuses URLs', () => {
      const id = pane.openUrl('example.com/pricing')
      expect(pane.activeTab.url).toBe('https://example.com/pricing')
      expect(pane.activeTab.status).toBe('idle')
      expect(pane.openUrl('https://example.com/pricing')).toBe(id)
      expect(pane.tabs).toHaveLength(1)
      expect(pane.openUrl('javascript:alert(1)')).toBe(null)
      expect(pane.tabs).toHaveLength(1)
    })

    it('reuses one new tab and turns it into a page on navigation', () => {
      const id = pane.openNewTab()
      expect(pane.openNewTab()).toBe(id)
      pane.navigateTab(id, 'example.com')
      expect(pane.activeTab.kind).toBe('url')
      expect(pane.activeTab.url).toBe('https://example.com/')
    })

    it('keeps per-tab history for back and forward', () => {
      const id = pane.openUrl('https://a.test/')
      pane.updateTab(id, { status: 'ready', data: { title: 'A' } })
      pane.navigateTab(id, 'https://a.test/b')
      pane.navigateTab(id, 'https://a.test/c')
      pane.goBack(id)
      expect(pane.activeTab.url).toBe('https://a.test/b')
      expect(pane.activeTab.status).toBe('idle')
      pane.goForward(id)
      expect(pane.activeTab.url).toBe('https://a.test/c')
      pane.goBack(id)
      pane.navigateTab(id, 'https://a.test/d')
      expect(pane.activeTab.history.entries).toEqual(['https://a.test/', 'https://a.test/b', 'https://a.test/d'])
      expect(pane.goForward(id)).toBe(null)
    })

    it('opens artifacts once and keeps the chosen version unless told otherwise', () => {
      pane.openArtifact('42', { activate: true, version: 2 })
      pane.openArtifact('42')
      expect(pane.tabs).toHaveLength(1)
      expect(pane.activeTab.version).toBe(2)
      pane.openArtifact('42', { version: null })
      expect(pane.activeTab.version).toBe(null)
    })

    it('clamps and stores the split ratio as a device preference', () => {
      pane.setRatio(0.99)
      expect(pane.ratio).toBe(0.85)
      expect(JSON.parse(localStorage.getItem('cs-agent-ui-v1')).paneRatio).toBe(0.85)
    })
  })

  describe('chat binding and rebuild', () => {
    function seedChat(chatId) {
      agent.messages.m1 = { id: 'm1', role: 'user', parts: [{ id: 'p0', type: 'text', text: 'Research' }] }
      agent.messages.m2 = assistant(
        'm2',
        [
          { id: 'p1', type: 'serp', status: 'done', tab_id: 'serp:c1', query: 'best note app', page: 2 },
          { id: 'p2', type: 'page_inspect', status: 'done', tab_id: 'page:p9', url: 'https://turonote.test/' },
          { id: 'p3', type: 'agent_call', status: 'done', artifact_id: 'a5', title: 'Battery page' },
        ],
        {
          serp: { c1: serpCapture() },
          pages: { p9: { capture_id: 'p9', url: 'https://turonote.test/', final_url: 'https://turonote.test/', frameable: true, seo: { title: 'Turonote' } } },
        }
      )
      agent.paths[chatId] = ['m1', 'm2']
      agent.chatState[chatId] = { loaded: true }
    }

    it('derives research and artifact tabs from messages', () => {
      seedChat('c')
      const specs = researchTabs(agent.visiblePath('c'))
      expect(specs.map((s) => s.id)).toEqual(['serp:c1', 'page:p9', 'artifact:a5'])
      expect(specs[0].status).toBe('ready')
      expect(specs[1].complete).toBe(true)
    })

    it('rebuilds tabs for a chat with no stored state and activates the newest', () => {
      seedChat('c')
      pane.bindChat('c')
      expect(pane.tabs.map((t) => t.id)).toEqual(['serp:c1', 'page:p9', 'artifact:a5'])
      expect(pane.activeId).toBe('artifact:a5')
      expect(pane.tabs[1].url).toBe('https://turonote.test/')
    })

    it('persists ids and urls only, and restores them with research data', async () => {
      vi.useFakeTimers()
      seedChat('c')
      pane.bindChat('c')
      pane.openUrl('https://example.com/a')
      pane.closeTab('page:p9')
      await nextTick()
      vi.advanceTimersByTime(200)

      const stored = JSON.parse(localStorage.getItem(TABS_KEY))
      const state = stored.chats.c.state
      expect(state.tabs.map((t) => t.id)).toEqual(['serp:c1', 'artifact:a5', expect.stringMatching(/^url:/)])
      expect(JSON.stringify(state)).not.toContain('best note app')
      expect(state.closed).toContain('page:p9')

      pane.bindChat('other')
      expect(pane.tabs).toHaveLength(0)
      pane.bindChat('c')
      expect(pane.tabs.map((t) => t.kind)).toEqual(['serp', 'artifact', 'url'])
      expect(pane.tabs[0].data.query).toBe('best note app')
      expect(pane.tabs[0].status).toBe('ready')
      expect(pane.tabs.some((t) => t.id === 'page:p9')).toBe(false)
    })

    it('reopens a closed research tab when its step is clicked', () => {
      seedChat('c')
      pane.bindChat('c')
      pane.closeTab('serp:c1')
      expect(pane.activateTab('serp:c1')).toBe('serp:c1')
      expect(pane.activeTab.data.results).toHaveLength(3)
    })

    it('marks restored captures that the chat no longer has', async () => {
      vi.useFakeTimers()
      localStorage.setItem(
        TABS_KEY,
        JSON.stringify({ v: 1, chats: { c: { at: 1, state: { open: true, active: 'serp:gone', tabs: [{ id: 'serp:gone', kind: 'serp' }] } } } })
      )
      agent.paths.c = []
      agent.chatState.c = { loaded: false }
      pane.bindChat('c')
      expect(pane.tabs[0].status).toBe('missing')
      agent.messages.m2 = assistant('m2', [])
      agent.paths.c = ['m2']
      agent.chatState.c = { loaded: true }
      await nextTick()
      expect(pane.tabs[0].status).toBe('gone')
    })

    it('opens an artifact tab while a sub-agent drafts it', async () => {
      agent.messages.m2 = assistant('m2', [{ id: 'p3', type: 'agent_call', status: 'preparing' }])
      agent.paths.c = ['m2']
      pane.bindChat('c')
      expect(pane.tabs).toHaveLength(0)
      agent.messages.m2.parts[0] = { id: 'p3', type: 'agent_call', status: 'drafting', artifact_id: 'a7' }
      await nextTick()
      expect(pane.activeId).toBe('artifact:a7')
      expect(pane.open).toBe(true)
    })

    it('settles a loading results tab when its step ends without a capture', async () => {
      agent.messages.m2 = {
        ...assistant('m2', [{ id: 'p1', type: 'serp', status: 'running', tab_id: 'serp:c1', query: 'q', page: 1 }]),
        status: 'streaming',
      }
      agent.paths.c = ['m2']
      agent.chatState.c = { loaded: true }
      pane.bindChat('c')
      pane.openSerp(serpSpec('c1'), { activate: true })
      expect(pane.activeTab.status).toBe('loading')

      // The resync brings the reply the sweeper closed.
      agent.messages.m2.status = 'interrupted'
      agent.messages.m2.parts[0] = {
        ...agent.messages.m2.parts[0],
        status: 'error',
        error: { code: 'interrupted', message: 'Interrupted' },
      }
      await nextTick()
      expect(pane.activeTab.status).toBe('error')
      expect(pane.activeTab.data.error).toEqual({ code: 'interrupted', message: 'Interrupted' })
    })

    it('settles loading research tabs when the reply ended here with steps still running', async () => {
      agent.messages.m2 = {
        ...assistant('m2', [
          { id: 'p1', type: 'serp', status: 'running', tab_id: 'serp:c1', query: 'q', page: 1 },
          { id: 'p2', type: 'page_inspect', status: 'running', tab_id: 'page:p9', url: 'https://turonote.test/' },
        ]),
        status: 'streaming',
      }
      agent.paths.c = ['m2']
      agent.chatState.c = { loaded: true }
      pane.bindChat('c')
      pane.openSerp(serpSpec('c1'))
      pane.openPage({ id: 'page:p9', kind: 'page', status: 'loading', data: { capture_id: 'p9', url: 'https://turonote.test/' } })

      // The stream gave up: the run was settled locally, no part was closed.
      agent.messages.m2.status = 'cancelled'
      await nextTick()
      const serp = pane.tabs.find((t) => t.id === 'serp:c1')
      const page = pane.tabs.find((t) => t.id === 'page:p9')
      expect(serp.status).toBe('error')
      expect(serp.data.error).toEqual({ code: 'stopped', message: 'Stopped' })
      expect(page.status).toBe('error')
      expect(page.data.error.code).toBe('stopped')
    })

    it('never opens a tab for an artifact the agent did not save', () => {
      agent.messages.m2 = assistant('m2', [
        { id: 'p1', type: 'agent_call', status: 'cancelled', artifact_id: 'a8', title: 'Acme page', kind: 'page', error: 'Stopped' },
        { id: 'p2', type: 'agent_call', status: 'error', artifact_id: 'a9', title: 'Guide', kind: 'document', error: 'The page is incomplete.' },
        { id: 'p3', type: 'agent_call', status: 'done', artifact_id: 'a10', version: 1, title: 'Ads', kind: 'sheet' },
        // A failed revision of an artifact saved in another chat.
        { id: 'p4', type: 'agent_call', status: 'error', artifact_id: 'a11', base_version: 2, kind: 'page', error: 'Upstream' },
      ])
      agent.paths.c = ['m2']
      agent.chatState.c = { loaded: true }

      const specs = researchTabs(agent.visiblePath('c'))
      expect(specs.map((s) => [s.id, s.unsaved])).toEqual([
        ['artifact:a8', true],
        ['artifact:a9', true],
        ['artifact:a10', false],
        ['artifact:a11', false],
      ])
      pane.bindChat('c')
      expect(pane.tabs.map((t) => t.id)).toEqual(['artifact:a10', 'artifact:a11'])
      expect(pane.activateTab('artifact:a9')).toBe(null)
      expect(pane.artifactCall('a9')).toEqual({
        status: 'error',
        active: false,
        saved: false,
        error: 'The page is incomplete.',
        kind: 'document',
        title: 'Guide',
      })
      expect(pane.artifactCall('a10').saved).toBe(true)
    })

    it('treats a call still drafting in a reply that ended as not finished', () => {
      agent.messages.m2 = {
        ...assistant('m2', [{ id: 'p1', type: 'agent_call', status: 'drafting', artifact_id: 'a8', kind: 'page' }]),
        status: 'interrupted',
      }
      agent.paths.c = ['m2']
      pane.bindChat('c')
      expect(pane.tabs).toHaveLength(0)
      expect(pane.open).toBe(false)
      expect(pane.artifactCall('a8')).toMatchObject({ status: 'error', active: false, saved: false, error: 'Interrupted' })
    })

    it('opens the artifact again for each new draft of it', async () => {
      agent.messages.m2 = assistant('m2', [{ id: 'p1', type: 'agent_call', status: 'drafting', artifact_id: 'a7', kind: 'page' }])
      agent.paths.c = ['m2']
      pane.bindChat('c')
      expect(pane.activeId).toBe('artifact:a7')
      agent.messages.m2.parts[0] = { id: 'p1', type: 'agent_call', status: 'done', artifact_id: 'a7', version: 1, kind: 'page' }
      await nextTick()
      pane.closeTab('artifact:a7')
      expect(pane.open).toBe(false)

      // A later turn revises it.
      agent.messages.m4 = assistant('m4', [{ id: 'p9', type: 'agent_call', status: 'planning', artifact_id: 'a7', kind: 'page' }])
      agent.paths.c = ['m2', 'm4']
      await nextTick()
      expect(pane.activeId).toBe('artifact:a7')
      expect(pane.open).toBe(true)
      expect(pane.artifactCall('a7')).toMatchObject({ status: 'planning', active: true, saved: true })
    })

    it('moves the new chat state to its id', () => {
      vi.useFakeTimers()
      pane.bindChat('new')
      pane.openUrl('https://example.com/')
      pane.rekeyChat('new', 'c42')
      expect(pane.chatKey).toBe('c42')
      expect(pane.tabs).toHaveLength(1)
      const stored = JSON.parse(localStorage.getItem(TABS_KEY))
      expect(stored.chats.c42.state.tabs[0].url).toBe('https://example.com/')
    })

    it('does not open the pane for the agent where it would cover the chat', () => {
      pane.setLayout('overlay')
      pane.openSerp(serpSpec('a'), { activate: true })
      expect(pane.activeId).toBe('serp:a')
      expect(pane.open).toBe(false)
      expect(pane.attention).toBe(true)

      pane.setOpen(true)
      expect(pane.open).toBe(true)
      expect(pane.attention).toBe(false)
      // Opened by the user, it stays open as an overlay.
      pane.setLayout('overlay')
      expect(pane.open).toBe(true)
    })

    it('closes a pane the agent opened once the layout turns out to be an overlay', () => {
      pane.openSerp(serpSpec('a'), { activate: true })
      expect(pane.open).toBe(true)
      pane.setLayout('overlay')
      expect(pane.open).toBe(false)
      expect(pane.attention).toBe(true)

      pane.setLayout('split')
      pane.openSerp(serpSpec('b'), { activate: true })
      expect(pane.open).toBe(true)
      expect(pane.attention).toBe(false)
    })

    it('resets when the project changes', () => {
      pane.bindChat('c')
      pane.openUrl('https://example.com/')
      agent.websiteId = 'w2'
      expect(pane.tabs).toHaveLength(0)
      expect(pane.chatKey).toBe(null)
    })
  })

  describe('research agents', () => {
    const PAGE_CAPTURE = {
      capture_id: 'pg1',
      url: 'https://notely.test/',
      final_url: 'https://notely.test/',
      frameable: true,
      status_code: 200,
      seo: { title: 'Notely: notes for teams' },
      error: null,
    }

    // A finished swarm whose agents took one Google page and one page (read
    // twice); the Claude agent failed without a capture.
    function swarmPart(overrides = {}) {
      return {
        id: 'p4',
        type: 'swarm',
        swarm_id: 's1',
        version: 1,
        status: 'done',
        tasks: [
          {
            id: 'google.p1.page1',
            status: 'done',
            pane: { kind: 'serp', tab_id: 'serp:c1' },
            detail: { query: 'best note app', page: 2, location: 'us' },
          },
          {
            id: 'competitors.p1.c1',
            status: 'done',
            pane: { kind: 'page', tab_id: 'page:pg1' },
            detail: { url: 'https://notely.test/', title: 'Notely' },
          },
          { id: 'engines.p1.claude', status: 'failed', pane: null, error: { code: 'rate_limited', message: 'Busy' } },
          { id: 'site.p1.page', status: 'done', pane: { kind: 'page', tab_id: 'page:pg1' }, detail: { url: 'https://notely.test/' } },
        ],
        ...overrides,
      }
    }

    function seedSwarmChat(chatId, part = swarmPart(), research = { serp: { c1: serpCapture() }, pages: { pg1: PAGE_CAPTURE } }) {
      agent.messages.m1 = { id: 'm1', role: 'user', parts: [{ id: 'p0', type: 'text', text: 'Research' }] }
      agent.messages.m2 = { ...assistant('m2', [part], research), status: 'complete' }
      agent.paths[chatId] = ['m1', 'm2']
      agent.chatState[chatId] = { loaded: true }
    }

    it('opens one results table tab per swarm and switches its version', () => {
      expect(pane.openTable('s1', { version: 2, title: 'Research Notion' })).toBe('table:s1')
      expect(pane.activeTab).toMatchObject({ id: 'table:s1', kind: 'table', swarmId: 's1', version: 2, status: 'ready' })
      expect(pane.open).toBe(true)
      expect(pane.titleOf(pane.activeTab)).toBe('Research Notion')

      // Again: the same tab, now on the latest version, keeping its title.
      expect(pane.openTable('s1')).toBe('table:s1')
      expect(pane.tabs).toHaveLength(1)
      expect(pane.activeTab).toMatchObject({ version: null, title: 'Research Notion' })

      pane.openTable('s2', { activate: false })
      expect(pane.tabs.map((t) => t.id)).toEqual(['table:s1', 'table:s2'])
      expect(pane.activeId).toBe('table:s1')
      expect(pane.titleOf(pane.tabs[1])).toBe('Research results')
      pane.updateTab('table:s2', { version: 3 })
      expect(pane.tabs[1].version).toBe(3)
      expect(pane.openTable('')).toBe(null)
      expect(pane.openTable(null)).toBe(null)
    })

    it('persists results table tabs by swarm and version, and restores them ready', async () => {
      vi.useFakeTimers()
      agent.paths.c = []
      agent.chatState.c = { loaded: true }
      pane.bindChat('c')
      pane.openTable('s1', { version: 2, title: 'Research Notion' })
      pane.openTable('s2')
      await nextTick()
      vi.advanceTimersByTime(200)

      const state = JSON.parse(localStorage.getItem(TABS_KEY)).chats.c.state
      expect(state.tabs).toEqual([
        { id: 'table:s1', kind: 'table', swarm_id: 's1', version: 2 },
        { id: 'table:s2', kind: 'table', swarm_id: 's2', version: null },
      ])
      expect(state.active).toBe('table:s2')

      pane.bindChat('other')
      expect(pane.tabs).toHaveLength(0)
      pane.bindChat('c')
      expect(pane.tabs.map((t) => [t.id, t.kind, t.swarmId, t.version, t.status])).toEqual([
        ['table:s1', 'table', 's1', 2, 'ready'],
        ['table:s2', 'table', 's2', null, 'ready'],
      ])
      expect(pane.activeId).toBe('table:s2')
      expect(pane.titleOf(pane.tabs[0])).toBe('Research results')
    })

    it('derives the agents\' captures only when asked: first occurrence, never opened by itself', () => {
      seedSwarmChat('c')
      expect(researchTabs(agent.visiblePath('c'))).toEqual([])
      const specs = researchTabs(agent.visiblePath('c'), { includeSwarm: true })
      expect(specs.map((s) => [s.id, s.kind, s.status, s.auto])).toEqual([
        ['serp:c1', 'serp', 'ready', false],
        ['page:pg1', 'page', 'ready', false],
      ])
      expect(specs[0].title).toBe('Google · best note app · p2')
      expect(specs[1].title).toBe('Notely: notes for teams')
    })

    it('never adds an agent capture to the pane on its own, on load or while the swarm runs', async () => {
      const running = swarmPart({ status: 'running' })
      running.tasks = running.tasks.map((t) => ({ ...t, status: 'running', pane: null }))
      seedSwarmChat('c', running, { serp: {}, pages: {} })
      agent.messages.m2.status = 'streaming'
      pane.bindChat('c')
      expect(pane.tabs).toHaveLength(0)

      // The agents finish and name their captures.
      agent.messages.m2.research = { serp: { c1: serpCapture() }, pages: { pg1: PAGE_CAPTURE } }
      agent.messages.m2.parts = [swarmPart()]
      agent.messages.m2.status = 'complete'
      await nextTick()
      expect(pane.tabs).toHaveLength(0)
      expect(pane.open).toBe(false)

      // A chat loaded with a finished swarm opens nothing either.
      pane.bindChat('other')
      seedSwarmChat('d')
      pane.bindChat('d')
      expect(pane.tabs).toHaveLength(0)
      expect(pane.open).toBe(false)
    })

    it('openCapture opens a capture that only a research agent names', () => {
      seedSwarmChat('c')
      pane.bindChat('c')
      expect(pane.openCapture('serp:c1')).toBe('serp:c1')
      expect(pane.activeTab).toMatchObject({ id: 'serp:c1', kind: 'serp', status: 'ready' })
      expect(pane.activeTab.data.results).toHaveLength(3)
      expect(pane.titleOf(pane.activeTab)).toBe('Google · best note app · p2')
      expect(pane.open).toBe(true)

      expect(pane.openCapture('page:pg1', { activate: false })).toBe('page:pg1')
      const page = pane.tabs.find((t) => t.id === 'page:pg1')
      expect(page).toMatchObject({ kind: 'page', status: 'ready', url: 'https://notely.test/', finalUrl: 'https://notely.test/' })
      expect(pane.activeId).toBe('serp:c1')

      // Again: the open tab is activated, not duplicated.
      expect(pane.openCapture('page:pg1')).toBe('page:pg1')
      expect(pane.tabs).toHaveLength(2)
      expect(pane.activeId).toBe('page:pg1')

      // Closed, it reopens from the research store.
      pane.closeTab('serp:c1')
      expect(pane.activateTab('serp:c1')).toBe('serp:c1')
      expect(pane.activeTab.data.query).toBe('best note app')
    })

    it('openCapture opens any capture in the chat research, and refuses the rest', () => {
      seedSwarmChat('c', swarmPart({ tasks: [] }), {
        serp: { c9: serpCapture({ capture_id: 'c9', query: 'notion alternatives', page: 1 }) },
        pages: {},
      })
      pane.bindChat('c')
      expect(pane.openCapture('serp:c9')).toBe('serp:c9')
      expect(pane.activeTab).toMatchObject({ kind: 'serp', status: 'ready' })
      expect(pane.titleOf(pane.activeTab)).toBe('Google · notion alternatives · p1')

      for (const id of ['serp:missing', 'page:', 'table:s1', 'artifact:a1', 'c9', '', null]) {
        expect(pane.openCapture(id)).toBe(null)
      }
      expect(pane.tabs).toHaveLength(1)
    })

    it('openCapture needs a bound chat', () => {
      seedSwarmChat('c')
      expect(pane.openCapture('serp:c1')).toBe(null)
      expect(pane.tabs).toHaveLength(0)
    })

    it('keeps restored tabs of agent captures instead of marking them gone', () => {
      localStorage.setItem(
        TABS_KEY,
        JSON.stringify({
          v: 1,
          chats: {
            c: {
              at: 1,
              state: {
                open: true,
                active: 'serp:c1',
                tabs: [
                  { id: 'serp:c1', kind: 'serp' },
                  { id: 'page:pg1', kind: 'page' },
                  { id: 'page:old', kind: 'page' },
                ],
              },
            },
          },
        })
      )
      seedSwarmChat('c')
      pane.bindChat('c')
      expect(pane.tabs.map((t) => [t.id, t.status])).toEqual([
        ['serp:c1', 'ready'],
        ['page:pg1', 'ready'],
        ['page:old', 'gone'],
      ])
      expect(pane.tabs[0].data.results).toHaveLength(3)
      expect(pane.tabs[1].url).toBe('https://notely.test/')
      expect(pane.activeId).toBe('serp:c1')
    })

    it('fills a restored agent capture tab once the task names its capture', async () => {
      localStorage.setItem(
        TABS_KEY,
        JSON.stringify({ v: 1, chats: { c: { at: 1, state: { open: false, active: 'serp:c1', tabs: [{ id: 'serp:c1', kind: 'serp' }] } } } })
      )
      const running = swarmPart({ status: 'running' })
      running.tasks = running.tasks.map((t) => ({ ...t, pane: null }))
      seedSwarmChat('c', running, { serp: { c1: serpCapture() }, pages: {} })
      agent.chatState.c = { loaded: false }
      pane.bindChat('c')
      expect(pane.tabs[0].status).toBe('missing')

      agent.messages.m2.parts = [swarmPart()]
      agent.chatState.c = { loaded: true }
      await nextTick()
      expect(pane.tabs[0]).toMatchObject({ id: 'serp:c1', status: 'ready' })
      expect(pane.tabs[0].data.query).toBe('best note app')
    })
  })
})
