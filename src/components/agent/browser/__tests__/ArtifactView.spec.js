import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'

vi.mock('@/stores/agent', async () => {
  const m = await import('./__fixtures__/stores.js')
  return { useAgentStore: m.useAgentStore }
})
vi.mock('@/stores/auth', async () => {
  const m = await import('./__fixtures__/stores.js')
  return { useAuthStore: m.useAuthStore }
})
vi.mock('@/composables/agent/useBrowse', () => ({ useBrowse: () => ({ load: () => {} }) }))

import ArtifactView from '../views/ArtifactView.vue'
import PaneHeader from '../PaneHeader.vue'
import { useArtifactSource } from '../useArtifactSource'
import { useAgentStore } from '@/stores/agent'
import { PREVIEW_CSP } from '@/lib/agent/srcdoc'
import { serpCapture } from './__fixtures__/stores.js'

// The artifact view, with the pane header when `header` is set. `call` is
// what the chat knows about the agent call writing the artifact.
const Harness = defineComponent({
  props: {
    artifactId: { type: String, required: true },
    version: { type: Number, default: null },
    call: { type: Object, default: null },
    header: { type: Boolean, default: false },
  },
  emits: ['version'],
  setup(props, { emit }) {
    const source = useArtifactSource(
      () => props.artifactId,
      () => props.version,
      { call: () => props.call }
    )
    const tab = { id: `artifact:${props.artifactId}`, kind: 'artifact', artifactId: props.artifactId, title: '', status: 'ready' }
    return () =>
      h('div', [
        props.header ? h(PaneHeader, { tab, source }) : null,
        h(ArtifactView, { source, onVersion: (v) => emit('version', v) }),
      ])
  },
})

function failWith(status) {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

function campaign(overrides = {}) {
  return {
    campaign: { name: 'Battery care', platform: 'google_search', final_url: 'https://shop.test/battery' },
    ad_groups: [
      {
        name: 'Range',
        keywords: [{ text: 'ebike battery range', match: 'exact' }],
        negatives: ['free'],
        ads: [
          {
            headlines: ['Longer rides start here', 'x'.repeat(31), 'Battery care guide'],
            descriptions: ['Learn how to keep your battery healthy.', 'Simple habits.'],
            path1: 'battery',
            path2: 'care',
          },
        ],
      },
    ],
    sitelinks: [{ text: 'Charging guide', url: 'https://shop.test/charging' }],
    warnings: [{ path: 'ad_groups[0].ads[0].headlines[1]', message: 'Headline is over 30 characters.' }],
    ...overrides,
  }
}

describe('ArtifactView', () => {
  let agent

  beforeEach(() => {
    setActivePinia(createPinia())
    agent = useAgentStore()
  })

  it('previews a drafting page in sandboxed frames with the injected CSP', async () => {
    agent.artifacts.a1 = {
      id: 'a1',
      kind: 'page',
      title: 'Battery landing page',
      draft: { status: 'drafting', kind: 'page', title: 'Battery landing page', content: '<h1>More rides.</h1>' },
    }
    const wrapper = mount(Harness, { props: { artifactId: 'a1' } })
    await nextTick()
    const frames = wrapper.findAll('iframe')
    expect(frames).toHaveLength(2)
    for (const frame of frames) {
      expect(frame.attributes('sandbox')).toBe('')
      expect(frame.attributes('referrerpolicy')).toBe('no-referrer')
    }
    const visible = frames.find((f) => f.classes().includes('is-front'))
    expect(visible.attributes('srcdoc')).toContain(PREVIEW_CSP)
    expect(visible.attributes('srcdoc')).toContain('More rides.')
    expect(wrapper.find('.ag-pav').attributes('aria-busy')).toBe('true')
    expect(agent.loadCalls).toHaveLength(0)
  })

  it('loads the saved copy when it is missing', async () => {
    agent.artifacts.a2 = { id: 'a2', kind: 'document', title: 'Guide', draft: null }
    const wrapper = mount(Harness, { props: { artifactId: 'a2' } })
    await flushPromises()
    expect(agent.loadCalls[0]).toEqual(['a2', null])
    expect(wrapper.text()).toContain('Loading…')
  })

  it('renders a saved Markdown document', async () => {
    agent.artifacts.a3 = { id: 'a3', kind: 'document', title: 'Guide', version: 1, content: '# Battery care\n\nKeep it cool.' }
    const wrapper = mount(Harness, { props: { artifactId: 'a3' } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(wrapper.find('.ag-doc h1').text()).toBe('Battery care')
    expect(wrapper.find('.ag-doc').text()).toContain('Keep it cool.')
  })

  it('appends the research data to a report', async () => {
    agent.artifacts.a4 = {
      id: 'a4',
      kind: 'report',
      title: 'Report',
      version: 1,
      content: '# Turonote report',
      data: {
        serp: [serpCapture()],
        engines: [
          { id: 'e1', prompt_text: 'best note app', engine: 'claude', engine_label: 'Claude', status: 'done', mentioned: true, rank: 3 },
          { id: 'e2', prompt_text: 'best note app', engine: 'grok', engine_label: 'Grok', status: 'unavailable' },
        ],
        pages: [],
      },
    }
    const wrapper = mount(Harness, { props: { artifactId: 'a4' } })
    await flushPromises()
    const toggle = wrapper.find('.ag-apx-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.text()).toContain('1 Google page · 2 engine checks')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const text = wrapper.find('.ag-apx-body').text()
    expect(text).toContain('Turonote ranked #14.')
    expect(text).toContain('Named')
    expect(text).toContain('#3')
    expect(text).toContain('Not available')
  })

  it('shows the ad campaign with limit flags and warnings', async () => {
    agent.artifacts.a5 = { id: 'a5', kind: 'sheet', title: 'Ads', version: 1, content: JSON.stringify(campaign()) }
    const wrapper = mount(Harness, { props: { artifactId: 'a5' } })
    await flushPromises()
    expect(wrapper.find('.ag-sheet-warn').text()).toContain('Ad group 1 › Ad 1 › Headline 2')
    const over = wrapper.findAll('tr.is-over')
    expect(over).toHaveLength(1)
    expect(over[0].text()).toContain('31/30')
    expect(wrapper.text()).toContain('[ebike battery range]')
    expect(wrapper.text()).toContain('shop.test/battery/care')
    expect(wrapper.text()).toContain('Google Search')
  })

  it('reads a streaming sheet snapshot from the draft', async () => {
    agent.artifacts.a6 = {
      id: 'a6',
      kind: 'sheet',
      draft: { status: 'drafting', kind: 'sheet', data: { campaign: { name: 'Partial' }, ad_groups: [] }, content: '' },
    }
    const wrapper = mount(Harness, { props: { artifactId: 'a6' } })
    await nextTick()
    expect(wrapper.text()).toContain('Writing the campaign…')
    expect(wrapper.text()).toContain('Partial')
  })

  it('explains a failed draft honestly', async () => {
    agent.artifacts.a7 = {
      id: 'a7',
      kind: 'page',
      draft: { status: 'failed', kind: 'page', content: '<h1>half', error: { code: 'truncated', message: 'The page was cut off.' } },
    }
    const wrapper = mount(Harness, { props: { artifactId: 'a7' } })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain("The agent couldn't finish this draft.")
    expect(wrapper.text()).toContain('The page was cut off.')
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('shows an older version with a way back to the latest', async () => {
    agent.artifacts.a8 = {
      id: 'a8',
      kind: 'document',
      title: 'Guide',
      version: 2,
      latest_version: 2,
      content: '# Version two',
      byVersion: { 1: { version: 1, content: '# Version one' } },
    }
    const wrapper = mount(Harness, { props: { artifactId: 'a8', version: 1 } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(wrapper.find('.ag-doc h1').text()).toBe('Version one')
    expect(wrapper.find('.ag-artv-notice').text()).toContain('Viewing version 1 of 2.')
    await wrapper.find('.ag-artv-notice-btn').trigger('click')
    expect(wrapper.emitted('version')[0]).toEqual([null])
  })

  it('keeps a finished draft out of exports and retries its saved copy until it loads', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      agent.artifacts.p1 = {
        id: 'p1',
        kind: 'page',
        title: 'Battery page',
        draft: {
          status: 'done',
          kind: 'page',
          title: 'Battery page',
          version: 1,
          content: '<h1>Raw draft</h1><form action="https://collector.test/lead"></form>',
          warnings: [{ path: 'form', message: 'Removed a form action.' }],
        },
      }
      let calls = 0
      agent.loadArtifact = vi.fn(async () => {
        calls += 1
        if (calls < 3) throw failWith(502)
        Object.assign(agent.artifacts.p1, { version: 1, content: '<h1>Checked page</h1>', draft: null })
        return agent.artifacts.p1
      })
      const wrapper = mount(Harness, { props: { artifactId: 'p1', header: true } })
      await flushPromises()
      expect(calls).toBe(1)
      expect(wrapper.find('.ag-export').attributes('aria-disabled')).toBe('true')
      expect(wrapper.find('.ag-artv-notice').text()).toBe('Draft finished. Loading the saved version…')

      await vi.advanceTimersByTimeAsync(1000)
      expect(calls).toBe(2)
      await vi.advanceTimersByTimeAsync(2000)
      expect(calls).toBe(3)
      await flushPromises()
      expect(wrapper.find('.ag-export').attributes('aria-disabled')).toBeUndefined()
      expect(wrapper.findAll('iframe').some((f) => f.attributes('srcdoc').includes('Checked page'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('says when the saved copy behind a finished draft will not load', async () => {
    agent.artifacts.p2 = {
      id: 'p2',
      kind: 'page',
      draft: { status: 'done', kind: 'page', version: 2, content: '<h1>Raw draft</h1>', warnings: [{ path: 'img', message: 'x' }] },
    }
    agent.loadArtifact = vi.fn(async () => {
      throw failWith(403)
    })
    const wrapper = mount(Harness, { props: { artifactId: 'p2', header: true } })
    await flushPromises()
    expect(agent.loadArtifact).toHaveBeenCalledTimes(1)
    const notice = wrapper.find('.ag-artv-notice')
    expect(notice.text()).toContain('This is the unchecked draft, and export is off until the saved version loads.')
    expect(wrapper.text()).not.toContain('checked for safety')
    expect(wrapper.find('.ag-export').attributes('aria-disabled')).toBe('true')
    await notice.find('.ag-artv-notice-btn').trigger('click')
    expect(agent.loadArtifact).toHaveBeenCalledTimes(2)
  })

  it('tells a draft the agent never saved from an item that was deleted', async () => {
    agent.loadArtifact = vi.fn(async () => {
      throw failWith(404)
    })
    const unsaved = { status: 'error', active: false, saved: false, error: 'The page is incomplete.', kind: 'page', title: 'Acme' }
    const never = mount(Harness, { props: { artifactId: 'gone1', call: unsaved } })
    await flushPromises()
    expect(never.find('[role="alert"]').text()).toContain("This draft wasn't saved.")
    expect(never.find('[role="alert"]').text()).toContain('The page is incomplete.')
    expect(never.text()).not.toContain('deleted')
    expect(never.find('.ag-perr-btn').exists()).toBe(false)

    const deleted = mount(Harness, { props: { artifactId: 'gone2', call: { ...unsaved, status: 'done', saved: true } } })
    await flushPromises()
    expect(deleted.find('[role="alert"]').text()).toContain('It was deleted, or you no longer have access to it.')
    expect(deleted.find('.ag-perr-btn').exists()).toBe(true)
  })

  it('waits for a draft that is still starting instead of calling it deleted', async () => {
    agent.loadArtifact = vi.fn(async () => {
      throw failWith(404)
    })
    const call = { status: 'planning', active: true, saved: false, error: '', kind: 'page', title: 'Acme website' }
    const wrapper = mount(Harness, { props: { artifactId: 'new1', call, header: true } })
    await flushPromises()
    expect(wrapper.find('.ag-artv-state').text()).toBe('Starting the draft…')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.ag-ph-title-text').text()).toBe('Acme website')

    await wrapper.setProps({ call: { ...call, status: 'cancelled', active: false, error: 'Stopped' } })
    await flushPromises()
    expect(agent.loadArtifact).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').text()).toContain("This draft wasn't saved.")
  })

  it('does not show a draft picked up mid-stream, which holds only its tail', async () => {
    agent.artifacts.t1 = {
      id: 't1',
      kind: 'page',
      draft: { status: 'drafting', kind: 'page', content: '<p>end of the page</p></body></html>', partial: true },
    }
    const wrapper = mount(Harness, { props: { artifactId: 't1' } })
    await nextTick()
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('.ag-artv-state').text()).toBe('Drafting… It shows here when the draft is finished.')
  })

  it('stops treating a draft as live once its agent call has ended', async () => {
    // The run stopped without the draft's own end event reaching this tab.
    agent.artifacts.s1 = { id: 's1', kind: 'page', draft: { status: 'drafting', kind: 'page', content: '<h1>Half a page' } }
    const stopped = { status: 'cancelled', active: false, saved: false, error: 'Stopped', kind: 'page', title: 'Acme' }
    const wrapper = mount(Harness, { props: { artifactId: 's1', call: stopped, header: true } })
    await flushPromises()
    expect(wrapper.find('.ag-ph-status').text()).toBe('Draft failed')
    expect(wrapper.find('[role="alert"]').text()).toContain("The agent couldn't finish this draft.")
    expect(wrapper.find('[role="alert"]').text()).toContain('Stopped')

    // A call that finished: the saved copy is what shows.
    agent.artifacts.s2 = {
      id: 's2',
      kind: 'page',
      version: 1,
      content: '<h1>Saved page</h1>',
      draft: { status: 'drafting', kind: 'page', content: '<h1>Half a page' },
    }
    const done = mount(Harness, { props: { artifactId: 's2', call: { ...stopped, status: 'done', saved: true, error: '' } } })
    await flushPromises()
    const docs = done.findAll('iframe').map((f) => f.attributes('srcdoc'))
    expect(docs.some((d) => d.includes('Saved page'))).toBe(true)
    expect(docs.some((d) => d.includes('Half a page'))).toBe(false)
  })
})
