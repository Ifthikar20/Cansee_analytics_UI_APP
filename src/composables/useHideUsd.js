// Whether this screen must hide dollars: the account is on the Free plan,
// which counts prompt runs and never shows an amount of money.
//
// The session's limits.prompt_runs says so for the whole app; a screen can
// pass the payloads it already has (an estimate with prompt_runs, GET
// agent/status/ with allowance.show_usd) as getters, and any of them saying
// "metered" hides dollars. Without Pinia (a component mounted on its own in
// a test) only those payloads decide.
import { computed } from 'vue'
import { hidesUsd, meteredRuns } from '@/lib/promptRuns'
import { useAuthStore } from '@/stores/auth'

export function useHideUsd(...getters) {
  let auth = null
  try {
    auth = useAuthStore()
  } catch {
    auth = null
  }
  return computed(() => {
    if (auth && hidesUsd({ prompt_runs: auth.session?.limits?.prompt_runs })) return true
    return getters.some((get) => {
      try {
        return hidesUsd(typeof get === 'function' ? get() : null)
      } catch {
        return false
      }
    })
  })
}

/** The session's free prompt runs (normalized), or null for paid accounts and without Pinia. */
export function useSessionRuns() {
  let auth = null
  try {
    auth = useAuthStore()
  } catch {
    auth = null
  }
  return computed(() => (auth ? meteredRuns(auth.session?.limits?.prompt_runs) : null))
}
