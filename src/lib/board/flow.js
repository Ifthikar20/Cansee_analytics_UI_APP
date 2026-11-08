// Where board cards sit and where a moved card lands (frame_board.md B2b,
// B3c, B4 and B10a). Pure: no Vue, no DOM. The column rules mirror the
// container queries in BoardWidget.vue (a test keeps the two equal); the
// boxes a drop reads are measured by the caller.
import { placeWidget } from './layout'

export const COLUMNS = 12
export const WIDE_MIN_PX = 1040 // @container board (max-width: 1039px) in BoardWidget.vue
export const SPLIT_MIN_PX = 640 // @container board (max-width: 639px)

const SPANS = {
    wide: { third: 4, half: 6, full: 12 },
    medium: { third: 6, half: 6, full: 12 },
}

/**
 * The column mode of a board `width` px wide (the content width of
 * .bd-body): 'wide', 'medium' or 'single'. 0 (not measured) is 'wide'. As
 * in the container queries, a width just over 1039px or 639px is the wider
 * mode.
 */
export function boardMode(width) {
    const w = Number(width) || 0
    if (w <= 0 || w > WIDE_MIN_PX - 1) return 'wide'
    return w > SPLIT_MIN_PX - 1 ? 'medium' : 'single'
}

/** The columns a widget of `size` spans in `mode`. */
export function spanOf(size, mode) {
    if (mode === 'single') return COLUMNS
    return SPANS[mode === 'medium' ? 'medium' : 'wide'][size] || COLUMNS
}

/**
 * Where each widget sits, [{key, row, col, span}], as CSS grid places the
 * cells without dense packing: in order, and a cell that does not fit the
 * rest of its row starts the next one.
 */
export function flowLayout(items, mode) {
    const out = []
    let row = 0
    let col = 0
    for (const item of items || []) {
        const span = spanOf(item.size, mode)
        if (col > 0 && col + span > COLUMNS) {
            row += 1
            col = 0
        }
        out.push({ key: item.key, row, col, span })
        col += span
    }
    return out
}

/**
 * Where a held widget goes for a key: {index, edge}. Left and Right move it
 * one place, Home and End to the ends, Up and Down to the nearest row above
 * or below at the column closest to its own (one place on a one-column
 * board). When it cannot go further, index is where it is and edge says
 * why: 'first', 'last', 'top' or 'bottom'; otherwise edge is null.
 */
export function keyTarget(items, key, keyName, mode) {
    const list = items || []
    const from = list.findIndex((w) => w.key === key)
    const last = list.length - 1
    if (from < 0) return { index: -1, edge: null }
    switch (keyName) {
        case 'ArrowLeft':
            return from > 0 ? { index: from - 1, edge: null } : { index: from, edge: 'first' }
        case 'ArrowRight':
            return from < last ? { index: from + 1, edge: null } : { index: from, edge: 'last' }
        case 'Home':
            return from > 0 ? { index: 0, edge: null } : { index: from, edge: 'first' }
        case 'End':
            return from < last ? { index: last, edge: null } : { index: from, edge: 'last' }
        case 'ArrowUp':
        case 'ArrowDown':
            return rowTarget(list, key, from, keyName === 'ArrowUp' ? -1 : 1, mode)
        default:
            return { index: from, edge: null }
    }
}

// Every other place is tried; the candidates are the places that put the
// widget on the nearest row above (or below) its own. The one whose centre
// column is closest to the widget's wins, then the one fewest places away.
function rowTarget(items, key, from, dir, mode) {
    const edge = dir < 0 ? 'top' : 'bottom'
    if (mode === 'single') {
        const index = from + dir
        return index >= 0 && index < items.length ? { index, edge: null } : { index: from, edge }
    }
    const here = flowLayout(items, mode)[from]
    const centre = here.col + here.span / 2
    let best = null
    for (let t = 0; t < items.length; t += 1) {
        if (t === from) continue
        const cell = flowLayout(placeWidget(items, key, t), mode)[t]
        if (dir < 0 ? cell.row >= here.row : cell.row <= here.row) continue
        const candidate = { index: t, row: cell.row, off: Math.abs(cell.col + cell.span / 2 - centre), steps: Math.abs(t - from) }
        if (!best || closer(candidate, best, dir)) best = candidate
    }
    return best ? { index: best.index, edge: null } : { index: from, edge }
}

function closer(a, b, dir) {
    if (a.row !== b.row) return dir < 0 ? a.row > b.row : a.row < b.row
    if (a.off !== b.off) return a.off < b.off
    return a.steps < b.steps
}

/**
 * The index the dragged widget `key` takes for a pointer at `point` ({x, y}
 * in px from the grid's top left). `cells` are the layout boxes
 * [{key, x, y, w, h}] in screen order, the dragged widget's slot included,
 * on a grid `width` px wide. In this order:
 * - over the slot: where it is;
 * - over another card: its leading half puts the widget just before it,
 *   its trailing half just after it (the top and bottom halves of a card
 *   that spans the whole row, the left and right halves of any other);
 * - right of a row's last card: just after that card;
 * - above the first row: first; below the last row: last;
 * - in a gap between cards or rows: where it is.
 */
export function dropIndex(cells, key, point, width) {
    const list = cells || []
    const current = list.findIndex((c) => c.key === key)
    if (current < 0) return current
    const { x, y } = point
    const inside = (c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h
    if (inside(list[current])) return current
    const others = list.filter((c) => c.key !== key)
    const over = others.findIndex(inside)
    if (over >= 0) {
        const c = others[over]
        const trailing = Math.abs(c.w - width) <= 1 ? y >= c.y + c.h / 2 : x >= c.x + c.w / 2
        return trailing ? over + 1 : over
    }
    const rows = rowsOf(list)
    const row = rows.find((r) => y >= r.top && y < r.bottom)
    if (row) {
        const end = row.cells[row.cells.length - 1]
        if (x < end.x + end.w) return current
        return end.key === key ? current : others.indexOf(end) + 1
    }
    if (rows.length && y < rows[0].top) return 0
    if (rows.length && y >= rows[rows.length - 1].bottom) return others.length
    return current
}

// Cells that share a top (within 1px) form a row; its band runs down to its
// tallest cell's bottom.
function rowsOf(cells) {
    const rows = []
    for (const c of cells) {
        const row = rows.find((r) => Math.abs(r.top - c.y) <= 1)
        if (row) {
            row.cells.push(c)
            row.bottom = Math.max(row.bottom, c.y + c.h)
        } else {
            rows.push({ top: c.y, bottom: c.y + c.h, cells: [c] })
        }
    }
    rows.sort((a, b) => a.top - b.top)
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x)
    return rows
}

/**
 * The auto-scroll speed in px per second for a pointer `distance` px inside
 * an edge of the visible band (0 or less at or beyond it): nothing outside
 * the zone, then a ramp up to `max` at the edge.
 */
export function edgeSpeed(distance, { zone = 72, max = 900 } = {}) {
    const n = Number(distance)
    if (Number.isNaN(n)) return 0
    const d = Math.max(0, n)
    if (d >= zone) return 0
    const t = (zone - d) / zone
    return max * t * t
}
