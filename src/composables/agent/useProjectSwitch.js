import { isNavigationFailure, useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { sectionOf } from '@/lib/shell/nav'

// Switching project from the header (and the agent's Projects page).
// Project-scoped list pages keep their section; a chat, an artifact or the
// projects list land on the new project's agent home, because chats and
// artifacts belong to one project. The Analytics board stays the board of
// the new project, with the same panel (`widget`) and filters; the query
// keys that name records of one project (a prompt, a cited URL...) are
// dropped. The Analytics entry, Settings and Billing stay where they are.
//
// Navigation comes first: the router makes the project active once the
// navigation is confirmed, and the shell's agent.init(newId) resets the old
// project's scope (transports detach, runs keep going on the server). A page
// that blocks the navigation (unsaved context edits) therefore leaves the old
// project fully in place.

const KEEP_SECTION = new Set([
  'agent-context',
  'agent-agents',
  'agent-findings',
  'agent-reviews',
  'agent-reports',
  'agent-documents',
  'agent-sheets',
])

// Routes without a project in the URL that stay as they are.
const STAY = new Set([
  'dashboard',
  'settings',
  'settings-project',
  'settings-autopilot',
  'settings-connections',
  'settings-brand-facts',
  'settings-command-center',
  'billing',
])

// Panel keys that name records of one project; they do not carry over.
export const PROJECT_QUERY_KEYS = Object.freeze(['prompt', 'check', 'product', 'verdict', 'topic', 'filter', 'url', 'run'])

function carriedQuery(query) {
  const out = { ...(query || {}) }
  for (const key of PROJECT_QUERY_KEYS) delete out[key]
  return out
}

/**
 * Where switching to `websiteId` goes from route `routeName`, or null when
 * the page stays as it is (the Analytics entry, Settings, Billing).
 */
export function projectTarget(routeName, websiteId, query = {}) {
  const name = String(routeName || '')
  const params = { websiteId: String(websiteId) }
  if (STAY.has(name)) return null
  if (KEEP_SECTION.has(name)) return { name, params }
  if (name === 'analytics') return { name, params, query: carriedQuery(query) }
  return { name: 'agent-home', params }
}

export function useProjectSwitch() {
  const route = useRoute()
  const router = useRouter()
  const app = useAppStore()

  function currentProjectId() {
    const wid = route.params?.websiteId ?? app.activeWebsite?.id
    return wid === undefined || wid === null || wid === '' ? null : String(wid)
  }

  /**
   * Switch to `websiteId`. Resolves true when the project changed (by a
   * navigation, or in place on a page without a project in its URL), false
   * for an unknown id, the project already open, or a navigation a guard
   * cancelled.
   */
  async function switchProject(websiteId) {
    const id = websiteId === undefined || websiteId === null ? '' : String(websiteId)
    const website = app.websites.find((w) => String(w.id) === id)
    if (!website) return false
    if (route.params?.websiteId && currentProjectId() === id) return false
    const target = sectionOf(route) === 'settings' ? null : projectTarget(route.name, id, route.query)
    if (!target) {
      // Nothing to navigate to: a push to the route already shown would be a
      // duplicated navigation, so the project changes in place.
      if (String(app.activeWebsite?.id ?? '') === id) return false
      app.setActiveWebsite(website)
      return true
    }
    let result
    try {
      result = await router.push(target)
    } catch {
      return false
    }
    if (isNavigationFailure(result)) return false
    // The guard already did this for project routes; keep the store in step regardless.
    if (String(app.activeWebsite?.id ?? '') !== id) app.setActiveWebsite(website)
    return true
  }

  return { switchProject, currentProjectId, projectTarget }
}
