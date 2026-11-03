import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('@/stores/agent', async () => {
  const m = await import('./__fixtures__/stores.js')
  return { useAgentStore: m.useAgentStore }
})
vi.mock('@/stores/auth', async () => {
  const m = await import('./__fixtures__/stores.js')
  return { useAuthStore: m.useAuthStore }
})

import TabStrip from '../TabStrip.vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentStore } from '@/stores/agent'
import { PANE_PANEL_ID, tabDomId } from '../ids'

function tabSpec(id, title) {
  return { id: `serp:${id}`, kind: 'serp', title, status: 'ready', data: { capture_id: id, query: title, results: [] } }
}

describe('TabStrip', () => {
  let pane
  let wrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    pane = useAgentPaneStore()
    pane.openSerp(tabSpec('a', 'alpha'))
    pane.openSerp(tabSpec('b', 'beta'))
    pane.openSerp(tabSpec('c', 'gamma'), { activate: true })
    wrapper = mount(TabStrip, { attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('renders a tablist with one selected, focusable tab tied to the panel', () => {
    const tabs = wrapper.findAll('[role="tab"]')
    expect(wrapper.find('[role="tablist"]').attributes('aria-label')).toBe('Browser tabs')
    expect(tabs).toHaveLength(3)
    const selected = tabs.filter((t) => t.attributes('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0].attributes('id')).toBe(tabDomId('serp:c'))
    expect(selected[0].attributes('aria-controls')).toBe(PANE_PANEL_ID)
    expect(tabs.map((t) => t.attributes('tabindex'))).toEqual(['-1', '-1', '0'])
    expect(wrapper.findAll('.ag-tab-close')[0].attributes('aria-hidden')).toBe('true')
  })

  it('moves focus with the arrow keys and activates with a click', async () => {
    const list = wrapper.find('[role="tablist"]')
    wrapper.findAll('[role="tab"]')[2].element.focus()
    await list.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(document.activeElement.id).toBe(tabDomId('serp:a'))
    await list.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(document.activeElement.id).toBe(tabDomId('serp:c'))
    expect(pane.activeId).toBe('serp:c')
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    expect(pane.activeId).toBe('serp:b')
  })

  it('closes the focused tab with Delete and keeps focus in the strip', async () => {
    const list = wrapper.find('[role="tablist"]')
    wrapper.findAll('[role="tab"]')[2].element.focus()
    await list.trigger('keydown', { key: 'Delete' })
    await nextTick()
    await nextTick()
    expect(pane.tabs.map((t) => t.id)).toEqual(['serp:a', 'serp:b'])
    expect(pane.activeId).toBe('serp:b')
    expect(document.activeElement.id).toBe(tabDomId('serp:b'))
  })

  it('closes a tab with its close button or a middle click', async () => {
    await wrapper.findAll('.ag-tab-close')[0].trigger('click')
    expect(pane.tabs.some((t) => t.id === 'serp:a')).toBe(false)
    await wrapper.findAll('.ag-tab')[0].trigger('auxclick', { button: 1 })
    expect(pane.tabs.map((t) => t.id)).toEqual(['serp:c'])
  })

  it('shows artifact titles from the agent store and opens a new tab', async () => {
    const agent = useAgentStore()
    agent.artifacts.a9 = { id: 'a9', kind: 'page', title: 'Battery landing page' }
    pane.openArtifact('a9')
    await nextTick()
    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toContain('Battery landing page')
    await wrapper.find('button[aria-label="New tab"]').trigger('click')
    expect(pane.activeTab.kind).toBe('newtab')
  })

  it('offers expand and hide controls', async () => {
    await wrapper.find('button[aria-label="Expand browser"]').trigger('click')
    expect(pane.expanded).toBe(true)
    await wrapper.find('button[aria-label="Hide browser"]').trigger('click')
    expect(wrapper.emitted('close-pane')).toHaveLength(1)
  })
})
