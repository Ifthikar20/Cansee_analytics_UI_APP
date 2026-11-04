import { computed, getCurrentScope, onScopeDispose, reactive, ref, shallowRef, toValue, watch } from 'vue'
import promptBoxApi from '@/api/promptBox'
import { POLL_MS, failureOf, isActiveRun, normalizeQuestion } from './specs'

// Ask AI's runs, kept fresh for the card and its panel (autopilot_frontend.md
// 6c and 6d). usePromptBoxRun follows one run of the board's project: it
// loads the run and polls it every 1.5 s while it is queued or running, and
// stops at a terminal status, on unmount and on a project change. A poll
// that fails keeps the last answer (`stale`) and tries again more slowly; a
// run that is gone (404) is not polled again.
//
// Two notes are shared per project, so the card and the panel agree: a
// counter that moves when a run is asked (Recent questions reload), and the
// questions tracked from a run in this session.

const MAX_BACKOFF_MS = 15_000

const shared = reactive({ asked: {}, tracked: {} })

const idOf = (value) => (value === undefined || value === null || value === '' ? null : String(value))
const trackKey = (wid, text) => `${idOf(wid)}|${normalizeQuestion(text)}`

/** A counter that moves each time a run of project `wid` is asked. */
export function runsVersion(wid) {
    return shared.asked[idOf(wid)] || 0
}

/** Say that a run of project `wid` was just asked. */
export function noteRunAsked(wid) {
    const id = idOf(wid)
    if (id) shared.asked[id] = (shared.asked[id] || 0) + 1
}

/** {prompt_id, brand_prompt_id} of a question tracked from Ask AI in this session, or null. */
export function trackedOf(wid, text) {
    return shared.tracked[trackKey(wid, text)] || null
}

export function rememberTracked(wid, text, ids) {
    if (idOf(wid)) shared.tracked[trackKey(wid, text)] = ids
}

/** Forget both notes (tests, sign-out). */
export function resetPromptBoxNotes() {
    for (const key of Object.keys(shared.asked)) delete shared.asked[key]
    for (const key of Object.keys(shared.tracked)) delete shared.tracked[key]
}

/**
 * One prompt box run of project `websiteId` (a ref or getter), kept fresh.
 * Returns {run, loading, failure, stale, active, follow, show, stop, reset}:
 * - follow(id, {initial}) loads run `id` (showing `initial`, a summary in
 *   hand, at once) and polls it while it is active;
 * - show(payload) shows a run already in hand (the run Ask created, Stop's
 *   answer) and polls it while it is active;
 * - stop() polls no more and drops a request in flight; reset() also
 *   forgets the run.
 */
export function usePromptBoxRun(websiteId, { interval = POLL_MS } = {}) {
    const run = shallowRef(null)
    const loading = ref(false)
    const failure = ref(null)
    const wid = computed(() => idOf(toValue(websiteId)))
    const active = computed(() => isActiveRun(run.value))
    const stale = computed(() => Boolean(failure.value && run.value))

    let timer = null
    let token = 0
    let misses = 0
    let alive = true

    function clear() {
        if (timer) clearTimeout(timer)
        timer = null
    }

    function schedule(id, delay) {
        clear()
        if (alive) timer = setTimeout(() => load(id), delay)
    }

    function accept(payload) {
        run.value = payload
        failure.value = null
        misses = 0
        if (isActiveRun(payload)) schedule(payload.id, interval)
        else clear()
    }

    function load(id) {
        timer = null
        const project = wid.value
        if (!alive || !project || !id) return Promise.resolve()
        const mine = ++token
        loading.value = true
        return promptBoxApi.get(project, id).then(
            (res) => {
                if (mine !== token) return
                loading.value = false
                accept(res?.data ?? null)
            },
            (err) => {
                if (mine !== token) return
                loading.value = false
                failure.value = failureOf(err)
                const shown = run.value && String(run.value.id) === String(id)
                // Gone, or never loaded: nothing to poll. A blip while it runs: try again later.
                if (failure.value.status === 404 || !shown || !isActiveRun(run.value)) return
                misses += 1
                schedule(id, Math.min(interval * 2 ** misses, MAX_BACKOFF_MS))
            }
        )
    }

    function follow(id, { initial = null } = {}) {
        clear()
        token += 1
        misses = 0
        failure.value = null
        if (initial && String(initial.id) === String(id)) run.value = initial
        else if (run.value && String(run.value.id) !== String(id)) run.value = null
        return load(id)
    }

    function show(payload) {
        clear()
        token += 1
        loading.value = false
        if (!payload) {
            run.value = null
            failure.value = null
            return
        }
        accept(payload)
    }

    function stop() {
        clear()
        token += 1
        loading.value = false
    }

    function reset() {
        stop()
        run.value = null
        failure.value = null
        misses = 0
    }

    // Another project's run never shows, and is never polled.
    watch(wid, (now, before) => {
        if (now !== before) reset()
    })

    if (getCurrentScope()) {
        onScopeDispose(() => {
            alive = false
            stop()
        })
    }

    return { run, loading, failure, stale, active, follow, show, stop, reset }
}
