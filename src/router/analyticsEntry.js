// /dashboard, the Analytics entry: it opens the board of a project. It
// renders a page of its own (AnalyticsEntryPage) only during onboarding,
// when the user has no project, or when the project list failed to load;
// that page says which and offers the way on. Like agentGuards.js, it does
// not import the agent store.
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { getLastProject } from '@/lib/agent/storage'
import { ensureWebsites } from './ensureWebsites'

const idOf = (v) => (v === null || v === undefined || v === '' ? null : String(v))

/** The project active in this session, read before a list load picks one. */
export function activeProjectId() {
    return idOf(useAppStore().activeWebsite?.id)
}

/**
 * The project the entry opens: `activeId` (the project active before the
 * list loaded) when it is in the list, else the user's last project, else
 * the first one; null for an empty list.
 */
export function entryProjectId(websites, activeId = null) {
    const ids = (websites || []).map((w) => String(w.id))
    if (!ids.length) return null
    const preferred = [idOf(activeId), getLastProject(idOf(useAuthStore().user?.id))]
    return preferred.find((id) => id && ids.includes(id)) || ids[0]
}

/** The /dashboard guard: true renders the entry page, a location opens a board. */
export async function resolveAnalyticsEntry(to) {
    if (useAuthStore().session?.onboarding?.needs_onboarding === true) return true
    // Loading the list makes its first project active; read the choice first.
    const chosen = activeProjectId()
    let websites
    try {
        websites = await ensureWebsites({ rejectOnError: true })
    } catch {
        return true
    }
    const id = entryProjectId(websites, chosen)
    if (!id) return true
    return { name: 'analytics', params: { websiteId: id }, query: to.query, hash: to.hash }
}
