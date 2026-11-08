// What the analytics setup panel remembers about one project, per user, in
// localStorage (key cs-setup-v1:<uid>:<wid>, removed on logout with the
// other per-user keys in lib/agent/storage.js):
//
//   {mode: 'research' | 'skip' | '', chatId: string | null,
//    createdAt: epoch ms | null, dismissed: boolean, collapsed: boolean}
//
// - mode and createdAt: onboarding finished this project at createdAt, with
//   the first research or without it. That makes the next visits a "first
//   landing" for FIRST_LANDING_MAX_AGE_MS.
// - chatId: the agent chat the first research runs in, written once the
//   chat exists (AgentChatPage).
// - dismissed: the user closed the panel once everything was set up.
// - collapsed: the user folded it to its one-line summary.
//
// Every access goes through readJSON/writeJSON, which never throw: private
// mode, a full quota or corrupt JSON read as "nothing stored", and the panel
// then shows only what the server reports.
import { readJSON, storageKeys, writeJSON } from '@/lib/agent/storage'

export const FIRST_LANDING_MAX_AGE_MS = 7 * 86_400_000

const MODES = new Set(['research', 'skip'])

const idOf = (v) => (v === null || v === undefined || v === '' ? '' : String(v))

function empty() {
    return { mode: '', chatId: null, createdAt: null, dismissed: false, collapsed: false }
}

function clean(raw) {
    const out = empty()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
    if (MODES.has(raw.mode)) out.mode = raw.mode
    const chatId = idOf(raw.chatId)
    if (chatId) out.chatId = chatId
    const createdAt = Number(raw.createdAt)
    if (raw.createdAt !== null && raw.createdAt !== undefined && Number.isFinite(createdAt) && createdAt > 0) {
        out.createdAt = createdAt
    }
    out.dismissed = raw.dismissed === true
    out.collapsed = raw.collapsed === true
    return out
}

function keyFor(uid, wid) {
    const u = idOf(uid)
    const w = idOf(wid)
    return u && w ? storageKeys.setup(u, w) : ''
}

/** The record for this user and project; an empty record when none is stored or readable. */
export function readSetup(uid, wid) {
    const key = keyFor(uid, wid)
    return key ? clean(readJSON(key, null)) : empty()
}

/** Merge `patch` into the stored record. Returns the record as stored, or null when it could not be written. */
function patchSetup(uid, wid, patch) {
    const key = keyFor(uid, wid)
    if (!key) return null
    const next = clean({ ...readSetup(uid, wid), ...patch })
    return writeJSON(key, next) ? next : null
}

/**
 * Onboarding finished this project (`mode` 'research' or 'skip'). A fresh
 * first landing: an earlier dismissal and first research chat are dropped.
 */
export function noteSetupFinished(uid, wid, mode, now = Date.now()) {
    if (!MODES.has(mode)) return null
    return patchSetup(uid, wid, { mode, createdAt: now, chatId: null, dismissed: false, collapsed: false })
}

/** The first research runs in chat `chatId`. */
export function noteFirstResearchChat(uid, wid, chatId, now = Date.now()) {
    const id = idOf(chatId)
    if (!id) return null
    const current = readSetup(uid, wid)
    // Sent after the paywall (no onboarding record in this browser): still a first landing.
    const createdAt = current.createdAt ?? now
    return patchSetup(uid, wid, { mode: 'research', chatId: id, createdAt })
}

export function dismissSetup(uid, wid) {
    return patchSetup(uid, wid, { dismissed: true })
}

export function setSetupCollapsed(uid, wid, collapsed) {
    return patchSetup(uid, wid, { collapsed: Boolean(collapsed) })
}

/** Onboarding finished less than maxAgeMs ago and the panel was not dismissed since. */
export function isFirstLanding(record, now = Date.now(), maxAgeMs = FIRST_LANDING_MAX_AGE_MS) {
    if (!record || record.dismissed || !record.createdAt) return false
    const age = now - record.createdAt
    return age >= 0 && age <= maxAgeMs
}
