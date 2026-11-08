// Agent workspace persistence (localStorage). Every key is versioned and
// every read and write is wrapped: private mode, a full quota and corrupt
// JSON all degrade to "nothing stored".
//
// | key                                   | contents                              |
// |---------------------------------------|---------------------------------------|
// | cs-agent-ui-v1                        | device prefs (not per user)           |
// | cs-agent-last-project:<uid>           | last project id                       |
// | cs-agent-last-chat:<uid>:<wid>        | last chat id in that project          |
// | cs-agent-tabs-v1:<uid>:<wid>          | pane state per chat, LRU of 30 chats  |
// | cs-agent-draft-v1:<uid>:<wid>:<cid>   | composer draft (`new` before a chat)  |
// | cs-agent-activity-seen-v1:<uid>       | activity last seen, per project       |
// | cs-agent-findings-v1:<uid>:<wid>      | Findings filters {status, category,   |
// |                                       | severity}                             |
// | cs-feedback-tokens-v1:<uid>           | Help & feedback ticket tokens         |
// | cs-feedback-seen-v1:<uid>             | Help & feedback messages seen, per    |
// |                                       | ticket                                |
//
// Pane state tabs are {id, kind} plus `url` (url tabs), `artifact_id` and
// `version` (artifact tabs), `swarm_id` and `version` (research table tabs).
//
// Logout removes every per-user key (clearUserData).

export const UI_PREFS_KEY = 'cs-agent-ui-v1'
const LAST_PROJECT_PREFIX = 'cs-agent-last-project:'
const LAST_CHAT_PREFIX = 'cs-agent-last-chat:'
const TABS_PREFIX = 'cs-agent-tabs-v1:'
const DRAFT_PREFIX = 'cs-agent-draft-v1:'
const ACTIVITY_SEEN_PREFIX = 'cs-agent-activity-seen-v1:'
const FINDINGS_PREFIX = 'cs-agent-findings-v1:'
// The analytics board's cached layouts (stores/board.js), keyed by user and project.
const BOARD_PREFIX = 'cs-board-v1:'
// The Help & feedback widget's ticket tokens and read state (api/feedbackClient.js).
// A token opens its ticket, so another account on this browser must never see it.
const FEEDBACK_TOKENS_PREFIX = 'cs-feedback-tokens-v1:'
const FEEDBACK_SEEN_PREFIX = 'cs-feedback-seen-v1:'
// Before they were per user: owned by nobody we can tell, so never read,
// and removed on logout.
const LEGACY_SHARED_KEYS = Object.freeze(['cs-feedback-tokens', 'cs-feedback-seen'])

export const USER_KEY_PREFIXES = Object.freeze([
    LAST_PROJECT_PREFIX,
    LAST_CHAT_PREFIX,
    TABS_PREFIX,
    DRAFT_PREFIX,
    ACTIVITY_SEEN_PREFIX,
    FINDINGS_PREFIX,
    BOARD_PREFIX,
    FEEDBACK_TOKENS_PREFIX,
    FEEDBACK_SEEN_PREFIX,
])

const FINDINGS_PREF_KEYS = Object.freeze(['status', 'category', 'severity'])

export const PANE_STATE_CHAT_LIMIT = 30
export const DRAFT_MAX_CHARS = 20000
const NEW_CHAT = 'new'

export const storageKeys = Object.freeze({
    uiPrefs: () => UI_PREFS_KEY,
    lastProject: (uid) => `${LAST_PROJECT_PREFIX}${uid}`,
    lastChat: (uid, wid) => `${LAST_CHAT_PREFIX}${uid}:${wid}`,
    tabs: (uid, wid) => `${TABS_PREFIX}${uid}:${wid}`,
    draft: (uid, wid, cid) => `${DRAFT_PREFIX}${uid}:${wid}:${cid || NEW_CHAT}`,
    activitySeen: (uid) => `${ACTIVITY_SEEN_PREFIX}${uid}`,
    findings: (uid, wid) => `${FINDINGS_PREFIX}${uid}:${wid}`,
    feedbackTokens: (uid) => `${FEEDBACK_TOKENS_PREFIX}${uid}`,
    feedbackSeen: (uid) => `${FEEDBACK_SEEN_PREFIX}${uid}`,
})

function backend() {
    try {
        return window.localStorage || null
    } catch {
        return null
    }
}

const present = (v) => v !== null && v !== undefined && v !== ''
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function readRaw(key) {
    try {
        const value = backend()?.getItem(key)
        return value === undefined ? null : value
    } catch {
        return null
    }
}

export function writeRaw(key, value) {
    try {
        const ls = backend()
        if (!ls) return false
        ls.setItem(key, String(value))
        return true
    } catch {
        return false
    }
}

export function removeKey(key) {
    try {
        backend()?.removeItem(key)
    } catch {}
}

export function readJSON(key, fallback = null) {
    const raw = readRaw(key)
    if (raw === null) return fallback
    try {
        const value = JSON.parse(raw)
        return value === null || value === undefined ? fallback : value
    } catch {
        return fallback
    }
}

export function writeJSON(key, value) {
    let raw
    try {
        raw = JSON.stringify(value)
    } catch {
        return false
    }
    return writeRaw(key, raw)
}

/* ── Device prefs (shared by every user of this browser) ── */

export function loadUiPrefs() {
    const prefs = readJSON(UI_PREFS_KEY, {})
    return isPlainObject(prefs) ? prefs : {}
}

export function saveUiPrefs(patch) {
    const next = { ...loadUiPrefs(), ...(isPlainObject(patch) ? patch : {}) }
    writeJSON(UI_PREFS_KEY, next)
    return next
}

/* ── Last project and last chat ── */

export function getLastProject(uid) {
    if (!present(uid)) return null
    return readRaw(storageKeys.lastProject(uid)) || null
}

export function setLastProject(uid, wid) {
    if (!present(uid) || !present(wid)) return
    writeRaw(storageKeys.lastProject(uid), String(wid))
}

export function getLastChat(uid, wid) {
    if (!present(uid) || !present(wid)) return null
    return readRaw(storageKeys.lastChat(uid, wid)) || null
}

export function setLastChat(uid, wid, cid) {
    if (!present(uid) || !present(wid)) return
    if (!present(cid) || cid === NEW_CHAT) return
    writeRaw(storageKeys.lastChat(uid, wid), String(cid))
}

/** Forget the last chat; with `cid`, only when it is that chat. */
export function clearLastChat(uid, wid, cid) {
    if (!present(uid) || !present(wid)) return
    const key = storageKeys.lastChat(uid, wid)
    if (present(cid) && readRaw(key) !== String(cid)) return
    removeKey(key)
}

/* ── Activity last seen ({websiteId: ISO time}; who opened what is per user) ── */

export function loadActivitySeen(uid) {
    if (!present(uid)) return {}
    const map = readJSON(storageKeys.activitySeen(uid), {})
    return isPlainObject(map) ? map : {}
}

export function saveActivitySeen(uid, map) {
    if (!present(uid) || !isPlainObject(map)) return
    writeJSON(storageKeys.activitySeen(uid), map)
}

/* ── Pane state per chat (ids and urls only; LRU of 30 chats per project) ── */

function readPaneBook(uid, wid) {
    const book = readJSON(storageKeys.tabs(uid, wid), null)
    if (!isPlainObject(book) || book.v !== 1 || !isPlainObject(book.chats)) {
        return { v: 1, chats: {} }
    }
    return book
}

// Capture payloads (`data`) are large and can be refetched; never store them.
function stripPayloads(state) {
    if (!isPlainObject(state)) return null
    const out = { ...state }
    if (Array.isArray(out.tabs)) {
        out.tabs = out.tabs
            .filter((t) => isPlainObject(t) && present(t.id))
            .map((t) => {
                const { data: _data, ...rest } = t
                return rest
            })
    }
    return out
}

export function loadPaneState(uid, wid, chatKey) {
    if (!present(uid) || !present(wid) || !present(chatKey)) return null
    const entry = readPaneBook(uid, wid).chats[String(chatKey)]
    if (!isPlainObject(entry) || !isPlainObject(entry.state)) return null
    return entry.state
}

export function savePaneState(uid, wid, chatKey, state) {
    if (!present(uid) || !present(wid) || !present(chatKey)) return false
    const clean = stripPayloads(state)
    if (!clean) return false
    const book = readPaneBook(uid, wid)
    book.chats[String(chatKey)] = { at: Date.now(), state: clean }
    const keys = Object.keys(book.chats)
    if (keys.length > PANE_STATE_CHAT_LIMIT) {
        keys
            .sort((a, b) => (book.chats[a].at || 0) - (book.chats[b].at || 0))
            .slice(0, keys.length - PANE_STATE_CHAT_LIMIT)
            .forEach((k) => delete book.chats[k])
    }
    return writeJSON(storageKeys.tabs(uid, wid), book)
}

export function removePaneState(uid, wid, chatKey) {
    if (!present(uid) || !present(wid) || !present(chatKey)) return
    const book = readPaneBook(uid, wid)
    if (!(String(chatKey) in book.chats)) return
    delete book.chats[String(chatKey)]
    writeJSON(storageKeys.tabs(uid, wid), book)
}

/** Move a chat's pane state to a new key (the `new` chat getting its id). */
export function movePaneState(uid, wid, fromKey, toKey) {
    if (!present(uid) || !present(wid) || !present(fromKey) || !present(toKey)) return
    const book = readPaneBook(uid, wid)
    const entry = book.chats[String(fromKey)]
    if (!entry) return
    delete book.chats[String(fromKey)]
    book.chats[String(toKey)] = { ...entry, at: Date.now() }
    writeJSON(storageKeys.tabs(uid, wid), book)
}

/** Chat ids that have stored pane state in a project, most recent first. */
export function paneStateChatIds(uid, wid) {
    if (!present(uid) || !present(wid)) return []
    const chats = readPaneBook(uid, wid).chats
    return Object.keys(chats).sort((a, b) => (chats[b].at || 0) - (chats[a].at || 0))
}

/* ── Composer drafts ── */

export function loadDraft(uid, wid, cid) {
    if (!present(uid) || !present(wid)) return ''
    const value = readRaw(storageKeys.draft(uid, wid, cid))
    return typeof value === 'string' ? value : ''
}

/** Save a draft; an empty or whitespace-only draft removes the key. */
export function saveDraft(uid, wid, cid, text) {
    if (!present(uid) || !present(wid)) return
    const key = storageKeys.draft(uid, wid, cid)
    const value = typeof text === 'string' ? text.slice(0, DRAFT_MAX_CHARS) : ''
    if (!value.trim()) removeKey(key)
    else writeRaw(key, value)
}

export function clearDraft(uid, wid, cid) {
    if (!present(uid) || !present(wid)) return
    removeKey(storageKeys.draft(uid, wid, cid))
}

export function moveDraft(uid, wid, fromCid, toCid) {
    if (!present(uid) || !present(wid)) return
    const text = loadDraft(uid, wid, fromCid)
    clearDraft(uid, wid, fromCid)
    if (text) saveDraft(uid, wid, toCid, text)
}

/* ── Findings filters per project (string values only; the store validates them) ── */

function pickFindingsPrefs(source) {
    const out = {}
    if (!isPlainObject(source)) return out
    for (const key of FINDINGS_PREF_KEYS) {
        if (typeof source[key] === 'string') out[key] = source[key]
    }
    return out
}

export function loadFindingsPrefs(uid, wid) {
    if (!present(uid) || !present(wid)) return {}
    return pickFindingsPrefs(readJSON(storageKeys.findings(uid, wid), {}))
}

export function saveFindingsPrefs(uid, wid, prefs) {
    if (!present(uid) || !present(wid) || !isPlainObject(prefs)) return false
    return writeJSON(storageKeys.findings(uid, wid), pickFindingsPrefs(prefs))
}

/* ── Logout ── */

/**
 * Remove per-user keys. With `uid`, only that user's; without, every
 * user's (used on logout, when the signed-in user may be unknown).
 * Device prefs stay. The old shared feedback keys go too (not counted).
 * Returns the number of per-user keys removed.
 */
export function clearUserData(uid) {
    const ls = backend()
    if (!ls) return 0
    LEGACY_SHARED_KEYS.forEach(removeKey)
    const doomed = []
    try {
        for (let i = 0; i < ls.length; i += 1) {
            const key = ls.key(i)
            if (!key) continue
            const prefix = USER_KEY_PREFIXES.find((p) => key.startsWith(p))
            if (!prefix) continue
            if (present(uid)) {
                const owner = key.slice(prefix.length).split(':')[0]
                if (owner !== String(uid)) continue
            }
            doomed.push(key)
        }
    } catch {
        return 0
    }
    doomed.forEach(removeKey)
    return doomed.length
}
