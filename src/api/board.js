import api from './client'

// The Analytics board's layout (backend apps.boards, board_contract.md 6):
// one saved layout per user and project, {saved, version, updated_at,
// widgets: [{key, size}]}. A save sends the version it loaded; 409
// layout_conflict carries the stored layout in error.details.layout.
//
// Every call is silent: the board shows its own save state. A save opts
// out of the 429 auto-retry, because a re-sent PUT would carry a version
// the first one already bumped.
const path = (wid) => `/boards/websites/${wid}/layout/`

export default {
    get: (wid) => api.get(path(wid), { _silentError: true }),
    // body: {version, widgets: [{key, size}]}.
    save: (wid, body) => api.put(path(wid), body, { _silentError: true, _noRetry429: true }),
    // Reset board: the default layout, with the version bumped.
    reset: (wid) => api.delete(path(wid), { _silentError: true }),
}
