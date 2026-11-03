import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import WorkspaceSwitcher from '../WorkspaceSwitcher.vue'

enableAutoUnmount(afterEach)

const Blank = defineComponent({ render: () => h('div') })

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  app.setWebsites([
    { id: 'w1', name: 'Wrenfield' },
    { id: 'w2', name: 'Acme' },
  ])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Blank },
      { path: '/settings', name: 'settings', component: Blank },
      { path: '/settings/project', name: 'settings-project', component: Blank },
      { path: '/settings/usage-dashboard', name: 'settings-command-center', component: Blank },
      { path: '/billing', name: 'billing', component: Blank },
      { path: '/projects/:websiteId/agent', name: 'agent-home', component: Blank },
      { path: '/projects/:websiteId/agent/reports', name: 'agent-reports', component: Blank },
    ],
  })
  await router.push('/projects/w1/agent/reports')
  await router.isReady()
  const wrapper = mount(WorkspaceSwitcher, {
    props: { website: app.websites[0] },
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  })
  return { wrapper, router, app, auth: useAuthStore(), ui: useAgentUiStore() }
}

async function openMenu(wrapper) {
  await wrapper.find('button.ag-ws').trigger('click')
  await flushPromises()
  return document.body.querySelector('.ag-portal.ag-menu')
}

function item(menu, text) {
  return [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].find((el) => el.textContent.includes(text))
}

beforeEach(() => {
  localStorage.clear()
})

describe('WorkspaceSwitcher', () => {
  it('shows the project monogram and name', async () => {
    const { wrapper } = await setup()
    const button = wrapper.find('button.ag-ws')
    expect(button.find('.ag-monogram').text()).toBe('W')
    expect(button.find('.ag-ws-name').text()).toBe('Wrenfield')
    expect(button.attributes('aria-label')).toContain('Wrenfield')
  })

  it('lists projects with the current one checked and switches in place', async () => {
    const { wrapper, router } = await setup()
    const menu = await openMenu(wrapper)
    const current = item(menu, 'Wrenfield')
    expect(current.textContent).toContain('(current)')
    expect(item(menu, 'Acme').textContent).not.toContain('(current)')
    item(menu, 'Acme').click()
    await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/projects/w2/agent/reports'))
  })

  it('opens Add project and links settings, account and billing', async () => {
    const { wrapper, ui, router } = await setup()
    let menu = await openMenu(wrapper)
    item(menu, 'Add project').click()
    await flushPromises()
    expect(ui.addProjectOpen).toBe(true)

    menu = await openMenu(wrapper)
    item(menu, 'Billing').click()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/billing'))
  })

  it('opens the usage dashboard from the account menu', async () => {
    const { wrapper, router } = await setup()
    const menu = await openMenu(wrapper)
    const entry = item(menu, 'Usage dashboard')
    expect(entry).toBeTruthy()
    expect(entry.querySelector('svg')).not.toBeNull()
    // "Command Center" is the design's working name only.
    expect(menu.textContent).not.toContain('Command Center')
    entry.click()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/settings/usage-dashboard'))
  })

  it('sets the theme from the Appearance submenu', async () => {
    const { wrapper, app } = await setup()
    const menu = await openMenu(wrapper)
    const trigger = item(menu, 'Appearance')
    expect(trigger.textContent).toContain('Light')
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await flushPromises()
    const dark = [...document.body.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent.includes('Dark'))
    expect(dark).toBeTruthy()
    dark.click()
    await flushPromises()
    expect(app.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    app.setTheme('light')
  })

  it('signs out and goes to login', async () => {
    const { wrapper, router, auth } = await setup()
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue()
    const menu = await openMenu(wrapper)
    item(menu, 'Sign out').click()
    await flushPromises()
    expect(logout).toHaveBeenCalled()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })
})
