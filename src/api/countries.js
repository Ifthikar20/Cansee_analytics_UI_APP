import api from './client'

// Rankings by country (backend apps.search_gap): Google and the AI engines
// asked the tracked prompts as if from other countries, at a cost the user
// confirms first. Country codes are lowercase ISO-2 ('gb').
//
// Every call is silent: the Countries page and its run dialog show
// failures inline. startRun opts out of the 429 auto-retry, because a
// re-sent POST would start (and bill) a second check.
export default {
    options: (wid) => api.get(`/search-gap/websites/${wid}/countries/options/`, { _silentError: true }),
    // body: {countries, prompt_ids, engines?, include_google?, google_pages?}; no side effects.
    estimate: (wid, body) => api.post(`/search-gap/websites/${wid}/countries/estimate/`, body, { _silentError: true }),
    // body: the estimate body plus confirm (the estimate's own `confirm`); 202 with the run.
    startRun: (wid, body) =>
        api.post(`/search-gap/websites/${wid}/countries/runs/`, body, { _silentError: true, _noRetry429: true }),
    listRuns: (wid) => api.get(`/search-gap/websites/${wid}/countries/runs/`, { _silentError: true }),
    getRun: (wid, rid) => api.get(`/search-gap/websites/${wid}/countries/runs/${rid}/`, { _silentError: true }),
    cancelRun: (wid, rid) =>
        api.post(`/search-gap/websites/${wid}/countries/runs/${rid}/cancel/`, {}, { _silentError: true }),
    // params: {prompt_id?, engine?} ('google' or an engine key).
    matrix: (wid, params) => api.get(`/search-gap/websites/${wid}/countries/`, { params, _silentError: true }),
    result: (wid, id) => api.get(`/search-gap/websites/${wid}/countries/results/${id}/`, { _silentError: true }),
}
