// Edits to a board layout, a list of {key, size} in the user's order
// (board_frontend.md 7). Pure: each edit returns a new list, or the same
// list when it changes nothing, so a caller can skip a save.
import { DEFAULT_LAYOUT, SIZES, widgetMeta } from './widgets'

/** A fresh copy of the default layout. */
export function defaultLayout() {
    return DEFAULT_LAYOUT.map((w) => ({ key: w.key, size: w.size }))
}

/**
 * The layout as the board can show it: unknown and repeated keys dropped,
 * and a size the widget does not allow replaced by its default size.
 */
export function normalizeLayout(widgets) {
    if (!Array.isArray(widgets)) return []
    const seen = new Set()
    const out = []
    for (const item of widgets) {
        const key = item && typeof item === 'object' ? item.key : null
        const meta = typeof key === 'string' ? widgetMeta(key) : null
        if (!meta || seen.has(key)) continue
        seen.add(key)
        out.push({ key, size: meta.sizes.includes(item.size) ? item.size : meta.size })
    }
    return out
}

/** Append `key` at its default size (unchanged when it is already on the board). */
export function addWidget(widgets, key) {
    const meta = widgetMeta(key)
    if (!meta || widgets.some((w) => w.key === key)) return widgets
    return [...widgets, { key, size: meta.size }]
}

export function removeWidget(widgets, key) {
    if (!widgets.some((w) => w.key === key)) return widgets
    return widgets.filter((w) => w.key !== key)
}

/** Move `key` one place up (-1) or down (1); unchanged at the ends. */
export function moveWidget(widgets, key, step) {
    const from = widgets.findIndex((w) => w.key === key)
    const to = from + (step < 0 ? -1 : 1)
    if (from < 0 || to < 0 || to >= widgets.length) return widgets
    const next = widgets.slice()
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
}

/**
 * Set the size of `key`. A size the widget does not allow is clamped to the
 * nearest one it does (Full width on a third-or-half widget is Half).
 */
export function resizeWidget(widgets, key, size) {
    const meta = widgetMeta(key)
    const wanted = SIZES.indexOf(size)
    if (!meta || wanted < 0) return widgets
    const allowed = meta.sizes.map((s) => SIZES.indexOf(s))
    const nearest = allowed.reduce((best, i) => (Math.abs(i - wanted) < Math.abs(best - wanted) ? i : best), allowed[0])
    const target = SIZES[nearest]
    const current = widgets.find((w) => w.key === key)
    if (!current || current.size === target) return widgets
    return widgets.map((w) => (w.key === key ? { ...w, size: target } : w))
}

/** True when two layouts hold the same widgets, in the same order and sizes. */
export function sameLayout(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((w, i) => w?.key === b[i]?.key && w?.size === b[i]?.size)
}
