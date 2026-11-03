// The Analytics tabs, in sidebar order and grouped, and the per-project
// memory of the last one used (the sidebar's Analytics switch returns
// there). `route` is the router name a section opens; `match` lists every
// route name that belongs to it (a prompt's page is Overview). `icon` is an
// @lucide/vue export name, resolved by AnalyticsSidebarNav through an
// explicit map, so only these icons reach the bundle.

export const ANALYTICS_GROUPS = [
    { key: 'search-vs-ai', label: 'Search vs AI' },
    { key: 'answer-engines', label: 'Answer engines' },
    { key: 'your-site', label: 'Your site' },
    { key: 'shopping', label: 'Shopping' },
]

export const ANALYTICS_SECTIONS = [
    { key: 'overview', group: 'search-vs-ai', label: 'Overview', icon: 'LayoutDashboard', route: 'dashboard', match: ['dashboard', 'prompt'] },
    { key: 'competitors', group: 'search-vs-ai', label: 'Competitors', icon: 'Swords', route: 'competitors', match: ['competitors'] },
    { key: 'countries', group: 'search-vs-ai', label: 'Countries', icon: 'Globe', route: 'countries', match: ['countries'] },
    { key: 'visibility', group: 'answer-engines', label: 'Visibility', icon: 'Eye', route: 'visibility', match: ['visibility'] },
    { key: 'sentiment', group: 'answer-engines', label: 'Sentiment', icon: 'Smile', route: 'sentiment', match: ['sentiment'] },
    { key: 'fact-check', group: 'answer-engines', label: 'Fact check', icon: 'BadgeCheck', route: 'fact-check', match: ['fact-check'] },
    { key: 'sources', group: 'answer-engines', label: 'Citations', icon: 'Quote', route: 'sources-urls', match: ['sources-urls', 'sources-url-detail'] },
    { key: 'fan-outs', group: 'answer-engines', label: 'Query fan-outs', icon: 'GitBranch', route: 'fan-outs', match: ['fan-outs'] },
    { key: 'prompt-research', group: 'answer-engines', label: 'Prompt research', icon: 'Lightbulb', route: 'prompt-research', match: ['prompt-research'] },
    { key: 'pages', group: 'your-site', label: 'Pages', icon: 'FileText', route: 'site-pages', match: ['site-pages'] },
    { key: 'crawler-access', group: 'your-site', label: 'Crawler access', icon: 'Bot', route: 'crawler-access', match: ['crawler-access'] },
    { key: 'ai-traffic', group: 'your-site', label: 'AI traffic', icon: 'MousePointerClick', route: 'ai-traffic', match: ['ai-traffic'] },
    { key: 'traffic', group: 'your-site', label: 'Traffic', icon: 'ChartLine', route: 'traffic', match: ['traffic'] },
    { key: 'products', group: 'shopping', label: 'Products', icon: 'ShoppingBag', route: 'products', match: ['products'] },
]

const STORAGE_KEY = 'cs-analytics-last'
const SIDE_KEY = 'cs-sidebar-side'
const SIDES = ['agent', 'analytics']
const HOME = Object.freeze({ name: 'dashboard' })

/** The groups in order, each with its sections: [{ key, label, sections }]. */
export function sectionsByGroup() {
    return ANALYTICS_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        sections: ANALYTICS_SECTIONS.filter((s) => s.group === g.key),
    }))
}

/** A section's label ('Citations' for 'sources'), '' for an unknown key. */
export function sectionLabel(key) {
    return ANALYTICS_SECTIONS.find((s) => s.key === key)?.label || ''
}

/** The section key a route belongs to ('overview', 'countries'...), or null. */
export function analyticsSectionOf(routeName) {
    const name = String(routeName || '')
    if (!name) return null
    return ANALYTICS_SECTIONS.find((s) => s.match.includes(name))?.key || null
}

/**
 * The router location of a section. The Overview follows the active
 * project and takes no params; every other section is addressed by its
 * project, so it has no location (null) without one.
 */
export function sectionRoute(key, websiteId) {
    const section = ANALYTICS_SECTIONS.find((s) => s.key === key)
    if (!section) return null
    if (section.key === 'overview') return { name: section.route }
    if (!websiteId) return null
    return { name: section.route, params: { websiteId: String(websiteId) } }
}

function readMemory() {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

/** Remember the section last opened for a project (this browser tab only). */
export function rememberAnalyticsSection(websiteId, key) {
    if (!websiteId || !ANALYTICS_SECTIONS.some((s) => s.key === key)) return
    const memory = readMemory()
    if (memory[websiteId] === key) return
    memory[websiteId] = key
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
    } catch {}
}

/** Where "Analytics" goes for a project: the section used last, else the Overview. */
export function analyticsHomeRoute(websiteId) {
    if (!websiteId) return { ...HOME }
    const key = readMemory()[websiteId]
    return sectionRoute(key, websiteId) || { ...HOME }
}

function rememberedSide() {
    try {
        const side = sessionStorage.getItem(SIDE_KEY)
        return SIDES.includes(side) ? side : 'agent'
    } catch {
        return 'agent'
    }
}

/**
 * Which side the sidebar shows: 'analytics' on an analytics route, 'agent'
 * on an agent route, and on any other route (Settings, Billing) the side
 * used last in this browser tab, else 'agent'.
 */
export function sidebarSide(route) {
    if (route?.meta?.analytics) return 'analytics'
    if (String(route?.name || '').startsWith('agent')) return 'agent'
    return rememberedSide()
}

/** Remember the side for routes that belong to neither (this browser tab only). */
export function rememberSidebarSide(side) {
    if (!SIDES.includes(side)) return
    try {
        sessionStorage.setItem(SIDE_KEY, side)
    } catch {}
}
