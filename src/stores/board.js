import { defineStore } from 'pinia'
import { ref } from 'vue'
import boardApi from '@/api/board'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { resetBoardSources } from '@/composables/board/useBoardSource'
import { readJSON, writeJSON } from '@/lib/agent/storage'
import {
    addWidget,
    defaultLayout,
    moveWidget,
    normalizeLayout,
    placeWidget,
    removeWidget,
    resizeWidget,
    sameLayout,
} from '@/lib/board/layout'

// The Analytics board's layout per project (board_frontend.md 7), saved per
// user on the server (board_contract.md 6). The UI is optimistic: an edit
// shows at once, lands in this browser's cache and is saved 400ms later.
//
// layouts[wid] = {widgets, version, saved, status, save, source}:
// - status: 'loading' (nothing known yet: the board shows skeletons and asks
//   for no data), 'ready', or 'error' (the GET failed; the cached or default
//   layout stays);
// - save: 'idle' | 'saving' | 'failed';
// - source: where the widgets came from: 'server', 'cache' or 'default'.
//
// Saves run one at a time per project; an edit made during a save is sent
// after it, with the version the save returned. A 409 means another window
// saved first: its layout wins and the toast says so.

export const SAVE_DEBOUNCE_MS = 400
const CACHE_PREFIX = 'cs-board-v1:'
export const CONFLICT_TOAST = 'Your board changed in another window. Showing the latest version.'

const idOf = (v) => (v === undefined || v === null || v === '' ? null : String(v))

export const useBoardStore = defineStore('board', () => {
    const layouts = ref({})
    // Per project, outside the reactive state: the save timer, the request
    // in flight, whether an edit waits for a save, the GET in flight.
    const work = new Map()

    function workOf(wid) {
        let w = work.get(wid)
        if (!w) {
            w = { timer: null, saving: null, pending: false, again: false, loading: null, resetting: false, gen: 0 }
            work.set(wid, w)
        }
        return w
    }

    function cacheKey(wid) {
        const uid = idOf(useAuthStore().user?.id)
        return uid ? `${CACHE_PREFIX}${uid}:${wid}` : null
    }

    function readCache(wid) {
        const key = cacheKey(wid)
        if (!key) return null
        const value = readJSON(key, null)
        if (!value || typeof value !== 'object' || !Array.isArray(value.widgets)) return null
        const version = Number.isInteger(value.version) && value.version >= 0 ? value.version : 0
        return { widgets: normalizeLayout(value.widgets), version, saved: value.saved === true }
    }

    function writeCache(wid) {
        const key = cacheKey(wid)
        const entry = layouts.value[wid]
        if (!key || !entry || entry.status === 'loading') return
        writeJSON(key, { widgets: entry.widgets, version: entry.version, saved: entry.saved })
    }

    /** The layout entry of a project, or null before load(). */
    function layoutOf(wid) {
        return layouts.value[idOf(wid)] || null
    }

    /** Whether `key` is on the project's board (the panel's Add to board). */
    function has(wid, key) {
        return Boolean(layoutOf(wid)?.widgets.some((w) => w.key === key))
    }

    // Take a payload of the layout API ({saved, version, widgets}).
    function adopt(wid, payload) {
        const entry = layouts.value[wid]
        entry.widgets = normalizeLayout(payload?.widgets)
        entry.version = Number.isInteger(payload?.version) ? payload.version : 0
        entry.saved = payload?.saved === true
        entry.source = 'server'
        writeCache(wid)
    }

    // A change of ours that the server has not answered yet.
    function busy(w) {
        return w.pending || Boolean(w.timer) || Boolean(w.saving) || w.resetting
    }

    /**
     * Show the project's board: the layout in memory, else this browser's
     * copy, else skeletons of the default with no data requests; then the
     * server's layout replaces it, unless a change of ours is on its way.
     */
    function load(wid) {
        const id = idOf(wid)
        if (!id) return Promise.resolve()
        if (!layouts.value[id]) {
            const cached = readCache(id)
            layouts.value[id] = cached
                ? { ...cached, status: 'ready', save: 'idle', source: 'cache' }
                : { widgets: defaultLayout(), version: 0, saved: false, status: 'loading', save: 'idle', source: 'default' }
        }
        const w = workOf(id)
        if (w.loading) return w.loading
        const gen = w.gen
        w.loading = boardApi
            .get(id)
            .then(
                (res) => {
                    const entry = layouts.value[id]
                    const payload = res?.data
                    // Something of ours changed or was saved meanwhile: it
                    // wins, and its save meets any newer layout as a 409.
                    // Versions only grow, so an older one is a late answer.
                    const version = Number.isInteger(payload?.version) ? payload.version : 0
                    entry.status = 'ready'
                    if (gen === w.gen && !busy(w) && version >= entry.version) adopt(id, payload)
                },
                () => {
                    const entry = layouts.value[id]
                    entry.status = 'error'
                },
            )
            .finally(() => {
                w.loading = null
            })
        return w.loading
    }

    function schedule(wid) {
        const w = workOf(wid)
        w.pending = true
        w.gen += 1
        clearTimeout(w.timer)
        w.timer = setTimeout(() => {
            w.timer = null
            flush(wid)
        }, SAVE_DEBOUNCE_MS)
    }

    function edit(wid, change) {
        const id = idOf(wid)
        const entry = layouts.value[id]
        // Nothing is known about the board while it loads: wait for it.
        if (!entry || entry.status === 'loading') return false
        const next = change(entry.widgets)
        if (next === entry.widgets || sameLayout(next, entry.widgets)) return false
        entry.widgets = next
        writeCache(id)
        schedule(id)
        return true
    }

    const add = (wid, key) => edit(wid, (widgets) => addWidget(widgets, key))
    const remove = (wid, key) => edit(wid, (widgets) => removeWidget(widgets, key))
    const move = (wid, key, step) => edit(wid, (widgets) => moveWidget(widgets, key, step))
    // A drop on the board: one edit, however far the widget went.
    const place = (wid, key, index) => edit(wid, (widgets) => placeWidget(widgets, key, index))
    const resize = (wid, key, size) => edit(wid, (widgets) => resizeWidget(widgets, key, size))

    function conflict(err) {
        const error = err?.response?.data?.error
        return err?.response?.status === 409 && error?.code === 'layout_conflict' ? error.details?.layout || null : null
    }

    /** Send the project's pending change now (the debounce calls this). */
    function flush(wid) {
        const id = idOf(wid)
        const w = workOf(id)
        const entry = layouts.value[id]
        if (!entry) return Promise.resolve()
        if (w.saving || w.resetting) {
            // One save at a time: this one goes once the current one is back.
            if (w.pending) w.again = true
            return w.saving || Promise.resolve()
        }
        if (!w.pending) return Promise.resolve()
        clearTimeout(w.timer)
        w.timer = null
        w.pending = false
        w.again = false
        const sent = entry.widgets.map(({ key, size }) => ({ key, size }))
        entry.save = 'saving'
        // Each outcome frees the slot before it changes what the board
        // shows, so a Try again on the new state starts a save of its own.
        w.saving = boardApi
            .save(id, { version: entry.version, widgets: sent })
            .then(
                (res) => {
                    w.saving = null
                    const payload = res?.data || {}
                    w.gen += 1
                    if (Number.isInteger(payload.version)) entry.version = payload.version
                    entry.saved = payload.saved !== false
                    entry.source = 'server'
                    // The server's copy, unless the user changed it since.
                    if (!w.pending && sameLayout(entry.widgets, sent)) entry.widgets = normalizeLayout(payload.widgets ?? sent)
                    entry.save = 'idle'
                    writeCache(id)
                },
                (err) => {
                    w.saving = null
                    const latest = conflict(err)
                    if (latest) {
                        clearTimeout(w.timer)
                        w.timer = null
                        w.pending = false
                        w.again = false
                        w.gen += 1
                        adopt(id, latest)
                        entry.save = 'idle'
                        useToast().info(CONFLICT_TOAST)
                        return
                    }
                    // Keep what the user sees; Try again sends it.
                    w.pending = true
                    entry.save = 'failed'
                },
            )
            .then(() => {
                if (w.again && !w.saving && entry.save !== 'failed') {
                    w.again = false
                    flush(id)
                }
            })
        return w.saving
    }

    /** Try again after a failed save: send the layout on screen. */
    function retrySave(wid) {
        const id = idOf(wid)
        if (!layouts.value[id]) return Promise.resolve()
        const w = workOf(id)
        w.pending = true
        return flush(id)
    }

    /**
     * Reset board: the default shows at once; pending saves are dropped, a
     * save in flight is waited for, then the server resets the layout and
     * its answer (with the new version) is taken.
     */
    async function reset(wid) {
        const id = idOf(wid)
        const entry = layouts.value[id]
        if (!entry) return
        const w = workOf(id)
        clearTimeout(w.timer)
        w.timer = null
        w.pending = false
        w.again = false
        w.gen += 1
        w.resetting = true
        entry.widgets = defaultLayout()
        entry.status = entry.status === 'loading' ? 'ready' : entry.status
        writeCache(id)
        try {
            if (w.saving) await w.saving.catch(() => {})
            const res = await boardApi.reset(id)
            const payload = res?.data || {}
            if (Number.isInteger(payload.version)) entry.version = payload.version
            entry.saved = payload.saved === true
            entry.source = 'server'
            // An edit made during the reset stays and is saved next.
            if (!w.pending) entry.widgets = normalizeLayout(payload.widgets ?? defaultLayout())
            entry.save = 'idle'
            entry.status = 'ready'
            writeCache(id)
        } catch (err) {
            const latest = conflict(err)
            if (latest) adopt(id, latest)
            else {
                // The default stays on screen; Try again saves it.
                w.pending = true
                entry.save = 'failed'
            }
        } finally {
            w.resetting = false
        }
        if (w.pending && entry.save !== 'failed') await flush(id)
    }

    /** Forget every project (tests, sign-out). */
    function clear() {
        for (const w of work.values()) clearTimeout(w.timer)
        work.clear()
        layouts.value = {}
    }

    // Sign-out drops every user's boards and the cards' cached data before
    // clearAuth returns, as the agent stores do.
    useAuthStore().onClearAuth(() => {
        clear()
        resetBoardSources()
    })

    return { layouts, layoutOf, has, load, add, remove, move, place, resize, flush, retrySave, reset, clear }
})
