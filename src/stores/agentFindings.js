import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import agentApi from '@/api/agent'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import { AgentError, normalizeError, normalizeFinding } from '@/lib/agent/normalize'
import { loadFindingsPrefs, saveFindingsPrefs } from '@/lib/agent/storage'
import { ERROR_CODE, FINDING_CATEGORY_LIST, FINDING_SEVERITY_LIST, FINDING_STATUS } from '@/lib/agent/types'

// Project findings (design/swarm_frontend.md 5b): the list the Findings page
// shows, and the research-table rows added to it. Findings are shared with
// the project's members; viewers read them, and `canEdit` (from the list
// response, and false after a write is refused with 403) hides the writes.
//
// `load` never throws: its error lands in `error`. Every write throws an
// AgentError for the caller to show. The list follows the filters: a status
// change moves a row out of a status tab, and new findings are prepended
// only where they match. `counts` are per status for the whole project,
// whatever the filters.
//
// `added` maps `${swarmId}:${sheet}:${rowKey}` to the finding id of the
// table rows added (or found already added) in this session, so a results
// table can show them as in Findings. Swarm ids are unique across projects,
// so it survives a project change; sign-out clears it.

const SILENT = Object.freeze({ _silentError: true })
const STATUS_FILTERS = new Set([...Object.values(FINDING_STATUS), 'all'])
const STATUS_VALUES = new Set(Object.values(FINDING_STATUS))
const SHEETS = new Set(['prompts', 'gaps', 'sources'])
// The 403 codes that mean "viewer": anything else (an allowance) is not about rights.
const PERMISSION_CODES = new Set(['permission_denied', 'forbidden', ''])
// swarm_contract.md 8.
const MAX_ROWS = 50
const MAX_TITLE = 200
const MAX_DETAIL = 2000
const MAX_PROMPT = 300
const MAX_QUERY = 200

const idOf = (v) => (v === null || v === undefined || v === '' ? null : String(v))
const textOf = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v))

function freshFilters() {
    return { status: FINDING_STATUS.OPEN, category: '', severity: '', q: '' }
}

function freshCounts() {
    return { open: 0, done: 0, dismissed: 0 }
}

function readCounts(raw) {
    const out = freshCounts()
    if (!raw || typeof raw !== 'object') return out
    for (const key of Object.keys(out)) {
        const n = Number(raw[key])
        out[key] = Number.isFinite(n) && n > 0 ? n : 0
    }
    return out
}

function listOf(data) {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.results)) return data.results
    return []
}

function findings(list) {
    return listOf(list).map(normalizeFinding).filter(Boolean)
}

export function addedKey(swarmId, sheet, rowKey) {
    return `${swarmId}:${sheet}:${rowKey}`
}

/** Filters from `patch` over `current`; values outside the vocabulary are ignored. */
function pickFilters(patch, current) {
    const next = { ...current }
    if (!patch || typeof patch !== 'object') return next
    if (STATUS_FILTERS.has(patch.status)) next.status = patch.status
    if (patch.category === null || patch.category === '' || FINDING_CATEGORY_LIST.includes(patch.category)) {
        next.category = patch.category || ''
    }
    if (patch.severity === null || patch.severity === '' || FINDING_SEVERITY_LIST.includes(patch.severity)) {
        next.severity = patch.severity || ''
    }
    if (typeof patch.q === 'string') next.q = patch.q.slice(0, MAX_QUERY)
    return next
}

/** True when a finding belongs in a list filtered by `f`; `search` also applies `q` (as the server does). */
function matches(finding, f, { search = true } = {}) {
    if (f.status !== 'all' && finding.status !== f.status) return false
    if (f.category && finding.category !== f.category) return false
    if (f.severity && finding.severity !== f.severity) return false
    const q = search ? f.q.trim().toLowerCase() : ''
    if (!q) return true
    return `${finding.title}\n${finding.detail}\n${finding.prompt_text}`.toLowerCase().includes(q)
}

function invalid(message) {
    return new AgentError({ status: 400, code: ERROR_CODE.INVALID, message })
}

export const useAgentFindingsStore = defineStore('agentFindings', () => {
    const auth = useAuthStore()

    /* ── State ── */

    const websiteId = ref(null)
    const items = ref([])
    const counts = ref(freshCounts())
    const canEdit = ref(true)
    const filters = ref(freshFilters())
    const cursor = ref(null)
    const hasMore = ref(false)
    const loading = ref(false)
    const loaded = ref(false)
    const error = ref(null)
    const added = ref({})

    // Bumped by every list request and by every reset; older responses are dropped.
    let request = 0

    /* ── Helpers ── */

    function userId() {
        return idOf(auth.user?.id)
    }

    // The project the agent workspace is on: where a chat's research lives.
    function agentProject() {
        try {
            return idOf(useAgentStore().websiteId)
        } catch {
            return null
        }
    }

    function projectOr(preferred) {
        const wid = preferred || websiteId.value || agentProject()
        if (!wid) throw new AgentError({ code: 'no_project', message: 'Choose a project first.' })
        return wid
    }

    // A refused write: a viewer gets 403 and the page turns read-only.
    function fail(err) {
        const e = normalizeError(err)
        if (e.status === 403 && PERMISSION_CODES.has(e.code)) canEdit.value = false
        return e
    }

    function persistPrefs() {
        const { status, category, severity } = filters.value
        saveFindingsPrefs(userId(), websiteId.value, { status, category, severity })
    }

    function bumpCount(status, delta) {
        if (!STATUS_VALUES.has(status)) return
        const next = { ...counts.value }
        next[status] = Math.max(0, (Number(next[status]) || 0) + delta)
        counts.value = next
    }

    function markAdded(swarmId, sheet, list) {
        const next = { ...added.value }
        for (const finding of list) {
            const source = finding.source
            if (!source || source.swarm_id !== swarmId || source.sheet !== sheet || !source.row_key) continue
            next[addedKey(swarmId, sheet, source.row_key)] = finding.id
        }
        added.value = next
    }

    // New findings of the listed project: counted, and prepended where the list shows them.
    function adopt(list) {
        if (!loaded.value || !list.length) return
        const known = new Set(items.value.map((f) => f.id))
        const fresh = list.filter((f) => !known.has(f.id))
        for (const finding of fresh) bumpCount(finding.status, 1)
        const shown = fresh.filter((f) => matches(f, filters.value))
        if (shown.length) items.value = [...shown, ...items.value]
    }

    // A finding changed on the server: its row follows the status, category and
    // severity filters (not the search, so a row being edited stays in view).
    function replaceItem(before, after) {
        if (before && after && before.status !== after.status) {
            bumpCount(before.status, -1)
            bumpCount(after.status, 1)
        }
        if (!before || !after) return
        const index = items.value.findIndex((f) => f.id === before.id)
        if (index === -1) return
        const next = items.value.slice()
        if (matches(after, filters.value, { search: false })) next[index] = after
        else next.splice(index, 1)
        items.value = next
    }

    /* ── Actions ── */

    /** Scope the store to a project; another project resets the list and restores its filters. */
    function init(wid) {
        const id = idOf(wid)
        if (!id || id === websiteId.value) return
        request += 1
        websiteId.value = id
        items.value = []
        counts.value = freshCounts()
        canEdit.value = true
        cursor.value = null
        hasMore.value = false
        loading.value = false
        loaded.value = false
        error.value = null
        filters.value = pickFilters(loadFindingsPrefs(userId(), id), freshFilters())
    }

    /** The first page for the filters, or the next with `more`. Never throws. */
    async function load({ more = false } = {}) {
        const wid = websiteId.value
        if (!wid) return
        if (more && (loading.value || !hasMore.value || !cursor.value)) return
        const token = ++request
        const f = filters.value
        loading.value = true
        error.value = null
        try {
            const { data } = await agentApi.listFindings(
                wid,
                {
                    status: f.status,
                    category: f.category,
                    severity: f.severity,
                    q: f.q.trim(),
                    cursor: more ? cursor.value : undefined,
                },
                SILENT
            )
            if (token !== request) return
            const results = findings(data)
            if (more) {
                const known = new Set(items.value.map((item) => item.id))
                items.value = [...items.value, ...results.filter((item) => !known.has(item.id))]
            } else {
                items.value = results
            }
            cursor.value = data?.next_cursor || null
            hasMore.value = Boolean(cursor.value)
            counts.value = readCounts(data?.counts)
            if (typeof data?.can_edit === 'boolean') canEdit.value = data.can_edit
            loaded.value = true
        } catch (err) {
            if (token === request) error.value = normalizeError(err)
        } finally {
            if (token === request) loading.value = false
        }
    }

    /** Change filters (status, category, severity, q): saved per project, then the list reloads. */
    function setFilters(patch) {
        const before = filters.value
        const next = pickFilters(patch, before)
        const changed = Object.keys(next).some((key) => next[key] !== before[key])
        filters.value = next
        if (websiteId.value) persistPrefs()
        if (!changed && loaded.value) return Promise.resolve()
        return load()
    }

    /**
     * Add research-table rows to Findings. Rows already added come back as
     * duplicates; both are marked in `added`. Resolves {created, duplicates}.
     */
    async function addFromTable({ swarmId, version, sheet, rowKeys } = {}) {
        const sid = idOf(swarmId)
        const number = Number(version)
        const keys = [...new Set((Array.isArray(rowKeys) ? rowKeys : []).map(textOf).filter(Boolean))]
        if (!sid || !Number.isInteger(number) || number < 1 || !SHEETS.has(sheet)) {
            throw invalid('This table cannot be added to Findings.')
        }
        if (!keys.length) throw invalid('Choose the rows to add.')
        if (keys.length > MAX_ROWS) throw invalid(`Add at most ${MAX_ROWS} rows at a time.`)
        // The research lives in the chat's project, not necessarily the listed one.
        const wid = projectOr(agentProject())
        let data
        try {
            ;({ data } = await agentApi.createFindings(
                wid,
                { from_swarm: { swarm_id: sid, version: number, sheet, row_keys: keys } },
                SILENT
            ))
        } catch (err) {
            throw fail(err)
        }
        const created = findings(data?.created)
        const duplicates = findings(data?.duplicates)
        markAdded(sid, sheet, [...created, ...duplicates])
        if (wid === websiteId.value) adopt(created)
        return { created, duplicates }
    }

    /** A finding written by hand. Resolves the Finding. */
    async function create({ title, detail = '', category, severity, prompt_text = '' } = {}) {
        const body = {
            title: textOf(title).trim(),
            detail: textOf(detail).trim(),
            category,
            severity,
            prompt_text: textOf(prompt_text).trim(),
        }
        if (!body.title) throw invalid('A finding needs a title.')
        if (body.title.length > MAX_TITLE) throw invalid(`Keep the title under ${MAX_TITLE} characters.`)
        if (body.detail.length > MAX_DETAIL) throw invalid(`Keep the details under ${MAX_DETAIL} characters.`)
        if (body.prompt_text.length > MAX_PROMPT) throw invalid(`Keep the prompt under ${MAX_PROMPT} characters.`)
        if (!FINDING_CATEGORY_LIST.includes(category)) throw invalid('Choose a category.')
        if (!FINDING_SEVERITY_LIST.includes(severity)) throw invalid('Choose a severity.')
        const wid = projectOr()
        let data
        try {
            ;({ data } = await agentApi.createFindings(wid, body, SILENT))
        } catch (err) {
            throw fail(err)
        }
        const [finding] = findings(data?.created)
        if (!finding) throw new AgentError({ message: 'The finding could not be created.' })
        if (wid === websiteId.value) adopt([finding])
        return finding
    }

    async function patchFinding(id, body) {
        const fid = idOf(id)
        if (!fid) throw invalid('Choose a finding first.')
        const wid = projectOr()
        const before = wid === websiteId.value ? items.value.find((f) => f.id === fid) || null : null
        let data
        try {
            ;({ data } = await agentApi.updateFinding(wid, fid, body, SILENT))
        } catch (err) {
            throw fail(err)
        }
        const after = normalizeFinding(data) || (before ? { ...before, ...body } : null)
        if (wid === websiteId.value) replaceItem(before, after)
        return after
    }

    /** Mark a finding open, done or dismissed. It leaves a status tab it no longer belongs to. */
    function setStatus(id, status) {
        if (!STATUS_VALUES.has(status)) return Promise.reject(invalid('Choose open, done or dismissed.'))
        return patchFinding(id, { status })
    }

    /** Edit the title, details or severity (the category and prompt are fixed once created). */
    function update(id, patch = {}) {
        const body = {}
        const p = patch && typeof patch === 'object' ? patch : {}
        if ('title' in p) {
            body.title = textOf(p.title).trim()
            if (!body.title) return Promise.reject(invalid('A finding needs a title.'))
            if (body.title.length > MAX_TITLE) return Promise.reject(invalid(`Keep the title under ${MAX_TITLE} characters.`))
        }
        if ('detail' in p) {
            body.detail = textOf(p.detail).trim()
            if (body.detail.length > MAX_DETAIL) return Promise.reject(invalid(`Keep the details under ${MAX_DETAIL} characters.`))
        }
        if ('severity' in p) {
            if (!FINDING_SEVERITY_LIST.includes(p.severity)) return Promise.reject(invalid('Choose a severity.'))
            body.severity = p.severity
        }
        if ('status' in p) {
            if (!STATUS_VALUES.has(p.status)) return Promise.reject(invalid('Choose open, done or dismissed.'))
            body.status = p.status
        }
        if (!Object.keys(body).length) {
            const current = items.value.find((f) => f.id === idOf(id)) || null
            return Promise.resolve(current)
        }
        return patchFinding(id, body)
    }

    /** Delete a finding for everyone in the project. One already deleted counts as removed. */
    async function remove(id) {
        const fid = idOf(id)
        if (!fid) throw invalid('Choose a finding first.')
        const wid = projectOr()
        try {
            await agentApi.deleteFinding(wid, fid, SILENT)
        } catch (err) {
            const e = fail(err)
            if (e.status !== 404) throw e
        }
        if (wid === websiteId.value) {
            const before = items.value.find((f) => f.id === fid)
            if (before) {
                items.value = items.value.filter((f) => f.id !== fid)
                bumpCount(before.status, -1)
            }
        }
        const next = { ...added.value }
        let changed = false
        for (const [key, value] of Object.entries(next)) {
            if (value === fid) {
                delete next[key]
                changed = true
            }
        }
        if (changed) added.value = next
    }

    /** True when this session added (or found already added) that table row. */
    function isAdded(swarmId, sheet, rowKey) {
        const sid = idOf(swarmId)
        const key = textOf(rowKey)
        if (!sid || !sheet || !key) return false
        return Boolean(added.value[addedKey(sid, sheet, key)])
    }

    /** Drop everything (sign-out). */
    function reset() {
        request += 1
        websiteId.value = null
        items.value = []
        counts.value = freshCounts()
        canEdit.value = true
        filters.value = freshFilters()
        cursor.value = null
        hasMore.value = false
        loading.value = false
        loaded.value = false
        error.value = null
        added.value = {}
    }

    // Sign-out drops every user's data before clearAuth returns; the token and
    // user watchers cover a session that ends or changes hands otherwise.
    auth.onClearAuth(() => reset())
    watch(
        () => auth.accessToken,
        (token, before) => {
            if (!token && before) reset()
        }
    )
    watch(
        () => idOf(auth.user?.id),
        (now, before) => {
            if (before && now && now !== before) reset()
        }
    )

    return {
        // state
        websiteId,
        items,
        counts,
        canEdit,
        filters,
        cursor,
        hasMore,
        loading,
        loaded,
        error,
        added,
        // actions
        init,
        load,
        setFilters,
        addFromTable,
        create,
        setStatus,
        update,
        remove,
        isAdded,
        reset,
    }
})
