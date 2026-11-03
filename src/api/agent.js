import api from './client'

// Agent workspace (backend apps.agent). Paths under /agent/ are served by
// gunicorn; /agent/live/ by the agent process (nginx routes it separately).
// The run event stream and long-poll are not here: they are read with fetch
// in lib/agent/streamClient.js and lib/agent/poller.js.
//
// Run-starting POSTs set _noRetry429 so the 429 retry never re-sends them.
// sendMessage is also _silentError: its failure shows on the message itself;
// so is rerunSwarm, whose caller shows the code-specific copy.

const site = (wid) => `/agent/websites/${encodeURIComponent(wid)}`
const live = (wid) => `/agent/live/websites/${encodeURIComponent(wid)}`
const enc = encodeURIComponent
const runStart = (config = {}) => ({ _noRetry429: true, ...config })
// Context, reviews, team and the usage dashboard show their failures where
// they happen (p2_frontend.md 10), so none of them toasts.
const quiet = (config = {}) => ({ _silentError: true, ...config })
const clean = (params) =>
    Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''))

export default {
    status: (config) => api.get('/agent/status/', config),
    agents: (config) => api.get('/agent/agents/', config),

    listChats: (wid, { q, cursor } = {}, config = {}) =>
        api.get(`${site(wid)}/chats/`, { ...config, params: clean({ q, cursor }) }),
    createChat: (wid, data = {}, config) => api.post(`${site(wid)}/chats/`, clean(data), runStart(config)),
    getChat: (wid, cid, config) => api.get(`${site(wid)}/chats/${encodeURIComponent(cid)}/`, config),
    // {title} or {current_leaf_id}
    updateChat: (wid, cid, data, config) => api.patch(`${site(wid)}/chats/${encodeURIComponent(cid)}/`, data, config),
    deleteChat: (wid, cid, config) => api.delete(`${site(wid)}/chats/${encodeURIComponent(cid)}/`, config),

    // {value: 1 | -1 | 0, reason?, comment?}
    feedback: (wid, mid, data, config) =>
        api.post(`${site(wid)}/messages/${encodeURIComponent(mid)}/feedback/`, data, config),

    listArtifacts: (wid, { kinds, q } = {}, config = {}) =>
        api.get(`${site(wid)}/artifacts/`, {
            ...config,
            params: clean({ kind: Array.isArray(kinds) ? kinds.join(',') : kinds, q }),
        }),
    getArtifact: (wid, aid, config) => api.get(`${site(wid)}/artifacts/${encodeURIComponent(aid)}/`, config),
    updateArtifact: (wid, aid, data, config) =>
        api.patch(`${site(wid)}/artifacts/${encodeURIComponent(aid)}/`, data, config),
    deleteArtifact: (wid, aid, config) => api.delete(`${site(wid)}/artifacts/${encodeURIComponent(aid)}/`, config),
    listVersions: (wid, aid, config) =>
        api.get(`${site(wid)}/artifacts/${encodeURIComponent(aid)}/versions/`, config),
    getVersion: (wid, aid, version, config) =>
        api.get(`${site(wid)}/artifacts/${encodeURIComponent(aid)}/versions/${encodeURIComponent(version)}/`, config),

    // {message_id, title?}; 409 already_saved carries details.artifact_id
    saveReport: (wid, data, config) => api.post(`${site(wid)}/reports/`, clean(data), config),

    /* ── context manager (p2_contract.md 11b): viewers read, members write ── */

    // ContextOverview: sections, entries, documents, facts, competitors, totals, build, can_edit
    getContext: (wid, config) => api.get(`${site(wid)}/context/`, config),
    // {section, title, body, references: [RefInput]}; 201 Entry (active, origin user)
    createContextEntry: (wid, data, config) => api.post(`${site(wid)}/context/entries/`, data, quiet(config)),
    // {revision, title?, body?, section?, position?}; 409 revision_conflict when stale
    updateContextEntry: (wid, id, data, config) =>
        api.patch(`${site(wid)}/context/entries/${enc(id)}/`, data, quiet(config)),
    deleteContextEntry: (wid, id, revision, config) =>
        api.delete(`${site(wid)}/context/entries/${enc(id)}/`, { ...quiet(config), params: { revision } }),
    // suggested entries only; {accepted, dismissed}
    reviewContextEntries: (wid, { accept = [], dismiss = [] } = {}, config) =>
        api.post(`${site(wid)}/context/entries/review/`, { accept, dismiss }, quiet(config)),
    // RefInput {kind, url?, fact_id?, document_id?, competitor_domain?, quote?}; 201 Reference
    addContextReference: (wid, entryId, data, config) =>
        api.post(`${site(wid)}/context/entries/${enc(entryId)}/references/`, data, quiet(config)),
    deleteContextReference: (wid, id, config) =>
        api.delete(`${site(wid)}/context/references/${enc(id)}/`, quiet(config)),
    listContextDocuments: (wid, config) => api.get(`${site(wid)}/context/documents/`, quiet(config)),
    // Document plus `text`
    getContextDocument: (wid, id, config) => api.get(`${site(wid)}/context/documents/${enc(id)}/`, quiet(config)),
    // {title, text}; 201 Document
    createContextDocument: (wid, data, config) => api.post(`${site(wid)}/context/documents/`, data, quiet(config)),
    // {title?, text?}
    updateContextDocument: (wid, id, data, config) =>
        api.patch(`${site(wid)}/context/documents/${enc(id)}/`, data, quiet(config)),
    deleteContextDocument: (wid, id, config) =>
        api.delete(`${site(wid)}/context/documents/${enc(id)}/`, quiet(config)),

    suggestions: (wid, config) => api.get(`${site(wid)}/suggestions/`, config),
    activity: (wid, config) => api.get(`${site(wid)}/activity/`, config),

    /* ── approvals (p2_contract.md 13c) ── */

    getReview: (wid, aid, config) => api.get(`${site(wid)}/artifacts/${enc(aid)}/review/`, quiet(config)),
    // {action, revision, reviewer_id?, note?}; 409 revision_conflict | review_state
    reviewAction: (wid, aid, data, config) =>
        api.post(`${site(wid)}/artifacts/${enc(aid)}/review/`, data, quiet(config)),
    // {body}; 201 ReviewEvent
    addReviewComment: (wid, aid, data, config) =>
        api.post(`${site(wid)}/artifacts/${enc(aid)}/review/comments/`, data, quiet(config)),
    // box: 'waiting' | 'mine' | 'approved'; [ArtifactSummary], newest first
    listReviews: (wid, box, config) => api.get(`${site(wid)}/reviews/`, { ...quiet(config), params: clean({ box }) }),
    // [{id, name, email, role, is_you}]; viewers get 403 permission_denied
    team: (wid, config) => api.get(`${site(wid)}/team/`, quiet(config)),

    /* ── usage dashboard (p2_contract.md 14b; signed in, not project-scoped) ── */

    // {scope, period, interval, website_id}
    commandCenter: (params = {}, config) =>
        api.get('/agent/command-center/', { ...quiet(config), params: clean(params) }),

    /* ── other apps' lists the agent task dialog and the context picker read ── */

    // GET search-gap overview; callers read prompts[] {prompt_id, text}
    trackedPrompts: (wid, config) => api.get(`/search-gap/websites/${enc(wid)}/overview/`, quiet(config)),
    // current brand facts; the envelope turns the paginated list into the data array
    brandFacts: (wid, { status, q } = {}, config) =>
        api.get(`/brand-vault/websites/${enc(wid)}/facts/`, {
            ...quiet(config),
            params: clean({ status, q, only_current: 'true' }),
        }),

    /* ── research agents (swarms): private to the chat's user ── */

    // SwarmDetail: plan, categories, tasks and versions (newest first)
    getSwarm: (wid, sid, config) => api.get(`${site(wid)}/swarms/${encodeURIComponent(sid)}/`, config),
    // SwarmVersion: counts, status and the table (null until it has one)
    getSwarmVersion: (wid, sid, number, config) =>
        api.get(`${site(wid)}/swarms/${encodeURIComponent(sid)}/versions/${encodeURIComponent(number)}/`, config),

    /* ── findings: shared with the project's members ── */

    // {status, category, severity, swarm_id, q, cursor} -> {results, next_cursor, counts, can_edit}
    listFindings: (wid, params = {}, config = {}) => api.get(`${site(wid)}/findings/`, { ...config, params: clean(params) }),
    // {from_swarm: {swarm_id, version, sheet, row_keys}} | {title, detail, category, severity, prompt_text};
    // 201 {created, duplicates}
    createFindings: (wid, data, config) => api.post(`${site(wid)}/findings/`, data, config),
    // any of {status, severity, title, detail}
    updateFinding: (wid, fid, data, config) =>
        api.patch(`${site(wid)}/findings/${encodeURIComponent(fid)}/`, data, config),
    deleteFinding: (wid, fid, config) => api.delete(`${site(wid)}/findings/${encodeURIComponent(fid)}/`, config),

    /* ── agent process ── */

    // {text, parent_id?, agent?}; 202 {user_message, assistant_message, run}
    sendMessage: (wid, cid, data, { idempotencyKey, ...config } = {}) =>
        api.post(
            `${live(wid)}/chats/${encodeURIComponent(cid)}/messages/`,
            clean(data),
            runStart({
                _silentError: true,
                ...config,
                headers: { ...(config.headers || {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
            })
        ),
    // 202 {assistant_message, run}
    regenerate: (wid, mid, config) =>
        api.post(`${live(wid)}/messages/${encodeURIComponent(mid)}/regenerate/`, {}, runStart(config)),
    // {text}; 202 {user_message, assistant_message, run}
    editMessage: (wid, mid, data, config) =>
        api.post(`${live(wid)}/messages/${encodeURIComponent(mid)}/edit/`, data, runStart(config)),
    // 202 {user_message, assistant_message, run}
    continueMessage: (wid, mid, config) =>
        api.post(`${live(wid)}/messages/${encodeURIComponent(mid)}/continue/`, {}, runStart(config)),
    // {scope: 'all'|'category'|'task', category?, task_id?};
    // 202 {user_message, assistant_message, run, swarm_version}
    rerunSwarm: (wid, sid, data, { idempotencyKey, ...config } = {}) =>
        api.post(
            `${live(wid)}/swarms/${encodeURIComponent(sid)}/rerun/`,
            clean(data),
            runStart({
                _silentError: true,
                ...config,
                headers: { ...(config.headers || {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
            })
        ),
    // idempotent; {status}
    cancelRun: (rid, config) =>
        api.post(`/agent/live/runs/${encodeURIComponent(rid)}/cancel/`, {}, { _noRetry429: true, _silentError: true, ...config }),
    // {url} -> BrowseResult (errors come back inside a 200)
    browse: (wid, url, config) => api.post(`${live(wid)}/browse/`, { url }, { _silentError: true, ...config }),
}
