// Pure event reducer for one run. It folds contract events (section 2)
// into a snapshot of the run's assistant message, the run's client state
// and the artifact drafts, and reports side effects for the store to apply
// (pane tabs, chat title, artifact refresh). Inputs are never mutated;
// unchanged objects keep their identity so renderers can skip them.
//
// snapshot = {
//   message: Message,                  the assistant message (parts, status, research)
//   run: {phase, lastSeq, startedAt, durationMs, usage, error, retrying, model, stopReason, outcome, queue},
//   drafts: {[artifactId]: Draft},
// }
// Draft = {artifactId, kind, title, agentKey, baseVersion, request, status: drafting|done|failed,
//          content, data, version, summary, warnings, error, startedAt, updatedAt, partial}
// `partial` marks a draft whose start this client never saw (it resumed
// after artifact.started, e.g. a reload mid-draft): `content` then holds
// only the text streamed since, not the document.
//
// Effects: {type:'pane.open', tab, activate, background?, order?} | {type:'pane.update', tabId, patch}
//          {type:'chat.updated', chatId, title} | {type:'artifact.started'|'artifact.completed'|
//          'artifact.failed'|'artifact.reset', artifactId, ...} | {type:'resync', reason}
//          {type:'terminal', phase, status}
//
// Research agents (design/swarm_contract.md 4c, pages_contract.md 7):
// task.* events patch one task of a `swarm` part, guarded by the task's
// `rev`, exactly as the backend's runtime/parts.py does. research.recorded
// adds a capture to the message research; a Google results page also opens
// as a background tab (`background: true`), placed by `order` (the swarm
// execution and the position of the task that took it, see swarmTabOrder)
// so a swarm's pages line up by prompt, then page. A page capture opens on
// click (its task row).
import { normalizeQueue, toEpochMs } from './normalize'
import { ACTIVE_PART_STATUSES, EVENT, MESSAGE_STATUS, PART_TYPES, RUN_PHASE, TAB_STATUSES, isTerminalPhase } from './types'

export function initialRunState(overrides = {}) {
    return {
        phase: RUN_PHASE.QUEUED,
        lastSeq: 0,
        startedAt: null,
        durationMs: null,
        usage: null,
        error: null,
        retrying: null,
        model: '',
        stopReason: '',
        outcome: '',
        queue: null,
        ...overrides,
    }
}

/** Fold a batch of events. Returns {message, run, drafts, effects}. */
export function reduceEvents(snapshot, events) {
    let state = {
        message: snapshot.message,
        run: snapshot.run || initialRunState(),
        drafts: snapshot.drafts || {},
    }
    const effects = []
    for (const event of events || []) {
        const out = reduceEvent(state, event)
        state = out.state
        for (const fx of out.effects) effects.push(fx)
    }
    return { ...state, effects }
}

/** Apply one event. Returns {state, effects}; duplicates (seq <= lastSeq) are no-ops. */
export function reduceEvent(state, event) {
    if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
        return { state, effects: [] }
    }
    const seq = Number(event.seq)
    const hasSeq = Number.isFinite(seq) && seq > 0
    if (hasSeq && seq <= (state.run.lastSeq || 0)) return { state, effects: [] }

    const handler = HANDLERS[event.type]
    let next = state
    let effects = []
    if (handler && state.message) {
        const out = handler(state, event)
        if (out) {
            next = out.state || state
            effects = out.effects || []
        }
    }
    if (hasSeq) next = { ...next, run: { ...next.run, lastSeq: seq } }
    return { state: next, effects }
}

/* ── helpers ── */

function withMessage(state, patch) {
    return { ...state, message: { ...state.message, ...patch } }
}

function withRun(state, patch) {
    return { ...state, run: { ...state.run, ...patch } }
}

function partsOf(state) {
    return Array.isArray(state.message.parts) ? state.message.parts : []
}

function sameRequest(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false
    return String(a) === String(b)
}

function replacePart(state, index, part) {
    const parts = partsOf(state).slice()
    parts[index] = part
    return withMessage(state, { parts })
}

function findPart(state, id) {
    if (id === null || id === undefined) return -1
    const key = String(id)
    return partsOf(state).findIndex((p) => p && String(p.id) === key)
}

function clearRetrying(state) {
    return state.run.retrying ? withRun(state, { retrying: null }) : state
}

function keepCancelling(phase, wanted) {
    if (isTerminalPhase(phase)) return phase
    if (phase === RUN_PHASE.CANCELLING) return phase
    return wanted
}

/** "serp:abc" -> {kind:'serp', captureId:'abc'}. */
export function parseTabId(tabId) {
    const raw = String(tabId || '')
    const colon = raw.indexOf(':')
    if (colon <= 0) return { kind: '', captureId: raw }
    return { kind: raw.slice(0, colon), captureId: raw.slice(colon + 1) }
}

const RESEARCH_BUCKET = { serp: 'serp', page: 'pages' }

function researchOf(state) {
    const r = state.message.research
    return r && typeof r === 'object' ? r : { serp: {}, pages: {} }
}

function mergeResearch(state, kind, captureId, patch) {
    const bucket = RESEARCH_BUCKET[kind]
    if (!bucket || !captureId) return { state, data: patch || null }
    const research = researchOf(state)
    const prevBucket = research[bucket] && typeof research[bucket] === 'object' ? research[bucket] : {}
    const prev = prevBucket[captureId]
    const data = { ...(prev || {}), ...(patch || {}) }
    if (!data.capture_id) data.capture_id = captureId
    const next = withMessage(state, {
        research: { ...research, [bucket]: { ...prevBucket, [captureId]: data } },
    })
    return { state: next, data }
}

// Status of a tab from its capture data, when the event does not say.
function inferTabStatus(kind, data) {
    if (!data) return 'loading'
    if (data.error) return 'error'
    if (kind === 'serp' && Array.isArray(data.results)) return 'ready'
    if (kind === 'page' && (data.seo || data.reader || data.final_url)) return 'ready'
    return 'loading'
}

// For browser.update: an explicit status wins; otherwise a patch that
// carries capture fields settles the tab. Undefined keeps the tab's status.
function updatedTabStatus(kind, patch, data) {
    if (TAB_STATUSES.has(patch.status)) return patch.status
    if (data && data.error) return 'error'
    const substantive = Object.keys(patch).some((k) => k !== 'status' && k !== 'title')
    if (!substantive) return undefined
    const inferred = inferTabStatus(kind, data)
    return inferred === 'loading' ? undefined : inferred
}

function agentCallFor(state, artifactId) {
    return partsOf(state).find((p) => p && p.type === 'agent_call' && String(p.artifact_id) === String(artifactId)) || null
}

function requestForArtifact(state, artifactId) {
    const call = agentCallFor(state, artifactId)
    if (call && call.request !== undefined) return call.request
    let max = null
    for (const p of partsOf(state)) {
        if (p && Number.isFinite(Number(p.request))) max = max === null ? Number(p.request) : Math.max(max, Number(p.request))
    }
    return max
}

function draftOf(state, artifactId) {
    return state.drafts[String(artifactId)] || null
}

function withDraft(state, artifactId, draft) {
    return { ...state, drafts: { ...state.drafts, [String(artifactId)]: draft } }
}

// Only artifact.started carries kind, title and agent. A draft first seen
// through a later event takes them from the agent_call part that names the
// artifact, so it still opens in the right viewer.
function blankDraft(state, artifactId, event) {
    const call = agentCallFor(state, artifactId)
    return {
        artifactId: String(artifactId),
        kind: event.kind || call?.kind || '',
        title: event.title || call?.title || '',
        agentKey: event.agent_key || call?.agent || '',
        baseVersion: event.base_version ?? null,
        request: requestForArtifact(state, artifactId),
        status: 'drafting',
        content: '',
        data: null,
        version: null,
        summary: '',
        warnings: [],
        error: null,
        startedAt: toEpochMs(event.ts),
        updatedAt: toEpochMs(event.ts),
        partial: false,
    }
}

function parseSnapshot(content) {
    if (typeof content !== 'string') return content ?? null
    try {
        return JSON.parse(content)
    } catch {
        return content
    }
}

/**
 * task.started / task.progress / task.finished: shallow-merge `patch` into
 * the task `task_id` of the swarm part `part_id` when `rev` is newer than the
 * task's. Unknown parts, non-swarm parts, unknown tasks and stale or
 * repeated revs change nothing. Only the touched part and task are new.
 */
function applyTaskPatch(state, e) {
    if (e.task_id === undefined || e.task_id === null) return { state }
    const index = findPart(state, e.part_id)
    if (index === -1) return { state }
    const part = partsOf(state)[index]
    if (!part || part.type !== PART_TYPES.SWARM || !Array.isArray(part.tasks)) return { state }
    const key = String(e.task_id)
    const ti = part.tasks.findIndex((t) => t && String(t.id) === key)
    const rev = Number(e.rev)
    if (ti === -1 || !Number.isFinite(rev) || rev <= Number(part.tasks[ti].rev || 0)) return { state }
    const patch = e.patch && typeof e.patch === 'object' ? e.patch : {}
    const tasks = part.tasks.slice()
    tasks[ti] = { ...tasks[ti], ...patch, id: tasks[ti].id, rev }
    return { state: clearRetrying(replacePart(state, index, { ...part, tasks })) }
}

/**
 * The place of the capture of task `index` of a swarm part among the pane's
 * tabs: {group, index}. A group is one execution of the swarm (its id and
 * version), so a re-run's pages line up after the earlier run's instead of
 * between them; `index` follows task order (prompt, then page).
 */
export function swarmTabOrder(part, index) {
    return { group: `${part.swarm_id ?? part.id}:${part.version ?? ''}`, index }
}

// The order of the capture task `taskId` took: the newest swarm part naming
// the task wins; null without a task id (an event recorded before task_id
// existed) or when no swarm part names it.
function taskOrder(state, taskId) {
    if (taskId === undefined || taskId === null || taskId === '') return null
    const key = String(taskId)
    const parts = partsOf(state)
    for (let i = parts.length - 1; i >= 0; i -= 1) {
        const part = parts[i]
        if (!part || part.type !== PART_TYPES.SWARM || !Array.isArray(part.tasks)) continue
        const index = part.tasks.findIndex((t) => t && String(t.id) === key)
        if (index !== -1) return swarmTabOrder(part, index)
    }
    return null
}

function terminal(state, event, phase, messagePatch, runPatch) {
    const finishedAt = event.ts || null
    let next = withMessage(state, {
        ...messagePatch,
        finished_at: state.message.finished_at || finishedAt,
    })
    next = withRun(next, { phase, retrying: null, queue: null, ...runPatch })
    return {
        state: next,
        effects: [{ type: 'terminal', phase, status: next.message.status }],
    }
}

/* ── handlers ── */

const HANDLERS = {
    // Still waiting for a free run slot; run.started follows once it has one.
    [EVENT.RUN_QUEUED](state, e) {
        if (state.run.phase !== RUN_PHASE.QUEUED) return null
        return { state: withRun(state, { queue: normalizeQueue(e) }) }
    },

    [EVENT.RUN_STARTED](state, e) {
        let next = withRun(state, {
            queue: null,
            phase: keepCancelling(state.run.phase, RUN_PHASE.RUNNING),
            startedAt: state.run.startedAt ?? toEpochMs(e.ts),
            model: e.model || state.run.model,
        })
        const status = state.message.status
        const live = status === MESSAGE_STATUS.STREAMING || !status || status === 'queued'
        next = withMessage(next, {
            status: live ? MESSAGE_STATUS.STREAMING : status,
            model: e.model || state.message.model || '',
            started_at: state.message.started_at || e.ts || null,
        })
        return { state: next }
    },

    [EVENT.RUN_RETRYING](state, e) {
        return {
            state: withRun(state, {
                retrying: {
                    attempt: Number(e.attempt) || 0,
                    reason: e.reason || '',
                    delayMs: Number(e.delay_ms) || 0,
                    at: toEpochMs(e.ts),
                },
            }),
        }
    },

    [EVENT.RUN_USAGE](state, e) {
        const usage = {
            requests: Number(e.requests) || 0,
            input_tokens: Number(e.input_tokens) || 0,
            output_tokens: Number(e.output_tokens) || 0,
            cache_read_tokens: Number(e.cache_read_tokens) || 0,
            cache_write_tokens: Number(e.cache_write_tokens) || 0,
            web_search_requests: Number(e.web_search_requests) || 0,
            cost_usd: Number(e.cost_usd) || 0,
        }
        return { state: withRun(state, { usage }) }
    },

    [EVENT.CHAT_UPDATED](state, e) {
        return {
            state,
            effects: [{ type: 'chat.updated', chatId: e.chat_id ? String(e.chat_id) : null, title: e.title || '' }],
        }
    },

    [EVENT.TURN_RESET](state, e) {
        if (e.request === null || e.request === undefined) return { state }
        const parts = partsOf(state)
        const kept = parts.filter((p) => !sameRequest(p && p.request, e.request))
        let next = kept.length === parts.length ? state : withMessage(state, { parts: kept })
        const effects = []
        const drafts = { ...next.drafts }
        let changed = false
        for (const [id, draft] of Object.entries(next.drafts)) {
            if (draft && sameRequest(draft.request, e.request)) {
                delete drafts[id]
                changed = true
                effects.push({ type: 'artifact.reset', artifactId: id })
            }
        }
        if (changed) next = { ...next, drafts }
        return { state: clearRetrying(next), effects }
    },

    [EVENT.RUN_COMPLETED](state, e) {
        const status = [MESSAGE_STATUS.COMPLETE, MESSAGE_STATUS.TRUNCATED, MESSAGE_STATUS.REFUSED].includes(e.status)
            ? e.status
            : MESSAGE_STATUS.COMPLETE
        const durationMs = Number.isFinite(Number(e.duration_ms)) ? Number(e.duration_ms) : state.run.durationMs
        const patch = { status, duration_ms: durationMs ?? state.message.duration_ms ?? null }
        if (Number.isFinite(Number(e.parts_seq))) patch.parts_seq = Number(e.parts_seq)
        return terminal(state, e, RUN_PHASE.DONE, patch, {
            durationMs,
            stopReason: e.stop_reason || '',
            outcome: status,
        })
    },

    [EVENT.RUN_FAILED](state, e) {
        const error = {
            code: e.error?.code || 'failed',
            message: e.error?.message || '',
            retryable: Boolean(e.error?.retryable),
        }
        return terminal(
            state,
            e,
            RUN_PHASE.FAILED,
            { status: MESSAGE_STATUS.FAILED, error_code: error.code, error_message: error.message },
            { error, outcome: MESSAGE_STATUS.FAILED }
        )
    },

    [EVENT.RUN_CANCELLED](state, e) {
        return terminal(state, e, RUN_PHASE.CANCELLED, { status: MESSAGE_STATUS.CANCELLED }, {
            outcome: MESSAGE_STATUS.CANCELLED,
        })
    },

    [EVENT.RUN_INTERRUPTED](state, e) {
        const error = { code: 'interrupted', message: e.reason || '', retryable: true }
        return terminal(
            state,
            e,
            RUN_PHASE.FAILED,
            { status: MESSAGE_STATUS.INTERRUPTED, error_code: 'interrupted', error_message: error.message },
            { error, outcome: MESSAGE_STATUS.INTERRUPTED }
        )
    },

    [EVENT.RESYNC](state, e) {
        return { state, effects: [{ type: 'resync', reason: e.reason || '' }] }
    },

    [EVENT.PART_ADDED](state, e) {
        const part = e.part
        if (!part || typeof part !== 'object' || part.id === undefined || part.id === null) return { state }
        const index = findPart(state, part.id)
        const next = index === -1 ? withMessage(state, { parts: [...partsOf(state), part] }) : replacePart(state, index, part)
        return { state: clearRetrying(next) }
    },

    [EVENT.PART_DELTA](state, e) {
        const index = findPart(state, e.part_id)
        if (index === -1 || typeof e.append !== 'string' || e.append === '') return { state }
        const field = typeof e.field === 'string' && e.field ? e.field : 'text'
        const part = partsOf(state)[index]
        const before = typeof part[field] === 'string' ? part[field] : ''
        return { state: clearRetrying(replacePart(state, index, { ...part, [field]: before + e.append })) }
    },

    [EVENT.PART_UPDATED](state, e) {
        const index = findPart(state, e.part_id)
        if (index === -1 || !e.patch || typeof e.patch !== 'object') return { state }
        const part = partsOf(state)[index]
        return { state: clearRetrying(replacePart(state, index, { ...part, ...e.patch, id: part.id })) }
    },

    [EVENT.ARTIFACT_STARTED](state, e) {
        if (!e.artifact_id) return { state }
        const draft = blankDraft(state, e.artifact_id, e)
        return {
            state: withDraft(state, e.artifact_id, draft),
            effects: [
                {
                    type: 'artifact.started',
                    artifactId: String(e.artifact_id),
                    kind: draft.kind,
                    title: draft.title,
                },
            ],
        }
    },

    [EVENT.ARTIFACT_DELTA](state, e) {
        if (!e.artifact_id || typeof e.append !== 'string') return { state }
        // A delta with no draft yet: the text before it was streamed before
        // this client's resume point (a snapshot, by contrast, is whole).
        const draft = draftOf(state, e.artifact_id) || { ...blankDraft(state, e.artifact_id, e), partial: true }
        return {
            state: withDraft(state, e.artifact_id, {
                ...draft,
                content: (draft.content || '') + e.append,
                updatedAt: toEpochMs(e.ts) ?? draft.updatedAt,
            }),
        }
    },

    [EVENT.ARTIFACT_SNAPSHOT](state, e) {
        if (!e.artifact_id) return { state }
        const draft = draftOf(state, e.artifact_id) || blankDraft(state, e.artifact_id, e)
        return {
            state: withDraft(state, e.artifact_id, {
                ...draft,
                data: parseSnapshot(e.content),
                updatedAt: toEpochMs(e.ts) ?? draft.updatedAt,
            }),
        }
    },

    [EVENT.ARTIFACT_COMPLETED](state, e) {
        if (!e.artifact_id) return { state }
        const draft = draftOf(state, e.artifact_id) || blankDraft(state, e.artifact_id, e)
        const version = e.version ?? draft.version
        return {
            state: withDraft(state, e.artifact_id, {
                ...draft,
                status: 'done',
                version,
                title: e.title || draft.title,
                summary: e.summary || '',
                warnings: Array.isArray(e.warnings) ? e.warnings : [],
                updatedAt: toEpochMs(e.ts) ?? draft.updatedAt,
            }),
            effects: [{ type: 'artifact.completed', artifactId: String(e.artifact_id), version }],
        }
    },

    [EVENT.ARTIFACT_FAILED](state, e) {
        if (!e.artifact_id) return { state }
        const draft = draftOf(state, e.artifact_id) || blankDraft(state, e.artifact_id, e)
        const error = { code: e.error?.code || 'failed', message: e.error?.message || '' }
        return {
            state: withDraft(state, e.artifact_id, { ...draft, status: 'failed', error }),
            effects: [{ type: 'artifact.failed', artifactId: String(e.artifact_id), error }],
        }
    },

    [EVENT.BROWSER_OPEN](state, e) {
        const spec = e.tab
        if (!spec || typeof spec !== 'object' || !spec.id) return { state }
        const parsed = parseTabId(spec.id)
        const kind = spec.kind || parsed.kind
        const { state: next, data } = mergeResearch(state, kind, parsed.captureId, spec.data)
        const tab = {
            id: String(spec.id),
            kind,
            title: spec.title || '',
            status: TAB_STATUSES.has(spec.status) ? spec.status : inferTabStatus(kind, data),
            data,
        }
        return { state: next, effects: [{ type: 'pane.open', tab, activate: Boolean(e.activate) }] }
    },

    [EVENT.BROWSER_UPDATE](state, e) {
        if (!e.tab_id) return { state }
        const parsed = parseTabId(e.tab_id)
        const patch = e.patch && typeof e.patch === 'object' ? e.patch : {}
        const { state: next, data } = mergeResearch(state, parsed.kind, parsed.captureId, patch)
        const tabPatch = { data }
        // The backend also sends the tab's status and title beside the data patch.
        const status = TAB_STATUSES.has(e.status) ? e.status : updatedTabStatus(parsed.kind, patch, data)
        if (status) tabPatch.status = status
        const title = typeof e.title === 'string' && e.title ? e.title : patch.title
        if (typeof title === 'string' && title) tabPatch.title = title
        return {
            state: next,
            effects: [{ type: 'pane.update', tabId: String(e.tab_id), kind: parsed.kind, patch: tabPatch }],
        }
    },

    [EVENT.TASK_STARTED]: applyTaskPatch,
    [EVENT.TASK_PROGRESS]: applyTaskPatch,
    [EVENT.TASK_FINISHED]: applyTaskPatch,

    [EVENT.RESEARCH_RECORDED](state, e) {
        if (e.capture_id === undefined || e.capture_id === null || e.capture_id === '') return { state }
        if (e.kind !== 'serp' && e.kind !== 'page') return { state }
        const capture = e.capture && typeof e.capture === 'object' ? e.capture : {}
        const captureId = String(e.capture_id)
        const { state: next, data } = mergeResearch(state, e.kind, captureId, capture)
        // A page capture has no pane effect: the task row that took it opens it on click.
        if (e.kind !== 'serp') return { state: next }
        const tab = { id: `serp:${captureId}`, kind: 'serp', title: '', status: inferTabStatus('serp', data), data }
        return {
            state: next,
            effects: [{ type: 'pane.open', tab, activate: false, background: true, order: taskOrder(next, e.task_id) }],
        }
    },
}

/**
 * True while a part should render as live: its status is in progress AND
 * the message is still streaming. A cancelled or failed run can leave
 * parts in a running status; they are not live anymore.
 */
export function isPartActive(part, message) {
    if (!part || !message) return false
    return message.status === MESSAGE_STATUS.STREAMING && ACTIVE_PART_STATUSES.has(part.status)
}
