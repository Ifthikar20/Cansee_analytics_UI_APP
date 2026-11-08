import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import websitesApi from '@/api/websites'
import billingApi from '@/api/billing'

let inflight = null

/**
 * Load what every signed-in shell needs: the user (when the session has
 * not supplied it yet), the website list, and the plan limits behind "Add
 * project". The three requests are independent and run together; each
 * failure is tolerated (the router guard owns auth, plan info is optional).
 * Concurrent calls share one run.
 */
export function bootstrapShell() {
    if (inflight) return inflight
    const authStore = useAuthStore()
    const appStore = useAppStore()
    const tasks = []
    if (!authStore.user) {
        tasks.push(authStore.fetchMe().catch(() => {}))
    }
    tasks.push(
        websitesApi
            .list({ _silentError: true })
            .then(({ data }) => appStore.setWebsites(data || []))
            .catch(() => { /* keep whatever the guard loaded */ })
    )
    // The backend resolves the allowance (trial-aware); never re-derive it
    // from the plan name here.
    tasks.push(
        billingApi
            .getCurrent({ _silentError: true })
            .then(({ data }) => appStore.setProjectLimit(data?.limits?.projects ?? -1))
            .catch(() => { /* plan info is optional */ })
    )
    inflight = Promise.all(tasks)
        .then(() => undefined)
        .finally(() => {
            inflight = null
        })
    return inflight
}

/** Run the shell bootstrap when the calling layout mounts. */
export function useShellBootstrap() {
    const ready = ref(false)
    onMounted(async () => {
        await bootstrapShell()
        ready.value = true
    })
    return { ready, bootstrap: bootstrapShell }
}
