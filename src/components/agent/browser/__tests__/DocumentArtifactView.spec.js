import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DocumentArtifactView from '@/components/agent/browser/views/DocumentArtifactView.vue'
import { loadHighlighter } from '@/lib/agent/markdown/renderer'

describe('DocumentArtifactView', () => {
  it('renders code plain first and highlights it when the highlighter arrives', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(DocumentArtifactView, {
      props: { markdown: '# Setup\n\n```js\nconst a = 1\n```\n', live: false, title: 'Setup' },
      global: { plugins: [pinia] },
    })
    expect(wrapper.find('h1').text()).toBe('Setup')
    expect(wrapper.find('code .hljs-keyword').exists()).toBe(false)

    expect(await loadHighlighter()).toBe(true)
    await flushPromises()
    expect(wrapper.find('code .hljs-keyword').exists()).toBe(true)
    expect(wrapper.find('code').text()).toBe('const a = 1')
    wrapper.unmount()
  })
})
