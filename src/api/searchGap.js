import api from './client'

// Search vs AI gap (backend apps.search_gap): each tracked prompt's Google
// rank next to every AI engine's, with where-to-change advice. promptId is
// the library Prompt id, the same id the prompt-library endpoints use.
export default {
    // 202 when queued; 409 {error: 'serpapi_not_configured'} without a key.
    checkGoogle: (websiteId, promptId, { force = false } = {}) =>
        api.post(
            `/search-gap/websites/${websiteId}/prompts/${promptId}/check/`,
            { force },
            { _silentError: true },
        ),
}
