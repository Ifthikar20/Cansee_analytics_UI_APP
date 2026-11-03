// Entry guards for the two agent URLs that carry no project: /agent picks
// one, /agent/c/:chatId finds the project a chat belongs to. Both always
// redirect, so their route components never render. They deliberately do
// not import the agent store (it would pull the workspace into the main chunk).
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { getLastChat, getLastProject, paneStateChatIds } from '@/lib/agent/storage'
import { ensureWebsites } from './ensureWebsites'

const idOf = (v) => (v === null || v === undefined || v === '' ? null : String(v))

function userId() {
    return idOf(useAuthStore().user?.id)
}

/** The user's websites, or null when the list could not be loaded. */
async function loadWebsitesOrNull() {
    try {
        return await ensureWebsites({ rejectOnError: true })
    } catch {
        return null
    }
}

/** Websites ordered by preference: the given ids first, then the rest. */
function ordered(websites, preferred) {
    const ids = websites.map((w) => String(w.id))
    const head = []
    for (const id of preferred.map(idOf)) {
        if (id && ids.includes(id) && !head.includes(id)) head.push(id)
    }
    return [...head, ...ids.filter((id) => !head.includes(id))]
}

/**
 * /agent: the project the user is in (an active website chosen earlier in
 * this session), else the stored last project, else the first one; then
 * that project's last chat, or a new chat. `?agent=` always starts a new
 * chat with that agent preselected. No projects: the dashboard, where the
 * onboarding flow adds one. A list that failed to load: the projects page,
 * which says so and retries.
 */
export async function resolveAgentEntry(to) {
    const app = useAppStore()
    const chosen = idOf(app.activeWebsite?.id)
    const websites = await loadWebsitesOrNull()
    if (!websites) return { name: 'agent-projects' }
    if (!websites.length) return { name: 'dashboard' }

    const uid = userId()
    const [wid] = ordered(websites, [chosen, getLastProject(uid)])
    const query = { ...to.query }
    if (!query.agent) {
        const chatId = getLastChat(uid, wid)
        if (chatId) {
            return { name: 'agent-chat', params: { websiteId: wid, chatId }, query, hash: to.hash }
        }
    }
    return { name: 'agent-home', params: { websiteId: wid }, query, hash: to.hash }
}

/**
 * /agent/c/:chatId: chats are private and scoped to a project, so look in
 * the projects this browser has seen the chat in first, then ask each
 * project in turn (active and last project first). Not found: /agent.
 */
export async function resolveChatLink(to) {
    const chatId = idOf(to.params.chatId)
    const app = useAppStore()
    const chosen = idOf(app.activeWebsite?.id)
    const websites = await loadWebsitesOrNull()
    if (!websites) return { name: 'agent-projects' }
    if (!websites.length) return { name: 'dashboard' }
    if (!chatId) return { name: 'agent', query: to.query }

    const uid = userId()
    const candidates = ordered(websites, [chosen, getLastProject(uid)])
    const target = (wid) => ({
        name: 'agent-chat',
        params: { websiteId: wid, chatId },
        query: to.query,
        hash: to.hash,
    })

    const known = candidates.find(
        (wid) => getLastChat(uid, wid) === chatId || paneStateChatIds(uid, wid).includes(chatId)
    )
    if (known) return target(known)

    const { default: agentApi } = await import('@/api/agent')
    for (const wid of candidates) {
        try {
            await agentApi.getChat(wid, chatId, { _silentError: true })
            return target(wid)
        } catch (err) {
            const status = err?.response?.status
            // A 404 means "not in this project"; anything else (agent off,
            // network) will not get better by asking the next project.
            if (status !== 404) break
        }
    }
    return { name: 'agent', query: to.query }
}
