// The analytics setup panel's live state for one project, read from the
// stores that already track it. No polling loop of its own:
// - the agent status (engines, Google, research, setup issues, prompt
//   runs) is the agent store's `status`, which AppShell loads when it
//   scopes the store to the project in view and the store reloads when a
//   run ends (the runs left change); Check again reloads it;
// - the first research's run is followed by the agent store's run manager
//   (stream, else long-poll), which attaches it when the chat detail
//   loads and detaches every transport when the project changes;
// - the panel's own record (first landing, chat id, dismissed, collapsed)
//   is lib/setup/storage.js.
//
// Another project's data never shows: everything about the chat is read
// only while the agent store serves this project, and the store drops any
// answer that arrives after a project change (its epoch).
import { computed, ref, toValue, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import { dismissSetup, readSetup, setSetupCollapsed } from '@/lib/setup/storage'
import {
    nextSteps,
    panelState,
    promptRunsLine,
    researchBlocker,
    researchMessage,
    researchProgress,
    setupIssues,
} from '@/lib/setup/status'

const idOf = (v) => (v === null || v === undefined || v === '' ? '' : String(v))

/**
 * `websiteId` is a ref, getter or value; `autopilotOn` a ref or getter
 * (true, false, or null when unknown).
 */
export function useSetupStatus(websiteId, { autopilotOn = null } = {}) {
    const agent = useAgentStore()
    const auth = useAuthStore()

    const wid = computed(() => idOf(toValue(websiteId)))
    const uid = computed(() => idOf(auth.user?.id))
    const record = ref(readSetup(uid.value, wid.value))
    watch([uid, wid], ([u, w]) => {
        record.value = readSetup(u, w)
    })

    // The agent store is scoped to one project at a time (AppShell follows the view).
    const scoped = computed(() => Boolean(wid.value) && idOf(agent.websiteId) === wid.value)
    const chatId = computed(() => (scoped.value ? record.value.chatId : null))

    // Load the first research chat once per project and chat: that attaches
    // its active run, which the store then follows to its end.
    watch(
        [chatId, scoped],
        ([cid, ok]) => {
            if (!ok || !cid) return
            const st = agent.chatState?.[cid]
            if (st && (st.loaded || st.loading)) return
            Promise.resolve(agent.loadChatDetail(cid)).catch(() => {})
        },
        { immediate: true },
    )

    const status = computed(() => (agent.status && typeof agent.status === 'object' ? agent.status : null))
    const statusKnown = computed(() => Boolean(status.value))
    const checking = computed(() => Boolean(agent.statusLoading))
    const statusFailed = computed(() => !status.value && Boolean(agent.statusError))

    const issues = computed(() => setupIssues(status.value))
    const runsLine = computed(() => promptRunsLine(status.value))
    const blocker = computed(() => researchBlocker(status.value, issues.value))

    const chat = computed(() => (chatId.value ? agent.chatState?.[chatId.value] || null : null))
    const run = computed(() => {
        const cid = chatId.value
        if (!cid) return null
        const active = agent.activeRun(cid)
        if (active) return active
        const st = agent.chatState?.[cid]
        const known = st?.activeRunId ? agent.runs?.[st.activeRunId] : null
        if (known) return known
        // A run this tab followed to its end: the newest one of this chat.
        const ofChat = Object.values(agent.runs || {}).filter((r) => r && r.chatId === cid)
        return ofChat.length ? ofChat[ofChat.length - 1] : null
    })
    const message = computed(() => {
        const cid = chatId.value
        if (!cid) return null
        return researchMessage({ run: run.value, messages: agent.messages || {}, path: agent.visiblePath(cid) })
    })
    const research = computed(() =>
        researchProgress({ chatId: chatId.value, chat: chat.value, run: run.value, message: message.value }),
    )

    const panel = computed(() =>
        panelState({ record: record.value, statusKnown: statusKnown.value, issues: issues.value, research: research.value }),
    )
    const steps = computed(() =>
        nextSteps({
            websiteId: wid.value,
            chatId: chatId.value,
            research: research.value,
            autopilotOn: toValue(autopilotOn),
            blocker: blocker.value,
        }),
    )

    const collapsed = computed(() => record.value.collapsed)

    function checkAgain() {
        if (agent.statusLoading) return Promise.resolve(status.value)
        return Promise.resolve(agent.loadStatus()).catch(() => null)
    }

    /** Close the panel for this project; only once it is dismissible. */
    function dismiss() {
        if (!panel.value.dismissible) return false
        const stored = dismissSetup(uid.value, wid.value)
        // Storage refused: hide it for this visit all the same.
        record.value = stored || { ...record.value, dismissed: true }
        return true
    }

    function setCollapsed(value) {
        const next = Boolean(value)
        const stored = setSetupCollapsed(uid.value, wid.value, next)
        record.value = stored || { ...record.value, collapsed: next }
    }

    return {
        websiteId: wid,
        record,
        chatId,
        status,
        statusKnown,
        statusFailed,
        checking,
        issues,
        runsLine,
        blocker,
        research,
        panel,
        steps,
        collapsed,
        checkAgain,
        dismiss,
        setCollapsed,
    }
}
