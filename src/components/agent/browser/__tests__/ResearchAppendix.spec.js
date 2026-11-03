import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResearchAppendix from '../views/ResearchAppendix.vue'
import { serpCapture } from './__fixtures__/stores.js'

function render(data) {
  return mount(ResearchAppendix, { props: { data, expanded: true } })
}

describe('ResearchAppendix', () => {
  it('keeps the reason an engine check failed or was not available', () => {
    const wrapper = render({
      serp: [],
      pages: [],
      engines: [
        { id: 'e1', prompt_text: 'best note app', engine: 'chatgpt', engine_label: 'ChatGPT', status: 'unavailable', error: 'OPENAI_API_KEY is not set' },
        { id: 'e2', prompt_text: 'best note app', engine: 'perplexity', engine_label: 'Perplexity', status: 'error', error: 'The engine did not answer.' },
        { id: 'e3', prompt_text: 'best note app', engine: 'claude', engine_label: 'Claude', status: 'error', error: 'Stopped' },
        { id: 'e4', prompt_text: 'best note app', engine: 'gemini', engine_label: 'Gemini', status: 'error', error: { message: 'Rate limited' } },
        { id: 'e5', prompt_text: 'best note app', engine: 'grok', engine_label: 'Grok', status: 'error', error: null },
      ],
    })
    const results = wrapper.findAll('tbody tr').map((row) => row.findAll('td')[2].text())
    expect(results).toEqual([
      'Not available: OPENAI_API_KEY is not set',
      'Error: The engine did not answer.',
      'Error: Stopped',
      'Error: Rate limited',
      'Error',
    ])
  })

  it('never turns an AI Overview that was not measured into a no', () => {
    const wrapper = render({
      engines: [],
      pages: [],
      serp: [
        serpCapture({ capture_id: 's1', ai_overview: { shown: true, captured: false, mentions_you: null, cites_you: null, references: [] } }),
        serpCapture({ capture_id: 's2', ai_overview: { shown: true, mentions_you: true, cites_you: null, references: [] } }),
        serpCapture({ capture_id: 's3', ai_overview: { shown: true, mentions_you: false, cites_you: true, references: [] } }),
      ],
    })
    const lines = wrapper.findAll('.ag-apx-line').map((p) => p.text()).filter((t) => t.startsWith('AI Overview'))
    expect(lines).toEqual([
      'AI Overview: shown, but its content was not captured, so mentions and citations were not measured.',
      'AI Overview: mentions you yes, cites you not measured.',
      'AI Overview: mentions you no, cites you yes.',
    ])
  })
})
