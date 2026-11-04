// The scroll container of the element in `target` (frame_board.md B10b):
// its nearest ancestor that scrolls, which on the board is the frame's
// <main id="app-main">, found once mounted. `height` is that container's
// clientHeight, kept current while it resizes.
import { onBeforeUnmount, onMounted, ref, shallowRef, toValue } from 'vue'
import { scrollParentOf } from './boardGeometry'

export function useScrollParent(target) {
    const el = shallowRef(null)
    const height = ref(0)
    let observer = null

    onMounted(() => {
        const node = toValue(target)
        if (!node) return
        const parent = scrollParentOf(node)
        el.value = parent
        height.value = parent?.clientHeight || 0
        if (!parent || typeof ResizeObserver !== 'function') return
        observer = new ResizeObserver(() => {
            height.value = parent.clientHeight || 0
        })
        observer.observe(parent)
    })
    onBeforeUnmount(() => observer?.disconnect())

    return { el, height }
}
