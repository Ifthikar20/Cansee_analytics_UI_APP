// Every DOM read the board's drag and drop makes (frame_board.md B10b), in
// one module, so a spec can stand in for the layout jsdom does not have.
// Decisions read layout boxes (offsets), which the transform of a cell that
// is still gliding does not change.

const SCROLLING = new Set(['auto', 'scroll', 'overlay'])
// How far inside the visible band a revealed cell stays.
const REVEAL_MARGIN_PX = 16

function isDocumentScroller(el) {
    return !el || el === document.scrollingElement || el === document.documentElement || el === document.body
}

/**
 * The nearest ancestor of `el` whose overflow-y scrolls (on the board, the
 * frame's <main id="app-main">), else the document's scroller.
 */
export function scrollParentOf(el) {
    let node = el?.parentElement || null
    while (node && node !== document.body && node !== document.documentElement) {
        if (SCROLLING.has(getComputedStyle(node).overflowY)) return node
        node = node.parentElement
    }
    return document.scrollingElement || document.documentElement
}

/** The grid's box in client px. */
export function gridBox(grid) {
    return grid.getBoundingClientRect()
}

/**
 * The cells' layout boxes, [{key, x, y, w, h}] in px from the grid's top
 * left, in screen order (.bd-grid is position: relative).
 */
export function readCells(grid) {
    if (!grid) return []
    return [...grid.children]
        .filter((el) => el.matches('li.bd-cell'))
        .map((el) => ({ key: el.dataset.widget, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }))
}

/**
 * What the scroll container shows below the sticky toolbar
 * ([data-bd-sticky]): {top, bottom} in client px.
 */
export function visibleBand(scrollEl, stickyEl) {
    let top = 0
    let bottom = document.documentElement.clientHeight || window.innerHeight
    if (!isDocumentScroller(scrollEl)) {
        top = scrollEl.getBoundingClientRect().top + scrollEl.clientTop
        bottom = top + scrollEl.clientHeight
    }
    const sticky = stickyEl?.getBoundingClientRect()
    if (sticky && sticky.bottom > top) top = Math.min(sticky.bottom, bottom)
    return { top, bottom }
}

/**
 * Scroll `scrollEl` just enough to show `el`'s layout box between `top` and
 * `bottom` (client px, a visible band); a box taller than the band shows
 * its top. Offsets put a cell that is still gliding where it lands.
 */
export function revealCell(scrollEl, el, { top = 0, bottom = window.innerHeight, smooth = false } = {}) {
    const parent = el?.offsetParent
    if (!scrollEl || !parent) return
    const start = parent.getBoundingClientRect().top + parent.clientTop + el.offsetTop
    const end = start + el.offsetHeight
    const from = top + REVEAL_MARGIN_PX
    const to = bottom - REVEAL_MARGIN_PX
    let delta = 0
    if (start < from) delta = start - from
    else if (end > to) delta = Math.min(end - to, start - from)
    if (Math.abs(delta) < 1) return
    scrollEl.scrollTo({ top: scrollEl.scrollTop + delta, behavior: smooth ? 'smooth' : 'auto' })
}
