import { isNavigationFailure, useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

// Switching project from the agent workspace. Project-scoped list pages keep
// their section; a chat, an artifact or the projects list land on the new
// project's agent home, because chats and artifacts belong to one project.
//
// Navigation comes first: the :websiteId guard makes the project active and
// the shell's agent.init(newId) resets the old project's scope (transports
// detach, runs keep going on the server). A page that blocks the navigation
// (unsaved context edits) therefore leaves the old project fully in place.

const KEEP_SECTION = new Set(['agent-context', 'agent-agents', 'agent-reports', 'agent-documents', 'agent-sheets'])

export function projectTarget(routeName, websiteId) {
  const name = String(routeName || '')
  const params = { websiteId: String(websiteId) }
  if (KEEP_SECTION.has(name)) return { name, params }
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
   * Navigate into `websiteId`. Resolves true when the navigation happened,
   * false for an unknown id, the project already open on a project page, or
   * a navigation a guard cancelled.
   */
  async function switchProject(websiteId) {
    const id = websiteId === undefined || websiteId === null ? '' : String(websiteId)
    const website = app.websites.find((w) => String(w.id) === id)
    if (!website) return false
    if (route.params?.websiteId && currentProjectId() === id) return false
    let result
    try {
      result = await router.push(projectTarget(route.name, id))
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
