import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtifactCard from '@/components/agent/message/ArtifactCard.vue'

const base = { artifactId: 'a1', title: 'Spring landing page', kind: 'page', projectName: 'Wrenfield', live: true }

describe('ArtifactCard', () => {
  it('shows the planning line while the sub-agent plans, then drafting', async () => {
    const wrapper = mount(ArtifactCard, { props: { ...base, status: 'planning', progress: '  Outlining the hero  ' } })
    expect(wrapper.find('.ag-card-sub').text()).toBe('Outlining the hero')
    await wrapper.setProps({ status: 'drafting' })
    expect(wrapper.find('.ag-card-sub').text()).toBe('Drafting…')
    await wrapper.setProps({ status: 'planning', progress: '' })
    expect(wrapper.find('.ag-card-sub').text()).toBe('Drafting…')
  })

  it('names the project once done and reads string errors', async () => {
    const wrapper = mount(ArtifactCard, { props: { ...base, status: 'done', live: false, version: 2 } })
    expect(wrapper.find('.ag-card-sub').text()).toBe('Wrenfield website · v2')
    await wrapper.setProps({ status: 'error', error: 'Stopped' })
    expect(wrapper.find('.ag-card-sub').text()).toBe('Not finished: Stopped')
  })
})
