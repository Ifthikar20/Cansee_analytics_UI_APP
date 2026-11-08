// The first research, handed from onboarding to the agent chat. Onboarding
// stashes the first message for the new project; the agent's new-chat page
// sends it right away (?start=first-research) or offers it later (after the
// paywall). sessionStorage keeps it in the tab that finished onboarding, and
// every access is guarded: storage can be full, blocked or disabled, and a
// lost entry only means the user starts the research by hand.
//
// The entry also carries the AI engines chosen on the last onboarding step
// (public keys, or null when none were chosen): the chat sends them with
// the first message, so the research asks only those engines.

import { ENGINES } from '@/lib/engines'

export const FIRST_RESEARCH_KEY = 'cs-agent-first-research-v1'
export const FIRST_RESEARCH_MAX_AGE_MS = 86_400_000

const idOf = (v) => (v === null || v === undefined ? '' : String(v))

const ENGINE_KEYS = ENGINES.map((e) => e.key)

/** Known engine keys, deduped, in the given order; null for anything else or none. */
function enginesOf(value) {
  if (!Array.isArray(value)) return null
  const out = []
  for (const key of value) if (ENGINE_KEYS.includes(key) && !out.includes(key)) out.push(key)
  return out.length ? out : null
}

function storage() {
  try {
    return window.sessionStorage || null
  } catch {
    return null
  }
}

/** The stored entry, or null when there is none or it is unreadable. */
function read() {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(FIRST_RESEARCH_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry !== 'object') return null
    const websiteId = idOf(entry.websiteId)
    const text = typeof entry.text === 'string' ? entry.text : ''
    const createdAt = Number(entry.createdAt)
    if (!websiteId || !text.trim() || !Number.isFinite(createdAt)) return null
    return { websiteId, text, createdAt, engines: enginesOf(entry.engines) }
  } catch {
    return null
  }
}

function remove() {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(FIRST_RESEARCH_KEY)
  } catch {}
}

function isFresh(entry, maxAgeMs) {
  const age = Date.now() - entry.createdAt
  return age >= 0 && age <= maxAgeMs
}

export function useFirstResearch() {
  /** Keep the first message (and its engines) for this project. Returns false when it could not be stored. */
  function stash({ websiteId, text, engines = null } = {}) {
    const id = idOf(websiteId)
    const body = typeof text === 'string' ? text.trim() : ''
    const store = storage()
    if (!id || !body || !store) return false
    try {
      store.setItem(
        FIRST_RESEARCH_KEY,
        JSON.stringify({ websiteId: id, text: body, createdAt: Date.now(), engines: enginesOf(engines) }),
      )
      return true
    } catch {
      return false
    }
  }

  /** The entry for this project when it is younger than maxAgeMs, else null. It stays stored. */
  function peek(websiteId, maxAgeMs = FIRST_RESEARCH_MAX_AGE_MS) {
    const entry = read()
    if (!entry || !idOf(websiteId) || entry.websiteId !== idOf(websiteId)) return null
    return isFresh(entry, maxAgeMs) ? entry : null
  }

  /**
   * The entry for this project, removed so it is used once. An expired entry
   * for this project is removed too and gives null; another project's entry
   * is left alone.
   */
  function take(websiteId) {
    const entry = read()
    if (!entry || !idOf(websiteId) || entry.websiteId !== idOf(websiteId)) return null
    remove()
    return isFresh(entry, FIRST_RESEARCH_MAX_AGE_MS) ? entry : null
  }

  /** Forget the entry, whatever project it is for. */
  function discard() {
    remove()
  }

  return { stash, peek, take, discard }
}
