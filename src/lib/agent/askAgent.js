// Ask the agent (p2_contract.md 1g and 15): an analytics page hands work to
// the agent by opening a new chat with a drafted message. Nothing is ever
// sent by itself, and no free text goes in the URL: the text travels as the
// new chat's composer draft (lib/agent/storage), and the URL carries only
// the agent key and the widget it came from (?agent=&from=), which the chat
// page reads to show "Drafted from {widget}. Review it, then send."
import { loadDraft, saveDraft } from '@/lib/agent/storage'
import { AGENT_KEY_LIST, NEW_CHAT_KEY } from '@/lib/agent/types'
import { WIDGETS } from '@/lib/board/widgets'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

export const ASK_TEXT_MAX = 2000

// Where a draft can come from, by key: the board's widgets
// (board_contract.md 9), the Agents page, and `sources`, the key the
// Citations tab used before the board (drafts opened from older links).
export const ASK_FROM_LABELS = Object.freeze({
    ...Object.fromEntries(WIDGETS.map((w) => [w.key, w.title])),
    agents: 'Agents',
    sources: 'Citations',
})

const BLOCKED_STORAGE =
    "Your browser blocked saving the draft, so it can't be handed to the agent. Allow site storage and try again."

/**
 * Save `text` (clipped to 2,000 characters) as the new-chat draft of the
 * project, then open the new chat with `agent` preselected. The draft
 * replaces any unsent new-chat draft. An agent outside the ten keys is
 * dropped; `from` is a key of ASK_FROM_LABELS.
 *
 * Resolves true once the navigation went through, false when nothing could
 * be handed over (no user or project, storage blocked: the user stays where
 * they are and a toast says why) or a guard cancelled the navigation.
 */
export async function askAgent(router, { websiteId, agent = null, from = '', text = '' } = {}) {
    const uid = useAuthStore().user?.id
    const wid = websiteId === undefined || websiteId === null ? '' : String(websiteId)
    const body = String(text ?? '').slice(0, ASK_TEXT_MAX)
    if (uid === undefined || uid === null || uid === '' || !wid || !body.trim()) return false

    saveDraft(String(uid), wid, NEW_CHAT_KEY, body)
    // A private window or blocked site data drops the write silently; check it landed.
    if (loadDraft(String(uid), wid, NEW_CHAT_KEY) !== body) {
        useToast().error(BLOCKED_STORAGE)
        return false
    }

    const query = {}
    if (AGENT_KEY_LIST.includes(agent)) query.agent = agent
    if (Object.prototype.hasOwnProperty.call(ASK_FROM_LABELS, from)) query.from = from
    try {
        const failure = await router.push({ name: 'agent-home', params: { websiteId: wid }, query })
        return !failure
    } catch {
        return false
    }
}
