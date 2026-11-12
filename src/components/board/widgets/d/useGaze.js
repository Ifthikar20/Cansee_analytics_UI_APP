// Where the Watch block's eye looks: toward the mouse or pen, anywhere on
// the page. It looks straight ahead for touch (no cursor to follow), as
// soon as a key is pressed (keyboard users have no cursor either), when
// the pointer leaves the window, and always for people who ask for
// reduced motion.
import { onBeforeUnmount, onMounted, ref, shallowRef, toValue } from 'vue'
import { gaze } from '@/lib/board/d/watch'

const AHEAD = Object.freeze({ x: 0, y: 0 })

function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * `target` is a ref (or getter) of the eye's element. Returns {look,
 * following}: `look` is the gaze {x, y} (lib/board/d/watch.js) and
 * `following` says whether a pointer is being followed.
 */
export function useGaze(target) {
    const look = shallowRef(AHEAD)
    const following = ref(false)
    let pointer = null
    let frame = 0

    function apply() {
        frame = 0
        const el = toValue(target)
        if (!pointer || !el || typeof el.getBoundingClientRect !== 'function') return
        look.value = gaze(pointer, el.getBoundingClientRect())
        following.value = true
    }

    function rest() {
        pointer = null
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        look.value = AHEAD
        following.value = false
    }

    function onMove(event) {
        if (event.pointerType === 'touch' || reducedMotion()) {
            if (following.value) rest()
            return
        }
        pointer = { x: event.clientX, y: event.clientY }
        // One update a frame, however many moves arrive.
        if (!frame) frame = requestAnimationFrame(apply)
    }

    onMounted(() => {
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('keydown', rest)
        window.addEventListener('blur', rest)
        document.documentElement.addEventListener('pointerleave', rest)
    })
    onBeforeUnmount(() => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('keydown', rest)
        window.removeEventListener('blur', rest)
        document.documentElement.removeEventListener('pointerleave', rest)
        if (frame) cancelAnimationFrame(frame)
        frame = 0
    })

    return { look, following }
}
