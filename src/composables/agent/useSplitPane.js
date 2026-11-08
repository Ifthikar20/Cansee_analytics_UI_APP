import { computed, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'

// Geometry and input handling for the chat | browser split handle. The ratio
// is the chat column's share of the width; both columns keep their minimum.

export const MIN_CHAT = 380
export const MIN_PANE = 420
export const HANDLE_WIDTH = 1
const KEY_STEP = 24

export function ratioBounds(width, { minStart = MIN_CHAT, minEnd = MIN_PANE, handle = HANDLE_WIDTH } = {}) {
    const usable = Number(width) - handle
    if (!(usable > 0)) return { min: 0.15, max: 0.85, fits: false }
    const min = minStart / usable
    const max = 1 - minEnd / usable
    return { min, max, fits: min <= max }
}

export function clampRatio(ratio, width, options = {}) {
    const r = Number.isFinite(ratio) ? ratio : 0.5
    const { min, max, fits } = ratioBounds(width, options)
    if (!fits) return Math.min(0.85, Math.max(0.15, r))
    return Math.min(max, Math.max(min, r))
}

export function ratioFromPointer(clientX, rect, handle = HANDLE_WIDTH) {
    const usable = rect.width - handle
    if (!(usable > 0)) return 0.5
    return (clientX - rect.left - handle / 2) / usable
}

// The ratio a key press moves the handle to, or null for other keys.
// Arrows move 24px (48px with Shift), Home and End go to the minimum chat
// and minimum browser widths, Enter resets to half.
export function keyRatio(key, { ratio, width, shift = false, ...options }) {
    const { min, max, fits } = ratioBounds(width, options)
    const usable = Math.max(1, Number(width) - (options.handle ?? HANDLE_WIDTH))
    const step = (KEY_STEP * (shift ? 2 : 1)) / usable
    switch (key) {
        case 'ArrowLeft':
            return clampRatio(ratio - step, width, options)
        case 'ArrowRight':
            return clampRatio(ratio + step, width, options)
        case 'Home':
            return fits ? min : clampRatio(0, width, options)
        case 'End':
            return fits ? max : clampRatio(1, width, options)
        case 'Enter':
            return clampRatio(0.5, width, options)
        default:
            return null
    }
}

export function useSplitPane({ container, ratio, onCommit, minStart = MIN_CHAT, minEnd = MIN_PANE }) {
    const width = ref(0)
    const dragging = ref(false)
    const dragRatio = ref(null)
    let startRatio = null
    let focusRatio = null
    let frame = 0
    let pendingX = null
    let observer = null

    const options = computed(() => ({ minStart: toValue(minStart), minEnd: toValue(minEnd) }))
    const bounds = computed(() => ratioBounds(width.value, options.value))
    const current = computed(() => {
        const value = dragging.value && dragRatio.value !== null ? dragRatio.value : toValue(ratio)
        return clampRatio(value, width.value, options.value)
    })

    function measure() {
        const el = toValue(container)
        width.value = el ? el.getBoundingClientRect().width : 0
    }

    function observe(el) {
        if (observer) observer.disconnect()
        if (!el || typeof ResizeObserver !== 'function') return
        observer = new ResizeObserver(measure)
        observer.observe(el)
    }

    onMounted(() => {
        measure()
        observe(toValue(container))
    })
    watch(
        () => toValue(container),
        (el) => {
            measure()
            observe(el)
        }
    )

    function commit(value) {
        if (value === null || value === undefined) return
        onCommit(clampRatio(value, width.value, options.value))
    }

    function finish(cancel) {
        if (!dragging.value) return
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        pendingX = null
        const value = cancel ? startRatio : dragRatio.value
        dragging.value = false
        dragRatio.value = null
        if (!cancel) commit(value)
    }

    function onPointerDown(event) {
        if (event.button !== 0 || !toValue(container)) return
        event.preventDefault()
        try {
            event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
        measure()
        startRatio = current.value
        dragRatio.value = current.value
        dragging.value = true
    }

    function onPointerMove(event) {
        if (!dragging.value) return
        pendingX = event.clientX
        if (frame) return
        frame = requestAnimationFrame(() => {
            frame = 0
            const el = toValue(container)
            if (pendingX === null || !el) return
            const rect = el.getBoundingClientRect()
            dragRatio.value = clampRatio(ratioFromPointer(pendingX, rect), rect.width, options.value)
        })
    }

    function onPointerUp(event) {
        if (!dragging.value) return
        if (pendingX !== null) {
            const el = toValue(container)
            if (el) {
                const rect = el.getBoundingClientRect()
                dragRatio.value = clampRatio(ratioFromPointer(pendingX, rect), rect.width, options.value)
            }
        }
        try {
            event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {}
        finish(false)
    }

    function onPointerCancel() {
        finish(true)
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            if (dragging.value) {
                finish(true)
            } else if (focusRatio !== null && Math.abs(focusRatio - current.value) > 1e-6) {
                commit(focusRatio)
            } else {
                return
            }
            event.preventDefault()
            event.stopPropagation()
            return
        }
        const next = keyRatio(event.key, {
            ratio: current.value,
            width: width.value,
            shift: event.shiftKey,
            ...options.value,
        })
        if (next === null) return
        event.preventDefault()
        commit(next)
    }

    function onFocus() {
        focusRatio = current.value
    }

    function onBlur() {
        focusRatio = null
    }

    function onDoubleClick() {
        commit(0.5)
    }

    onBeforeUnmount(() => {
        if (observer) observer.disconnect()
        if (frame) cancelAnimationFrame(frame)
    })

    const aria = computed(() => ({
        'aria-valuenow': Math.round(current.value * 100),
        'aria-valuemin': Math.round(Math.min(bounds.value.min, current.value) * 100),
        'aria-valuemax': Math.round(Math.max(bounds.value.max, current.value) * 100),
        'aria-valuetext': `Chat ${Math.round(current.value * 100)} percent`,
    }))

    return {
        width,
        dragging,
        current,
        bounds,
        aria,
        measure,
        handlers: {
            onPointerdown: onPointerDown,
            onPointermove: onPointerMove,
            onPointerup: onPointerUp,
            onPointercancel: onPointerCancel,
            onKeydown: onKeyDown,
            onFocus,
            onBlur,
            onDblclick: onDoubleClick,
        },
    }
}
