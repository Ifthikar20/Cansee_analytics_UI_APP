import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const fakeAgent = reactive({})
vi.mock('@/stores/agent', () => ({ useAgentStore: () => fakeAgent }))

const { default: AgentContextPage } = await import('../AgentContextPage.vue')

const Blank = defineComponent({ render: () => h('div', { class: 'blank' }) })
const mounted = []

const CONTEXT = {
  website_id: 'w1',
  audience: 'Commuters who ride e-bikes daily',
  voice: 'Plain and practical',
  offerings: [{ name: 'Battery care plan', description: 'Yearly check', url: 'https://example.com/care' }],
  rules: ['Never promise range figures'],
  revision: 4,
  updated_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  updated_by_name: 'Sam',
}

async function setup(context = CONTEXT, { failLoad = '' } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAppStore().setWebsites([{ id: 'w1', name: 'Wrenfield' }])
  Object.assign(fakeAgent, {
    websiteId: 'w1',
    context: null,
    loadContext: vi.fn(async () => {
      if (failLoad) throw Object.assign(new Error('x'), { name: 'AgentError', message: failLoad })
      return structuredClone(context)
    }),
    saveContext: vi.fn(async (payload) => ({
      ...payload,
      website_id: 'w1',
      revision: payload.revision + 1,
      updated_at: new Date().toISOString(),
      updated_by_name: 'You',
    })),
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:websiteId/agent/context', name: 'agent-context', component: AgentContextPage, props: true },
      { path: '/projects/:websiteId/agent/reports', name: 'agent-reports', component: Blank },
      { path: '/settings/brand-facts', name: 'settings-brand-facts', component: Blank },
      { path: '/settings/project', name: 'settings-project', component: Blank },
    ],
  })
  await router.push('/projects/w1/agent/context')
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

function saveButton(wrapper) {
  return wrapper.findAll('.ag-ctx-bar button').find((b) => b.text().startsWith('Sav'))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  document.body.innerHTML = ''
})

describe('AgentContextPage', () => {
  it('loads the context into the form with who saved it last', async () => {
    const { wrapper } = await setup()
    expect(fakeAgent.loadContext).toHaveBeenCalledTimes(1)
    expect(wrapper.find('#ag-ctx-audience').element.value).toBe(CONTEXT.audience)
    expect(wrapper.find('#ag-ctx-voice').element.value).toBe(CONTEXT.voice)
    expect(wrapper.findAll('.ag-ctx-offering')).toHaveLength(1)
    expect(wrapper.findAll('.ag-ctx-rule input')[0].element.value).toBe('Never promise range figures')
    expect(wrapper.find('.ag-ctx-state').text()).toBe('Saved by Sam 3 hours ago')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('a[href="/settings/brand-facts"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/settings/project"]').exists()).toBe(true)
  })

  it('starts blank for a project with no context yet', async () => {
    const { wrapper } = await setup({ website_id: 'w1', audience: '', voice: '', offerings: [], rules: [], revision: 0 })
    expect(wrapper.text()).toContain('No offerings added.')
    expect(wrapper.text()).toContain('No rules added.')
    expect(wrapper.find('.ag-ctx-state').text()).toBe('Not saved yet')
  })

  it('saves trimmed fields with the revision and drops empty rows', async () => {
    const { wrapper } = await setup()
    await wrapper.find('#ag-ctx-voice').setValue('  Warm, direct  ')
    expect(wrapper.find('.ag-ctx-state').text()).toBe('Unsaved changes')
    await wrapper.findAll('.ag-ctx-add').find((b) => b.text().includes('Add offering')).trigger('click')
    await wrapper.findAll('.ag-ctx-add').find((b) => b.text().includes('Add rule')).trigger('click')
    const offerings = wrapper.findAll('.ag-ctx-offering')
    expect(offerings).toHaveLength(2)
    await offerings[1].find('input[type="url"]').setValue('example.com/pro')
    await offerings[1].find('input[type="text"]').setValue('Pro plan')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(fakeAgent.saveContext).toHaveBeenCalledWith({
      audience: CONTEXT.audience,
      voice: 'Warm, direct',
      offerings: [
        { name: 'Battery care plan', description: 'Yearly check', url: 'https://example.com/care' },
        { name: 'Pro plan', description: '', url: 'https://example.com/pro' },
      ],
      rules: ['Never promise range figures'],
      revision: 4,
    })
    expect(wrapper.find('.ag-ctx-state').text()).toBe('Saved by You just now')
  })

  it('asks for a name when an offering has other details', async () => {
    const { wrapper } = await setup()
    await wrapper.findAll('.ag-ctx-add').find((b) => b.text().includes('Add offering')).trigger('click')
    const row = wrapper.findAll('.ag-ctx-offering')[1]
    await row.find('textarea').setValue('No name given')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(fakeAgent.saveContext).not.toHaveBeenCalled()
    expect(row.find('input[type="text"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Give this offering a name.')
    expect(wrapper.find('.ag-ctx-state').text()).toBe('Fix the highlighted fields, then save again.')
  })

  it('offers a reload when someone else saved first', async () => {
    const { wrapper } = await setup()
    fakeAgent.saveContext = vi.fn(async () => {
      throw Object.assign(new Error('stale'), { name: 'AgentError', status: 409, code: 'revision_conflict' })
    })
    await wrapper.find('#ag-ctx-audience').setValue('Changed')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    const banner = wrapper.find('.ag-ctx-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.attributes('role')).toBe('alert')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    await banner.find('button').trigger('click')
    await flushPromises()
    expect(fakeAgent.loadContext).toHaveBeenCalledTimes(2)
    expect(wrapper.find('#ag-ctx-audience').element.value).toBe(CONTEXT.audience)
    expect(wrapper.find('.ag-ctx-banner').exists()).toBe(false)
  })

  it('discards edits back to the saved version', async () => {
    const { wrapper } = await setup()
    await wrapper.find('#ag-ctx-audience').setValue('Something else')
    const discard = wrapper.findAll('.ag-ctx-bar button').find((b) => b.text() === 'Discard')
    await discard.trigger('click')
    expect(wrapper.find('#ag-ctx-audience').element.value).toBe(CONTEXT.audience)
    expect(wrapper.find('.ag-ctx-state').text()).toBe('Saved by Sam 3 hours ago')
  })

  it('confirms before leaving with unsaved edits', async () => {
    const { wrapper, router } = await setup()
    await wrapper.find('#ag-ctx-audience').setValue('Unsaved')
    await router.push('/projects/w1/agent/reports')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('agent-context')
    const dialog = document.body.querySelector('[role="alertdialog"]')
    expect(dialog.textContent).toContain('Leave without saving?')
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Leave').click()
    await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('agent-reports'))
  })

  it('leaves freely without edits', async () => {
    const { router } = await setup()
    await router.push('/projects/w1/agent/reports')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('agent-reports')
  })

  it('shows a load error with a retry', async () => {
    const { wrapper } = await setup(CONTEXT, { failLoad: 'The agent is turned off for this workspace.' })
    expect(wrapper.text()).toContain("Couldn't load the context.")
    expect(wrapper.text()).toContain('The agent is turned off for this workspace.')
    expect(wrapper.find('form').exists()).toBe(false)
    fakeAgent.loadContext = vi.fn(async () => structuredClone(CONTEXT))
    await wrapper.find('.ag-empty button').trigger('click')
    await flushPromises()
    expect(wrapper.find('#ag-ctx-audience').element.value).toBe(CONTEXT.audience)
  })
})
