import axios from 'axios'
import agentApi from '@/api/agent'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAuthStore } from '@/stores/auth'

// Loads pages for url tabs through POST live/websites/<wid>/browse/. Results
// are cached per user, project and URL, so Back and Forward do not refetch.

const CACHE_MAX = 30
const cache = new Map()
const inflight = new Map()

const SERVICE_COPY = {
    agent_disabled: 'The agent is switched off, so pages cannot be opened here.',
    agent_unavailable: 'The agent service is offline right now. Try again in a minute.',
    agent_not_configured: 'The agent is not set up on this server yet.',
}

// Fetch errors (as opposed to a BrowseResult that carries its own error).
export function browseError(err) {
    const status = err?.response?.status || 0
    const body = err?.response?.data
    const code = (body && body.error && typeof body.error === 'object' ? body.error.code : body?.error) || ''
    const message = (body && body.error && typeof body.error === 'object' && body.error.message) || ''
    if (!status) return { code: 'network', message: "CanSee couldn't be reached. Check your connection and try again." }
    if (status === 503) {
        const key = SERVICE_COPY[code] ? code : 'agent_unavailable'
        return { code: key, message: SERVICE_COPY[key] }
    }
    if (status === 429) {
        return { code: code || 'rate_limited', message: message || 'Too many pages were opened in a short time. Try again in a minute.' }
    }
    if (status === 404) return { code: 'not_found', message: 'This project could not be found.' }
    if (status === 403) return { code: code || 'forbidden', message: message || "You don't have access to open pages for this project." }
    if (status === 400) return { code: code || 'invalid', message: message || "This address can't be opened." }
    return { code: code || 'server_error', message: message || 'The page could not be loaded. Try again.' }
}

function remember(key, result) {
    cache.delete(key)
    cache.set(key, result)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

export function useBrowse() {
    const agent = useAgentStore()
    const pane = useAgentPaneStore()
    const auth = useAuthStore()

    function cacheKey(url) {
        return `${auth.user?.id ?? ''}|${agent.websiteId}|${url}`
    }

    function cached(url) {
        return cache.get(cacheKey(url)) || null
    }

    // -> {result} | {error} | {cancelled}
    function fetchPage(url, { force = false } = {}) {
        const wid = agent.websiteId
        if (wid === undefined || wid === null || wid === '') {
            return Promise.resolve({ error: { code: 'no_project', message: 'Choose a project to open pages.' } })
        }
        const key = cacheKey(url)
        if (!force && cache.has(key)) {
            const result = cache.get(key)
            remember(key, result)
            return Promise.resolve({ result })
        }
        if (inflight.has(key)) return inflight.get(key)
        const request = agentApi
            .browse(wid, url)
            .then((res) => {
                const result = res && res.data && typeof res.data === 'object' ? res.data : null
                if (!result) return { error: { code: 'server_error', message: 'The page could not be loaded. Try again.' } }
                if (!result.error) remember(key, result)
                return { result }
            })
            .catch((err) => (axios.isCancel(err) ? { cancelled: true } : { error: browseError(err) }))
            .finally(() => inflight.delete(key))
        inflight.set(key, request)
        return request
    }

    function tabById(id) {
        return pane.tabs.find((t) => t.id === id) || null
    }

    // Loads the tab's current URL into the tab. A result that arrives after
    // the tab navigated elsewhere is dropped.
    async function load(tabId, { force = false } = {}) {
        const tab = tabById(tabId)
        if (!tab || !tab.url) return
        const url = tab.url
        pane.updateTab(tabId, { status: 'loading' })
        const outcome = await fetchPage(url, { force })
        const now = tabById(tabId)
        if (!now || now.url !== url || outcome.cancelled) return
        pane.updateTab(tabId, { data: null })
        if (outcome.error) {
            pane.updateTab(tabId, { status: 'error', data: { url, error: outcome.error, transport: true } })
            return
        }
        const r = outcome.result
        pane.updateTab(tabId, {
            status: r.error ? 'error' : 'ready',
            finalUrl: r.final_url || null,
            title: r.title || r.seo?.title || now.title,
            data: r,
        })
    }

    return { load, fetchPage, cached }
}
