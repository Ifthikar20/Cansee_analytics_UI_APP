// The reading of a board card: one sentence that says what the card's
// numbers mean for this project, and the step that follows from it. A card
// computes it from its own payload (lib/board/meaning/) and hands it to its
// frame, which draws it above the evidence (CardReading.vue).
//
// A reading is {line, next?}. `line` is a full sentence built only from the
// payload: when the payload cannot support a sentence the reading is null
// and the card shows its numbers alone. `next` is {label, widget?, query?,
// to?}: `widget` opens that block's side panel (with `query`), `to` is a
// router location. A next step without a target is dropped.

export const READING_MAX = 120

function clean(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** The next step as {label, widget, query, to}, or null when it leads nowhere. */
export function normalizeNext(next) {
    if (!next || typeof next !== 'object') return null
    const label = clean(next.label)
    if (!label) return null
    const widget = clean(next.widget)
    const to = next.to && (typeof next.to === 'object' || typeof next.to === 'string') ? next.to : null
    if (!widget && !to) return null
    const query = next.query && typeof next.query === 'object' ? { ...next.query } : {}
    return { label, widget, query, to: widget ? null : to }
}

/**
 * The reading as {line, next}, or null when there is no sentence to show.
 * A sentence that still carries a hole from a missing value ("undefined",
 * "NaN", "null") is dropped whole: a card says nothing before it says
 * something wrong.
 */
export function normalizeReading(reading) {
    if (!reading || typeof reading !== 'object') return null
    const line = clean(reading.line)
    if (!line) return null
    if (/\b(undefined|NaN|null|Infinity)\b/.test(line)) return null
    return { line, next: normalizeNext(reading.next) }
}
