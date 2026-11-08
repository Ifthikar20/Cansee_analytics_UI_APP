// First-visit hints (coachmarks): the registry and their stored state.
// Pure, no Vue. The store (stores/hints.js) decides which one shows.
//
// A hint shows once per user. Its state lives in this browser only, under
// `cs-hints-v1:<uid>` = { seen: [key, ...], skipped: boolean }. The key is
// deliberately not one of storage.js USER_KEY_PREFIXES: logout keeps it, so
// signing in again does not replay the tips. Every read and write goes
// through storage.js, which never throws (private mode, a full quota or
// corrupt JSON read as "nothing seen").
import { readJSON, removeKey, writeJSON } from '@/lib/agent/storage'

export const HINTS_PREFIX = 'cs-hints-v1:'

/**
 * In the order they may show. `after` is a hint that must have been seen
 * first, so the board's tips come one after another.
 */
export const HINTS = Object.freeze(
    [
        {
            key: 'board.ask-ai',
            title: 'Start here',
            body: 'Type a question a buyer would ask and see how often each AI engine names you.',
        },
        {
            key: 'shell.project',
            after: 'board.ask-ai',
            title: 'Your project',
            body: 'A project is one website. Switch projects, add another site or open its settings here. Analytics and the Agent follow the project you pick.',
        },
        {
            key: 'board.add-widget',
            after: 'shell.project',
            title: 'Add more views',
            body: 'Add widgets such as Competitors, Citations or Sentiment to this board. Click a card title to open its detailed view.',
        },
        {
            key: 'board.track',
            after: 'board.ask-ai',
            title: 'Keep asking it',
            body: 'Track adds this question to your tracked prompts and to Prompt ranking. With Autopilot on, it is asked the same way every day, so changes are comparable.',
        },
        {
            key: 'agent.chips',
            title: 'Pick a specialist',
            body: 'Pick a specialist or just type your request. Each specialist saves its draft for you to review and export.',
        },
        {
            key: 'agent.findings-select',
            title: 'Add to Findings',
            body: "Tick rows to add them to Findings, the project's list of issues to fix.",
        },
    ].map((hint, order) => Object.freeze({ ...hint, order })),
)

export const HINT_KEYS = Object.freeze(HINTS.map((h) => h.key))

const BY_KEY = new Map(HINTS.map((h) => [h.key, h]))

/** The hint's {key, order, title, body, after?}, or null. */
export function hintOf(key) {
    return BY_KEY.get(key) || null
}

const present = (v) => v !== null && v !== undefined && v !== ''

export function hintsKey(uid) {
    return `${HINTS_PREFIX}${uid}`
}

/** {seen: string[], skipped: boolean}; nothing seen for no user or bad data. */
export function loadHintState(uid) {
    const empty = { seen: [], skipped: false }
    if (!present(uid)) return empty
    const raw = readJSON(hintsKey(uid), null)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
    const seen = Array.isArray(raw.seen) ? raw.seen.filter((k) => typeof k === 'string' && BY_KEY.has(k)) : []
    return { seen: [...new Set(seen)], skipped: raw.skipped === true }
}

/** Saves {seen, skipped}; false when there is no user or storage refused. */
export function saveHintState(uid, { seen = [], skipped = false } = {}) {
    if (!present(uid)) return false
    return writeJSON(hintsKey(uid), { seen: [...new Set(seen)], skipped: Boolean(skipped) })
}

/** Forgets every hint the user saw or skipped. */
export function clearHintState(uid) {
    if (present(uid)) removeKey(hintsKey(uid))
}

/**
 * The hint to show among the `waiting` keys (hints whose targets are on
 * screen and ready): the first in order that is unseen and whose `after`
 * has been seen. `current` keeps showing while it still qualifies, so a
 * hint never swaps for another mid-read. Null when none qualifies.
 */
export function pickHint({ waiting = [], seen = [], current = null } = {}) {
    const seenSet = new Set(seen)
    const waitingSet = new Set(waiting)
    const ok = (hint) =>
        Boolean(hint) && waitingSet.has(hint.key) && !seenSet.has(hint.key) && (!hint.after || seenSet.has(hint.after))
    if (current && ok(hintOf(current))) return current
    const next = HINTS.find(ok)
    return next ? next.key : null
}
