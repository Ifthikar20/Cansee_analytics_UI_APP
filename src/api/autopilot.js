import api from './client'

// Autopilot of one project (autopilot_contract.md 3). Every call is silent:
// the settings page shows each failure inline, in its own words. The calls
// that start or change something never auto-retry a 429, so a retried
// request cannot save twice, start a second run or send a second test text.
const base = (wid) => `/autopilot/websites/${wid}`

export default {
    get: (wid) => api.get(`${base(wid)}/`, { _silentError: true }),
    save: (wid, body) => api.put(`${base(wid)}/`, body, { _silentError: true, _noRetry429: true }),
    // Run now: the estimate has no side effects; the run sends its `confirm`.
    estimate: (wid) => api.post(`${base(wid)}/run/estimate/`, {}, { _silentError: true }),
    runNow: (wid, confirm) => api.post(`${base(wid)}/run/`, { confirm }, { _silentError: true, _noRetry429: true }),
    runs: (wid) => api.get(`${base(wid)}/runs/`, { _silentError: true }),
    // A run with its prompt rows and the text it sent (`text_body`).
    run: (wid, id) => api.get(`${base(wid)}/runs/${id}/`, { _silentError: true }),
    cancel: (wid, id) => api.post(`${base(wid)}/runs/${id}/cancel/`, {}, { _silentError: true }),
    // At most one every 10 minutes per project (429 too_many_tests).
    testText: (wid) => api.post(`${base(wid)}/text/test/`, {}, { _silentError: true, _noRetry429: true }),
}
