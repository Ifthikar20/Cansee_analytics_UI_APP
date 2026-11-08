import { computed, onBeforeUnmount, ref, shallowRef, unref } from 'vue'
import countriesApi from '@/api/countries'
import { isActiveRun } from '@/lib/analytics/countrySpecs'

export const RUN_POLL_MS = 3000

/**
 * The country check shown in the Countries page's progress panel.
 *
 * There is no event stream: while the run is queued or running, the run is
 * polled every 3 s. Polling pauses while the browser tab is hidden and
 * resumes (with an immediate read) when it is shown again; it stops for
 * good on unmount. `onFinish(run)` is called once when a run this view
 * watched comes to an end, so the page can reload its results.
 *
 * - track(run): show a run (a CountryRun or RunSummary) and poll it if active.
 * - cancel(): ask the server to stop it (idempotent).
 * - dismiss(): hide a finished run's panel.
 */
export function useCountryRun(websiteId, { onFinish = null } = {}) {
    const run = shallowRef(null)
    const stopping = ref(false)
    const cancelError = ref('')
    let timer = null
    let disposed = false

    const active = computed(() => isActiveRun(run.value))

    function clearTimer() {
        if (timer) clearTimeout(timer)
        timer = null
    }

    function schedule() {
        clearTimer()
        if (disposed || !active.value) return
        if (typeof document !== 'undefined' && document.hidden) return
        timer = setTimeout(poll, RUN_POLL_MS)
    }

    function settle(next) {
        const wasActive = isActiveRun(run.value)
        run.value = next
        if (!isActiveRun(next)) {
            stopping.value = false
            if (wasActive && typeof onFinish === 'function') onFinish(next)
        }
    }

    let reading = false

    async function poll() {
        timer = null
        const current = run.value
        if (disposed || reading || !isActiveRun(current)) return
        const wid = unref(websiteId)
        reading = true
        try {
            const res = await countriesApi.getRun(wid, current.id)
            // The view moved to another project or another run meanwhile.
            if (disposed || unref(websiteId) !== wid || run.value?.id !== current.id) return
            settle(res.data)
        } catch {
            // A failed read keeps the last known state; the next poll retries.
        } finally {
            reading = false
        }
        schedule()
    }

    function track(next) {
        clearTimer()
        run.value = next || null
        stopping.value = Boolean(next?.cancel_requested)
        cancelError.value = ''
        if (isActiveRun(next)) schedule()
    }

    async function cancel() {
        const current = run.value
        if (!isActiveRun(current)) return
        stopping.value = true
        cancelError.value = ''
        const wid = unref(websiteId)
        try {
            const res = await countriesApi.cancelRun(wid, current.id)
            if (disposed || run.value?.id !== current.id) return
            // Keep the results already read; the cancel answer has none.
            settle({ ...res.data, results: res.data?.results || current.results })
            if (isActiveRun(run.value)) schedule()
        } catch (err) {
            stopping.value = false
            cancelError.value = err?.displayMessage || "We couldn't stop this check. Try again."
        }
    }

    function dismiss() {
        clearTimer()
        run.value = null
        stopping.value = false
        cancelError.value = ''
    }

    function onVisibility() {
        if (document.hidden) clearTimer()
        else if (active.value && !timer) poll()
    }

    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

    onBeforeUnmount(() => {
        disposed = true
        clearTimer()
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    })

    return { run, active, stopping, cancelError, track, cancel, dismiss, poll }
}
