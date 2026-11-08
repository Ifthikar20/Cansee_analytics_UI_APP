import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import router from '@/router'
import { getClientId, recordFailedRequest } from '@/lib/diagnostics'

const api = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
})

/* ── Request Interceptor ── */
// One refresh in flight at a time; every caller awaits the same promise.
let refreshPromise = null
// Set when a refresh attempt itself returns 401/403. Stops the storm of
// follow-up requests from each kicking off their own refresh; cleared the
// next time we see a fresh access token (i.e. after a successful login).
let sessionDead = false
let lastSeenToken = null

function currentAccessToken() {
    const auth = useAuthStore()
    if (auth.accessToken && auth.accessToken !== lastSeenToken) {
        // A new access token means the user logged back in; re-arm the
        // refresh flow so future 401s can attempt a refresh again.
        sessionDead = false
        lastSeenToken = auth.accessToken
    }
    return auth.accessToken
}

/**
 * Headers every API request carries: the bearer token, plus request
 * tracing (a fresh id per request and the stable per-session client id
 * the backend writes into every log line). Used by the axios instance and
 * by fetch-based callers (the agent run stream).
 */
export function authHeaders() {
    const token = currentAccessToken()
    const headers = {
        'X-Request-ID': crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        'X-Client-Id': getClientId(),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
}

/**
 * Where an expired session sends the user: the login page, with the page
 * they were on as `redirect` so signing back in returns them there (as the
 * route guard does for a cold load). Public and guest pages are not
 * returned to.
 */
function loginLocation(here) {
    const path = here?.fullPath
    if (!path || here.meta?.public || here.meta?.guest || !path.startsWith('/')) return { name: 'login' }
    return { name: 'login', query: { redirect: path } }
}

/**
 * Exchange the refresh cookie for a new access token. Single-flight:
 * concurrent callers share one request. Resolves with the new token. On a
 * 401/403 the session is over: auth is cleared and the user is sent to
 * login. Other failures (network, 5xx) reject without signing anyone out.
 */
export function refreshAccessToken() {
    if (refreshPromise) return refreshPromise
    currentAccessToken()
    if (sessionDead) return Promise.reject(new Error('Session expired'))
    refreshPromise = (async () => {
        try {
            const { data } = await axios.post('/api/v1/auth/refresh/', {}, { withCredentials: true })
            const newToken = data.data?.access || data.access
            const auth = useAuthStore()
            auth.accessToken = newToken
            lastSeenToken = newToken
            sessionDead = false
            return newToken
        } catch (refreshError) {
            // Only kick the user to /login if the refresh itself was
            // rejected as unauthorized. Any other failure (network
            // blip, 5xx from the backend, browser blocking the cookie
            // briefly) should NOT silently log them out — the original
            // request will simply fail and the user can retry.
            const refreshStatus = refreshError?.response?.status
            if (refreshStatus === 401 || refreshStatus === 403) {
                sessionDead = true
                const auth = useAuthStore()
                auth.clearAuth()
                // Don't pile up duplicate navigations if we're already
                // on /login (other in-flight requests may also 401).
                const here = router.currentRoute.value
                if (here?.name !== 'login') {
                    router.push(loginLocation(here))
                }
            }
            throw refreshError
        } finally {
            refreshPromise = null
        }
    })()
    return refreshPromise
}

api.interceptors.request.use((config) => {
    const headers = authHeaders()
    for (const [name, value] of Object.entries(headers)) {
        config.headers[name] = value
    }
    return config
})

/* ── Response Interceptor ── */

// User-friendly fallback messages — never show raw errors
const FRIENDLY_MESSAGES = {
    400: 'Something didn\'t look right. Please check your input.',
    401: 'Your session has expired. Please log in again.',
    403: 'You don\'t have permission to do that.',
    404: 'We couldn\'t find what you\'re looking for.',
    409: 'This action conflicts with something already in progress.',
    429: 'You\'re making requests too quickly. Please wait a moment.',
    500: 'Something went wrong on our end. Please try again.',
    502: 'Our servers are temporarily unavailable. Please try again shortly.',
    503: 'This feature is temporarily unavailable. Please try again shortly.',
}

api.interceptors.response.use(
    (response) => {
        // Every JSON success body from the API is enveloped by the backend
        // (core/interceptors/response_envelope.py) as {success, data, meta?}.
        // Unwrap unconditionally so callers always receive one shape:
        // res.data is the payload, res.meta the pagination block. Bodies
        // without the envelope (blobs, third-party URLs fetched through
        // this instance) pass through as the raw axios response.
        if (response.data && response.data.success !== undefined) {
            return response.data
        }
        return response
    },
    async (error) => {
        const originalRequest = error.config

        // 401 — try to refresh (silently, no toast)
        if (error.response?.status === 401 && !originalRequest._retry) {
            // If a previous refresh already failed, don't keep banging on
            // /auth/refresh/ — every queued component would otherwise kick
            // off its own retry and we'd flood the server with 401s.
            if (sessionDead) {
                return Promise.reject(error)
            }

            originalRequest._retry = true
            try {
                const newToken = await refreshAccessToken()
                originalRequest.headers.Authorization = `Bearer ${newToken}`
                return api(originalRequest)
            } catch (refreshError) {
                return Promise.reject(refreshError)
            }
        }

        // ── 429 Rate Limited — auto-retry with exponential backoff ──
        // Requests that start an agent run opt out with _noRetry429: a
        // re-sent POST would start a second run.
        const status = error.response?.status || 0
        if (status === 429 && !originalRequest?._noRetry429) {
            if (!originalRequest._retryCount) originalRequest._retryCount = 0
            if (originalRequest._retryCount < 2) {
                originalRequest._retryCount++
                const delay = originalRequest._retryCount * 2000
                await new Promise(r => setTimeout(r, delay))
                return api(originalRequest)
            }
        }

        // Remember the failure for support diagnostics (attached to
        // feedback-widget messages). Cancelled requests aren't failures.
        if (!axios.isCancel(error)) {
            recordFailedRequest({
                method: originalRequest?.method,
                url: originalRequest?.url,
                status,
                requestId: originalRequest?.headers?.['X-Request-ID'],
            })
        }

        // ── Extract user-friendly message ──
        const serverMessage = error.response?.data?.error?.message

        // Use the server's friendly message if it exists, otherwise use our fallback
        const displayMessage = serverMessage || FRIENDLY_MESSAGES[status] || FRIENDLY_MESSAGES[500]

        // Attach for page-level catch blocks to use
        error.displayMessage = displayMessage

        // ── Show toast automatically for most errors ──
        // Skip toasts for: 401 (handled above), cancelled requests, and network errors
        const skipToast = (
            status === 401 ||
            axios.isCancel(error) ||
            originalRequest?._silentError  // opt-in: api.get('/...', { _silentError: true })
        )

        if (!skipToast) {
            try {
                const toast = useToast()
                if (status === 429) {
                    toast.warning(displayMessage)
                } else if (status >= 500) {
                    toast.error(displayMessage)
                } else if (status === 403) {
                    toast.warning(displayMessage)
                } else {
                    toast.error(displayMessage)
                }
            } catch {
                // Toast composable may not be available outside Vue context
            }
        }

        return Promise.reject(error)
    }
)

export default api
