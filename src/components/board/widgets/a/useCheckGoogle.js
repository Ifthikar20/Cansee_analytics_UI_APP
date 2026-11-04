// Google checks for the tracked prompts that have none yet, from the
// Summary panel and the Prompts card and panel (the Overview's "Check
// Google for {n}", moved here). Checks are queued one prompt at a time with
// a progress word; one toast reports the outcome, then the overview
// refetches.
import { ref, toValue } from 'vue'
import searchGapApi from '@/api/searchGap'
import { useToast } from '@/composables/useToast'
import { useBoard } from '@/lib/board/context'

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`
}

// The API answers some failures with a bare code ({"error": "code"}) and
// others with {"error": {"code", "message"}}.
function errorCode(err) {
    const e = err?.response?.data?.error
    return typeof e === 'string' ? e : e?.code || ''
}

/** The overview rows Google has not checked (or whose check failed). */
export function uncheckedPrompts(prompts) {
    return (Array.isArray(prompts) ? prompts : []).filter((p) => p?.google?.status !== 'ok')
}

/** {checking, progress, label(n), run(prompts)}; call it in setup. */
export function useCheckGoogle() {
    const board = useBoard()
    const toast = useToast()
    const checking = ref(false)
    const progress = ref('')

    function label(count) {
        return checking.value ? `Checking Google ${progress.value}` : `Check Google for ${count}`
    }

    async function run(prompts) {
        const wid = toValue(board.websiteId)
        const pending = uncheckedPrompts(prompts)
        if (!wid || !pending.length || checking.value) return
        checking.value = true
        let queued = 0
        let failed = 0
        let unavailable = false
        try {
            for (const [i, p] of pending.entries()) {
                progress.value = `${i + 1} of ${pending.length}`
                try {
                    await searchGapApi.checkGoogle(wid, p.prompt_id)
                    queued += 1
                } catch (err) {
                    if (errorCode(err) === 'serpapi_not_configured') {
                        unavailable = true
                        break
                    }
                    failed += 1
                }
            }
            if (queued) toast.success(`Google checks queued for ${plural(queued, 'prompt', 'prompts')}.`)
            if (unavailable) toast.error("Google rank checks aren't available yet.")
            else if (failed) toast.error(`We couldn't queue Google checks for ${plural(failed, 'prompt', 'prompts')}.`)
        } finally {
            checking.value = false
            progress.value = ''
            board.invalidate('overview')
        }
    }

    return { checking, progress, label, run }
}
