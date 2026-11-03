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

    it('resets when the project changes', () => {
      pane.bindChat('c')
      pane.openUrl('https://example.com/')
      agent.websiteId = 'w2'
      expect(pane.tabs).toHaveLength(0)
      expect(pane.chatKey).toBe(null)
    })
  })
})
