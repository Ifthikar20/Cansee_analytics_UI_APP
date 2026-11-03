import api from './client'

// Insights (backend apps.insights, p2_contract.md sections 1e-9): runs of
// paid and free work (estimate first, then a confirmed start), and the
// read-only payloads of the analytics tabs built on them. Every path is
// under /insights/websites/<wid>/.
//
// Every call is silent: pages and run dialogs show failures inline.
// startRun and trackIdea opt out of the 429 auto-retry, because a re-sent
// POST would start (and bill) the work twice.
const base = (wid) => `/insights/websites/${wid}`

export default {
    // Runs: kind = answer_analysis | site_audit | prompt_research | fanout_google | shopping_check | context_build.
    runOptions: (wid, kind) => api.get(`${base(wid)}/runs/options/`, { params: { kind }, _silentError: true }),
    // body: {kind, params}; no side effects.
    estimate: (wid, body) => api.post(`${base(wid)}/runs/estimate/`, body, { _silentError: true }),
    listRuns: (wid, kind) => api.get(`${base(wid)}/runs/`, { params: { kind }, _silentError: true }),
    // body: {kind, params, confirm} with the estimate's own `confirm`; 202 with the run.
    startRun: (wid, body) => api.post(`${base(wid)}/runs/`, body, { _silentError: true, _noRetry429: true }),
    getRun: (wid, id) => api.get(`${base(wid)}/runs/${id}/`, { _silentError: true }),
    cancelRun: (wid, id) => api.post(`${base(wid)}/runs/${id}/cancel/`, {}, { _silentError: true }),

    // Tabs. params as each section of the contract lists them.
    sentiment: (wid, params) => api.get(`${base(wid)}/sentiment/`, { params, _silentError: true }),
    factCheck: (wid, params) => api.get(`${base(wid)}/fact-check/`, { params, _silentError: true }),
    competitors: (wid, params) => api.get(`${base(wid)}/competitors/`, { params, _silentError: true }),
    citations: (wid, params) => api.get(`${base(wid)}/citations/`, { params, _silentError: true }),
    crawlerAccess: (wid) => api.get(`${base(wid)}/crawler-access/`, { _silentError: true }),
    pages: (wid, params) => api.get(`${base(wid)}/pages/`, { params, _silentError: true }),
    promptIdeas: (wid, params) => api.get(`${base(wid)}/prompt-ideas/`, { params, _silentError: true }),
    // body: {status: 'dismissed' | 'new'}.
    updateIdea: (wid, id, body) => api.patch(`${base(wid)}/prompt-ideas/${id}/`, body, { _silentError: true }),
    fanOuts: (wid, params) => api.get(`${base(wid)}/fan-outs/`, { params, _silentError: true }),
    products: (wid) => api.get(`${base(wid)}/products/`, { _silentError: true }),
    createProduct: (wid, body) => api.post(`${base(wid)}/products/`, body, { _silentError: true }),
    product: (wid, id) => api.get(`${base(wid)}/products/${id}/`, { _silentError: true }),
    updateProduct: (wid, id, body) => api.patch(`${base(wid)}/products/${id}/`, body, { _silentError: true }),
    // Archives (204); the product's results stay.
    archiveProduct: (wid, id) => api.delete(`${base(wid)}/products/${id}/`, { _silentError: true }),
    // body: {confirm: {ai_usd_max}}; 201 {idea, prompt_id, scan_audit_id}.
    trackIdea: (wid, id, body) =>
        api.post(`${base(wid)}/prompt-ideas/${id}/track/`, body, { _silentError: true, _noRetry429: true }),
}
