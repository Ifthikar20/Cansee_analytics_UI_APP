// What the board's frame shows around a card, in words and numbers: the
// chip in its corner, the header line above the grid and how many columns
// the grid has. Pure: no Vue, no requests; storage goes through the
// helpers that never throw.
import { readRaw, writeRaw } from '@/lib/agent/storage'
import { cleanDensity } from './flow'

/* ── The chip in a card's corner ── */

// What a card's body shows right now. A card reports one of these to its
// frame (useCardStatus); the frame never guesses.
//   live     numbers that just came from the API
//   stale    the last numbers; the latest refresh failed
//   empty    the API answered and there is nothing to show yet
//   setup    something must be connected or turned on first
//   error    the card's data could not be loaded
//   loading  the first answer is on its way
//   ready    a tool that waits for the user (Ask AI); it claims no data
export const CARD_STATUSES = Object.freeze(['live', 'stale', 'empty', 'setup', 'error', 'loading', 'ready'])

const CHIPS = Object.freeze({
    live: Object.freeze({ label: 'Live', live: true, quiet: false }),
    stale: Object.freeze({ label: 'Stale', live: false, quiet: true }),
    empty: Object.freeze({ label: 'No data', live: false, quiet: true }),
    setup: Object.freeze({ label: 'Setup', live: false, quiet: true }),
    error: Object.freeze({ label: 'Error', live: false, quiet: true }),
    loading: Object.freeze({ label: 'Loading', live: false, quiet: true }),
    ready: Object.freeze({ label: 'Ready', live: false, quiet: false }),
})

/**
 * The chip for a status: {label, live (the orange dot), quiet (outlined, not
 * filled)}, or null for no chip. Only 'live' ever reads "Live".
 */
export function statusChip(status) {
    return CHIPS[status] || null
}

// The kinds a card's own state can have (CardState): only 'empty' means
// "nothing yet"; an error is an error; every other kind asks for setup.
const SETUP_KINDS = new Set(['not_connected', 'not_available', 'disabled'])

/**
 * A card's status from what its frame knows:
 * {loading, failed, failedKind, emptyKind, stale}. `failedKind` and
 * `emptyKind` are CardState kinds ('' when the card has numbers).
 */
export function cardStatus({ loading = false, failed = false, failedKind = '', emptyKind = '', stale = false } = {}) {
    if (loading) return 'loading'
    if (failed) return SETUP_KINDS.has(failedKind) ? 'setup' : 'error'
    if (emptyKind) {
        if (emptyKind === 'error') return 'error'
        return SETUP_KINDS.has(emptyKind) ? 'setup' : 'empty'
    }
    return stale ? 'stale' : 'live'
}

/* ── The header line ── */

const text = (v) => (typeof v === 'string' ? v.trim() : '')

function hostOf(url) {
    const raw = text(url)
    if (!raw) return ''
    try {
        return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, '')
    } catch {
        return ''
    }
}

/**
 * The line above the grid: {name, descriptors}. `name` is the project's
 * name (else its site, else ''), and the descriptors are true of every
 * board: what it measures, the project's site when the name does not say
 * it already, and the year.
 */
export function boardHeadline(website, now = new Date()) {
    const host = hostOf(website?.url) || hostOf(website?.domain)
    const name = text(website?.name) || host
    const descriptors = ['AI visibility']
    if (host && host.toLowerCase() !== name.toLowerCase()) descriptors.push(host)
    const year = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getFullYear() : null
    if (year) descriptors.push(String(year))
    return { name, descriptors }
}

/* ── Columns ── */

// The board's density (lib/board/flow.js) as the user left it.
const DENSITY_PREFIX = 'cs-board-columns-v1:'
const densityKey = (uid) => `${DENSITY_PREFIX}${uid === null || uid === undefined || uid === '' ? 'anon' : uid}`

/** The user's density on this browser (the default when nothing usable is stored). */
export function readDensity(uid) {
    return cleanDensity(readRaw(densityKey(uid)))
}

/** Remember the user's density on this browser; a browser that refuses is ignored. */
export function writeDensity(uid, value) {
    writeRaw(densityKey(uid), String(cleanDensity(value)))
}
