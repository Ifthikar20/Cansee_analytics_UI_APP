import { defineStore } from 'pinia'
import { computed, markRaw, ref, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import { hostOf, isHttpUrl, normalizeAddress } from '@/lib/agent/url'
import { loadPaneState, loadUiPrefs, movePaneState, savePaneState, saveUiPrefs } from '@/lib/agent/storage'

// Browser pane state for the bound chat: the tab list, the active tab and the
// split geometry. Research tabs (Google results pages and inspected pages)
// come from browser.* events while a run streams and are rebuilt from each
// message's `research` after a reload. Per chat only ids and URLs are stored
// (cs-agent-tabs-v1); the split ratio and the SEO facts panel are device
// prefs (cs-agent-ui-v1).
//
// Tab statuses: idle (a URL not fetched yet), loading, ready, error, missing
// (restored from storage, waiting for the chat's research) and gone (the
// chat loaded without that capture).

export const MAX_TABS = 12
const MAX_CLOSED = 100
const MAX_STASH = 30
const RESEARCH_KINDS = new Set(['serp', 'page'])
const TAB_FIELDS = new Set(['title', 'status', 'mode', 'url', 'finalUrl', 'history', 'version', 'kind', 'artifactId', 'nonce'])
const ACTIVE_AGENT_STATUSES = new Set(['planning', 'drafting', 'validating'])

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

export function serpTitle(capture) {
    const query = capture && typeof capture.query === 'string' ? capture.query : ''
    if (!query) return 'Google'
    const page = Number(capture.page)
    return page > 1 ? `Google · ${query} · p${page}` : `Google · ${query}`
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

function partStatus(part) {
    if (part.status === 'error') return 'error'
    if (part.status === 'running' || part.status === 'queued') return 'loading'
    return 'missing'
}

// Research and artifact tabs referenced by the messages, oldest first.
export function researchTabs(messages) {
    const out = []
    const seen = new Set()
    for (const m of messages || []) {
        if (!m || m.role !== 'assistant') continue
        const research = m.research || {}
        const serps = research.serp || {}
        const pages = research.pages || {}
        for (const part of m.parts || []) {
            if (!part) continue
            if ((part.type === 'serp' || part.type === 'page_inspect') && typeof part.tab_id === 'string') {
                if (seen.has(part.tab_id)) continue
                seen.add(part.tab_id)
                const captureId = part.tab_id.replace(/^(serp|page):/, '')
                if (part.type === 'serp') {
                    const capture = serps[captureId] || null
                    const status = captureStatus('serp', capture)
                    const data = capture || {
                        query: part.query,
                        page: part.page,
                        location: part.location,
                        error: part.error || null,
                    }
                    out.push({
                        id: part.tab_id,
                        kind: 'serp',
                        title: serpTitle(data),
                        status: status === 'loading' ? partStatus(part) : status,
                        data,
                        complete: status !== 'loading',
                    })
                } else {
                    const capture = pages[captureId] || null
                    const status = captureStatus('page', capture)
                    const data = capture || { url: part.url, error: part.error || null }
                    out.push({
                        id: part.tab_id,
                        kind: 'page',
                        title: part.title || capture?.seo?.title || hostOf(part.url) || 'Page',
                        status: status === 'loading' ? partStatus(part) : status,
                        data,
                        complete: status !== 'loading',
                    })
                }
            } else if (part.type === 'agent_call' && part.artifact_id !== undefined && part.artifact_id !== null) {
                const id = `artifact:${part.artifact_id}`
                if (seen.has(id)) continue
                seen.add(id)
                out.push({
                    id,
                    kind: 'artifact',
                    artifactId: part.artifact_id,
                    title: part.title || '',
                    status: 'ready',
                    agentStatus: part.status,
                })
            }
        }
    }
    return out
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

    let closed = new Set()
    let autoOpened = new Set()
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

    function addTab(tab) {
        tabs.value.push({
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
        })
        const added = tabs.value[tabs.value.length - 1]
        touch(added)
        evictOverflow(added.id)
        return added
    }

    // Opens the pane for agent-driven tabs, except on phones where the pane is
    // a full-screen dialog the user opens.
    function reveal() {
        if (!isPhone()) open.value = true
    }

    function select(tab) {
        activeId.value = tab.id
        touch(tab)
    }

    function specFields(spec) {
        const { complete: _c, agentStatus: _s, ...fields } = spec
        if (spec.kind === 'page') Object.assign(fields, pageFields(spec.data))
        const kept = stash.get(spec.id)
        if (kept && !spec.complete) Object.assign(fields, kept)
        return fields
    }

    function reopenFromResearch(id) {
        const key = chatKey.value
        if (!key || typeof id !== 'string') return null
        const spec = researchTabs(messageList(key)).find((s) => s.id === id)
        if (!spec) return null
        closed.delete(id)
        return addTab(specFields(spec))
    }

    function activateTab(id) {
        const tab = byId(id) || reopenFromResearch(id)
        if (!tab) return null
        select(tab)
        open.value = true
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

    function openSerp(input, { activate = false } = {}) {
        const spec = serpSpec(input)
        if (!spec) return null
        closed.delete(spec.id)
        let tab = byId(spec.id)
        if (tab) {
            tab.data = mergeData(tab.data, spec.data)
            if (spec.title) tab.title = spec.title
            if (spec.status) tab.status = spec.status
        } else {
            tab = addTab({ id: spec.id, kind: 'serp', title: spec.title, status: spec.status, data: spec.data })
        }
        if (activate) {
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
            open.value = true
        }
        return tabId
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
        open.value = Boolean(value)
        if (!open.value) expanded.value = false
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
        if (saved.open && tabs.value.length && !isPhone()) open.value = true
        restored = true
    }

    function hydrate(tab, spec) {
        if (tab.kind !== spec.kind) return
        if (spec.kind === 'artifact') {
            if (!tab.title && spec.title) tab.title = spec.title
            return
        }
        // Live data from browser events wins over the stored research copy.
        if (tab.status === 'ready' || tab.status === 'error') return
        if (!spec.complete && tab.status === 'loading') return
        if (!spec.complete && stash.has(spec.id)) {
            Object.assign(tab, stash.get(spec.id))
            return
        }
        tab.data = spec.complete ? mergeData(tab.data, spec.data) : mergeData(spec.data, tab.data)
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

    function reconcile() {
        const key = chatKey.value
        if (!key || key === 'new') return
        loadSaved()
        const specs = researchTabs(messageList(key))
        const fresh = !restored
        let lastAdded = null
        const candidates = fresh ? specs.slice(-MAX_TABS) : specs
        for (const spec of candidates) {
            const tab = byId(spec.id)
            if (tab) hydrate(tab, spec)
            else if (!closed.has(spec.id)) lastAdded = addTab(specFields(spec))
            if (spec.kind === 'artifact' && ACTIVE_AGENT_STATUSES.has(spec.agentStatus) && !autoOpened.has(spec.id)) {
                autoOpened.add(spec.id)
                openArtifact(spec.artifactId, { activate: true, reveal: !isPhone() })
            }
        }
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
        closed = new Set()
        autoOpened = new Set()
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
                sig += `${m.id}:${(m.parts || []).length}:${Object.keys(r.serp || {}).length}:${Object.keys(r.pages || {}).length}`
                for (const p of m.parts || []) {
                    if (!p) continue
                    if (p.type === 'agent_call') sig += `:${p.artifact_id ?? ''}/${p.status || ''}`
                    else if (p.type === 'serp' || p.type === 'page_inspect') sig += `:${p.tab_id || ''}/${p.status || ''}`
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
        activeTab,
        hasTabs,
        titleOf,
        artifactOf,
        bindChat,
        rekeyChat,
        openArtifact,
        openSerp,
        updateTab,
        openPage,
        openUrl,
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
        reset,
    }
})
