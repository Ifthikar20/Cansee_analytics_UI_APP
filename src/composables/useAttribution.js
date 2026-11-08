import { onBeforeUnmount, ref, toValue, watch } from 'vue'
import citationsApi from '@/api/citations'
import { createAttributionLoader } from '@/lib/attribution/loader'

const IDLE = Object.freeze({ phase: 'idle', data: null, error: null })

/**
 * One response's source attribution for the chat viewer. Loads (and if
 * needed starts) it while `isOpen` and `resultId` are set, polls while it is
 * pending, and stops on close, on another response, and on unmount.
 * All three arguments are refs or getters.
 *
 * Returns {state, retry}: state is {phase, data, error} (lib/attribution/
 * loader.js); retry() re-runs a failed analysis, or loads again after an
 * error or a timeout.
 */
export function useAttribution(websiteId, resultId, isOpen) {
    const state = ref(IDLE)
    const payload = (res) => res?.data ?? null
    const loader = createAttributionLoader({
        get: () => citationsApi.attribution(toValue(websiteId), toValue(resultId)).then(payload),
        post: (body) => citationsApi.startAttribution(toValue(websiteId), toValue(resultId), body).then(payload),
        onUpdate: (next) => {
            state.value = next
        },
    })

    watch(
        () => [toValue(isOpen), toValue(websiteId), toValue(resultId)],
        ([open, wid, rid]) => {
            if (open && wid && rid) {
                loader.start()
            } else {
                loader.stop()
                state.value = IDLE
            }
        },
        { immediate: true },
    )

    onBeforeUnmount(() => loader.stop())

    function retry() {
        return state.value.phase === 'failed' ? loader.refresh() : loader.start()
    }

    return { state, retry }
}
