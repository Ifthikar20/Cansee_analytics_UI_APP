import api from './client'

// Citations (backend apps.citations): one AI answer in the chat viewer,
// where that answer got its information (attribution_contract.md 1), and
// the reader view of a source page (attribution_contract.md 2). Every path
// is under /citations/websites/<wid>/; `resultId` is the response's
// public_id.
//
// Every call is silent: the chat viewer shows failures inline.
// startAttribution opts out of the 429 auto-retry: a re-sent POST would
// start the analysis twice.
const base = (wid) => `/citations/websites/${wid}`

export default {
    chat: (wid, resultId) => api.get(`${base(wid)}/chats/${resultId}/`, { _silentError: true }),
    // Stored attribution, or status "none"; never starts work.
    attribution: (wid, resultId) => api.get(`${base(wid)}/chats/${resultId}/attribution/`, { _silentError: true }),
    // body: {} to start, {refresh: true} to re-run. Same shape as attribution().
    startAttribution: (wid, resultId, body = {}) =>
        api.post(`${base(wid)}/chats/${resultId}/attribution/`, body, { _silentError: true, _noRetry429: true }),
    // `url` must be a source.url from one of this website's attributions.
    pageSnapshot: (wid, url) => api.get(`${base(wid)}/pages/snapshot/`, { params: { url }, _silentError: true }),
}
