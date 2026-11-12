// The Watch block (board key "watch"): what the eye is watching, from the
// search-gap overview, and where it looks. Pure: no Vue, no requests.
import { listWords, num, plural, text } from './words'

/**
 * What is tracked for a project: {prompts, engines: [{key, label, ready}],
 * ready, total}, or null without an overview payload. `prompts` counts the
 * tracked prompts; `ready` the engines set up on this workspace.
 */
export function watchFacts(overview) {
    if (!overview || typeof overview !== 'object') return null
    const counted = num(overview.kpis?.prompts)
    const prompts = Array.isArray(overview.prompts)
        ? overview.prompts.filter(Boolean).length
        : counted !== null && counted > 0
          ? Math.floor(counted)
          : 0
    const engines = (Array.isArray(overview.engines) ? overview.engines : [])
        .filter((e) => e && (text(e.key) || text(e.label)))
        .map((e) => ({ key: text(e.key) || text(e.label), label: text(e.label) || text(e.key), ready: Boolean(e.configured) }))
    return { prompts, engines, ready: engines.filter((e) => e.ready).length, total: engines.length }
}

/**
 * The card's status for its frame: nothing tracked is 'empty', prompts
 * with no engine to ask is 'setup', else 'live'.
 */
export function watchStatus(facts) {
    if (!facts || !facts.prompts) return 'empty'
    return facts.ready ? 'live' : 'setup'
}

/** The two readouts under the eye: {prompts, engines}; '' when unknown. */
export function watchReadouts(facts) {
    if (!facts) return { prompts: '', engines: '' }
    return {
        prompts: facts.prompts ? `${plural(facts.prompts, 'prompt', 'prompts')} tracked` : 'No prompts tracked yet',
        engines: facts.total ? `${facts.ready} of ${plural(facts.total, 'engine', 'engines')}` : '',
    }
}

/** The same facts as one sentence, for screen readers. */
export function watchSentence(facts) {
    if (!facts) return ''
    const ready = facts.engines.filter((e) => e.ready).map((e) => e.label)
    const missing = facts.engines.filter((e) => !e.ready).map((e) => e.label)
    const parts = []
    if (!facts.prompts) parts.push('Nothing is tracked yet.')
    else if (!facts.total) parts.push(`Cansee is watching ${plural(facts.prompts, 'prompt', 'prompts')}.`)
    else if (!ready.length) parts.push(`${plural(facts.prompts, 'prompt', 'prompts')} tracked, but no AI engine is set up to ask.`)
    else parts.push(`Cansee is watching ${plural(facts.prompts, 'prompt', 'prompts')} on ${facts.ready} of ${plural(facts.total, 'AI engine', 'AI engines')}: ${listWords(ready)}.`)
    if (facts.prompts && ready.length && missing.length) parts.push(`Not set up: ${listWords(missing)}.`)
    return parts.join(' ')
}

/* ── Where the eye looks ── */

const AHEAD = Object.freeze({ x: 0, y: 0 })
const round2 = (v) => Math.round(v * 100) / 100

/**
 * The eye's gaze toward a pointer: {x, y}, each -1..1, a vector no longer
 * than 1 from the eye's centre (right and down are positive). `pointer` is
 * {x, y} and `box` the eye's {left, top, width, height}, both in viewport
 * pixels; the gaze is at full reach once the pointer is `reach` pixels
 * away. Anything unusable looks straight ahead.
 */
export function gaze(pointer, box, reach = 360) {
    const px = num(pointer?.x)
    const py = num(pointer?.y)
    const left = num(box?.left)
    const top = num(box?.top)
    const width = num(box?.width)
    const height = num(box?.height)
    if ([px, py, left, top, width, height].includes(null) || !(reach > 0)) return AHEAD
    const dx = px - (left + width / 2)
    const dy = py - (top + height / 2)
    const distance = Math.hypot(dx, dy)
    if (!distance) return AHEAD
    const pull = Math.min(1, distance / reach)
    return { x: round2((dx / distance) * pull) || 0, y: round2((dy / distance) * pull) || 0 }
}

const signed = (v) => `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}`

/** A gaze as the readout prints it: "-0.16, +0.11". */
export function gazeText(point) {
    const x = num(point?.x) ?? 0
    const y = num(point?.y) ?? 0
    return `${signed(x || 0)}, ${signed(y || 0)}`
}
