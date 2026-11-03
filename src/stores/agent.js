import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'
import agentApi from '@/api/agent'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import {
    AgentError,
    normalizeArtifact,
    normalizeChatDetail,
    normalizeChatSummary,
    normalizeError,
    normalizeMessage,
    normalizeRun,
} from '@/lib/agent/normalize'
import { reduceEvents } from '@/lib/agent/reducer'
import { createRunManager } from '@/lib/agent/runManager'
import { clearDraft, clearLastChat, removePaneState, setLastChat, setLastProject } from '@/lib/agent/storage'
import {
    addChild,
    mergeChildren,
    newestLeaf,
    parentKeyOf,
    pathTo,
    removeChild,
    replaceChild,
    rootKey,
    siblingInfo as treeSiblingInfo,
} from '@/lib/agent/tree'
import {
    ERROR_CODE,
    MESSAGE_STATUS,
    NEW_CHAT_KEY,
    RUN_PHASE,
    TRANSPORT_STATE,
    isTerminalPhase,
    phaseFromMessageStatus,
    phaseFromRunStatus,
} from '@/lib/agent/types'

// The agent workspace store, scoped to one project (website) at a time and
// normalised: chats, a message tree, runs and artifacts by id. Streaming
// lives here, not in components: runManager feeds contract events through
// the pure reducer (lib/agent/reducer.js), and the pane effects it reports
// (browser.open / browser.update) go to the agentPane store.
//
// Errors: init, loadStatus, loadChats and openChat never throw; their
// errors land in statusError, chats.error and chatState[id].error. Every
// other action throws an AgentError (lib/agent/normalize.js) for the caller
// to show, so requests are _silentError (no second, generic toast from the
// API client). A failed message POST does not throw: the optimistic message
// gets status `send_failed` and `send.error`, and retrySend() re-posts it
// with the same Idempotency-Key (editing its text takes a new key).
//
// The server decides when a run is over. A run this tab had to end on its
// own (its transport failed for good) is `settledLocally`; when the server
// still lists it as active, the next chat detail attaches it again.

const SILENT = Object.freeze({ _silentError: true })

// Stop waits this long for the terminal event, then asks the server.
const STOP_FALLBACK_MS = 8000
// After a new chat's first reply, when its generated title has not arrived,
// the server is asked again after each of these delays.
const TITLE_CHECKS_MS = [2000, 6000, 15000]
const SERVER_RUNS_TO_FOLLOW = 3
const RUN_KEYS = ['phase', 'lastSeq', 'startedAt', 'durationMs', 'usage', 'error', 'retrying', 'model', 'stopReason', 'outcome']

const idOf = (v) => (v === null || v === undefined || v === '' ? null : String(v))

function newId() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    } catch {}
    const rand = () => Math.random().toString(36).slice(2, 10)
    return `${Date.now().toString(36)}-${rand()}-${rand()}`
}

function freshChats() {
    return { byId: {}, order: [], loading: false, loaded: false, cursor: null, hasMore: false, search: '', error: null }
}

function freshChatState() {
    return { loaded: false, loading: false, error: null, leafId: null, activeRunId: null, pending: false, cancelOnStart: false }
}

function listOf(data) {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.results)) return data.results
    return []
}

export const useAgentStore = defineStore('agent', () => {
    const auth = useAuthStore()
    const app = useAppStore()

    /* ── State ── */

    const websiteId = ref(null)
    // Bumped on every project reset; async results from an older epoch are dropped.
    const epoch = ref(0)
    const status = ref(null)
    const statusError = ref(null)
    const statusLoading = ref(false)
    const chats = ref(freshChats())
    const chatState = ref({})
    const messages = ref({})
    const childrenOf = ref({})
    const runs = ref({})
    const artifacts = ref({})
    const catalog = ref([])
    const catalogLoaded = ref(false)
    const suggestions = ref([])
    const context = ref(null)
    const activity = ref([])
    // The chat on screen; a run finishing anywhere else marks its chat unseen.
    const viewingChatId = ref(null)

    const inflightChats = new Map()
    const stopTimers = new Map()
    // Chats this tab created whose generated title has not arrived yet, and
    // the pending checks for one (see followTitle).
    const titleWanted = new Set()
    const titleTimers = new Map()
    let chatsRequest = 0
    let initPromise = null

    const manager = createRunManager({
        applyEvents: (runId, events) => applyEvents(runId, events),
        onTransport: (runId, transport) => {
            const run = runs.value[runId]
            if (run) run.transport = transport
        },
        onResync: (runId) => resyncRun(runId),
        onClose: (runId, info) => onTransportClosed(runId, info),
    })

    /* ── Getters ── */

    function chatRunning(id) {
        const st = chatState.value[id]
        if (st) {
            if (st.pending) return true
            const run = st.activeRunId ? runs.value[st.activeRunId] : null
            if (run) return !isTerminalPhase(run.phase)
            if (st.loaded) return false
        }
        return Boolean(chats.value.byId[id]?.active_run_id)
    }

    function uiStore() {
        try {
            return useAgentUiStore()
        } catch {
            return null
        }
    }

    /** Chat summaries in list order, with `running` and `unseen` flags. */
    const recents = computed(() => {
        const ui = uiStore()
        return chats.value.order
            .map((id) => chats.value.byId[id])
            .filter(Boolean)
            .map((chat) => ({
                ...chat,
                running: chatRunning(chat.id),
                unseen: Boolean(ui && typeof ui.isUnseen === 'function' && ui.isUnseen(chat.id)),
            }))
    })

    /** Messages from the root to the chat's current leaf. */
    const visiblePath = computed(() => (chatId) => {
        const st = chatState.value[idOf(chatId) || NEW_CHAT_KEY]
        if (!st || !st.leafId) return []
        return pathTo(messages.value, st.leafId)
    })

    /** {ids, index (0-based), position (1-based), count, prevId, nextId, hasPrev, hasNext}. */
    const siblingInfo = computed(() => (id) => treeSiblingInfo(childrenOf.value, messages.value, idOf(id)))

    /** The chat's run while it is not finished, else null. */
    const activeRun = computed(() => (chatId) => {
        const st = chatState.value[idOf(chatId) || NEW_CHAT_KEY]
        const run = st && st.activeRunId ? runs.value[st.activeRunId] : null
        return run && !isTerminalPhase(run.phase) ? run : null
    })

    /** True while a message is being posted or a run is active in the chat. */
    const isChatBusy = computed(() => (chatId) => {
        const key = idOf(chatId) || NEW_CHAT_KEY
        const st = chatState.value[key]
        if (!st) return false
        return Boolean(st.pending) || Boolean(activeRun.value(key))
    })

    const artifact = computed(() => (id) => {
        const key = idOf(id)
        return key ? artifacts.value[key] || null : null
    })

    /** The run that produced an assistant message, if this session knows it. */
    const runOf = computed(() => (messageId) => {
        const key = idOf(messageId)
        if (!key) return null
        const message = messages.value[key]
        if (message && message.run_id && runs.value[message.run_id]) return runs.value[message.run_id]
        return Object.values(runs.value).find((r) => r.messageId === key) || null
    })

    /* ── Internal helpers ── */

    function userId() {
        return idOf(auth.user?.id)
    }

    function ensureChatState(key) {
        if (!chatState.value[key]) chatState.value[key] = freshChatState()
        return chatState.value[key]
    }

    /**
     * The project id, initialising from `expected` (the project the calling
     * page shows) or the active website when needed. When the store is
     * scoped to a project other than `expected` this throws rather than act
     * on the wrong project.
     */
    function ensureProject(expected = null) {
        const want = idOf(expected)
        if (!websiteId.value) {
            const id = want || idOf(app.activeWebsite?.id)
            if (id) init(id)
        }
        if (!websiteId.value) throw new AgentError({ code: 'no_project', message: 'Choose a project first.' })
        if (want && want !== websiteId.value) {
            throw new AgentError({
                code: 'project_changed',
                message: 'The workspace is on another project now. Reload this page, then try again.',
            })
        }
        return websiteId.value
    }

    function withPane(chatId, fn) {
        let pane
        try {
            pane = useAgentPaneStore()
        } catch {
            return
        }
        if (!pane || idOf(pane.chatKey) !== idOf(chatId)) return
        try {
            fn(pane)
        } catch (err) {
            console.error('[agent] pane update failed', err)
        }
    }

    function markSeen(chatId) {
        const ui = uiStore()
        if (ui && typeof ui.markSeen === 'function') ui.markSeen(chatId)
    }

    function markUnseen(chatId) {
        const ui = uiStore()
        if (ui && typeof ui.markUnseen === 'function') ui.markUnseen(chatId)
    }

    function upsertChatSummary(summary) {
        if (!summary) return null
        const prev = chats.value.byId[summary.id]
        chats.value.byId[summary.id] = { ...(prev ? toRaw(prev) : {}), ...summary }
        return chats.value.byId[summary.id]
    }

    function moveToTop(chatId, preview = '') {
        const c = chats.value
        const chat = c.byId[chatId]
        if (chat) {
            chat.last_message_at = new Date().toISOString()
            if (preview) chat.preview = preview.slice(0, 200)
        }
        if (c.search) return
        c.order = [chatId, ...c.order.filter((id) => id !== chatId)]
    }

    function upsertMessage(raw, { chatId = null, keepLiveParts = true } = {}) {
        const message = normalizeMessage(raw)
        if (!message) return null
        if (!message.chat_id && chatId) message.chat_id = String(chatId)
        const prev = messages.value[message.id] ? toRaw(messages.value[message.id]) : null
        if (prev && keepLiveParts) {
            // A stream applied past the server's checkpoint keeps its parts.
            const run = Object.values(runs.value).find((r) => r.messageId === message.id)
            if (run && manager.isAttached(run.id) && (run.lastSeq || 0) > (message.parts_seq || 0)) {
                message.parts = prev.parts
                message.research = prev.research
                message.status = prev.status
                message.parts_seq = prev.parts_seq
            }
        }
        if (prev && prev.client_id && !message.client_id) message.client_id = prev.client_id
        messages.value[message.id] = message
        mergeChildren(childrenOf.value, parentKeyOf(message), message.sibling_ids)
        return messages.value[message.id]
    }

    function upsertRun(raw, { chatId = null, messageId = null } = {}) {
        const r = normalizeRun(raw)
        if (!r) return null
        if (runs.value[r.id]) return runs.value[r.id]
        runs.value[r.id] = {
            id: r.id,
            chatId: idOf(chatId) || r.chat_id,
            messageId: idOf(messageId) || r.message_id,
            phase: phaseFromRunStatus(r.status),
            transport: { state: TRANSPORT_STATE.IDLE, mode: 'sse', attempt: 0 },
            lastSeq: 0,
            startedAt: null,
            durationMs: null,
            usage: null,
            cancelRequested: false,
            settledLocally: false,
            error: null,
            retrying: null,
            model: '',
            stopReason: '',
            outcome: '',
        }
        return runs.value[r.id]
    }

    /** The server still runs a run this tab ended on its own: follow it again. */
    function reviveRun(run, serverPhase) {
        run.settledLocally = false
        run.error = null
        run.phase = run.cancelRequested ? RUN_PHASE.CANCELLING : serverPhase
        if (run.cancelRequested) armStopCheck(run.id)
    }

    function attachRun(run) {
        if (!run || isTerminalPhase(run.phase)) return
        manager.attach({ id: run.id, lastSeq: run.lastSeq })
    }

    /** A run accepted by a 202: becomes the chat's active run and starts streaming. */
    function startRun(chatId, rawRun, assistant) {
        const st = ensureChatState(chatId)
        if (assistant) st.leafId = assistant.id
        const run = upsertRun(rawRun, { chatId, messageId: assistant?.id })
        if (!run) return null
        st.activeRunId = run.id
        const chat = chats.value.byId[chatId]
        if (chat) chat.active_run_id = run.id
        if (assistant && !assistant.run_id) assistant.run_id = run.id
        attachRun(run)
        return run
    }

    function ingestChatDetail(raw, { resync = false } = {}) {
        const detail = normalizeChatDetail(raw)
        if (!detail) return null
        const chatId = detail.id
        const { messages: list, active_run: activeRunRaw, current_leaf_id: leafId, ...summary } = detail
        upsertChatSummary(summary)
        for (const m of list) upsertMessage(m, { chatId, keepLiveParts: !resync })
        const st = ensureChatState(chatId)
        if (leafId) st.leafId = leafId
        st.loaded = true
        st.error = null

        const serverPhase = activeRunRaw ? phaseFromRunStatus(activeRunRaw.status) : null
        if (activeRunRaw && !isTerminalPhase(serverPhase)) {
            const known = runs.value[activeRunRaw.id]
            const revive = Boolean(known && known.settledLocally)
            const run = upsertRun(activeRunRaw, { chatId, messageId: activeRunRaw.message_id })
            if (revive) reviveRun(run, serverPhase)
            const message = messages.value[run.messageId]
            // Resume from the snapshot the parts reflect, not the run's newest seq.
            if (!known || resync || revive) run.lastSeq = message ? Number(message.parts_seq) || 0 : 0
            st.activeRunId = run.id
            attachRun(run)
        } else if (st.activeRunId) {
            const local = runs.value[st.activeRunId]
            if (!local || isTerminalPhase(local.phase)) {
                st.activeRunId = null
            } else if (resync || !manager.isAttached(local.id)) {
                // The server has no active run and no stream will report the
                // end (a resyncing transport is paused until this returns).
                finishFromSavedMessage(local)
            }
        }
        return detail
    }

    function loadChatDetail(id, { force = false, resync = false } = {}) {
        const chatId = String(id)
        const st = ensureChatState(chatId)
        if (!force && st.loaded) return Promise.resolve(st)
        if (!resync && inflightChats.has(chatId)) return inflightChats.get(chatId)
        const wid = websiteId.value
        if (!wid) return Promise.resolve(null)
        const ep = epoch.value
        st.loading = true
        const request = agentApi
            .getChat(wid, chatId, { _silentError: true })
            .then(({ data }) => {
                if (ep !== epoch.value) return null
                ingestChatDetail(data, { resync })
                return chatState.value[chatId] || null
            })
            .catch((err) => {
                const error = normalizeError(err)
                if (ep === epoch.value && chatState.value[chatId]) chatState.value[chatId].error = error
                throw error
            })
            .finally(() => {
                if (inflightChats.get(chatId) === request) inflightChats.delete(chatId)
                if (ep === epoch.value && chatState.value[chatId]) chatState.value[chatId].loading = false
            })
        inflightChats.set(chatId, request)
        return request
    }

    // Chats the server lists with an active run this tab is not following
    // (another tab started it, or this tab lost its stream): load them so the
    // recents spinner and the unseen dot follow the run to its end.
    function followServerRuns(summaries) {
        let followed = 0
        for (const s of summaries) {
            if (followed >= SERVER_RUNS_TO_FOLLOW) break
            if (!s.active_run_id || manager.isAttached(s.active_run_id)) continue
            const local = runs.value[s.active_run_id]
            if (local && isTerminalPhase(local.phase) && !local.settledLocally) continue
            followed += 1
            loadChatDetail(s.id, { force: true }).catch(() => {})
        }
    }

    function clearStopTimer(runId) {
        const timer = stopTimers.get(runId)
        if (timer) clearTimeout(timer)
        stopTimers.delete(runId)
    }

    function clearTitleTimer(chatId) {
        const timer = titleTimers.get(chatId)
        if (timer) clearTimeout(timer)
        titleTimers.delete(chatId)
    }

    /**
     * A new chat's generated title is saved after its first reply ended when
     * the title takes longer than the reply, and then no chat.updated event
     * carries it. Ask the server after each TITLE_CHECKS_MS delay until a
     * generated or user title is there.
     */
    function followTitle(chatId, attempt = 0) {
        if (attempt >= TITLE_CHECKS_MS.length) return
        clearTitleTimer(chatId)
        const ep = epoch.value
        const wanted = (chat) => Boolean(chat) && chat.title_source !== 'user' && chat.title_source !== 'model'
        const check = async () => {
            titleTimers.delete(chatId)
            const wid = websiteId.value
            if (ep !== epoch.value || !wid || !wanted(chats.value.byId[chatId])) return
            let detail = null
            try {
                const response = await agentApi.getChat(wid, chatId, { _silentError: true })
                detail = normalizeChatDetail(response?.data)
            } catch (err) {
                if (normalizeError(err).status === 404) return
            }
            const chat = chats.value.byId[chatId]
            if (ep !== epoch.value || !wanted(chat)) return
            if (detail && detail.title) {
                chat.title = detail.title
                chat.title_source = detail.title_source
            }
            if (wanted(chat)) followTitle(chatId, attempt + 1)
        }
        titleTimers.set(chatId, setTimeout(check, TITLE_CHECKS_MS[attempt]))
    }

    /**
     * Drafts the run was still writing when it ended: nothing writes them
     * anymore. When the draft's agent call reports it saved, only its end
     * event missed this tab, so the draft goes and the saved copy loads.
     * Any other one failed.
     */
    function settleDrafts(run) {
        const message = messages.value[run.messageId]
        const calls = (Array.isArray(message?.parts) ? message.parts : []).filter((p) => p && p.type === 'agent_call')
        const stopped = run.phase === RUN_PHASE.CANCELLED
        for (const [aid, entry] of Object.entries(artifacts.value)) {
            const draft = entry?.draft
            if (!draft || draft.runId !== run.id || draft.status !== 'drafting') continue
            const call = calls.filter((p) => idOf(p.artifact_id) === aid).pop()
            if (call && call.status === 'done') {
                entry.draft = null
                refreshArtifact(aid)
                continue
            }
            entry.draft = {
                ...draft,
                status: 'failed',
                error: stopped ? { code: 'stopped', message: 'Stopped' } : { code: 'not_finished', message: 'Not finished' },
            }
        }
    }

    function onRunTerminal(run) {
        if (!run) return
        clearStopTimer(run.id)
        const st = chatState.value[run.chatId]
        if (st && st.activeRunId === run.id) st.activeRunId = null
        const chat = chats.value.byId[run.chatId]
        if (chat) {
            if (chat.active_run_id === run.id) chat.active_run_id = null
            chat.last_message_at = new Date().toISOString()
        }
        settleDrafts(run)
        if (titleWanted.delete(run.chatId) && chat && chat.title_source !== 'user' && chat.title_source !== 'model') {
            followTitle(run.chatId)
        }
        if (viewingChatId.value !== run.chatId) markUnseen(run.chatId)
        // Spend changed: refresh the allowance shown next to the composer.
        loadStatus()
    }

    /** The server has finished `run` but no terminal event reached this tab: its saved message says how. */
    function finishFromSavedMessage(run) {
        const message = messages.value[run.messageId]
        run.phase = phaseFromMessageStatus(message?.status) || RUN_PHASE.DONE
        onRunTerminal(run)
    }

    /**
     * End a run on this side when no terminal event will arrive and the
     * server cannot be asked (its transport failed for good, or the server
     * no longer knows the run). The server stays authoritative: a chat
     * detail that still lists the run as active revives it.
     */
    function settleRunLocally(runId, phase, error = null) {
        const run = runs.value[runId]
        if (!run) return
        manager.detach(runId)
        clearStopTimer(runId)
        if (isTerminalPhase(run.phase)) return
        run.phase = phase
        run.settledLocally = true
        if (error) run.error = error
        const message = messages.value[run.messageId]
        if (message && message.status === MESSAGE_STATUS.STREAMING) {
            message.status = phase === RUN_PHASE.CANCELLED ? MESSAGE_STATUS.CANCELLED : MESSAGE_STATUS.INTERRUPTED
            if (error) {
                message.error_code = error.code || ''
                message.error_message = error.message || ''
            }
        }
        onRunTerminal(run)
    }

    function onTransportClosed(runId, { terminal, error } = {}) {
        if (terminal) return
        const run = runs.value[runId]
        if (!run || isTerminalPhase(run.phase)) return
        if (error) {
            const e = normalizeError(error)
            settleRunLocally(runId, RUN_PHASE.FAILED, { code: e.code || 'transport', message: e.message, retryable: e.retryable })
        }
    }

    async function resyncRun(runId) {
        const run = runs.value[runId]
        if (!run) return null
        const ep = epoch.value
        try {
            await loadChatDetail(run.chatId, { force: true, resync: true })
        } catch {
            return null
        }
        if (ep !== epoch.value) return null
        const fresh = runs.value[runId]
        if (!fresh) return null
        const st = chatState.value[fresh.chatId]
        const message = messages.value[fresh.messageId]
        const active = Boolean(st && st.activeRunId === runId && !isTerminalPhase(fresh.phase))
        if (!active) {
            if (!isTerminalPhase(fresh.phase)) finishFromSavedMessage(fresh)
            return { active: false, lastSeq: fresh.lastSeq }
        }
        fresh.lastSeq = message ? Number(message.parts_seq) || 0 : 0
        return { active: true, lastSeq: fresh.lastSeq }
    }

    function armStopCheck(runId) {
        clearStopTimer(runId)
        stopTimers.set(
            runId,
            setTimeout(() => {
                stopTimers.delete(runId)
                checkStoppingRun(runId)
            }, STOP_FALLBACK_MS)
        )
    }

    /**
     * Stop's fallback: no terminal event yet, so ask the server. A run it
     * still lists as active is still stopping (a tool in flight can take a
     * while to return); the chat stays busy, the transport keeps reading and
     * the check repeats. A run it has finished is settled from the saved
     * message instead of being assumed cancelled.
     */
    async function checkStoppingRun(runId) {
        const run = runs.value[runId]
        if (!run || isTerminalPhase(run.phase) || !websiteId.value) return
        const ep = epoch.value
        let response
        try {
            response = await agentApi.getChat(websiteId.value, run.chatId, { _silentError: true })
        } catch (err) {
            if (ep !== epoch.value) return
            // The chat is gone, so the run is too; anything else: ask again later.
            if (normalizeError(err).status === 404) settleRunLocally(runId, RUN_PHASE.CANCELLED)
            else armStopCheck(runId)
            return
        }
        const current = runs.value[runId]
        if (ep !== epoch.value || !current || isTerminalPhase(current.phase)) return
        const data = response?.data
        const live = normalizeChatDetail(data)?.active_run
        if (live && String(live.id) === runId && !isTerminalPhase(phaseFromRunStatus(live.status))) {
            armStopCheck(runId)
            return
        }
        // Finished on the server without its terminal event reaching this tab:
        // stop reading and take the saved message, which is final.
        manager.detach(runId)
        ingestChatDetail(data, { resync: true })
        if (!isTerminalPhase(current.phase)) finishFromSavedMessage(current)
    }

    function commitDrafts(runId, before, after) {
        if (before === after) return
        for (const [aid, draft] of Object.entries(after)) {
            if (before[aid] === draft) continue
            const next = { ...draft, runId }
            const current = artifacts.value[aid]
            if (current) {
                current.draft = next
                if (!current.title && next.title) current.title = next.title
            } else {
                artifacts.value[aid] = {
                    id: aid,
                    kind: next.kind,
                    title: next.title,
                    agent_key: next.agentKey,
                    latest_version: next.baseVersion ?? null,
                    byVersion: {},
                    versions: null,
                    draft: next,
                }
            }
        }
        for (const aid of Object.keys(before)) {
            if (!(aid in after) && artifacts.value[aid]) artifacts.value[aid].draft = null
        }
    }

    function refreshArtifact(artifactId) {
        loadArtifact(artifactId).catch(() => {
            // The draft keeps the full content when the saved version cannot load.
        })
    }

    function runEffects(run, effects) {
        for (const fx of effects) {
            switch (fx.type) {
                case 'pane.open':
                    withPane(run.chatId, (pane) => {
                        if (fx.tab.kind === 'serp') pane.openSerp(fx.tab, { activate: fx.activate })
                        else if (fx.tab.kind === 'page') pane.openPage(fx.tab, { activate: fx.activate })
                    })
                    break
                case 'pane.update':
                    withPane(run.chatId, (pane) => pane.updateTab(fx.tabId, fx.patch))
                    break
                case 'chat.updated': {
                    // Only the generated title comes as an event; a name the
                    // user set meanwhile stays.
                    const chatId = fx.chatId || run.chatId
                    const chat = chats.value.byId[chatId]
                    if (chat && fx.title && chat.title_source !== 'user') {
                        chat.title = fx.title
                        chat.title_source = 'model'
                    }
                    if (fx.title) titleWanted.delete(chatId)
                    break
                }
                case 'artifact.completed':
                    refreshArtifact(fx.artifactId)
                    break
                case 'resync':
                    resyncRun(run.id)
                    break
                case 'terminal':
                    onRunTerminal(run)
                    break
                default:
                    break
            }
        }
    }

    /** Fold a batch of a run's events into the store (called by runManager once per frame). */
    function applyEvents(runId, events) {
        const run = runs.value[runId]
        if (!run || !Array.isArray(events) || !events.length) return
        const message = messages.value[run.messageId]
        if (!message) return
        const rawRun = toRaw(run)
        const drafts = {}
        for (const [aid, a] of Object.entries(artifacts.value)) {
            if (a && a.draft && a.draft.runId === runId) drafts[aid] = toRaw(a.draft)
        }
        const snapshot = { message: toRaw(message), run: {}, drafts }
        for (const key of RUN_KEYS) snapshot.run[key] = rawRun[key]
        const out = reduceEvents(snapshot, events)
        if (out.message !== snapshot.message) messages.value[run.messageId] = out.message
        for (const key of RUN_KEYS) {
            if (run[key] !== out.run[key]) run[key] = out.run[key]
        }
        commitDrafts(runId, drafts, out.drafts)
        runEffects(run, out.effects)
    }

    function lastPersistedLeaf(chatId) {
        const st = chatState.value[chatId]
        if (!st || !st.leafId) return null
        const path = pathTo(messages.value, st.leafId)
        for (let i = path.length - 1; i >= 0; i -= 1) {
            if (!path[i].local) return path[i].id
        }
        return null
    }

    function dropFailedSends(chatId) {
        const st = chatState.value[chatId]
        for (const [id, m] of Object.entries(messages.value)) {
            if (!m.local || m.chat_id !== chatId || m.status !== MESSAGE_STATUS.SEND_FAILED) continue
            if (st && st.leafId === id) st.leafId = m.parent_id || null
            removeChild(childrenOf.value, parentKeyOf(m), id)
            delete messages.value[id]
        }
    }

    function adoptTempMessage(tempId, raw) {
        const temp = messages.value[tempId] ? toRaw(messages.value[tempId]) : null
        const real = normalizeMessage(raw)
        if (!real) return null
        if (!real.chat_id && temp) real.chat_id = temp.chat_id
        real.client_id = tempId
        if (temp) {
            replaceChild(childrenOf.value, parentKeyOf(temp), tempId, real.id)
            delete messages.value[tempId]
        }
        messages.value[real.id] = real
        mergeChildren(childrenOf.value, parentKeyOf(real), real.sibling_ids)
        for (const st of Object.values(chatState.value)) {
            if (st.leafId === tempId) st.leafId = real.id
        }
        return messages.value[real.id]
    }

    function postSend(tempId) {
        const temp = messages.value[tempId]
        if (!temp || !temp.send) return Promise.resolve(null)
        const chatId = temp.chat_id
        const wid = websiteId.value
        const ep = epoch.value
        const st = ensureChatState(chatId)
        st.pending = true
        temp.status = MESSAGE_STATUS.SENDING
        temp.send.error = null
        temp.error_code = ''
        temp.error_message = ''
        const meta = toRaw(temp.send)
        return agentApi
            .sendMessage(
                wid,
                chatId,
                { text: meta.text, parent_id: meta.parentId || undefined, agent: meta.agent || undefined },
                { idempotencyKey: meta.idempotencyKey }
            )
            .then(({ data }) => {
                if (ep !== epoch.value) return null
                adoptTempMessage(tempId, data?.user_message)
                const assistant = upsertMessage(data?.assistant_message, { chatId })
                const run = startRun(chatId, data?.run, assistant)
                const s = chatState.value[chatId]
                if (s) s.pending = false
                applyEarlyStop(chatId)
                return run
            })
            .catch((err) => {
                if (ep !== epoch.value) return null
                const error = normalizeError(err)
                const m = messages.value[tempId]
                if (m) {
                    m.status = MESSAGE_STATUS.SEND_FAILED
                    m.send.error = error.toJSON()
                    m.error_code = error.code
                    m.error_message = error.message
                }
                const s = chatState.value[chatId]
                if (s) {
                    s.pending = false
                    s.cancelOnStart = false
                }
                // Disabled, unconfigured or over allowance: refresh the banner.
                if (error.status === 503 || error.code === ERROR_CODE.ALLOWANCE_EXCEEDED) loadStatus()
                followBusyChat(chatId, error)
                return null
            })
    }

    /** A Stop pressed while the run-start POST was pending applies to the run it started. */
    function applyEarlyStop(chatId) {
        const st = chatState.value[chatId]
        if (!st || !st.cancelOnStart) return
        st.cancelOnStart = false
        stop(chatId)
    }

    /** 409 run_in_progress: the server is running a turn this tab does not follow; load it. */
    function followBusyChat(chatId, error) {
        if (error.status !== 409 || error.code !== ERROR_CODE.RUN_IN_PROGRESS) return
        loadChatDetail(chatId, { force: true }).catch(() => {})
    }

    function forgetChat(chatId) {
        for (const run of Object.values(runs.value)) {
            if (run.chatId !== chatId) continue
            manager.detach(run.id)
            clearStopTimer(run.id)
            delete runs.value[run.id]
        }
        for (const [id, m] of Object.entries(messages.value)) {
            if (m.chat_id !== chatId) continue
            delete messages.value[id]
            delete childrenOf.value[id]
        }
        delete childrenOf.value[rootKey(chatId)]
        delete chatState.value[chatId]
        inflightChats.delete(chatId)
        titleWanted.delete(chatId)
        clearTitleTimer(chatId)
        delete chats.value.byId[chatId]
        chats.value.order = chats.value.order.filter((id) => id !== chatId)
        // Reset the pane before dropping its stored tabs, or it writes them back.
        withPane(chatId, (pane) => pane.reset())
        const uid = userId()
        const wid = websiteId.value
        clearLastChat(uid, wid, chatId)
        clearDraft(uid, wid, chatId)
        removePaneState(uid, wid, chatId)
        markSeen(chatId)
        if (viewingChatId.value === chatId) viewingChatId.value = null
    }

    function messageOrThrow(id) {
        const message = messages.value[idOf(id)]
        if (!message) throw new AgentError({ status: 404, code: ERROR_CODE.NOT_FOUND })
        return message
    }

    function assertIdle(chatId) {
        if (isChatBusy.value(chatId)) throw new AgentError({ status: 409, code: ERROR_CODE.RUN_IN_PROGRESS })
    }

    /* ── Actions: loading ── */

    /**
     * Scope the store to a project. A different project first resets the
     * previous one (transports detach; runs keep going on the server).
     * Sets websiteId synchronously; the returned promise settles when the
     * status, the first page of chats and the agent catalog have loaded.
     */
    function init(wid) {
        const id = idOf(wid)
        if (!id) return Promise.resolve()
        if (websiteId.value === id) return initPromise || Promise.resolve()
        if (websiteId.value) resetProjectScope()
        websiteId.value = id
        setLastProject(userId(), id)
        initPromise = Promise.allSettled([
            loadStatus(),
            loadChats(),
            catalogLoaded.value ? null : loadCatalog(),
        ]).then(() => undefined)
        return initPromise
    }

    async function loadStatus() {
        statusLoading.value = true
        try {
            const { data } = await agentApi.status({ _silentError: true })
            status.value = data && typeof data === 'object' ? data : null
            statusError.value = null
        } catch (err) {
            statusError.value = normalizeError(err)
        } finally {
            statusLoading.value = false
        }
        return status.value
    }

    /** First page (or the next with `more`), optionally filtered by `q`. Latest call wins. */
    async function loadChats({ more = false, q } = {}) {
        const wid = websiteId.value
        if (!wid) return
        const current = chats.value
        const search = q === undefined ? current.search : String(q ?? '').trim()
        if (more && (!current.hasMore || !current.cursor || search !== current.search)) return
        const token = ++chatsRequest
        const ep = epoch.value
        current.loading = true
        current.error = null
        try {
            const { data } = await agentApi.listChats(
                wid,
                { q: search || undefined, cursor: more ? current.cursor : undefined },
                { _silentError: true }
            )
            if (token !== chatsRequest || ep !== epoch.value) return
            const results = listOf(data).map(normalizeChatSummary).filter(Boolean)
            const c = chats.value
            const order = more ? [...c.order] : []
            for (const summary of results) {
                upsertChatSummary(summary)
                if (!order.includes(summary.id)) order.push(summary.id)
            }
            c.order = order
            c.cursor = data?.next_cursor || null
            c.hasMore = Boolean(c.cursor)
            c.search = search
            c.loaded = true
            followServerRuns(results)
        } catch (err) {
            if (token === chatsRequest && ep === epoch.value) chats.value.error = normalizeError(err)
        } finally {
            if (token === chatsRequest && ep === epoch.value) chats.value.loading = false
        }
    }

    /**
     * Show a chat: loads it once per session (`force` reloads), resumes its
     * active run, remembers it as the project's last chat and clears its
     * unseen mark. `null` or 'new' selects the new-chat state.
     */
    async function openChat(id, { force = false } = {}) {
        const key = idOf(id) || NEW_CHAT_KEY
        viewingChatId.value = key
        if (key === NEW_CHAT_KEY) {
            const fresh = ensureChatState(NEW_CHAT_KEY)
            // A message sent from the new-chat view lives in its chat now.
            if (!fresh.pending) fresh.leafId = null
            return fresh
        }
        if (!websiteId.value) {
            try {
                ensureProject()
            } catch {
                return null
            }
        }
        markSeen(key)
        setLastChat(userId(), websiteId.value, key)
        try {
            await loadChatDetail(key, { force })
        } catch (err) {
            if (err && err.status === 404) clearLastChat(userId(), websiteId.value, key)
        }
        return chatState.value[key] || null
    }

    /** Mark which chat is on screen (null when none), for unseen tracking. */
    function setViewingChat(id) {
        viewingChatId.value = idOf(id)
        if (viewingChatId.value) markSeen(viewingChatId.value)
    }

    /* ── Actions: chats ── */

    async function renameChat(id, title) {
        const wid = ensureProject()
        const chatId = String(id)
        const name = String(title ?? '').trim().slice(0, 120)
        if (!name) throw new AgentError({ status: 400, code: ERROR_CODE.INVALID, message: 'A chat needs a name.' })
        const chat = chats.value.byId[chatId]
        const previous = chat ? { title: chat.title, title_source: chat.title_source } : null
        if (chat) Object.assign(chat, { title: name, title_source: 'user' })
        try {
            const { data } = await agentApi.updateChat(wid, chatId, { title: name }, { ...SILENT })
            const summary = normalizeChatSummary(data)
            if (summary) {
                const { messages: _m, active_run: _r, current_leaf_id: _l, ...rest } = summary
                upsertChatSummary(rest)
            }
            return chats.value.byId[chatId] || null
        } catch (err) {
            if (chat && previous) Object.assign(chat, previous)
            throw normalizeError(err)
        }
    }

    async function deleteChat(id) {
        const wid = ensureProject()
        const chatId = String(id)
        const ep = epoch.value
        try {
            await agentApi.deleteChat(wid, chatId, { ...SILENT })
        } catch (err) {
            const error = normalizeError(err)
            if (error.status !== 404) throw error
        }
        if (ep === epoch.value) forgetChat(chatId)
    }

    /* ── Actions: turns ── */

    /**
     * Send a user message. With no chatId the chat is created first (and
     * the pane's new-chat tabs move to it); the optimistic message shows in
     * the new-chat view meanwhile and is dropped if the chat cannot be
     * created. Resolves with the chat id once the chat exists; the message
     * POST continues in the background (see the header for how its failure
     * surfaces).
     */
    async function send({ chatId = null, text, agent = null } = {}) {
        const body = typeof text === 'string' ? text.trim() : ''
        if (!body) throw new AgentError({ status: 400, code: ERROR_CODE.INVALID, message: 'Write a message first.' })
        const wid = ensureProject()
        const ep = epoch.value
        let cid = idOf(chatId) === NEW_CHAT_KEY ? null : idOf(chatId)
        if (cid) {
            assertIdle(cid)
            // The reply attaches to the current leaf, which needs the chat loaded.
            if (!chatState.value[cid]?.loaded) await loadChatDetail(cid)
            if (ep !== epoch.value) throw new AgentError({ code: 'aborted', message: 'The project changed.' })
            assertIdle(cid)
        }

        if (!cid) {
            const fresh = ensureChatState(NEW_CHAT_KEY)
            if (fresh.pending) throw new AgentError({ status: 409, code: ERROR_CODE.RUN_IN_PROGRESS })
            fresh.pending = true
            fresh.cancelOnStart = false
            // On screen while the chat is created; it then moves to that chat.
            const tempId = addOptimistic(NEW_CHAT_KEY, null, body, agent)
            fresh.leafId = tempId
            try {
                const { data } = await agentApi.createChat(wid, agent ? { entry_agent: agent } : {}, { ...SILENT })
                if (ep !== epoch.value) throw new AgentError({ code: 'aborted', message: 'The project changed.' })
                const detail = ingestChatDetail(data)
                if (!detail) throw new AgentError({ message: 'The chat could not be created.' })
                cid = detail.id
            } catch (err) {
                if (ep === epoch.value) discardOptimistic(tempId)
                throw normalizeError(err)
            } finally {
                const s = chatState.value[NEW_CHAT_KEY]
                if (s) s.pending = false
            }
            try {
                useAgentPaneStore().rekeyChat(NEW_CHAT_KEY, cid)
            } catch {}
            if (viewingChatId.value === NEW_CHAT_KEY) viewingChatId.value = cid
            setLastChat(userId(), wid, cid)
            // Its first reply also gets it a generated title.
            titleWanted.add(cid)

            const temp = messages.value[tempId]
            removeChild(childrenOf.value, rootKey(NEW_CHAT_KEY), tempId)
            temp.chat_id = cid
            addChild(childrenOf.value, parentKeyOf(temp), tempId)
            // The new-chat view keeps showing it until the route moves to the
            // chat; openChat(null) clears it after that.
            const st = ensureChatState(cid)
            st.leafId = tempId
            st.pending = true
            st.cancelOnStart = Boolean(chatState.value[NEW_CHAT_KEY]?.cancelOnStart)
            if (chatState.value[NEW_CHAT_KEY]) chatState.value[NEW_CHAT_KEY].cancelOnStart = false
            moveToTop(cid, body)
            postSend(tempId)
            return cid
        }

        const st = ensureChatState(cid)
        dropFailedSends(cid)
        const tempId = addOptimistic(cid, lastPersistedLeaf(cid), body, agent)
        st.leafId = tempId
        st.pending = true
        st.cancelOnStart = false
        moveToTop(cid, body)
        postSend(tempId)
        return cid
    }

    /** An optimistic user message under `chatKey`, waiting for its POST. */
    function addOptimistic(chatKey, parentId, body, agent) {
        const tempId = `tmp-${newId()}`
        const temp = {
            id: tempId,
            chat_id: chatKey,
            parent_id: parentId,
            role: 'user',
            status: MESSAGE_STATUS.SENDING,
            parts: [{ id: `${tempId}:text`, type: 'text', text: body }],
            parts_seq: 0,
            sibling_ids: [tempId],
            research: { serp: {}, pages: {} },
            created_at: new Date().toISOString(),
            feedback: null,
            saved_report_id: null,
            run_id: null,
            error_code: '',
            error_message: '',
            local: true,
            client_id: tempId,
            send: { idempotencyKey: newId(), text: body, agent: agent || null, parentId, error: null },
        }
        messages.value[tempId] = temp
        addChild(childrenOf.value, parentKeyOf(temp), tempId)
        return tempId
    }

    function discardOptimistic(tempId) {
        const temp = messages.value[tempId]
        if (!temp) return
        removeChild(childrenOf.value, parentKeyOf(temp), tempId)
        delete messages.value[tempId]
        for (const st of Object.values(chatState.value)) {
            if (st.leafId === tempId) st.leafId = null
        }
    }

    /** Re-post a failed optimistic message with its original Idempotency-Key. */
    function retrySend(tempId) {
        const message = messages.value[idOf(tempId)]
        if (!message || !message.local || !message.send) return Promise.resolve(null)
        if (message.status === MESSAGE_STATUS.SENDING) return Promise.resolve(null)
        return postSend(message.id)
    }

    /**
     * Stop the chat's run: POST cancel and keep reading until run.cancelled
     * or run.completed arrives. Without one after 8 s, the server is asked
     * (see checkStoppingRun); the chat stays busy while the server still
     * runs the turn, since a new message would be refused until it ends. A
     * turn still waiting for its 202 is cancelled as soon as the run exists.
     */
    async function stop(chatId) {
        const key = idOf(chatId) || NEW_CHAT_KEY
        const st = chatState.value[key]
        if (!st) return
        const run = activeRun.value(key)
        if (!run) {
            if (st.pending) st.cancelOnStart = true
            return
        }
        if (run.cancelRequested) return
        run.cancelRequested = true
        run.phase = RUN_PHASE.CANCELLING
        armStopCheck(run.id)
        let response
        try {
            response = await agentApi.cancelRun(run.id)
        } catch (err) {
            const error = normalizeError(err)
            // The server does not know the run: nothing will report its end.
            if (error.status === 404) settleRunLocally(run.id, RUN_PHASE.CANCELLED)
            return
        }
        // Already finished on the server: confirm it now rather than in 8 s.
        const status = response?.data?.status
        if (status && isTerminalPhase(phaseFromRunStatus(status))) {
            clearStopTimer(run.id)
            checkStoppingRun(run.id)
        }
    }

    async function regenerate(assistantId) {
        const message = messageOrThrow(assistantId)
        const chatId = message.chat_id
        const wid = ensureProject()
        const ep = epoch.value
        assertIdle(chatId)
        const st = ensureChatState(chatId)
        st.pending = true
        st.cancelOnStart = false
        try {
            const { data } = await agentApi.regenerate(wid, message.id, { ...SILENT })
            if (ep !== epoch.value) return null
            const assistant = upsertMessage(data?.assistant_message, { chatId })
            if (assistant && message.parent_id) addChild(childrenOf.value, String(message.parent_id), assistant.id)
            const run = startRun(chatId, data?.run, assistant)
            applyEarlyStop(chatId)
            return run
        } catch (err) {
            const error = normalizeError(err)
            if (ep === epoch.value) followBusyChat(chatId, error)
            throw error
        } finally {
            const s = ep === epoch.value ? chatState.value[chatId] : null
            if (s) {
                s.pending = false
                s.cancelOnStart = false
            }
        }
    }

    async function startSiblingTurn(message, request) {
        const chatId = message.chat_id
        const ep = epoch.value
        assertIdle(chatId)
        const st = ensureChatState(chatId)
        st.pending = true
        st.cancelOnStart = false
        try {
            const { data } = await request()
            if (ep !== epoch.value) return null
            const user = upsertMessage(data?.user_message, { chatId })
            if (user) addChild(childrenOf.value, parentKeyOf(user), user.id)
            const assistant = upsertMessage(data?.assistant_message, { chatId })
            if (assistant && user) addChild(childrenOf.value, user.id, assistant.id)
            const run = startRun(chatId, data?.run, assistant)
            applyEarlyStop(chatId)
            return run
        } catch (err) {
            const error = normalizeError(err)
            if (ep === epoch.value) followBusyChat(chatId, error)
            throw error
        } finally {
            const s = ep === epoch.value ? chatState.value[chatId] : null
            if (s) {
                s.pending = false
                s.cancelOnStart = false
            }
        }
    }

    /** Edit a user message: a new user sibling and a fresh reply. */
    async function editMessage(userMessageId, text) {
        const message = messageOrThrow(userMessageId)
        const body = typeof text === 'string' ? text.trim() : ''
        if (!body) throw new AgentError({ status: 400, code: ERROR_CODE.INVALID, message: 'Write a message first.' })
        if (message.local && message.send) {
            // Not on the server yet: change the text and post it again. Other
            // text is another request, so it takes a new Idempotency-Key; the
            // old key would replay a turn the server may have started with
            // the old text.
            message.parts = [{ id: `${message.id}:text`, type: 'text', text: body }]
            if (message.send.text !== body) message.send.idempotencyKey = newId()
            message.send.text = body
            return retrySend(message.id)
        }
        const wid = ensureProject()
        return startSiblingTurn(message, () => agentApi.editMessage(wid, message.id, { text: body }, { ...SILENT }))
    }

    /** Continue a truncated reply. */
    async function continueMessage(assistantId) {
        const message = messageOrThrow(assistantId)
        const wid = ensureProject()
        return startSiblingTurn(message, () => agentApi.continueMessage(wid, message.id, { ...SILENT }))
    }

    /* ── Actions: branches and feedback ── */

    /**
     * Show the previous (dir < 0 or 'prev') or next sibling of a message.
     * The newest leaf under it shows at once when this session knows it;
     * the server's path (PATCH current_leaf_id) then replaces it.
     */
    async function switchBranch(id, dir) {
        const message = messageOrThrow(id)
        const info = treeSiblingInfo(childrenOf.value, messages.value, message.id)
        const step = dir === 'prev' || Number(dir) < 0 ? -1 : 1
        const targetId = info.ids[info.index + step]
        if (!targetId) return null
        const chatId = message.chat_id
        const wid = ensureProject()
        const ep = epoch.value
        const st = ensureChatState(chatId)
        const previousLeaf = st.leafId
        if (messages.value[targetId]) st.leafId = newestLeaf(childrenOf.value, messages.value, targetId)
        try {
            const { data } = await agentApi.updateChat(wid, chatId, { current_leaf_id: targetId }, { _silentError: true })
            if (ep !== epoch.value) return null
            ingestChatDetail(data)
            return chatState.value[chatId]?.leafId || null
        } catch (err) {
            if (ep === epoch.value && chatState.value[chatId]) chatState.value[chatId].leafId = previousLeaf
            throw normalizeError(err)
        }
    }

    /** Thumbs feedback: value 1, -1, or 0 to clear; extra {reason, comment}. */
    async function sendFeedback(id, value, extra = {}) {
        const message = messageOrThrow(id)
        const wid = ensureProject()
        const v = Number(value) > 0 ? 1 : Number(value) < 0 ? -1 : 0
        const previous = { feedback: message.feedback, feedback_reason: message.feedback_reason }
        message.feedback = v === 0 ? null : v
        if (extra && extra.reason !== undefined) message.feedback_reason = extra.reason
        try {
            const payload = { value: v }
            if (extra && extra.reason) payload.reason = extra.reason
            if (extra && extra.comment) payload.comment = extra.comment
            const { data } = await agentApi.feedback(wid, message.id, payload, { ...SILENT })
            if (data && data.value !== undefined) message.feedback = data.value === 0 ? null : data.value
            return message.feedback
        } catch (err) {
            Object.assign(message, previous)
            throw normalizeError(err)
        }
    }

    /* ── Actions: reports and artifacts ── */

    function ensureArtifact(id) {
        const key = String(id)
        if (!artifacts.value[key]) artifacts.value[key] = { id: key, byVersion: {}, versions: null, draft: null }
        return artifacts.value[key]
    }

    function mergeArtifact(raw) {
        const a = normalizeArtifact(raw)
        if (!a) return null
        const prev = artifacts.value[a.id] ? toRaw(artifacts.value[a.id]) : null
        const next = { byVersion: {}, versions: null, draft: null, ...(prev || {}), ...a }
        next.draft = prev ? prev.draft || null : null
        if ('content' in a && a.version !== undefined && a.version !== null) {
            next.byVersion = { ...(next.byVersion || {}), [String(a.version)]: { ...a } }
            // A saved version at or past the draft's supersedes the draft.
            const draft = next.draft
            if (draft && draft.status === 'done' && Number(a.version) >= Number(draft.version || 0)) next.draft = null
        }
        artifacts.value[a.id] = next
        return artifacts.value[a.id]
    }

    /** Save an assistant reply to Reports. 409 already_saved resolves with {id, already_saved: true}. */
    async function saveReport(messageId, title) {
        const message = messageOrThrow(messageId)
        const wid = ensureProject()
        try {
            const body = { message_id: message.id }
            if (typeof title === 'string' && title.trim()) body.title = title.trim()
            const { data } = await agentApi.saveReport(wid, body, { _silentError: true })
            const saved = mergeArtifact(data)
            if (saved) message.saved_report_id = saved.id
            return saved
        } catch (err) {
            const error = normalizeError(err)
            const existing = idOf(error.details?.artifact_id)
            if (error.code === ERROR_CODE.ALREADY_SAVED && existing) {
                message.saved_report_id = existing
                return { id: existing, already_saved: true }
            }
            throw error
        }
    }

    /** The latest version (or `version`) of an artifact, with its content. */
    async function loadArtifact(id, version = null) {
        const wid = ensureProject()
        const ep = epoch.value
        const key = String(id)
        try {
            if (version === null || version === undefined || version === '') {
                const { data } = await agentApi.getArtifact(wid, key, { _silentError: true })
                if (ep !== epoch.value) return null
                return mergeArtifact(data)
            }
            const { data } = await agentApi.getVersion(wid, key, version, { _silentError: true })
            if (ep !== epoch.value) return null
            const entry = ensureArtifact(key)
            entry.byVersion = { ...(entry.byVersion || {}), [String(version)]: data }
            return entry.byVersion[String(version)]
        } catch (err) {
            throw normalizeError(err)
        }
    }

    async function loadVersions(id) {
        const wid = ensureProject()
        const ep = epoch.value
        try {
            const { data } = await agentApi.listVersions(wid, String(id), { _silentError: true })
            if (ep !== epoch.value) return []
            const list = listOf(data)
            ensureArtifact(id).versions = list
            return list
        } catch (err) {
            throw normalizeError(err)
        }
    }

    /** Artifact summaries of the given kinds (all when empty), optionally searched. */
    async function loadArtifacts(kinds = null, q = '') {
        const wid = ensureProject()
        const ep = epoch.value
        try {
            const { data } = await agentApi.listArtifacts(
                wid,
                { kinds: Array.isArray(kinds) && kinds.length ? kinds : kinds || undefined, q: q || undefined },
                { _silentError: true }
            )
            if (ep !== epoch.value) return []
            const list = listOf(data).map(normalizeArtifact).filter(Boolean)
            for (const a of list) mergeArtifact(a)
            return list
        } catch (err) {
            throw normalizeError(err)
        }
    }

    /* ── Actions: other ── */

    async function loadCatalog({ force = false } = {}) {
        if (catalogLoaded.value && !force) return catalog.value
        try {
            const { data } = await agentApi.agents({ _silentError: true })
            catalog.value = listOf(data)
            catalogLoaded.value = true
            return catalog.value
        } catch (err) {
            throw normalizeError(err)
        }
    }

    async function loadSuggestions() {
        const wid = ensureProject()
        const ep = epoch.value
        try {
            const { data } = await agentApi.suggestions(wid, { _silentError: true })
            if (ep !== epoch.value) return []
            suggestions.value = listOf(data)
            return suggestions.value
        } catch (err) {
            throw normalizeError(err)
        }
    }

    /** The brand context. Pass the page's `websiteId`; another project in scope throws project_changed. */
    async function loadContext({ websiteId: expected = null } = {}) {
        const wid = ensureProject(expected)
        const ep = epoch.value
        try {
            const { data } = await agentApi.getContext(wid, { _silentError: true })
            if (ep !== epoch.value) return null
            context.value = data && typeof data === 'object' ? data : null
            return context.value
        } catch (err) {
            throw normalizeError(err)
        }
    }

    /**
     * PUT the brand context with its revision; a stale one throws code
     * revision_conflict. Pass the page's `websiteId`: a form shown for one
     * project is never written to another (that throws project_changed).
     */
    async function saveContext(payload = {}, { websiteId: expected = null } = {}) {
        const wid = ensureProject(expected)
        const ep = epoch.value
        const body = {
            audience: payload.audience ?? '',
            voice: payload.voice ?? '',
            offerings: Array.isArray(payload.offerings) ? payload.offerings : [],
            rules: Array.isArray(payload.rules) ? payload.rules : [],
            revision: payload.revision ?? context.value?.revision ?? 0,
        }
        try {
            const { data } = await agentApi.putContext(wid, body, { _silentError: true })
            if (ep === epoch.value) context.value = data && typeof data === 'object' ? data : context.value
            return context.value
        } catch (err) {
            throw normalizeError(err)
        }
    }

    async function loadActivity() {
        const wid = ensureProject()
        const ep = epoch.value
        try {
            const { data } = await agentApi.activity(wid, { _silentError: true })
            if (ep !== epoch.value) return []
            activity.value = listOf(data)
            return activity.value
        } catch (err) {
            throw normalizeError(err)
        }
    }

    /* ── Actions: resets ── */

    /** Leave the project: detach every transport (runs keep going on the server) and drop its data. */
    function resetProjectScope() {
        manager.detachAll()
        for (const timer of stopTimers.values()) clearTimeout(timer)
        stopTimers.clear()
        for (const timer of titleTimers.values()) clearTimeout(timer)
        titleTimers.clear()
        titleWanted.clear()
        inflightChats.clear()
        epoch.value += 1
        chatsRequest += 1
        initPromise = null
        websiteId.value = null
        chats.value = freshChats()
        chatState.value = {}
        messages.value = {}
        childrenOf.value = {}
        runs.value = {}
        artifacts.value = {}
        suggestions.value = []
        context.value = null
        activity.value = []
        viewingChatId.value = null
    }

    /** Sign-out or a different user: drop everything, including status and the catalog. */
    function resetAll() {
        resetProjectScope()
        status.value = null
        statusError.value = null
        statusLoading.value = false
        catalog.value = []
        catalogLoaded.value = false
    }

    /* ── Watchers ── */

    // Sign-out drops every user's data right away (clearAuth runs this
    // before it returns); the token watcher covers a token cleared otherwise.
    auth.onClearAuth(() => resetAll())
    watch(
        () => auth.accessToken,
        (token, before) => {
            if (!token && before) resetAll()
        }
    )
    watch(
        () => idOf(auth.user?.id),
        (now, before) => {
            if (before && now && now !== before) resetAll()
            else if (now && websiteId.value) setLastProject(now, websiteId.value)
        }
    )
    // The project follows the workspace URL, never app.activeWebsite on its
    // own: AgentShell calls init() for the project in view. The active
    // website can change while a page that blocked the switch (unsaved
    // context edits) still shows the old project.

    return {
        // state
        websiteId,
        epoch,
        status,
        statusError,
        statusLoading,
        chats,
        chatState,
        messages,
        childrenOf,
        runs,
        artifacts,
        catalog,
        catalogLoaded,
        suggestions,
        context,
        activity,
        viewingChatId,
        // getters
        recents,
        visiblePath,
        siblingInfo,
        activeRun,
        isChatBusy,
        artifact,
        runOf,
        // loading
        init,
        loadStatus,
        loadChats,
        openChat,
        setViewingChat,
        // chats
        renameChat,
        deleteChat,
        // turns
        send,
        stop,
        regenerate,
        editMessage,
        continueMessage,
        retrySend,
        // branches and feedback
        switchBranch,
        sendFeedback,
        // reports and artifacts
        saveReport,
        loadArtifact,
        loadVersions,
        loadArtifacts,
        // other
        loadCatalog,
        loadSuggestions,
        loadContext,
        saveContext,
        loadActivity,
        // streaming (runManager calls this; exposed for tests and tools)
        applyEvents,
        // resets
        resetProjectScope,
        resetAll,
    }
})
