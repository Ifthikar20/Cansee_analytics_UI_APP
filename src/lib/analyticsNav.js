// The Analytics sections, in sub-nav order, and the per-project memory of
// the last one used (the top nav and the agent sidebar's Analytics link
// return there). `route` is the router name a section opens; `match` lists
// every route name that belongs to it (a prompt's page is Overview).

export const ANALYTICS_SECTIONS = [
    { key: 'overview', label: 'Overview', route: 'dashboard', match: ['dashboard', 'prompt'] },
    { key: 'visibility', label: 'Visibility', route: 'visibility', match: ['visibility'] },
    { key: 'countries', label: 'Countries', route: 'countries', match: ['countries'] },
    { key: 'traffic', label: 'Traffic', route: 'traffic', match: ['traffic'] },
    { key: 'ai-traffic', label: 'AI traffic', route: 'ai-traffic', match: ['ai-traffic'] },
    { key: 'sources', label: 'Sources', route: 'sources-urls', match: ['sources-urls', 'sources-url-detail'] },
]

const STORAGE_KEY = 'cs-analytics-last'
const HOME = Object.freeze({ name: 'dashboard' })

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
