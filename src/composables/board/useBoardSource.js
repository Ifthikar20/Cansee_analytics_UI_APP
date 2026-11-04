import { computed, getCurrentScope, onScopeDispose, shallowReactive, shallowRef, toValue, watch } from 'vue'
import { useBoard } from '@/lib/board/context'
import { SOURCES } from '@/lib/board/sources'

// The board's shared data cache (board_contract.md 5). Every card reads its
// payloads through useBoardSource(key), so two cards on one source share one
// request. Entries are kept per project ({wid}|{key}), which makes switching
// back to a project instant:
// - an entry is fresh for 60 seconds; a stale one shows at once and
//   refetches in the background;
// - invalidate(wid, key) refetches an entry for the cards that show it (an
//   unused entry refetches on its next use);
// - revalidate(wid) refetches the stale entries in use (closing the panel);
// - a refetch that fails keeps the last payload (`stale`).

export const FRESH_MS = 60_000

const entries = new Map()
// Per entry id: the request token (a newer request drops an older answer)
// and the request in flight. Kept out of the reactive entries.
const tokens = new Map()
const inflight = new Map()

const idOf = (wid, key) => `${wid}|${key}`

function entryFor(wid, key) {
    const id = idOf(wid, key)
    let entry = entries.get(id)
    if (!entry) {
        entry = shallowReactive({ id, wid, key, data: null, loaded: false, loading: false, failure: null, fetchedAt: 0, users: 0 })
        entries.set(id, entry)
    }
    return entry
}

// The shape useAnalyticsQuery reports: {status, code, message}.
function failureOf(err) {
    const body = err?.response?.data?.error
    return {
        status: err?.response?.status || 0,
        code: typeof body === 'string' ? body : body?.code || '',
        message: err?.displayMessage || (body && typeof body === 'object' && body.message) || '',
    }
}

function fresh(entry) {
    return entry.loaded && !entry.failure && Date.now() - entry.fetchedAt < FRESH_MS
}

function start(entry) {
    const token = (tokens.get(entry.id) || 0) + 1
    tokens.set(entry.id, token)
    entry.loading = true
    const current = () => tokens.get(entry.id) === token
    const promise = Promise.resolve()
        .then(() => SOURCES[entry.key](entry.wid))
        .then(
            (data) => {
                if (!current()) return
                entry.data = data ?? null
                entry.loaded = true
                entry.failure = null
                entry.fetchedAt = Date.now()
            },
            (err) => {
                if (current()) entry.failure = failureOf(err)
            },
        )
        .finally(() => {
            if (!current()) return
            entry.loading = false
            inflight.delete(entry.id)
        })
    inflight.set(entry.id, promise)
    return promise
}

// Fetch unless the entry is fresh or already on its way.
function ensure(entry) {
    if (fresh(entry)) return Promise.resolve()
    return inflight.get(entry.id) || start(entry)
}

// Forget a request in flight: its answer is dropped when it lands.
function drop(entry) {
    tokens.set(entry.id, (tokens.get(entry.id) || 0) + 1)
    inflight.delete(entry.id)
    entry.loading = false
}

/**
 * Refetch the entry `key` of project `wid` (every entry of the project
 * without a key). Shown entries refetch now; unused ones on their next use.
 */
export function invalidate(wid, key) {
    if (wid === undefined || wid === null || wid === '') return
    for (const entry of entries.values()) {
        if (entry.wid !== String(wid) || (key && entry.key !== key)) continue
        if (entry.users > 0) start(entry)
        else {
            drop(entry)
            entry.fetchedAt = 0
        }
    }
}

/** Refetch the stale entries of project `wid` that a card shows. */
export function revalidate(wid) {
    if (wid === undefined || wid === null || wid === '') return
    for (const entry of entries.values()) {
        if (entry.wid === String(wid) && entry.users > 0) ensure(entry)
    }
}

/** Empty the cache (tests, sign-out). */
export function resetBoardSources() {
    entries.clear()
    tokens.clear()
    inflight.clear()
}

/**
 * The payload of source `key` (a key of SOURCES) for the board's project.
 * Returns {data, loading, error, failure, stale, reload}: `failure` is
 * {status, code, message} or null, `error` its message, `stale` true when
 * the last refetch failed and `data` is from an earlier answer. Another
 * project's payload never shows: a project change switches to that
 * project's entry (empty until it loads).
 */
export function useBoardSource(key) {
    const board = useBoard()
    const wid = computed(() => {
        const value = toValue(board.websiteId)
        return value === undefined || value === null || value === '' ? null : String(value)
    })
    const entry = shallowRef(null)

    function attach(next) {
        if (entry.value === next) return
        if (entry.value) entry.value.users -= 1
        entry.value = next
        if (next) {
            next.users += 1
            ensure(next)
        }
    }

    watch(wid, (id) => attach(id && SOURCES[key] ? entryFor(id, key) : null), { immediate: true })
    if (getCurrentScope()) onScopeDispose(() => attach(null))

    const data = computed(() => entry.value?.data ?? null)
    const loading = computed(() => Boolean(entry.value?.loading))
    const failure = computed(() => entry.value?.failure ?? null)
    const error = computed(() => (failure.value ? failure.value.message || 'error' : ''))
    const stale = computed(() => Boolean(failure.value && entry.value?.loaded))

    function reload() {
        return entry.value ? start(entry.value) : Promise.resolve()
    }

    return { data, loading, error, failure, stale, reload }
}
