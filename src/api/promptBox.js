import api from './client'

// Ask AI, the prompt box of one project (autopilot_contract.md 4). The
// estimate has no side effects; a run sends exactly the `confirm` of the
// estimate the user read. Every call is silent: the card and its panel show
// each failure in their own words. The calls that start or change something
// never auto-retry a 429, so a retried request cannot ask twice or track twice.
const base = (wid) => `/prompt-box/websites/${wid}`

export default {
    // body: {text, samples, engines?}
    estimate: (wid, body) => api.post(`${base(wid)}/estimate/`, body, { _silentError: true }),
    // body: {text, samples, engines?, confirm: {answers, ai_usd_max}}; 201 Run.
    create: (wid, body) => api.post(`${base(wid)}/runs/`, body, { _silentError: true, _noRetry429: true }),
    // The project's 20 newest runs, as summaries (no answers).
    list: (wid) => api.get(`${base(wid)}/runs/`, { _silentError: true }),
    // A run with its answers; `full` adds each answer's text, citation URLs and searches.
    get: (wid, id, { full = false } = {}) =>
        api.get(`${base(wid)}/runs/${id}/`, full ? { params: { full: 1 }, _silentError: true } : { _silentError: true }),
    cancel: (wid, id) => api.post(`${base(wid)}/runs/${id}/cancel/`, {}, { _silentError: true, _noRetry429: true }),
    // Track this prompt: tracked without a scan (no second spend); Autopilot
    // asks it from its next run. 403 tracked_prompt_limit past the plan's cap.
    track: (wid, text) =>
        api.post(`/prompt-library/websites/${wid}/prompts/`, { text, scan: false }, { _silentError: true, _noRetry429: true }),
}
