import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAgentUiStore } from '@/stores/agentUi'

const PREFS_KEY = 'cs-agent-ui-v1'

function freshStore() {
  setActivePinia(createPinia())
  return useAgentUiStore()
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('agentUi preferences', () => {
  it('persists sidebar and recents collapse in cs-agent-ui-v1 and reads them back', () => {
    const ui = freshStore()
    ui.setSidebarCollapsed(true)
    ui.toggleRecents()
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY))
    expect(saved).toMatchObject({ sidebarCollapsed: true, recentsCollapsed: true })

    const again = freshStore()
    expect(again.sidebarCollapsed).toBe(true)
    expect(again.recentsCollapsed).toBe(true)
  })

  it('keeps other fields of the shared prefs object', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ paneRatio: 0.6 }))
    const ui = freshStore()
    ui.setSidebarCollapsed(true)
    expect(JSON.parse(localStorage.getItem(PREFS_KEY))).toEqual({ paneRatio: 0.6, sidebarCollapsed: true })
  })

  it('starts from defaults when the stored value is corrupt', () => {
    localStorage.setItem(PREFS_KEY, '{not json')
    const ui = freshStore()
    expect(ui.sidebarCollapsed).toBe(false)
    expect(ui.recentsCollapsed).toBe(false)
  })

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const ui = freshStore()
    expect(() => ui.setSidebarCollapsed(true)).not.toThrow()
    expect(ui.sidebarCollapsed).toBe(true)
  })
})

describe('agentUi sidebar', () => {
  it('collapses the docked sidebar and toggles the drawer when narrow', () => {
    const ui = freshStore()
    ui.setDocked(true)
    expect(ui.sidebarVisible).toBe(true)
    expect(ui.showSidebarToggle).toBe(false)
    ui.toggleSidebar()
    expect(ui.sidebarCollapsed).toBe(true)
    expect(ui.sidebarVisible).toBe(false)
    expect(ui.showSidebarToggle).toBe(true)

    ui.setDocked(false)
    expect(ui.showSidebarToggle).toBe(true)
    expect(ui.drawerOpen).toBe(false)
    ui.toggleSidebar()
    expect(ui.drawerOpen).toBe(true)
    expect(ui.sidebarVisible).toBe(true)
    // The docked preference is untouched by the drawer.
    expect(ui.sidebarCollapsed).toBe(true)
  })

  it('closes the drawer when the layout becomes wide', () => {
    const ui = freshStore()
    ui.setDocked(false)
    ui.openDrawer()
    ui.setDocked(true)
    expect(ui.drawerOpen).toBe(false)
  })

  it('openSearch reveals the sidebar, expands recents and opens the filter', () => {
    const ui = freshStore()
    ui.setDocked(true)
    ui.setSidebarCollapsed(true)
    ui.setRecentsCollapsed(true)
    const before = ui.searchRequest
    ui.openSearch()
    expect(ui.sidebarCollapsed).toBe(false)
    expect(ui.recentsCollapsed).toBe(false)
    expect(ui.filterOpen).toBe(true)
    expect(ui.searchRequest).toBe(before + 1)
  })
})

describe('agentUi unseen chats and activity', () => {
  it('marks and clears unseen chats by id', () => {
    const ui = freshStore()
    ui.markUnseen(42)
    expect(ui.isUnseen('42')).toBe(true)
    ui.markSeen('42')
    expect(ui.isUnseen(42)).toBe(false)
  })

  it('only moves the activity watermark forward', () => {
    const ui = freshStore()
    ui.markActivitySeen('w1', '2026-11-02T10:00:00Z')
    ui.markActivitySeen('w1', '2026-11-01T10:00:00Z')
    expect(ui.activitySeenAtFor('w1')).toBe('2026-11-02T10:00:00Z')
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)).activitySeenAt).toEqual({ w1: '2026-11-02T10:00:00Z' })
  })
})

describe('agentUi.announce', () => {
  it('routes by politeness and normalises whitespace', () => {
    const ui = freshStore()
    ui.announce('  Agent   is working ')
    expect(ui.politeAnnouncement.text).toBe('Agent is working')
    ui.announce('The agent stopped with an error.', 'assertive')
    expect(ui.assertiveAnnouncement.text).toBe('The agent stopped with an error.')
  })

  it('drops an identical message inside 1.5 s and clears text later', () => {
    vi.useFakeTimers()
    const ui = freshStore()
    expect(ui.announce('Chat deleted')).toBe(true)
    const id = ui.politeAnnouncement.id
    expect(ui.announce('Chat deleted')).toBe(false)
    expect(ui.politeAnnouncement.id).toBe(id)
    vi.advanceTimersByTime(1600)
    expect(ui.announce('Chat deleted')).toBe(true)
    expect(ui.politeAnnouncement.id).toBe(id + 1)
    vi.advanceTimersByTime(8000)
    expect(ui.politeAnnouncement.text).toBe('')
  })

  it('ignores empty text', () => {
    const ui = freshStore()
    expect(ui.announce('   ')).toBe(false)
    expect(ui.announce(null)).toBe(false)
  })
})

describe('agentUi.focusComposer', () => {
  it('prefers the latest registered handler', async () => {
    const ui = freshStore()
    const first = vi.fn(() => true)
    const second = vi.fn(() => true)
    ui.registerComposer(first)
    const off = ui.registerComposer(second)
    await expect(ui.focusComposer()).resolves.toBe(true)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    off()
    await ui.focusComposer()
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('falls back to the composer textarea in the DOM', async () => {
    const ui = freshStore()
    document.body.innerHTML = '<form class="ag-composer"><textarea></textarea></form>'
    await expect(ui.focusComposer()).resolves.toBe(true)
    expect(document.activeElement).toBe(document.querySelector('.ag-composer textarea'))
  })

  it('retries until the composer mounts', async () => {
    vi.useFakeTimers()
    const ui = freshStore()
    const done = ui.focusComposer()
    vi.advanceTimersByTime(120)
    document.body.innerHTML = '<form class="ag-composer"><textarea></textarea></form>'
    vi.advanceTimersByTime(60)
    await expect(done).resolves.toBe(true)
    expect(ui.composerFocusRequest).toBe(1)
  })

  it('gives up after about 1.5 s', async () => {
    vi.useFakeTimers()
    const ui = freshStore()
    const done = ui.focusComposer()
    vi.advanceTimersByTime(2000)
    await expect(done).resolves.toBe(false)
  })
})

describe('agentUi.reset', () => {
  it('closes dialogs and forgets unseen chats but keeps device prefs', () => {
    const ui = freshStore()
    ui.setSidebarCollapsed(true)
    ui.openShortcuts()
    ui.openAddProject()
    ui.markUnseen('c1')
    ui.reset()
    expect(ui.shortcutsOpen).toBe(false)
    expect(ui.addProjectOpen).toBe(false)
    expect(ui.isUnseen('c1')).toBe(false)
    expect(ui.sidebarCollapsed).toBe(true)
  })
})
