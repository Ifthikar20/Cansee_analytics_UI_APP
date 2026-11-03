import { useAppStore } from '@/stores/app'
import websitesApi from '@/api/websites'

let inflight = null

function loadWebsites(app) {
    if (inflight) return inflight
    inflight = websitesApi
        .list({ _silentError: true })
        .then(({ data }) => {
            app.setWebsites(Array.isArray(data) ? data : [])
            return { error: null }
        })
        .catch((error) => ({ error }))
        .finally(() => {
            inflight = null
        })
    return inflight
}

/**
 * The user's websites (projects), loading the list when the store is
 * empty or `force` is set. Concurrent callers share one request. A failed
 * load resolves with whatever the store already holds, unless
 * `rejectOnError` is set (a page that must not show a failure as "none").
 */
export function ensureWebsites({ force = false, rejectOnError = false } = {}) {
    const app = useAppStore()
    if (!force && app.websites.length) return Promise.resolve(app.websites)
    return loadWebsites(app).then(({ error }) => {
        if (error && rejectOnError) throw error
        return app.websites
    })
}
