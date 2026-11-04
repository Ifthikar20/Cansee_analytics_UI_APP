// The header's three destinations (one list for the bar, the phone sheet,
// the logo and the Ctrl/Cmd+K jump) and the section a route belongs to.
// AppShell's parent records carry meta.section; vue-router merges it into
// every child's meta.
import { getLastChat } from '@/lib/agent/storage'
import { boardLocation } from '@/lib/board/links'

export const SECTIONS = Object.freeze(['analytics', 'agent', 'settings'])

const idOf = (v) => (v === undefined || v === null || v === '' ? null : String(v))

/** 'analytics' | 'agent' | 'settings' for a route rendered in AppShell, else null. */
export function sectionOf(route) {
    const section = route?.meta?.section
    return SECTIONS.includes(section) ? section : null
}

/** Analytics: the project's board with no panel open; /dashboard picks a project. */
export function analyticsLocation(websiteId) {
    return boardLocation(idOf(websiteId))
}

/** Agent: the project's last chat, else its new-chat view; /agent picks a project. */
export function agentLocation(websiteId, userId) {
    const wid = idOf(websiteId)
    if (!wid) return { name: 'agent' }
    const uid = idOf(userId)
    const chatId = uid ? getLastChat(uid, wid) : null
    return chatId
        ? { name: 'agent-chat', params: { websiteId: wid, chatId } }
        : { name: 'agent-home', params: { websiteId: wid } }
}

/** The bar's links in order, the current one marked. */
export function navItems(route, { websiteId = null, userId = null } = {}) {
    const section = sectionOf(route)
    return [
        { key: 'analytics', label: 'Analytics', to: analyticsLocation(websiteId), active: section === 'analytics' },
        { key: 'agent', label: 'Agent', to: agentLocation(websiteId, userId), active: section === 'agent' },
        { key: 'settings', label: 'Settings', to: { name: 'settings' }, active: section === 'settings' },
    ]
}

/** Help pages; both open in a new tab. */
export const HELP_LINKS = Object.freeze([
    Object.freeze({ key: 'docs', label: 'Docs', name: 'docs' }),
    Object.freeze({ key: 'support', label: 'Support', name: 'support' }),
])
