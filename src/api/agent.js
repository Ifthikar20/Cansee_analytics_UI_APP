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
const runStart = (config = {}) => ({ _noRetry429: true, ...config })
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

    getContext: (wid, config) => api.get(`${site(wid)}/context/`, config),
    // {audience, voice, offerings, rules, revision}; 409 revision_conflict when stale
    putContext: (wid, data, config) => api.put(`${site(wid)}/context/`, data, config),

    suggestions: (wid, config) => api.get(`${site(wid)}/suggestions/`, config),
    activity: (wid, config) => api.get(`${site(wid)}/activity/`, config),

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
