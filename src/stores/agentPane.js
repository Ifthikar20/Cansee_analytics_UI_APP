import { defineStore } from 'pinia'
import { computed, markRaw, ref, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import { hostOf, isHttpUrl, normalizeAddress } from '@/lib/agent/url'
import { taskError } from '@/lib/agent/normalize'
import { swarmTabOrder } from '@/lib/agent/reducer'
import { loadPaneState, loadUiPrefs, movePaneState, savePaneState, saveUiPrefs } from '@/lib/agent/storage'

// Browser pane state for the bound chat: the tab list, the active tab and the
// split geometry. Research tabs (Google results pages and inspected pages)
// come from browser.* events while a run streams and are rebuilt from each
// message's `research` after a reload. Per chat only ids and URLs are stored
// (cs-agent-tabs-v1); the split ratio and the SEO facts panel are device
// prefs (cs-agent-ui-v1).
//
// The research agents (swarm parts) take their captures without browser
// events. Their Google results pages open as background tabs as each one is
// recorded (openSerp with `background`): ordered by task (prompt, then page),
// never taking the active tab, revealing the pane at most once per run, and
// rebuilt from the research store after a reload. The strip holds one such
// tab per Google page (query, page and location): a re-run's newer capture
// takes the place of the earlier run's tab, live and on a rebuild. Their page
// captures still open on click (a task row calls openCapture). A swarm's
// results table is a `table` tab, one per swarm: {id: 'table:<swarmId>',
// kind: 'table', swarmId, version, title}, where a null version follows the
// latest.
//
// Tab statuses: idle (a URL not fetched yet), loading, ready, error, missing
// (restored from storage, waiting for the chat's research) and gone (the
// chat loaded without that capture).

export const MAX_TABS = 12
const MAX_CLOSED = 100
const MAX_STASH = 30
const RESEARCH_KINDS = new Set(['serp', 'page'])
const TAB_FIELDS = new Set([
    'title',
    'status',
    'mode',
    'url',
    'finalUrl',
    'history',
    'version',
    'kind',
    'artifactId',
    'swarmId',
    'nonce',
])
const ACTIVE_AGENT_STATUSES = new Set(['planning', 'drafting', 'validating'])
const SETTLED_AGENT_STATUSES = new Set(['done', 'error', 'cancelled'])
// Reply statuses after which none of its steps is still running, whatever
// the last event about a step said.
const ENDED_STATUSES = new Set(['complete', 'truncated', 'refused', 'cancelled', 'failed', 'interrupted'])
const LAYOUTS = new Set(['split', 'overlay', 'fullscreen'])

function isPhone() {
    try {
        return window.matchMedia('(max-width: 767px)').matches
    } catch {
        return false
    }
}

function newId(prefix) {
    return `${prefix}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// The user id claim of the stored access token, so stored tabs can be read
// before the session request finishes after a reload.
function tokenUserId(token) {
    if (typeof token !== 'string') return null
    try {
        const part = token.split('.')[1]
        if (!part) return null
        const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
        const id = json.user_id ?? json.sub
        return id === undefined || id === null ? null : id
    } catch {
        return null
    }
}

// Which Google page a capture shows: its query, results page and location
// ('' when the capture does not say its query). Two captures with the same
// key show the same page, taken at different times.
export function serpPageKey(capture) {
    const query = capture && typeof capture.query === 'string' ? capture.query.trim().replace(/\s+/g, ' ').toLowerCase() : ''
    if (!query) return ''
    const page = Number(capture.page)
    const location = typeof capture.location === 'string' ? capture.location.trim().toLowerCase() : ''
    return `${query}\n${Number.isInteger(page) && page > 0 ? page : 1}\n${location}`
}

// The same title the server gives a results tab, page number included.
export function serpTitle(capture) {
    const query = capture && typeof capture.query === 'string' ? capture.query : ''
    if (!query) return 'Google'
    const page = Number(capture.page)
    return Number.isInteger(page) && page > 0 ? `Google · ${query} · p${page}` : `Google · ${query}`
}

// Same rule as the reducer: a capture is settled once it has an error, a
// results list (serp) or page facts (page).
function captureStatus(kind, capture) {
    if (!capture) return 'loading'
    if (capture.error) return 'error'
    if (kind === 'serp' && Array.isArray(capture.results)) return 'ready'
    if (kind === 'page' && (capture.seo || capture.reader || capture.final_url)) return 'ready'
    return 'loading'
}

// BrowserTabSpec or a bare SerpCapture -> {id, title, status, data}.
function serpSpec(input) {
    if (!input || typeof input !== 'object') return null
    if (typeof input.id === 'string' && input.id) {
        const data = input.data && typeof input.data === 'object' ? input.data : null
        return { id: input.id, title: input.title || serpTitle(data), status: input.status || captureStatus('serp', data), data }
    }
    if (input.capture_id) {
        return { id: `serp:${input.capture_id}`, title: serpTitle(input), status: captureStatus('serp', input), data: input }
    }
    return null
}

// BrowserTabSpec or a bare PageCapture -> {id, title, status, data}.
function pageSpec(input) {
    if (!input || typeof input !== 'object') return null
    let id
    let data
    let title = ''
    let status = ''
    if (typeof input.id === 'string' && input.id) {
        id = input.id
        data = input.data && typeof input.data === 'object' ? input.data : null
        title = input.title || ''
        status = input.status || ''
    } else if (input.capture_id) {
        id = `page:${input.capture_id}`
        data = input
    } else {
        return null
    }
    const url = (data && (data.final_url || data.url)) || ''
    return {
        id,
        title: title || (data && (data.title || data.seo?.title)) || hostOf(url) || 'Page',
        status: status || captureStatus('page', data),
        data,
    }
}

function historyFor(url) {
    return url ? { entries: [url], index: 0 } : { entries: [], index: -1 }
}

function pageFields(data) {
    const d = data || {}
    return { url: d.url || null, finalUrl: d.final_url || null, history: historyFor(d.url || null) }
}

function running(part) {
    return part.status === 'running' || part.status === 'queued'
}

function partStatus(part, ended) {
    if (part.status === 'error') return 'error'
    if (running(part)) return ended ? 'error' : 'loading'
    return 'missing'
}

// What the server writes on a step it closes when a run ends; a reply that
// was settled on this side gets the same.
function endedError(messageStatus) {
    if (messageStatus === 'cancelled') return { code: 'stopped', message: 'Stopped' }
    if (messageStatus === 'interrupted') return { code: 'interrupted', message: 'Interrupted' }
    return { code: 'not_finished', message: 'Not finished' }
}

function errorText(error) {
    if (typeof error === 'string') return error
    return error && typeof error.message === 'string' ? error.message : ''
}

// "serp:<id>" -> 'serp', "page:<id>" -> 'page'; '' for anything else.
function captureKind(tabId) {
    if (typeof tabId !== 'string') return ''
    const colon = tabId.indexOf(':')
    if (colon <= 0 || colon === tabId.length - 1) return ''
    const kind = tabId.slice(0, colon)
    return RESEARCH_KINDS.has(kind) ? kind : ''
}

// The tab of a capture a research agent took (task.pane), built from the
// research store like a step's tab. A task names its capture only once it
// has finished, so without a capture the tab is `missing`. A Google page
// opens by itself (auto) in its place among the swarm's pages (`order`);
// a page capture waits for a click. `swarm` marks a research agent's Google
// page, which a newer capture of the same page supersedes.
function swarmTaskSpec(task, serps, pages, order) {
    const tabId = task.pane.tab_id
    const kind = captureKind(tabId)
    if (!kind) return null
    const captureId = tabId.slice(kind.length + 1)
    const detail = task.detail && typeof task.detail === 'object' ? task.detail : {}
    const error = task.status === 'done' ? null : taskError(task.error)
    if (kind === 'serp') {
        const capture = serps[captureId] || null
        const status = captureStatus('serp', capture)
        const data = capture || { query: detail.query, page: detail.page, location: detail.location, error }
        return {
            id: tabId,
            kind: 'serp',
            title: serpTitle(data),
            status: status === 'loading' ? (error ? 'error' : 'missing') : status,
            data,
            order,
            swarm: true,
            complete: status !== 'loading',
            auto: true,
        }
    }
    const capture = pages[captureId] || null
    const status = captureStatus('page', capture)
    const url = detail.final_url || detail.url || ''
    const data = capture || { url: detail.url || null, error }
    return {
        id: tabId,
        kind: 'page',
        title: capture?.seo?.title || detail.title || hostOf(url) || 'Page',
        status: status === 'loading' ? (error ? 'error' : 'missing') : status,
        data,
        complete: status !== 'loading',
        auto: false,
    }
}

// Research and artifact tabs referenced by the messages, oldest first.
//
// An artifact gets one spec, from its first call; later calls on it (its
// revisions) update the spec, so agentStatus and callId are the latest
// call's. saved: a call finished, recorded a version, or revised an earlier
// version. unsaved: none did and none is running, so the artifact was never
// created: the agent names it when it starts and saves it only when a draft
// passes its checks.
//
// includeSwarm also yields the capture of each research agent (the first
// task naming it): Google pages with `auto: true`, so a fresh load rebuilds
// them as it rebuilds a step's tabs; page captures with `auto: false`, so
// the pane rebuilds and reopens those but never adds them by itself. A
// Google page that a later research agent captured again (a re-run: same
// query, page and location) is superseded: `auto: false` and `supersededBy`
// the newest capture's tab id, so only the newest opens by itself.
export function researchTabs(messages, { includeSwarm = false } = {}) {
    const out = []
    const seen = new Set()
    const artifacts = new Map()
    for (const m of messages || []) {
        if (!m || m.role !== 'assistant') continue
        const research = m.research || {}
        const serps = research.serp || {}
        const pages = research.pages || {}
        const ended = ENDED_STATUSES.has(m.status)
        for (const part of m.parts || []) {
            if (!part) continue
            if (part.type === 'swarm') {
                if (!includeSwarm || !Array.isArray(part.tasks)) continue
                part.tasks.forEach((task, index) => {
                    const tabId = task && task.pane && task.pane.tab_id
                    if (typeof tabId !== 'string' || seen.has(tabId)) return
                    const spec = swarmTaskSpec(task, serps, pages, swarmTabOrder(part, index))
                    if (!spec) return
                    seen.add(tabId)
                    out.push(spec)
                })
                continue
            }
            if ((part.type === 'serp' || part.type === 'page_inspect') && typeof part.tab_id === 'string') {
                if (seen.has(part.tab_id)) continue
                seen.add(part.tab_id)
                const captureId = part.tab_id.replace(/^(serp|page):/, '')
                const error = part.error || (ended && running(part) ? endedError(m.status) : null)
                if (part.type === 'serp') {
                    const capture = serps[captureId] || null
                    const status = captureStatus('serp', capture)
                    const data = capture || {
                        query: part.query,
                        page: part.page,
                        location: part.location,
                        error,
                    }
                    out.push({
                        id: part.tab_id,
                        kind: 'serp',
                        title: serpTitle(data),
                        status: status === 'loading' ? partStatus(part, ended) : status,
                        data,
                        complete: status !== 'loading',
                    })
                } else {
                    const capture = pages[captureId] || null
                    const status = captureStatus('page', capture)
                    const data = capture || { url: part.url, error }
                    out.push({
                        id: part.tab_id,
                        kind: 'page',
                        title: part.title || capture?.seo?.title || hostOf(part.url) || 'Page',
                        status: status === 'loading' ? partStatus(part, ended) : status,
                        data,
                        complete: status !== 'loading',
                    })
                }
            } else if (part.type === 'agent_call' && part.artifact_id !== undefined && part.artifact_id !== null) {
                const id = `artifact:${part.artifact_id}`
                // A call still marked as working in a reply that ended did not finish.
                const cut = ended && !SETTLED_AGENT_STATUSES.has(part.status)
                const call = {
                    agentStatus: cut ? (m.status === 'cancelled' ? 'cancelled' : 'error') : part.status,
                    callId: part.id ?? null,
                    error: errorText(part.error) || (cut ? endedError(m.status).message : ''),
                }
                // base_version > 0: the call revises an artifact saved before it.
                const saved =
                    part.status === 'done' ||
                    (part.version !== undefined && part.version !== null) ||
                    Number(part.base_version) > 0
                const spec = artifacts.get(id)
                if (spec) {
                    Object.assign(spec, call, {
                        saved: spec.saved || saved,
                        title: part.title || spec.title,
                        artifactKind: part.kind || spec.artifactKind,
                    })
                } else {
                    const added = {
                        id,
                        kind: 'artifact',
                        artifactId: part.artifact_id,
                        title: part.title || '',
                        status: 'ready',
                        ...call,
                        saved,
                        artifactKind: part.kind || '',
                    }
                    artifacts.set(id, added)
                    out.push(added)
                }
            }
        }
    }
    for (const spec of artifacts.values()) spec.unsaved = !spec.saved && !ACTIVE_AGENT_STATUSES.has(spec.agentStatus)
    if (includeSwarm) markSuperseded(out)
    return out
}

// Specs come oldest first, so the last research-agent capture of a Google
// page is the newest; every earlier capture of that page is superseded.
function markSuperseded(specs) {
    const newest = new Map()
    for (const spec of specs) {
        const key = spec.swarm ? serpPageKey(spec.data) : ''
        if (key) newest.set(key, spec.id)
    }
    for (const spec of specs) {
        const latest = spec.swarm ? newest.get(serpPageKey(spec.data)) : null
        if (!latest || latest === spec.id) continue
        spec.auto = false
        spec.supersededBy = latest
    }
}

export const useAgentPaneStore = defineStore('agentPane', () => {
    const agent = useAgentStore()
    const auth = useAuthStore()

    const prefs = loadUiPrefs()

    const chatKey = ref(null)
    const open = ref(false)
    const expanded = ref(false)
    // The chat column's share of the workspace width (0..1).
    const ratio = ref(Number.isFinite(prefs.paneRatio) ? Math.min(0.85, Math.max(0.15, prefs.paneRatio)) : 0.5)
    const tabs = ref([])
    const activeId = ref(null)
    const returnFocusEl = ref(null)
    const factsOpen = ref(prefs.seoFactsOpen !== false)
    // The workspace layout (split, overlay or fullscreen), once it has
    // measured itself; null before.
    const layout = ref(null)
    // The agent had tabs to show while the pane stayed closed.
    const attention = ref(false)

    let openedByAgent = false
    let closed = new Set()
    // Agent calls whose artifact was opened, so each call opens it once.
    let autoOpened = new Set()
    // Runs whose background tabs already revealed the pane (or tried to).
    let revealed = new Set()
    let stash = new Map()
    let restored = false
    let savedLoaded = false
    let useSeq = 0
    let scope = null
    let persistTimer = null
    let lastWritten = ''

    const activeTab = computed(() => tabs.value.find((t) => t.id === activeId.value) || null)
    const hasTabs = computed(() => tabs.value.length > 0)

    function byId(id) {
        return tabs.value.find((t) => t.id === id) || null
    }

    function artifactOf(id) {
        if (id === undefined || id === null) return null
        try {
            if (typeof agent.artifact === 'function') return agent.artifact(id) || null
        } catch {}
        return (agent.artifacts && agent.artifacts[id]) || null
    }

    function titleOf(tab) {
        if (!tab) return ''
        if (tab.kind === 'artifact') {
            const a = artifactOf(tab.artifactId)
            return (a && ((a.draft && a.draft.title) || a.title)) || tab.title || 'Untitled'
        }
        if (tab.kind === 'newtab') return 'New tab'
        if (tab.kind === 'table') return tab.title || 'Research results'
        if (tab.kind === 'url' || tab.kind === 'page') {
            const d = tab.data || {}
            return d.title || d.seo?.title || tab.title || hostOf(tab.finalUrl || tab.url) || 'Page'
        }
        return tab.title || 'Google'
    }

    function messageList(key) {
        let path
        try {
            path = typeof agent.visiblePath === 'function' ? agent.visiblePath(key) || [] : []
        } catch {
            path = []
        }
        const map = agent.messages || {}
        return path.map((m) => (m && typeof m === 'object' ? m : map[m])).filter(Boolean)
    }

    function chatLoaded(key) {
        const state = agent.chatState && agent.chatState[key]
        return Boolean(state && state.loaded)
    }

    // ── Persistence ──

    function scopeKey(s) {
        return s ? `${s.uid}:${s.wid}` : null
    }

    function currentScope() {
        const uid = auth.user?.id ?? auth.session?.user?.id ?? tokenUserId(auth.accessToken)
        const wid = agent.websiteId
        if (uid === undefined || uid === null || wid === undefined || wid === null || wid === '') return null
        return { uid: String(uid), wid: String(wid) }
    }

    function snapshot() {
        return {
            open: open.value,
            active: activeId.value,
            tabs: tabs.value.map((t) => {
                const entry = { id: t.id, kind: t.kind }
                if (t.kind === 'url' && t.url) entry.url = t.url
                if (t.kind === 'artifact') {
                    entry.artifact_id = t.artifactId
                    if (t.version) entry.version = t.version
                }
                if (t.kind === 'table') {
                    entry.swarm_id = t.swarmId
                    entry.version = t.version ?? null
                }
                if (t.mode) entry.mode = t.mode
                return entry
            }),
        }
    }

    function writeNow() {
        if (persistTimer) {
            clearTimeout(persistTimer)
            persistTimer = null
        }
        const chat = chatKey.value
        if (!chat || chat === 'new') return
        if (!scope) scope = currentScope()
        if (!scope) return
        const state = { ...snapshot(), closed: Array.from(closed).slice(-MAX_CLOSED) }
        const text = JSON.stringify([scopeKey(scope), chat, state])
        if (text === lastWritten) return
        lastWritten = text
        savePaneState(scope.uid, scope.wid, chat, state)
    }

    function schedulePersist() {
        if (persistTimer) clearTimeout(persistTimer)
        persistTimer = setTimeout(writeNow, 150)
    }

    function readChat(s, chat) {
        if (!s) return null
        const state = loadPaneState(s.uid, s.wid, chat)
        return state && Array.isArray(state.tabs) ? state : null
    }

    // ── Tabs ──

    function touch(tab) {
        if (tab) tab.usedAt = ++useSeq
    }

    function rememberClosed(tab) {
        if (!RESEARCH_KINDS.has(tab.kind) && tab.kind !== 'artifact') return
        closed.add(tab.id)
        if (tab.data && (tab.status === 'ready' || tab.status === 'error')) {
            stash.delete(tab.id)
            stash.set(tab.id, { title: tab.title, status: tab.status, data: tab.data })
            if (stash.size > MAX_STASH) stash.delete(stash.keys().next().value)
        }
    }

    function evictOverflow(keepId) {
        while (tabs.value.length > MAX_TABS) {
            let victim = null
            for (const t of tabs.value) {
                if (t.id === activeId.value || t.id === keepId) continue
                if (!victim || t.usedAt < victim.usedAt) victim = t
            }
            if (!victim) return
            tabs.value = tabs.value.filter((t) => t !== victim)
            rememberClosed(victim)
        }
    }

    // Where a tab with `order` ({group, index}, kept in memory only) goes:
    // after the last tab of its group with a smaller index, else before the
    // first one with a larger index, else last.
    function orderedIndex(order) {
        const list = tabs.value
        if (!order || order.group === undefined || order.group === null) return list.length
        let after = -1
        let before = -1
        list.forEach((t, i) => {
            if (!t.order || t.order.group !== order.group) return
            if (t.order.index < order.index) after = i
            else if (t.order.index > order.index && before === -1) before = i
        })
        if (after !== -1) return after + 1
        return before !== -1 ? before : list.length
    }

    function newTab(tab) {
        return {
            title: '',
            status: 'ready',
            data: null,
            url: null,
            finalUrl: null,
            mode: null,
            history: null,
            artifactId: null,
            version: null,
            ...tab,
        }
    }

    function addTab(tab) {
        const at = orderedIndex(tab.order)
        tabs.value.splice(at, 0, newTab(tab))
        const added = tabs.value[at]
        touch(added)
        evictOverflow(added.id)
        return added
    }

    // The other research-agent tabs showing the same Google page as `tab`
    // (query, page and location) under another capture.
    function samePageTabs(tab) {
        const key = tab.kind === 'serp' && tab.swarm ? serpPageKey(tab.data) : ''
        if (!key) return []
        return tabs.value.filter((t) => t.id !== tab.id && t.kind === 'serp' && t.swarm && serpPageKey(t.data) === key)
    }

    // Drops `others` for `tab` (in the strip or not yet): it takes the
    // earliest place among them and, when one of them was active, the active
    // tab. The dropped tabs count as closed, so neither a rebuild nor a
    // background open brings them back; a click on their task row still does.
    function supersede(tab, others) {
        const wasActive = others.some((t) => t.id === activeId.value)
        const dropped = new Set(others.map((t) => t.id))
        const list = []
        let placed = false
        for (const t of tabs.value) {
            if (t.id === tab.id || dropped.has(t.id)) {
                if (!placed) list.push(tab)
                placed = true
                continue
            }
            list.push(t)
        }
        if (!placed) list.push(tab)
        tabs.value = list
        for (const other of others) rememberClosed(other)
        const kept = byId(tab.id)
        if (wasActive && kept) select(kept)
        return kept
    }

    // Adds a tab. A research agent's Google page takes the place of the
    // agents' tabs that show the same page, so the strip keeps one tab per
    // Google page: the newest capture, or the one the user opened last.
    function placeTab(tab) {
        const fields = newTab(tab)
        const others = samePageTabs(fields)
        if (!others.length) return addTab(tab)
        const kept = supersede(fields, others)
        touch(kept)
        return kept
    }

    // Opens the pane for the user: a click, a key, a link.
    function show() {
        open.value = true
        openedByAgent = false
        attention.value = false
    }

    // The pane would cover the chat: an overlay (a narrow workspace), a
    // full-screen dialog, or a phone before the workspace has measured itself.
    function coversChat() {
        return layout.value ? layout.value !== 'split' : isPhone()
    }

    // Opens the pane for agent-driven tabs where it sits beside the chat. As
    // an overlay (a narrow workspace) or a full-screen dialog (phones) it
    // would cover the chat the user is typing in, so it stays closed and
    // `attention` marks that there is something to see.
    function reveal() {
        if (open.value) return
        if (coversChat()) {
            attention.value = true
            return
        }
        open.value = true
        openedByAgent = true
        attention.value = false
    }

    // The first background tab of a run (`key`) shows the pane once: beside
    // the chat it opens on that tab; where it would cover the chat only
    // `attention` is set. Later tabs of the run, and an open pane, change
    // nothing. Focus is never moved.
    function revealOnce(tab, key) {
        if (key === undefined || key === null || key === '') return
        const k = String(key)
        if (revealed.has(k)) return
        revealed.add(k)
        if (open.value) return
        if (coversChat()) {
            attention.value = true
            return
        }
        select(tab)
        open.value = true
        openedByAgent = true
        attention.value = false
    }

    // The workspace reports its layout once it has measured itself, and null
    // when it unmounts. A pane the agent opened while the layout was not
    // known yet, or before the workspace narrowed, closes again.
    function setLayout(value) {
        layout.value = LAYOUTS.has(value) ? value : null
        if (open.value && openedByAgent && layout.value && layout.value !== 'split') {
            open.value = false
            expanded.value = false
            attention.value = true
        }
    }

    function select(tab) {
        activeId.value = tab.id
        touch(tab)
    }

    function specFields(spec) {
        if (spec.kind === 'artifact') {
            return { id: spec.id, kind: 'artifact', artifactId: spec.artifactId, title: spec.title, status: spec.status }
        }
        const { complete: _c, auto: _a, supersededBy: _s, ...fields } = spec
        if (spec.kind === 'page') Object.assign(fields, pageFields(spec.data))
        const kept = stash.get(spec.id)
        if (kept && !spec.complete) Object.assign(fields, kept)
        return fields
    }

    function reopenFromResearch(id) {
        const key = chatKey.value
        if (!key || typeof id !== 'string') return null
        const spec = researchTabs(messageList(key), { includeSwarm: true }).find((s) => s.id === id)
        if (!spec || spec.unsaved) return null
        closed.delete(id)
        return placeTab(specFields(spec))
    }

    // A capture of the bound chat that no step or agent names (a results
    // table can link one), straight from its messages' research.
    function storedCaptureSpec(id) {
        const key = chatKey.value
        const kind = captureKind(id)
        if (!key || !kind) return null
        const captureId = id.slice(kind.length + 1)
        for (const m of messageList(key)) {
            const research = (m && m.research) || {}
            const capture = (kind === 'serp' ? research.serp : research.pages)?.[captureId]
            if (!capture || typeof capture !== 'object') continue
            const data = { ...capture, capture_id: capture.capture_id || captureId }
            const spec = kind === 'serp' ? serpSpec(data) : pageSpec(data)
            return spec ? { ...spec, id, kind, complete: true } : null
        }
        return null
    }

    function activateTab(id) {
        const tab = byId(id) || reopenFromResearch(id)
        if (!tab) return null
        select(tab)
        show()
        return tab.id
    }

    function closeTab(id) {
        const idx = tabs.value.findIndex((t) => t.id === id)
        if (idx < 0) return activeId.value
        const [tab] = tabs.value.splice(idx, 1)
        rememberClosed(tab)
        if (activeId.value === id) {
            const next = tabs.value[idx] || tabs.value[idx - 1] || null
            activeId.value = next ? next.id : null
            touch(next)
        }
        if (!tabs.value.length) {
            open.value = false
            expanded.value = false
        }
        return activeId.value
    }

    function mergeData(current, incoming) {
        if (!incoming) return current
        if (!current) return { ...incoming }
        return { ...current, ...incoming }
    }

    // The fields that hold a value: an empty field in live data does not
    // erase what the stored copy knows, such as the error a step ended with.
    function present(data) {
        if (!data) return data
        return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined))
    }

    // options.background: a research agent's page, opened without taking
    // the active tab (it is selected only when none is) and never reopened
    // once the user closed it; `order` places it among its swarm's pages
    // and `revealKey` (the run) lets the run's first one reveal the pane. A
    // re-run's capture of a page the strip already shows takes that tab's
    // place (placeTab).
    function openSerp(input, { activate = false, background = false, order = null, revealKey = null } = {}) {
        const spec = serpSpec(input)
        if (!spec) return null
        if (background && closed.has(spec.id)) return null
        if (!background) closed.delete(spec.id)
        let tab = byId(spec.id)
        if (tab) {
            tab.data = mergeData(tab.data, spec.data)
            if (spec.title) tab.title = spec.title
            if (spec.status) tab.status = spec.status
            if (background && order && !tab.order) tab.order = order
            if (background) tab.swarm = true
        } else {
            const fields = { id: spec.id, kind: 'serp', title: spec.title, status: spec.status, data: spec.data }
            if (background) Object.assign(fields, { swarm: true }, order ? { order } : {})
            tab = placeTab(fields)
        }
        if (background) {
            if (!activeId.value) select(tab)
            revealOnce(tab, revealKey)
        } else if (activate) {
            select(tab)
            reveal()
        }
        return tab.id
    }

    function openUrl(input, { activate = true, reuse = true } = {}) {
        const url = normalizeAddress(String(input || '')) || (isHttpUrl(input) ? String(input).trim() : null)
        if (!url) return null
        if (reuse) {
            const same = tabs.value.find(
                (t) => (t.kind === 'url' || t.kind === 'page') && (t.url === url || t.finalUrl === url)
            )
            if (same) {
                if (activate) activateTab(same.id)
                return same.id
            }
        }
        const tab = addTab({ id: newId('url'), kind: 'url', title: hostOf(url), status: 'idle', ...pageFields({ url }) })
        if (activate) activateTab(tab.id)
        return tab.id
    }

    function openPage(input, { activate = true } = {}) {
        if (typeof input === 'string') return openUrl(input, { activate })
        const spec = pageSpec(input)
        if (!spec) return null
        closed.delete(spec.id)
        let tab = byId(spec.id)
        if (tab) {
            tab.data = mergeData(tab.data, spec.data)
            tab.status = spec.status || tab.status
            if (spec.title) tab.title = spec.title
            const fields = pageFields(spec.data)
            if (fields.finalUrl) tab.finalUrl = fields.finalUrl
            if (!tab.url && fields.url) {
                tab.url = fields.url
                tab.history = fields.history
            }
        } else {
            tab = addTab({ id: spec.id, kind: 'page', title: spec.title, status: spec.status, data: spec.data, ...pageFields(spec.data) })
        }
        if (activate) {
            select(tab)
            reveal()
        }
        return tab.id
    }

    // options.version: a version number, or null for the latest. Leaving it
    // out keeps the version the tab already shows.
    function openArtifact(id, options = {}) {
        if (id === undefined || id === null || id === '') return null
        const { activate = true } = options
        const tabId = `artifact:${id}`
        closed.delete(tabId)
        let tab = byId(tabId)
        if (!tab) {
            const a = artifactOf(id)
            tab = addTab({ id: tabId, kind: 'artifact', artifactId: id, title: (a && a.title) || '', version: options.version ?? null })
        } else if (Object.prototype.hasOwnProperty.call(options, 'version')) {
            tab.version = options.version ?? null
        }
        if (activate) {
            select(tab)
            if (options.reveal === false) return tabId
            show()
        }
        return tabId
    }

    // What the bound chat knows about the agent call that writes an
    // artifact: {status, active, saved, error, kind, title}, or null.
    function artifactCall(id) {
        const key = chatKey.value
        if (!key || id === undefined || id === null || id === '') return null
        const spec = researchTabs(messageList(key)).find((s) => s.id === `artifact:${id}`)
        if (!spec) return null
        return {
            status: spec.agentStatus || '',
            active: ACTIVE_AGENT_STATUSES.has(spec.agentStatus),
            saved: spec.saved,
            error: spec.error,
            kind: spec.artifactKind,
            title: spec.title,
        }
    }

    // The results table of a research swarm: one tab per swarm, showing
    // `version` (null: the latest). Opening it again switches its version.
    function openTable(swarmId, { version = null, activate = true, title = '' } = {}) {
        if (swarmId === undefined || swarmId === null || swarmId === '') return null
        const sid = String(swarmId)
        const n = Number(version)
        const v = version !== null && Number.isInteger(n) && n > 0 ? n : null
        const tabId = `table:${sid}`
        let tab = byId(tabId)
        if (tab) {
            tab.version = v
            if (title) tab.title = title
        } else {
            tab = addTab({ id: tabId, kind: 'table', swarmId: sid, version: v, title: title || '', status: 'ready' })
        }
        if (activate) {
            select(tab)
            show()
        }
        return tabId
    }

    // Opens (or activates) the tab of a Google results page or page capture
    // ("serp:<id>" / "page:<id>") of the bound chat: one a step showed, one
    // a research agent took, or any capture in its messages' research.
    // Returns the tab id, or null when the chat has no such capture.
    function openCapture(tabId, { activate = true } = {}) {
        const id = typeof tabId === 'string' ? tabId.trim() : ''
        if (!captureKind(id)) return null
        let tab = byId(id)
        if (!tab) {
            const key = chatKey.value
            if (!key) return null
            const spec =
                researchTabs(messageList(key), { includeSwarm: true }).find((s) => s.id === id) || storedCaptureSpec(id)
            if (!spec) return null
            closed.delete(id)
            tab = placeTab(specFields(spec))
        }
        if (activate) {
            select(tab)
            show()
        }
        return tab.id
    }

    function openNewTab() {
        const existing = tabs.value.find((t) => t.kind === 'newtab')
        if (existing) return activateTab(existing.id)
        const tab = addTab({ id: newId('newtab'), kind: 'newtab', title: 'New tab', status: 'ready' })
        return activateTab(tab.id)
    }

    // Patches tab fields. Any other key, and the keys of patch.data, merge into
    // the tab's data, which is how browser.update patches arrive.
    function updateTab(id, patch) {
        const tab = byId(id)
        if (!tab || !patch || typeof patch !== 'object') return null
        let dataPatch = null
        for (const [key, value] of Object.entries(patch)) {
            if (key === 'data') {
                if (value === null) tab.data = null
                else if (value && typeof value === 'object') dataPatch = { ...(dataPatch || {}), ...value }
            } else if (TAB_FIELDS.has(key)) {
                tab[key] = value
            } else {
                dataPatch = { ...(dataPatch || {}), [key]: value }
            }
        }
        if (dataPatch) {
            tab.data = mergeData(tab.data, dataPatch)
            if (RESEARCH_KINDS.has(tab.kind) || tab.kind === 'url') {
                if (tab.data.error) tab.status = 'error'
                else if (!('status' in patch) && ['loading', 'missing', 'idle'].includes(tab.status)) tab.status = 'ready'
            }
        }
        return tab
    }

    // In-tab navigation for page, url and new tabs; the page view fetches it.
    function navigateTab(id, input, { replace = false } = {}) {
        const tab = byId(id)
        const url = normalizeAddress(String(input || '')) || (isHttpUrl(input) ? String(input).trim() : null)
        if (!tab || !url) return null
        const history = tab.history && Array.isArray(tab.history.entries) ? tab.history : historyFor(tab.url)
        let entries = history.entries.slice(0, history.index + 1)
        if (replace && entries.length) entries[entries.length - 1] = url
        else if (entries[entries.length - 1] !== url) entries.push(url)
        if (entries.length > 50) entries = entries.slice(-50)
        Object.assign(tab, {
            kind: 'url',
            url,
            finalUrl: null,
            data: null,
            title: hostOf(url),
            status: 'idle',
            mode: null,
            history: { entries, index: entries.length - 1 },
        })
        touch(tab)
        return tab.id
    }

    function goHistory(id, step) {
        const tab = byId(id)
        const history = tab && tab.history
        if (!history || !Array.isArray(history.entries)) return null
        const index = history.index + step
        if (index < 0 || index >= history.entries.length) return null
        const url = history.entries[index]
        Object.assign(tab, {
            kind: tab.kind === 'page' ? 'url' : tab.kind,
            url,
            finalUrl: null,
            data: null,
            title: hostOf(url),
            status: 'idle',
            history: { entries: history.entries, index },
        })
        return tab.id
    }

    // ── Pane ──

    function setReturnFocus(el) {
        returnFocusEl.value = el && typeof el === 'object' ? markRaw(el) : null
    }

    function setOpen(value, { returnFocus } = {}) {
        if (returnFocus !== undefined) setReturnFocus(returnFocus)
        if (value) {
            show()
            return
        }
        open.value = false
        expanded.value = false
    }

    function toggleOpen(options = {}) {
        setOpen(!open.value, options)
    }

    function setExpanded(value) {
        expanded.value = Boolean(value)
    }

    function setRatio(value) {
        const n = Number(value)
        if (!Number.isFinite(n)) return
        ratio.value = Math.min(0.85, Math.max(0.15, n))
        saveUiPrefs({ paneRatio: ratio.value })
    }

    function setFactsOpen(value) {
        factsOpen.value = Boolean(value)
        saveUiPrefs({ seoFactsOpen: factsOpen.value })
    }

    // ── Chat binding and rebuild ──

    function restoreTab(entry) {
        if (!entry || typeof entry.id !== 'string') return null
        const base = { id: entry.id, kind: entry.kind, mode: entry.mode === 'live' || entry.mode === 'reader' ? entry.mode : null }
        if (entry.kind === 'serp' || entry.kind === 'page') return { ...base, status: 'missing', data: null }
        if (entry.kind === 'artifact' && entry.artifact_id !== undefined && entry.artifact_id !== null) {
            return { ...base, artifactId: entry.artifact_id, version: entry.version || null }
        }
        if (entry.kind === 'table' && entry.swarm_id !== undefined && entry.swarm_id !== null && entry.swarm_id !== '') {
            const n = Number(entry.version)
            const version = entry.version !== null && Number.isInteger(n) && n > 0 ? n : null
            return { ...base, swarmId: String(entry.swarm_id), version, title: '', status: 'ready' }
        }
        if (entry.kind === 'url' && isHttpUrl(entry.url)) {
            return { ...base, title: hostOf(entry.url), status: 'idle', ...pageFields({ url: entry.url }) }
        }
        if (entry.kind === 'newtab') return { ...base, title: 'New tab' }
        return null
    }

    function loadSaved() {
        const key = chatKey.value
        if (savedLoaded || !key || key === 'new') return
        if (!scope) scope = currentScope()
        if (!scope) return
        savedLoaded = true
        const saved = readChat(scope, key)
        if (!saved) return
        for (const id of Array.isArray(saved.closed) ? saved.closed : []) closed.add(id)
        for (const entry of saved.tabs.slice(-MAX_TABS)) {
            const tab = restoreTab(entry)
            if (tab && !byId(tab.id) && !closed.has(tab.id)) addTab(tab)
        }
        const active = byId(saved.active) || tabs.value[0] || null
        if (active && !activeId.value) select(active)
        if (saved.open && tabs.value.length) reveal()
        restored = true
    }

    function hydrate(tab, spec) {
        if (tab.kind !== spec.kind) return
        // A tab restored from storage learns its place among its swarm's
        // pages, and that it is a research agent's page.
        if (spec.order && !tab.order) tab.order = spec.order
        if (spec.swarm) tab.swarm = true
        if (spec.kind === 'artifact') {
            if (!tab.title && spec.title) tab.title = spec.title
            return
        }
        // Live data from browser events wins over the stored research copy
        // while the step runs. A step that ended without a capture (an error,
        // or a run that stopped) settles the tab.
        if (tab.status === 'ready' || tab.status === 'error') return
        if (!spec.complete && spec.status === 'loading' && tab.status === 'loading') return
        if (!spec.complete && stash.has(spec.id)) {
            Object.assign(tab, stash.get(spec.id))
            return
        }
        tab.data = spec.complete ? mergeData(tab.data, spec.data) : mergeData(spec.data, present(tab.data))
        tab.status = spec.status
        if (!tab.title) tab.title = spec.title
        if (spec.kind === 'page') {
            const fields = pageFields(spec.data)
            if (!tab.url && fields.url) {
                tab.url = fields.url
                tab.history = fields.history
            }
            if (!tab.finalUrl && fields.finalUrl) tab.finalUrl = fields.finalUrl
        }
    }

    // Research-agent tabs that show the same Google page, such as a tab list
    // saved before a re-run captured the page again: the newest capture
    // stays, in the earliest place. A tab the chat's research does not name
    // yet came from a live event, so it is the newest.
    function dropSupersededTabs(specs) {
        const rank = new Map(specs.map((s, i) => [s.id, i]))
        const age = (tab) => rank.get(tab.id) ?? Infinity
        const groups = new Map()
        for (const tab of tabs.value) {
            const page = tab.kind === 'serp' && tab.swarm ? serpPageKey(tab.data) : ''
            if (!page) continue
            if (!groups.has(page)) groups.set(page, [])
            groups.get(page).push(tab)
        }
        for (const group of groups.values()) {
            if (group.length < 2) continue
            const newest = group.reduce((a, b) => (age(b) >= age(a) ? b : a))
            supersede(newest, group.filter((t) => t !== newest))
        }
    }

    function reconcile() {
        const key = chatKey.value
        if (!key || key === 'new') return
        loadSaved()
        const specs = researchTabs(messageList(key), { includeSwarm: true })
        const fresh = !restored
        let lastAdded = null
        // Only the steps' own tabs open by themselves; a research agent's
        // capture (auto: false) only rebuilds a tab that is already there.
        const auto = specs.filter((s) => s.auto !== false)
        const candidates = new Set((fresh ? auto.slice(-MAX_TABS) : auto).map((s) => s.id))
        for (const spec of specs) {
            const tab = byId(spec.id)
            if (tab) hydrate(tab, spec)
            else if (candidates.has(spec.id) && !closed.has(spec.id) && !spec.unsaved) lastAdded = placeTab(specFields(spec))
            if (!candidates.has(spec.id)) continue
            const call = `${spec.id}|${spec.callId ?? ''}`
            if (spec.kind === 'artifact' && ACTIVE_AGENT_STATUSES.has(spec.agentStatus) && !autoOpened.has(call)) {
                autoOpened.add(call)
                openArtifact(spec.artifactId, { activate: true, reveal: false })
                reveal()
            }
        }
        dropSupersededTabs(specs)
        if (chatLoaded(key)) {
            const available = new Set(specs.filter((s) => s.complete || s.status !== 'missing').map((s) => s.id))
            for (const tab of tabs.value) {
                if (RESEARCH_KINDS.has(tab.kind) && tab.status === 'missing' && !available.has(tab.id)) tab.status = 'gone'
            }
        }
        if (fresh && lastAdded) {
            if (!activeId.value) select(lastAdded)
            reveal()
        }
        if (!activeId.value && tabs.value.length) select(tabs.value[tabs.value.length - 1])
        if (specs.length || chatLoaded(key)) restored = true
    }

    function clearChatState() {
        tabs.value = []
        activeId.value = null
        expanded.value = false
        attention.value = false
        openedByAgent = false
        closed = new Set()
        autoOpened = new Set()
        revealed = new Set()
        stash = new Map()
        restored = false
        savedLoaded = false
        lastWritten = ''
    }

    function bindChat(key) {
        const next = key === undefined || key === null || key === '' ? null : String(key)
        if (next === chatKey.value) return
        writeNow()
        chatKey.value = next
        clearChatState()
        open.value = false
        scope = currentScope()
        if (next) reconcile()
    }

    function rekeyChat(from, to) {
        const a = from === undefined || from === null ? null : String(from)
        const b = to === undefined || to === null ? null : String(to)
        if (!b || a === b || chatKey.value !== a) return
        chatKey.value = b
        restored = true
        savedLoaded = true
        lastWritten = ''
        if (!scope) scope = currentScope()
        if (scope && a && a !== 'new') movePaneState(scope.uid, scope.wid, a, b)
        writeNow()
    }

    function reset() {
        if (persistTimer && auth.accessToken) writeNow()
        if (persistTimer) clearTimeout(persistTimer)
        persistTimer = null
        chatKey.value = null
        open.value = false
        returnFocusEl.value = null
        scope = null
        clearChatState()
    }

    // Persist only the stored fields; data patches do not cause a write.
    watch(
        () => JSON.stringify(snapshot()),
        () => {
            if (chatKey.value && chatKey.value !== 'new') schedulePersist()
        }
    )

    // Rebuild when the bound chat's messages, parts or research change. Text
    // is not read here, so streaming deltas do not re-run it.
    watch(
        () => {
            const key = chatKey.value
            if (!key || key === 'new') return ''
            let sig = chatLoaded(key) ? 'L' : 'l'
            for (const m of messageList(key)) {
                if (m.role !== 'assistant') continue
                const r = m.research || {}
                sig += `${m.id}:${m.status || ''}:${(m.parts || []).length}:${Object.keys(r.serp || {}).length}:${Object.keys(r.pages || {}).length}`
                for (const p of m.parts || []) {
                    if (!p) continue
                    if (p.type === 'agent_call') sig += `:${p.artifact_id ?? ''}/${p.status || ''}/${p.version ?? ''}`
                    else if (p.type === 'serp' || p.type === 'page_inspect') sig += `:${p.tab_id || ''}/${p.status || ''}`
                    else if (p.type === 'swarm' && Array.isArray(p.tasks)) {
                        // A task names its capture when it finishes.
                        let panes = 0
                        for (const t of p.tasks) if (t && t.pane && t.pane.tab_id) panes += 1
                        sig += `:${p.swarm_id ?? ''}/${p.status || ''}/${panes}`
                    }
                }
                sig += '|'
            }
            return sig
        },
        () => reconcile()
    )

    // Stored tabs can be read once the user and project are known.
    watch(
        () => scopeKey(currentScope()),
        (key) => {
            if (!key || savedLoaded || !chatKey.value) return
            scope = currentScope()
            reconcile()
        }
    )

    // A different user or project never sees the previous tabs.
    watch(
        () => auth.user?.id ?? null,
        (now, before) => {
            if (before !== null && now !== before) reset()
        },
        { flush: 'sync' }
    )
    watch(
        () => agent.websiteId,
        (now, before) => {
            if (before !== undefined && before !== null && now !== before) reset()
        },
        { flush: 'sync' }
    )

    return {
        chatKey,
        open,
        expanded,
        ratio,
        tabs,
        activeId,
        returnFocusEl,
        factsOpen,
        layout,
        attention,
        activeTab,
        hasTabs,
        titleOf,
        artifactOf,
        artifactCall,
        bindChat,
        rekeyChat,
        openArtifact,
        openSerp,
        updateTab,
        openPage,
        openUrl,
        openTable,
        openCapture,
        openNewTab,
        navigateTab,
        goBack: (id) => goHistory(id, -1),
        goForward: (id) => goHistory(id, 1),
        activateTab,
        closeTab,
        setOpen,
        toggleOpen,
        setExpanded,
        setRatio,
        setFactsOpen,
        setReturnFocus,
        setLayout,
        reset,
    }
})
