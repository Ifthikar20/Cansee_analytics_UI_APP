import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const post = vi.fn()
vi.mock('@/api/client', () => ({ default: { post: (...args) => post(...args) } }))

const warning = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ warning, error: vi.fn(), success: vi.fn() }),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const fetchSession = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ fetchSession, session: { next_route: 'dashboard' } }),
}))

import { provideOnboardingFlow } from '../useOnboardingFlow'

function setup() {
  let flow
  const Host = defineComponent({
    setup() {
      flow = provideOnboardingFlow({ onComplete: vi.fn() })
      return () => h('div')
    },
  })
  mount(Host)
  flow.form.value = {
    ...flow.form.value,
    url: 'https://notion.com',
    business_name: 'Notion',
    keywords: ['best note app', '  ', 'notion vs coda'],
    competitors: [{ name: 'Coda', domain: 'coda.io', selected: true }],
  }
  return flow
}

describe('onboarding finish', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    post.mockReset()
    warning.mockReset()
  })

  it('tracks the confirmed starter prompts on the new project', async () => {
    post.mockImplementation((url) => Promise.resolve(
      url === '/onboarding/save/' ? { data: { website_id: 'w1' } } : { data: { created_count: 2 } },
    ))
    const flow = setup()

    await flow.finish()
    await flushPromises()

    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[0][0]).toBe('/onboarding/save/')
    expect(post.mock.calls[1][0]).toBe('/prompt-library/websites/w1/prompts/')
    expect(post.mock.calls[1][1]).toEqual({ text: 'best note app\nnotion vs coda' })
    expect(warning).not.toHaveBeenCalled()
  })

  it('keeps the project and says so when the prompts cannot be added', async () => {
    post.mockImplementation((url) => (
      url === '/onboarding/save/'
        ? Promise.resolve({ data: { website_id: 'w1' } })
        : Promise.reject(new Error('boom'))
    ))
    const flow = setup()

    await flow.finish()
    await flushPromises()

    expect(warning).toHaveBeenCalledWith(
      "Your project is saved, but we couldn't add its starter prompts. Add them from the Overview.",
    )
    expect(fetchSession).toHaveBeenCalled()
  })

  it('adds nothing when no starter prompts were kept', async () => {
    post.mockResolvedValue({ data: { website_id: 'w1' } })
    const flow = setup()
    flow.form.value = { ...flow.form.value, keywords: [] }

    await flow.finish()

    expect(post).toHaveBeenCalledTimes(1)
  })
})
