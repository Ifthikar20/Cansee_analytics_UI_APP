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

import ArtifactView from '../views/ArtifactView.vue'
import { useArtifactSource } from '../useArtifactSource'
import { useAgentStore } from '@/stores/agent'
import { PREVIEW_CSP } from '@/lib/agent/srcdoc'
import { serpCapture } from './__fixtures__/stores.js'

const Harness = defineComponent({
  props: { artifactId: { type: String, required: true }, version: { type: Number, default: null } },
  emits: ['version'],
  setup(props, { emit }) {
    const source = useArtifactSource(
      () => props.artifactId,
      () => props.version
    )
    return () => h(ArtifactView, { source, onVersion: (v) => emit('version', v) })
  },
})

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
})
