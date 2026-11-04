// Moving board cards by drag and drop (frame_board.md B3, B4, B6 and B10b),
// one move at a time per board. BoardGrid provides it over the widgets it
// shows (`shown` is the draft order while a card moves); each BoardWidget
// takes its handlers and flags from useBoardDragItem.
// - Pointer: a press on a card's grip, or with a mouse or pen anywhere on
//   its header but the options button, lifts the card once the pointer is
//   6px away. The card floats under the pointer at its own size, its cell
//   stays in the grid as the slot and moves through the draft while the
//   other cards glide, and the release saves the order as one edit.
// - Keyboard, on the grip: Space or Enter picks the widget up, the arrows,
//   Home and End move it, Space or Enter drops it, and Escape or focus
//   leaving the grip cancels.
// Window listeners, never pointer capture: Vue moving a cell in the DOM
// releases capture and can blur what had focus.
import { computed, inject, nextTick, onBeforeUnmount, provide, ref, shallowRef, toValue, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useBoard } from '@/lib/board/context'
import { boardMode, dropIndex, edgeSpeed, keyTarget } from '@/lib/board/flow'
import { placeWidget, sameLayout } from '@/lib/board/layout'
import { widgetMeta } from '@/lib/board/widgets'
import { useAgentUiStore } from '@/stores/agentUi'
import { useBoardStore } from '@/stores/board'
import { gridBox, readCells, revealCell, scrollParentOf, visibleBand } from './boardGeometry'

const DRAG = Symbol('board-drag')

// How far a press moves before the card lifts; how far the pointer must go
// before a change that undoes the last one is made.
export const LIFT_PX = 6
export const UNDO_PX = 12
const GLIDE_MS = 180
const GLIDE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'
// A click this soon after a Space or Enter the grip handled is that key's.
const KEY_CLICK_MS = 500
// The longest frame an auto-scroll step covers (the first frame after a stall).
const MAX_FRAME_MS = 50
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])
// Presses on these never start a drag from the header; the title does.
const CONTROLS = 'a[href], button, input, select, textarea, [role="button"]'
const EDGES = {
    first: (title) => `${title} is already first.`,
    last: (title) => `${title} is already last.`,
    top: (title) => `${title} is already in the top row.`,
    bottom: (title) => `${title} is already in the bottom row.`,
}

// Each card's drop glide, so a new lift can stop it.
const glides = new WeakMap()

const titleOf = (key) => widgetMeta(key)?.title || key
const indexOf = (list, key) => list.findIndex((w) => w.key === key)
const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi)
const isSpace = (key) => key === ' ' || key === 'Spacebar'
const stickyOf = (el) => el?.closest?.('.bd')?.querySelector('[data-bd-sticky]') || null

function focusWithin(el) {
    const active = document.activeElement
    return active instanceof HTMLElement && el.contains(active) ? active : null
}

/**
 * The board's moves, for BoardGrid: `grid` is the list element, `items` the
 * store's widgets and `enabled` whether cards may move at all (not while
 * the layout loads, not on a phone). Returns {shown, state, key}.
 */
export function provideBoardDrag({ grid, items, enabled }) {
    const route = useRoute()
    const board = useBoard()
    const store = useBoardStore()
    const ui = useAgentUiStore()
    const motion = usePreferredReducedMotion()

    // 'idle' | 'armed' (pressed, under the threshold) | 'lifted' (pointer) | 'held' (keyboard)
    const state = ref('idle')
    const key = ref(null)
    const draft = shallowRef(null)

    const list = () => toValue(items) || []
    const moving = () => state.value === 'lifted' || state.value === 'held'
    const shown = computed(() => (moving() && draft.value ? draft.value : list()))
    const canMove = computed(() => Boolean(toValue(enabled)) && list().length > 1)
    const gridEl = () => toValue(grid) || null
    const reduced = () => motion.value === 'reduce'

    // The move in progress. Nothing in it is reactive: the floating card is
    // written to directly, every frame.
    let move = null
    let lastKeyAt = 0

    function begin(k, fields) {
        move = { key: k, ...fields }
        key.value = k
    }

    // Ends the move in progress without a word: the listeners, the frame
    // loop, the page class and the floating card's inline styles go, and
    // the grid shows the store's order again.
    function finish() {
        const m = move
        if (!m) return null
        const was = state.value
        if (was === 'armed' || was === 'lifted') listen(false)
        if (m.raf) cancelAnimationFrame(m.raf)
        if (was === 'lifted') {
            document.documentElement.classList.remove('bd-dragging')
            m.card.style.width = ''
            m.card.style.height = ''
            m.card.style.transform = ''
        }
        move = null
        draft.value = null
        state.value = 'idle'
        key.value = null
        // The slot keeps its height until the cards have re-rendered. The
        // grid's TransitionGroup measures the cards before the card drops
        // back into its cell, and a slot that had already collapsed would
        // send every card after it gliding in from above.
        if (was === 'lifted') {
            nextTick(() => {
                m.cell.style.minHeight = ''
            })
        }
        return m
    }

    function cancelText(m) {
        const now = list()
        const at = indexOf(now, m.key)
        return at < 0 ? 'Move cancelled.' : `Move cancelled. ${titleOf(m.key)} is back at ${at + 1} of ${now.length}.`
    }

    function refocus(el, { onlyIfLost = false } = {}) {
        nextTick(() => {
            const active = document.activeElement
            if (!el?.isConnected || active === el) return
            if (onlyIfLost && active && active !== document.body) return
            el.focus({ preventScroll: true })
        })
    }

    /* ── Pointer ── */

    function press(event, k, from) {
        if (!event.isPrimary || event.button !== 0 || !canMove.value || state.value !== 'idle') return
        const target = event.target instanceof Element ? event.target : null
        if (from === 'head') {
            // The grip takes its own presses; a touch drag starts from the grip only.
            if (event.pointerType === 'touch' || !target || target.closest('.bd-card-grip')) return
            const control = target.closest(CONTROLS)
            if (control && !control.classList.contains('bd-card-open')) return
        }
        const cell = event.currentTarget?.closest?.('li.bd-cell')
        const card = cell?.querySelector('.bd-card')
        if (!card) return
        const at = { x: event.clientX, y: event.clientY }
        begin(k, { pointerId: event.pointerId, cell, card, start: at, pointer: at })
        state.value = 'armed'
        listen(true)
    }

    function listen(on) {
        const method = on ? 'addEventListener' : 'removeEventListener'
        window[method]('pointermove', onPointerMove)
        window[method]('pointerup', onPointerUp)
        window[method]('pointercancel', onPointerCancel)
        window[method]('keydown', onWindowKeydown, true)
        window[method]('blur', onWindowBlur)
    }

    function onPointerMove(event) {
        if (!move || event.pointerId !== move.pointerId) return
        // No button down: it was released outside the window.
        if (event.buttons === 0) {
            release(true)
            return
        }
        move.pointer = { x: event.clientX, y: event.clientY }
        const travel = Math.hypot(move.pointer.x - move.start.x, move.pointer.y - move.start.y)
        if (state.value === 'armed' && travel >= LIFT_PX) lift()
    }

    function onPointerUp(event) {
        if (move && event.pointerId === move.pointerId) release(true)
    }

    function onPointerCancel(event) {
        if (move && event.pointerId === move.pointerId) release(false)
    }

    // Read before the page's own listeners, so the frame's Escape hotkey
    // never sees the Escape that cancels a drag.
    function onWindowKeydown(event) {
        if (event.key !== 'Escape' || !move) return
        if (state.value !== 'lifted') {
            finish()
            return
        }
        event.preventDefault()
        event.stopPropagation()
        cancelLifted(false)
    }

    function onWindowBlur() {
        if (state.value === 'lifted') cancelLifted(false)
        else if (state.value === 'armed') finish()
    }

    // A release drops a lifted card; a press that never lifted was a click.
    function release(dropped) {
        if (state.value !== 'lifted') finish()
        else if (dropped) drop()
        else cancelLifted(true)
    }

    function lift() {
        const { cell, card } = move
        const before = list()
        const from = indexOf(before, move.key)
        if (from < 0) {
            finish()
            return
        }
        glides.get(card)?.cancel()
        const box = card.getBoundingClientRect()
        const width = card.offsetWidth
        const height = card.offsetHeight
        // The slot keeps the card's natural height, so its row keeps its own.
        card.style.height = 'auto'
        const natural = card.offsetHeight
        card.style.height = ''
        const anchor = gridEl() || cell
        Object.assign(move, {
            from,
            base: before,
            grab: { x: move.pointer.x - box.left, y: move.pointer.y - box.top },
            focus: focusWithin(card),
            scrollEl: scrollParentOf(anchor),
            stickyEl: stickyOf(anchor),
            last: null,
            frameAt: null,
            carry: 0,
        })
        cell.style.minHeight = `${natural}px`
        card.style.width = `${width}px`
        card.style.height = `${height}px`
        card.style.transform = 'translate(0px, 0px)'
        draft.value = before.slice()
        state.value = 'lifted'
        document.documentElement.classList.add('bd-dragging')
        move.raf = requestAnimationFrame(frame)
    }

    // Each frame: the auto-scroll step, the insertion, then the floating
    // card once the grid shows the draft.
    function frame(now) {
        if (!move || state.value !== 'lifted') return
        move.raf = requestAnimationFrame(frame)
        const dt = move.frameAt === null ? 1000 / 60 : clamp(now - move.frameAt, 0, MAX_FRAME_MS)
        move.frameAt = now
        autoScroll(dt)
        track()
        nextTick(placeCard)
    }

    // Near or beyond the band's top or bottom edge, scroll toward it. The
    // fraction of a pixel a frame leaves is carried to the next one.
    function autoScroll(dt) {
        const el = move.scrollEl
        if (!el) return
        const band = visibleBand(el, move.stickyEl)
        const toTop = move.pointer.y - band.top
        const toBottom = band.bottom - move.pointer.y
        const speed = toTop < toBottom ? -edgeSpeed(toTop) : edgeSpeed(toBottom)
        if (!speed) {
            move.carry = 0
            return
        }
        move.carry += (speed * dt) / 1000
        const step = Math.trunc(move.carry)
        if (!step) return
        move.carry -= step
        el.scrollTop += step
    }

    function track() {
        const el = gridEl()
        if (!el) return
        const box = gridBox(el)
        const band = visibleBand(move.scrollEl, move.stickyEl)
        const point = {
            x: clamp(move.pointer.x, box.left, box.left + box.width) - box.left,
            y: clamp(move.pointer.y, band.top, band.bottom) - box.top,
        }
        const current = indexOf(draft.value, move.key)
        const next = dropIndex(readCells(el), move.key, point, box.width)
        if (next < 0 || next === current) return
        // A change that would undo the last one waits until the pointer has moved on.
        const last = move.last
        if (last && last.to === current && last.from === next && Math.hypot(point.x - last.x, point.y - last.y) < UNDO_PX) return
        move.last = { from: current, to: next, x: point.x, y: point.y }
        draft.value = placeWidget(draft.value, move.key, next)
    }

    // The floating card under the pointer, placed against its cell's box as
    // drawn, which already includes the cell's glide.
    function placeCard() {
        if (!move || state.value !== 'lifted') return
        const box = move.cell.getBoundingClientRect()
        const x = move.pointer.x - move.grab.x - box.left
        const y = move.pointer.y - move.grab.y - box.top
        move.card.style.transform = `translate(${x}px, ${y}px)`
    }

    function drop() {
        const m = move
        const to = indexOf(draft.value, m.key)
        const from = m.card.getBoundingClientRect()
        finish()
        if (to !== m.from) {
            if (store.place(toValue(board.websiteId), m.key, to)) {
                ui.announce(`Moved ${titleOf(m.key)}. Now ${to + 1} of ${list().length}.`)
            } else {
                ui.announce(cancelText(m))
            }
        }
        swallowClick(m.pointerId, true)
        land(m, from)
    }

    function cancelLifted(released) {
        const m = move
        const from = m.card.getBoundingClientRect()
        finish()
        ui.announce(cancelText(m))
        swallowClick(m.pointerId, released)
        land(m, from)
    }

    // The card glides from where it floated into its cell, and focus goes
    // back to what had it when the card lifted.
    function land(m, from) {
        nextTick(() => {
            if (m.focus?.isConnected && document.activeElement !== m.focus) m.focus.focus({ preventScroll: true })
            if (reduced() || !m.card.isConnected || typeof m.card.animate !== 'function') return
            const to = m.card.getBoundingClientRect()
            const dx = from.left - to.left
            const dy = from.top - to.top
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
            // Above the cards it passes over, as its slot was.
            m.cell.style.zIndex = '5'
            const glide = m.card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
                duration: GLIDE_MS,
                easing: GLIDE_EASE,
            })
            glides.set(m.card, glide)
            const done = () => {
                if (glides.get(m.card) === glide) glides.delete(m.card)
                m.cell.style.zIndex = ''
            }
            glide.onfinish = done
            glide.oncancel = done
        })
    }

    // The click that follows a drag's release never reaches the board, so a
    // drag never opens a panel. A drag cancelled with the button still down
    // waits for its release; the next press or key lets clicks through.
    function swallowClick(pointerId, released) {
        const swallow = (event) => {
            event.preventDefault()
            event.stopPropagation()
            stop()
        }
        const onUp = (event) => {
            if (event.pointerId === pointerId) setTimeout(stop, 0)
        }
        function stop() {
            window.removeEventListener('click', swallow, true)
            window.removeEventListener('pointerup', onUp, true)
            window.removeEventListener('pointerdown', stop, true)
            window.removeEventListener('keydown', stop, true)
        }
        window.addEventListener('click', swallow, true)
        if (released) {
            setTimeout(stop, 0)
            return
        }
        window.addEventListener('pointerup', onUp, true)
        window.addEventListener('pointerdown', stop, true)
        window.addEventListener('keydown', stop, true)
    }

    /* ── Keyboard ── */

    function keydown(event, k) {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        const held = state.value === 'held' && key.value === k
        if (isSpace(event.key) || event.key === 'Enter') {
            if (!held && state.value !== 'idle') return
            event.preventDefault()
            if (event.repeat) return
            lastKeyAt = Date.now()
            if (held) dropHeld()
            else pickUp(event.currentTarget, k)
            return
        }
        if (!held) return
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancelHeld({ refocusGrip: true })
        } else if (MOVE_KEYS.has(event.key)) {
            event.preventDefault()
            step(event.key)
        }
    }

    function pickUp(grip, k) {
        if (!canMove.value || state.value !== 'idle' || !grip) return
        const cell = grip.closest('li.bd-cell')
        const before = list()
        const from = indexOf(before, k)
        if (!cell || from < 0) return
        const anchor = gridEl() || cell
        begin(k, { from, base: before, grip, cell, scrollEl: scrollParentOf(anchor), stickyEl: stickyOf(anchor), reordering: false })
        draft.value = before.slice()
        state.value = 'held'
        ui.announce(
            `${titleOf(k)} picked up. Position ${from + 1} of ${before.length}. Use the arrow keys to move it, then press Space to drop it or Escape to cancel.`,
        )
    }

    function step(keyName) {
        const m = move
        const el = gridEl()
        const mode = boardMode(el ? gridBox(el).width : 0)
        const { index, edge } = keyTarget(draft.value, m.key, keyName, mode)
        if (edge) {
            ui.announce(EDGES[edge](titleOf(m.key)))
            return
        }
        if (index < 0 || index === indexOf(draft.value, m.key)) return
        // Vue moving the cell can blur the grip: that blur is not the user leaving.
        m.reordering = true
        draft.value = placeWidget(draft.value, m.key, index)
        ui.announce(`${titleOf(m.key)}, position ${index + 1} of ${draft.value.length}.`)
        nextTick(() => {
            if (move !== m) return
            if (document.activeElement !== m.grip) m.grip.focus({ preventScroll: true })
            m.reordering = false
            revealCell(m.scrollEl, m.cell, { ...visibleBand(m.scrollEl, m.stickyEl), smooth: !reduced() })
        })
    }

    function dropHeld() {
        const m = move
        const to = indexOf(draft.value, m.key)
        finish()
        const title = titleOf(m.key)
        if (to !== m.from && store.place(toValue(board.websiteId), m.key, to)) {
            ui.announce(`Moved ${title}. Now ${to + 1} of ${list().length}.`)
        } else {
            ui.announce(`${title} stays at ${indexOf(list(), m.key) + 1} of ${list().length}.`)
        }
        refocus(m.grip)
    }

    // refocusGrip: Escape keeps focus on the grip. Focus that moved on
    // (blur) stays where it went; anything else gives the grip back focus
    // only when the reorder lost it.
    function cancelHeld({ refocusGrip = false, focusMoved = false } = {}) {
        const m = finish()
        if (!m) return
        ui.announce(cancelText(m))
        if (!focusMoved) refocus(m.grip, { onlyIfLost: !refocusGrip })
    }

    function blur(event, k) {
        if (state.value !== 'held' || key.value !== k || !move || move.reordering) return
        cancelHeld({ focusMoved: true })
    }

    // A mouse click on the grip does nothing. A screen reader in browse mode
    // sends a click (detail 0) instead of keys: it picks up and drops.
    function click(event, k) {
        if (event.detail !== 0 || Date.now() - lastKeyAt < KEY_CLICK_MS) return
        if (state.value === 'held' && key.value === k) dropHeld()
        else if (state.value === 'idle') pickUp(event.currentTarget, k)
    }

    /* ── Whatever pulls the board from under a move cancels it ── */

    function cancelAny() {
        if (state.value === 'lifted') cancelLifted(false)
        else if (state.value === 'held') cancelHeld()
        else if (state.value === 'armed') finish()
    }

    // A panel, another project or another page.
    watch(() => route.fullPath, cancelAny)
    // The layout starts loading, or the window narrows to a phone.
    watch(
        () => Boolean(toValue(enabled)),
        (on) => {
            if (!on) cancelAny()
        },
    )
    // A late load answer or a 409 under the move. A save's answer replaces
    // the list with the same content, which changes nothing.
    watch(list, (now) => {
        if (move?.base && moving() && !sameLayout(now, move.base)) cancelAny()
    })
    onBeforeUnmount(finish)

    provide(DRAG, { state, key, canMove, press, keydown, click, blur })
    return { shown, state, key }
}

/**
 * One card's part in the board's moves (`getKey` returns its widget key):
 * the handlers for its grip and its header, whether cards can move, and
 * whether this one floats (lifted, its cell the slot) or is held.
 */
export function useBoardDragItem(getKey) {
    const drag = inject(DRAG, null)
    const k = () => toValue(getKey)
    const is = (name) => computed(() => Boolean(drag) && drag.state.value === name && drag.key.value === k())
    const lifted = is('lifted')
    return {
        grip: drag
            ? {
                  pointerdown: (event) => drag.press(event, k(), 'grip'),
                  keydown: (event) => drag.keydown(event, k()),
                  click: (event) => drag.click(event, k()),
                  blur: (event) => drag.blur(event, k()),
              }
            : {},
        head: drag ? { pointerdown: (event) => drag.press(event, k(), 'head') } : {},
        canMove: computed(() => Boolean(drag?.canMove.value)),
        lifted,
        held: is('held'),
        slot: lifted,
    }
}
