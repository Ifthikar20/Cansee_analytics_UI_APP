import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ANALYTICS_SECTIONS, sectionLabel } from '@/lib/analyticsNav'
import AnalyticsSidebarNav, { SECTION_ICONS } from '../AnalyticsSidebarNav.vue'

const Blank = defineComponent({ render: () => h('div') })
const at = (key) => ({ analytics: key, title: sectionLabel(key) })

function makeRouter() {
  const pathOf = (name) => (name === 'site-pages' ? 'pages' : name === 'sources-urls' ? 'sources' : name)
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'dashboard', component: Blank, meta: at('overview') },
      { path: '/settings', name: 'settings', component: Blank, meta: { settings: true } },
      { path: '/projects/:websiteId/prompts/:promptId', name: 'prompt', component: Blank, meta: at('overview') },
      { path: '/projects/:websiteId/sources/detail', name: 'sources-url-detail', component: Blank, meta: at('sources') },
      ...ANALYTICS_SECTIONS.filter((s) => s.key !== 'overview').map((s) => ({
        path: `/projects/:websiteId/${pathOf(s.route)}`,
        name: s.route,
        component: Blank,
        meta: at(s.key),
      })),
    ],
  })
}

const mounted = []

async function setup(path, websiteId = 'w1') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AnalyticsSidebarNav, { props: { websiteId }, global: { plugins: [router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
})

describe('AnalyticsSidebarNav', () => {
  it('maps every tab icon to an imported icon', () => {
    for (const s of ANALYTICS_SECTIONS) expect(SECTION_ICONS[s.icon], s.icon).toBeTruthy()
    expect(Object.keys(SECTION_ICONS)).toHaveLength(14)
  })

  it('lists the four groups as headings over their tabs', async () => {
    const { wrapper } = await setup('/projects/w1/visibility')
    const group = wrapper.find('[role="group"]')
    expect(group.attributes('aria-label')).toBe('Analytics')
    const headings = wrapper.findAll('.ag-an-group')
    expect(headings.map((p) => p.text())).toEqual(['Search vs AI', 'Answer engines', 'Your site', 'Shopping'])
    const lists = wrapper.findAll('ul[role="list"]')
    expect(lists).toHaveLength(4)
    lists.forEach((list, i) => expect(list.attributes('aria-labelledby')).toBe(headings[i].attributes('id')))
    expect(lists[1].findAll('li').map((li) => li.text())).toEqual([
      'Visibility',
      'Sentiment',
      'Fact check',
      'Citations',
      'Query fan-outs',
      'Prompt research',
    ])
    // Every row draws its icon.
    expect(wrapper.findAll('.ag-nav-row')).toHaveLength(14)
    for (const row of wrapper.findAll('.ag-nav-row')) expect(row.find('svg').exists()).toBe(true)
  })

  it('marks the current tab, a prompt page under Overview and a source detail under Citations', async () => {
    let ctx = await setup('/projects/w1/pages')
    let current = ctx.wrapper.findAll('[aria-current="page"]')
    expect(current.map((a) => a.text())).toEqual(['Pages'])
    expect(current[0].classes()).toContain('is-active')
    expect(current[0].attributes('href')).toBe('/projects/w1/pages')

    ctx = await setup('/projects/w1/prompts/p9')
    expect(ctx.wrapper.findAll('[aria-current="page"]').map((a) => a.text())).toEqual(['Overview'])

    ctx = await setup('/projects/w1/sources/detail')
    expect(ctx.wrapper.findAll('[aria-current="page"]').map((a) => a.text())).toEqual(['Citations'])

    // Settings: no tab is current.
    ctx = await setup('/settings')
    expect(ctx.wrapper.findAll('[aria-current="page"]')).toHaveLength(0)
  })

  it('disables the tabs that need a project when there is none, except the Overview', async () => {
    const { wrapper } = await setup('/dashboard', null)
    const links = wrapper.findAll('a.ag-nav-row')
    expect(links.map((a) => a.text())).toEqual(['Overview'])
    expect(links[0].attributes('href')).toBe('/dashboard')
    const disabled = wrapper.findAll('.ag-nav-row.is-disabled')
    expect(disabled).toHaveLength(13)
    for (const row of disabled) expect(row.attributes('aria-disabled')).toBe('true')
  })
})
