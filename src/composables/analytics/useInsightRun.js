import { computed, getCurrentInstance, getCurrentScope, inject, onScopeDispose, provide, ref, shallowRef, toValue, watch } from 'vue'
import insightsApi from '@/api/insights'
import { useToast } from '@/composables/useToast'
import { RUN_KIND_LABELS } from '@/lib/analytics/insightWords'

export const INSIGHT_RUN_POLL_MS = 3000
export const ESTIMATE_DELAY_MS = 300
export const ACTIVE_RUN_STATUSES = Object.freeze(['queued', 'running'])

export function isActiveInsightRun(run) {
    return Boolean(run && ACTIVE_RUN_STATUSES.includes(run.status))
}

// One injection key per kind: a page's useInsightRun(kind) provides itself,
// and the InsightRunDialog of that kind rendered by the page picks it up.
const KEYS = new Map()
export function insightRunKey(kind) {
    if (!KEYS.has(kind)) KEYS.set(kind, Symbol(`insight-run:${kind}`))
    return KEYS.get(kind)
}

/** The useInsightRun(kind) of the page around this component, or null. */
export function injectInsightRun(kind) {
    return inject(insightRunKey(kind), null)
}

function errorBody(err) {
    const body = err?.response?.data?.error
    return body && typeof body === 'object' ? body : { code: typeof body === 'string' ? body : '', message: '' }
}

function failureOf(err) {
    const body = errorBody(err)
    return { status: err?.response?.status || 0, code: body.code || '', message: body.message || err?.displayMessage || '' }
}

/**
 * One kind of insights run on a page (p2_contract.md 1e), built like wave 1
 * useCountryRun: the run options, the dialog's estimate and confirmed start,
 * and the run shown in the progress panel.
 *
 *   const audit = useInsightRun('site_audit', { websiteId: () => props.websiteId, onFinished: reload })
 *   audit.open({ competitors: true })   // dialog open; the estimate follows every change
 *   audit.update({ competitors: false }) // 300 ms later a new estimate is posted
 *   await audit.start()                  // creates the run with the estimate's own `confirm`
 *
 * - Options load on mount and whenever the project changes; an active run
 *   in them (`active_run`) is adopted and polled.
 * - The run is polled every 3 s while queued or running; polling pauses
 *   while the browser tab is hidden and stops on unmount.
 * - `onFinished(run)` is called once when a run this view watched ends, so
 *   the page can reload its data.
 * - Nothing runs unconfirmed: start() sends `estimate.confirm`; a 409
 *   estimate_changed replaces the estimate and asks for a new confirm.
 */
export function useInsightRun(kind, { websiteId, onFinished = null } = {}) {
    const toast = useToast()
    const wid = () => {
        const value = toValue(websiteId)
        return value === undefined || value === null || value === '' ? '' : String(value)
    }

    const options = shallowRef(null)
    const optionsLoading = ref(false)
    const optionsFailure = ref(null)
    const optionsError = computed(() => (optionsFailure.value ? optionsFailure.value.message || 'error' : ''))

    const run = shallowRef(null)
    const stopping = ref(false)
    const stopError = ref('')
    const active = computed(() => isActiveInsightRun(run.value))

    const isOpen = ref(false)
    const params = shallowRef({})
    const estimate = shallowRef(null)
    const estimating = ref(false)
    const submitting = ref(false)
    const error = ref('')
    const changedNote = ref('')

    const kindLabel = computed(() => run.value?.kind_label || RUN_KIND_LABELS[kind] || 'Run')
    const canStart = computed(
        () =>
            isOpen.value &&
            !estimating.value &&
            !submitting.value &&
            Boolean(estimate.value?.can_run && estimate.value?.confirm),
    )

    let disposed = false
    let pollTimer = null
    let reading = false
    let estimateTimer = null
    let estimateToken = 0
    let optionsToken = 0
    const finished = new Set()

    /* ── Options ── */

    async function loadOptions() {
        const id = wid()
        if (!id) return null
        const mine = ++optionsToken
        optionsLoading.value = true
        try {
            const res = await insightsApi.runOptions(id, kind)
            if (disposed || mine !== optionsToken || wid() !== id) return null
            options.value = res.data || null
            optionsFailure.value = null
            // Adopt a run started elsewhere (another tab, an earlier visit) unless
            // this view is already watching an active one.
            const current = options.value?.active_run
            if (current && !active.value && String(run.value?.id ?? '') !== String(current.id)) track(current)
            return options.value
        } catch (err) {
            if (disposed || mine !== optionsToken) return null
            optionsFailure.value = failureOf(err)
            return null
        } finally {
            if (mine === optionsToken) optionsLoading.value = false
        }
    }

    /* ── The run in the progress panel ── */

    function clearPoll() {
        if (pollTimer) clearTimeout(pollTimer)
        pollTimer = null
    }

    function schedule() {
        clearPoll()
        if (disposed || !active.value) return
        if (typeof document !== 'undefined' && document.hidden) return
        pollTimer = setTimeout(poll, INSIGHT_RUN_POLL_MS)
    }

    function settle(next) {
        const wasActive = isActiveInsightRun(run.value)
        run.value = next || null
        if (isActiveInsightRun(next)) return
        stopping.value = false
        if (wasActive && next && !finished.has(String(next.id))) {
            finished.add(String(next.id))
            // The finished run changes what the options say (last run, choices, allowance).
            loadOptions()
            if (typeof onFinished === 'function') onFinished(next)
        }
    }

    async function poll() {
        pollTimer = null
        const current = run.value
        if (disposed || reading || !isActiveInsightRun(current)) return
        const id = wid()
        reading = true
        try {
            const res = await insightsApi.getRun(id, current.id)
            // The view moved to another project or another run meanwhile.
            if (disposed || wid() !== id || run.value?.id !== current.id) return
            settle(res.data)
        } catch {
            // A failed read keeps the last known state; the next poll retries.
        } finally {
            reading = false
        }
        schedule()
    }

    /** Show a run (a Run or RunSummary) and poll it while it is active. */
    function track(next) {
        clearPoll()
        run.value = next || null
        stopping.value = Boolean(next?.cancel_requested)
        stopError.value = ''
        if (isActiveInsightRun(next)) schedule()
    }

    /** Ask the server to stop the run (idempotent); finished work is kept. */
    async function stop() {
        const current = run.value
        if (!isActiveInsightRun(current)) return
        stopping.value = true
        stopError.value = ''
        const id = wid()
        try {
            const res = await insightsApi.cancelRun(id, current.id)
            if (disposed || run.value?.id !== current.id) return
            settle(res.data)
            if (isActiveInsightRun(run.value)) {
                stopping.value = true
                schedule()
            }
        } catch (err) {
            stopping.value = false
            stopError.value = failureOf(err).message || "We couldn't stop this run. Try again."
        }
    }

    /** Hide a finished run's panel. */
    function dismiss() {
        if (active.value) return
        clearPoll()
        run.value = null
        stopping.value = false
        stopError.value = ''
    }

    /* ── Dialog: params, debounced estimate, confirmed start ── */

    function clearEstimateTimer() {
        if (estimateTimer) clearTimeout(estimateTimer)
        estimateTimer = null
    }

    function queueEstimate() {
        clearEstimateTimer()
        changedNote.value = ''
        error.value = ''
        estimateToken += 1
        if (!isOpen.value || !wid()) {
            estimating.value = false
            return
        }
        // The previous estimate stays (dimmed) until the new one answers.
        estimating.value = true
        estimateTimer = setTimeout(runEstimate, ESTIMATE_DELAY_MS)
    }

    async function runEstimate() {
        estimateTimer = null
        const mine = ++estimateToken
        const id = wid()
        try {
            const res = await insightsApi.estimate(id, { kind, params: params.value })
            if (disposed || mine !== estimateToken) return
            estimate.value = res.data || null
            error.value = ''
        } catch (err) {
            if (disposed || mine !== estimateToken) return
            estimate.value = null
            error.value = failureOf(err).message || "We couldn't estimate the cost. Try again."
        } finally {
            if (!disposed && mine === estimateToken) estimating.value = false
        }
    }

    /** Open the dialog with the page's selection; the first estimate follows. */
    function open(initial = {}) {
        params.value = { ...(initial || {}) }
        estimate.value = null
        error.value = ''
        changedNote.value = ''
        isOpen.value = true
        if (optionsFailure.value || !options.value) loadOptions()
        queueEstimate()
    }

    function close() {
        isOpen.value = false
        clearEstimateTimer()
        estimateToken += 1
        estimating.value = false
    }

    /** Merge a change into the params (a control in the dialog) and re-estimate. */
    function update(patch = {}) {
        params.value = { ...params.value, ...(patch || {}) }
        queueEstimate()
    }

    /** Replace the params and re-estimate. */
    function setParams(next = {}) {
        params.value = { ...(next || {}) }
        queueEstimate()
    }

    /**
     * Create the run with the estimate's own `confirm`. Resolves the run on
     * 202 (the dialog closes and a toast says it started), else null with
     * `changedNote` (the cost moved: confirm again) or `error` set.
     */
    async function start() {
        if (!canStart.value) return null
        const id = wid()
        submitting.value = true
        error.value = ''
        changedNote.value = ''
        try {
            const res = await insightsApi.startRun(id, { kind, params: params.value, confirm: estimate.value.confirm })
            if (disposed) return null
            const created = res.data || null
            close()
            if (created) track(created)
            toast.success(`${created?.kind_label || RUN_KIND_LABELS[kind] || 'The run'} started.`)
            return created
        } catch (err) {
            if (disposed) return null
            const body = errorBody(err)
            if (err?.response?.status === 409 && body.code === 'estimate_changed' && body.details?.estimate) {
                estimate.value = body.details.estimate
                changedNote.value = 'The cost changed. Check the new estimate and confirm again.'
            } else {
                error.value = failureOf(err).message || "We couldn't start this run. Try again."
            }
            return null
        } finally {
            submitting.value = false
        }
    }

    /* ── Lifecycle ── */

    function reset() {
        clearPoll()
        close()
        optionsToken += 1
        options.value = null
        optionsFailure.value = null
        optionsLoading.value = false
        run.value = null
        stopping.value = false
        stopError.value = ''
        estimate.value = null
        error.value = ''
        changedNote.value = ''
    }

    watch(
        wid,
        (id) => {
            reset()
            if (id) loadOptions()
        },
        { immediate: true },
    )

    function onVisibility() {
        if (document.hidden) clearPoll()
        else if (active.value && !pollTimer) poll()
    }

    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

    if (getCurrentScope()) {
        onScopeDispose(() => {
            disposed = true
            clearPoll()
            clearEstimateTimer()
            estimateToken += 1
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
        })
    }

    const api = {
        kind,
        kindLabel,
        options,
        optionsLoading,
        optionsError,
        optionsFailure,
        loadOptions,
        run,
        active,
        stopping,
        stopError,
        track,
        stop,
        dismiss,
        isOpen,
        params,
        estimate,
        estimating,
        submitting,
        error,
        changedNote,
        canStart,
        open,
        close,
        update,
        setParams,
        start,
    }
    if (getCurrentInstance()) provide(insightRunKey(kind), api)
    return api
}
