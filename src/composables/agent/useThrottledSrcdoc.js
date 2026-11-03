import { onScopeDispose, ref, toValue, watch } from 'vue'
import { buildSrcdoc } from '@/lib/agent/srcdoc'

// Double-buffered srcdoc for a page that may still be streaming. Two frames
// take turns: the visible one keeps the last build while the hidden one loads
// the next, and they swap on its load event, so a growing draft never
// flashes blank. While `live` is true, rebuilds run at most every `interval`
// ms; otherwise every change applies at once.
export function useThrottledSrcdoc(source, { live = false, interval = 700, build = buildSrcdoc } = {}) {
    const docs = ref(['', ''])
    const front = ref(0)
    const pending = ref(-1)
    let timer = null
    let lastAt = 0
    let lastHtml = null

    function write(index, doc) {
        const next = docs.value.slice()
        next[index] = doc
        docs.value = next
    }

    function clear() {
        if (timer) clearTimeout(timer)
        timer = null
    }

    function apply() {
        timer = null
        lastAt = Date.now()
        const html = toValue(source) ?? ''
        if (html === lastHtml) return
        lastHtml = html
        const doc = build(html)
        const shown = front.value
        if (!docs.value[shown]) {
            write(shown, doc)
            return
        }
        const back = 1 - shown
        if (docs.value[back] === doc) {
            // That frame already holds this document; no load event will come.
            front.value = back
            pending.value = -1
            return
        }
        write(back, doc)
        pending.value = back
    }

    function schedule() {
        // Settled content, and the first paint of a draft, apply at once.
        if (!toValue(live) || !docs.value[front.value]) {
            clear()
            apply()
            return
        }
        if (timer) return
        timer = setTimeout(apply, Math.max(0, interval - (Date.now() - lastAt)))
    }

    function onLoad(index) {
        if (index !== pending.value) return
        front.value = index
        pending.value = -1
    }

    function flush() {
        clear()
        apply()
    }

    watch(() => toValue(source), schedule, { immediate: true })
    watch(
        () => Boolean(toValue(live)),
        (isLive) => {
            if (!isLive) flush()
        }
    )
    onScopeDispose(clear)

    return { docs, front, pending, onLoad, flush }
}
