import { computed, ref, shallowRef, watch } from 'vue'

/**
 * One analytics request, reloaded whenever its inputs change.
 *
 *   const q = useAnalyticsQuery(
 *     () => visibilityApi.dashboard(wid.value, params.value).then((r) => r.data),
 *     () => [wid.value, params.value],
 *     { resetOn: () => wid.value },
 *   )
 *
 * - `fetcher` returns the payload (a promise).
 * - `deps` returns the inputs; a change (compared by value) reloads.
 * - `resetOn` returns a key (the project): when it differs from the key of
 *   the data on screen, the data is cleared before loading, so one
 *   project's numbers never show under another's name.
 *
 * Returns {data, loading, error, failure, stale, reload}. The previous
 * data stays while a reload runs (charts dim instead of flashing), and an
 * answer that arrives after a newer request started is ignored.
 * `error` is the failure's display message ('' when none), `failure` its
 * {status, code, message}; `stale` is true when the last reload failed and
 * the data on screen is from an earlier load.
 */
export function useAnalyticsQuery(fetcher, deps, { resetOn = null, immediate = true } = {}) {
    const data = shallowRef(null)
    const loading = ref(false)
    const failure = ref(null)
    let token = 0
    let dataKey

    function keyOf(value) {
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }

    async function reload() {
        const mine = ++token
        const key = resetOn ? keyOf(resetOn()) : undefined
        if (resetOn && key !== dataKey) data.value = null
        loading.value = true
        failure.value = null
        try {
            const payload = await fetcher()
            if (mine !== token) return
            data.value = payload ?? null
            dataKey = key
        } catch (err) {
            if (mine !== token) return
            const body = err?.response?.data?.error
            failure.value = {
                status: err?.response?.status || 0,
                code: typeof body === 'string' ? body : body?.code || '',
                message: err?.displayMessage || (typeof body === 'object' && body?.message) || '',
            }
        } finally {
            if (mine === token) loading.value = false
        }
    }

    const error = computed(() => (failure.value ? failure.value.message || 'error' : ''))
    const stale = computed(() => Boolean(failure.value && data.value))

    watch(() => keyOf(deps()), () => reload(), { immediate })

    return { data, loading, error, failure, stale, reload }
}
