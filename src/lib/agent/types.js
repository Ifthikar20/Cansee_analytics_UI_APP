// Shared vocabulary of the agent workspace. String values come from the
// backend contract (design/agent_contract.md) and must match it exactly.

/**
 * @typedef {Object} Part
 * @property {string} id
 * @property {string} type     one of PART_TYPES
 * @property {number} [request] API request index inside the run; turn.reset drops by it
 * @property {string} [status]
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} chat_id
 * @property {string|null} parent_id
 * @property {'user'|'assistant'} role
 * @property {string} status   one of MESSAGE_STATUS
 * @property {Part[]} parts
 * @property {number} parts_seq
 * @property {string[]} sibling_ids  oldest first, including the message itself
 * @property {{serp: Object<string, Object>, pages: Object<string, Object>}} research
 * @property {string|null} saved_report_id
 * @property {number|null} feedback
 */

/**
 * Store-side run record (stores/agent.js `runs[id]`).
 * @typedef {Object} RunState
 * @property {string} id
 * @property {string} chatId
 * @property {string} messageId
 * @property {string} phase  one of RUN_PHASE
 * @property {{state: string, mode: 'sse'|'poll', attempt: number}} transport
 * @property {number} lastSeq    highest event seq applied
 * @property {number|null} startedAt  epoch ms
 * @property {number|null} durationMs
 * @property {Object|null} usage   cumulative run.usage payload
 * @property {boolean} cancelRequested
 * @property {{code: string, message: string, retryable: boolean}|null} error
 */

/**
 * @typedef {Object} BrowserTabSpec
 * @property {string} id      "serp:<capture_id>" | "page:<capture_id>"
 * @property {'serp'|'page'} kind
 * @property {string} title
 * @property {'loading'|'ready'|'error'} status
 * @property {Object} data    SerpCapture | PageCapture
 */

/**
 * One research agent inside a `swarm` part (design/swarm_contract.md 5c).
 * task.* events shallow-merge a patch into it when their `rev` is newer.
 * @typedef {Object} SwarmTask
 * @property {string} id        `<category>.p<i>.<slot>`, stable across versions
 * @property {string} category  one of SWARM_CATEGORY_LIST
 * @property {string} subcategory  `p1`..`p5`
 * @property {string} worker
 * @property {string} label
 * @property {string} target
 * @property {string} status    one of TASK_STATUS
 * @property {string} step      live sub-step, '' when not running
 * @property {string} result    one line, '' until terminal
 * @property {'good'|'warn'|'bad'|'muted'|null} tone
 * @property {string[]} depends_on
 * @property {{code: string, message: string}|null} error
 * @property {{kind: 'serp'|'page', tab_id: string}|null} pane
 * @property {Object|null} detail  per worker
 * @property {number} rev
 */

/**
 * A project finding (swarm_contract.md 6d), as normalizeFinding returns it.
 * @typedef {Object} Finding
 * @property {string} id
 * @property {string} title
 * @property {string} detail
 * @property {string} category        one of FINDING_CATEGORY_LIST
 * @property {string} category_label
 * @property {string} severity        one of FINDING_SEVERITY_LIST
 * @property {string} status          one of FINDING_STATUS
 * @property {string} prompt_text
 * @property {Object[]} evidence      [{kind, label, tab_id, url}]
 * @property {Object|null} source     {swarm_id, swarm_title, version, sheet, row_key, task_ids, chat_id, message_id}
 */

export const EVENT = Object.freeze({
    RUN_STARTED: 'run.started',
    RUN_RETRYING: 'run.retrying',
    RUN_USAGE: 'run.usage',
    CHAT_UPDATED: 'chat.updated',
    TURN_RESET: 'turn.reset',
    RUN_COMPLETED: 'run.completed',
    RUN_FAILED: 'run.failed',
    RUN_CANCELLED: 'run.cancelled',
    RUN_INTERRUPTED: 'run.interrupted',
    RESYNC: 'resync',
    RECONNECT: 'reconnect',
    PART_ADDED: 'part.added',
    PART_DELTA: 'part.delta',
    PART_UPDATED: 'part.updated',
    ARTIFACT_STARTED: 'artifact.started',
    ARTIFACT_DELTA: 'artifact.delta',
    ARTIFACT_SNAPSHOT: 'artifact.snapshot',
    ARTIFACT_COMPLETED: 'artifact.completed',
    ARTIFACT_FAILED: 'artifact.failed',
    BROWSER_OPEN: 'browser.open',
    BROWSER_UPDATE: 'browser.update',
    // Research agents (swarm_contract.md 4a): task events patch one task of a
    // swarm part; research.recorded adds a capture to the message research.
    TASK_STARTED: 'task.started',
    TASK_PROGRESS: 'task.progress',
    TASK_FINISHED: 'task.finished',
    RESEARCH_RECORDED: 'research.recorded',
})

export const TERMINAL_EVENT_TYPES = new Set([
    EVENT.RUN_COMPLETED,
    EVENT.RUN_FAILED,
    EVENT.RUN_CANCELLED,
    EVENT.RUN_INTERRUPTED,
])

export const PART_TYPES = Object.freeze({
    THINKING: 'thinking',
    TEXT: 'text',
    TOOL: 'tool',
    WEB_SEARCH: 'web_search',
    WEB_FETCH: 'web_fetch',
    SERP: 'serp',
    PAGE_INSPECT: 'page_inspect',
    ENGINE_CHECK: 'engine_check',
    AGENT_CALL: 'agent_call',
    CHART: 'chart',
    BROWSER_OPEN: 'browser_open',
    NOTICE: 'notice',
    SWARM: 'swarm',
    SWARM_TABLE: 'swarm_table',
})

// Part statuses that mean "still working" while the message streams. Once
// the message leaves `streaming`, none of them should render as live.
export const ACTIVE_PART_STATUSES = new Set([
    'preparing',
    'queued',
    'running',
    'planning',
    'drafting',
    'validating',
    'loading',
])

export const MESSAGE_STATUS = Object.freeze({
    COMPLETE: 'complete',
    STREAMING: 'streaming',
    TRUNCATED: 'truncated',
    REFUSED: 'refused',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    INTERRUPTED: 'interrupted',
    // Client-only: an optimistic user message waiting for, or rejected by, the POST.
    SENDING: 'sending',
    SEND_FAILED: 'send_failed',
})

// Server run statuses (Run.status, ChatDetail.active_run.status).
export const RUN_STATUS = Object.freeze({
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    INTERRUPTED: 'interrupted',
})

// Client run phases: queued -> running -> done | cancelled | failed, plus cancelling.
export const RUN_PHASE = Object.freeze({
    QUEUED: 'queued',
    RUNNING: 'running',
    CANCELLING: 'cancelling',
    DONE: 'done',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
})

export const TERMINAL_PHASES = new Set([RUN_PHASE.DONE, RUN_PHASE.CANCELLED, RUN_PHASE.FAILED])

export function isTerminalPhase(phase) {
    return TERMINAL_PHASES.has(phase)
}

/** Map a server run status to the client phase. */
export function phaseFromRunStatus(status) {
    switch (status) {
        case RUN_STATUS.QUEUED:
            return RUN_PHASE.QUEUED
        case RUN_STATUS.RUNNING:
            return RUN_PHASE.RUNNING
        case RUN_STATUS.COMPLETED:
            return RUN_PHASE.DONE
        case RUN_STATUS.CANCELLED:
            return RUN_PHASE.CANCELLED
        case RUN_STATUS.FAILED:
        case RUN_STATUS.INTERRUPTED:
            return RUN_PHASE.FAILED
        default:
            return RUN_PHASE.QUEUED
    }
}

/** Map a finished message status to the client phase of its run. */
export function phaseFromMessageStatus(status) {
    switch (status) {
        case MESSAGE_STATUS.COMPLETE:
        case MESSAGE_STATUS.TRUNCATED:
        case MESSAGE_STATUS.REFUSED:
            return RUN_PHASE.DONE
        case MESSAGE_STATUS.CANCELLED:
            return RUN_PHASE.CANCELLED
        case MESSAGE_STATUS.FAILED:
        case MESSAGE_STATUS.INTERRUPTED:
            return RUN_PHASE.FAILED
        default:
            return null
    }
}

export const TRANSPORT_STATE = Object.freeze({
    IDLE: 'idle',
    CONNECTING: 'connecting',
    OPEN: 'open',
    RECONNECTING: 'reconnecting',
    OFFLINE: 'offline',
    // The site is down for maintenance; the transport waits for Retry-After.
    MAINTENANCE: 'maintenance',
    CLOSED: 'closed',
    ERROR: 'error',
})

/* ── Research agents (swarm_contract.md 1e, 1b, 2c) ── */

export const TASK_STATUS = Object.freeze({
    QUEUED: 'queued',
    RUNNING: 'running',
    DONE: 'done',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    STOPPED: 'stopped',
})

// A terminal task never changes again within its part.
export const TERMINAL_TASK_STATUSES = new Set(['done', 'failed', 'skipped', 'stopped'])

export const SWARM_STATUS = Object.freeze({
    PLANNING: 'planning',
    RUNNING: 'running',
    DONE: 'done',
    PARTIAL: 'partial',
    ERROR: 'error',
    CANCELLED: 'cancelled',
    INTERRUPTED: 'interrupted',
})

export const LIVE_SWARM_STATUSES = new Set(['planning', 'running'])

// Fixed order: the tree, the re-run menu and the findings filters follow it.
export const SWARM_CATEGORY_LIST = Object.freeze(['google', 'engines', 'competitors', 'site', 'sources'])

// `other` is for findings only (a manual finding outside the five categories).
export const SWARM_CATEGORY_LABELS = Object.freeze({
    google: 'Google (SEO)',
    engines: 'AI engines (GEO)',
    competitors: 'Competitor pages',
    site: 'Your site and content gaps',
    sources: 'Sources and citations',
    other: 'Other',
})

export const FINDING_STATUS = Object.freeze({ OPEN: 'open', DONE: 'done', DISMISSED: 'dismissed' })

export const FINDING_SEVERITY_LIST = Object.freeze(['high', 'medium', 'low'])

export const FINDING_CATEGORY_LIST = Object.freeze([...SWARM_CATEGORY_LIST, 'other'])

export const TAB_STATUSES = new Set(['loading', 'ready', 'error'])

export const ARTIFACT_KIND_LIST = Object.freeze(['page', 'document', 'sheet', 'report'])

export const AGENT_KEY_LIST = Object.freeze(['gap_analyst', 'landing_page', 'aeo_article', 'ad_campaign'])

// The chat key for a chat that does not exist on the server yet.
export const NEW_CHAT_KEY = 'new'

// Error codes from the contract that the UI handles specifically.
export const ERROR_CODE = Object.freeze({
    AGENT_DISABLED: 'agent_disabled',
    AGENT_UNAVAILABLE: 'agent_unavailable',
    AGENT_NOT_CONFIGURED: 'agent_not_configured',
    ALLOWANCE_EXCEEDED: 'allowance_exceeded',
    AGENT_BUSY: 'agent_busy',
    RUN_IN_PROGRESS: 'run_in_progress',
    REVISION_CONFLICT: 'revision_conflict',
    ALREADY_SAVED: 'already_saved',
    SERP_NOT_CONFIGURED: 'serp_not_configured',
    INVALID: 'invalid',
    NOT_FOUND: 'not_found',
    NETWORK: 'network',
    UNAUTHORIZED: 'unauthorized',
    INTERRUPTED: 'interrupted',
    // 503 from nginx's maintenance switch, with Retry-After.
    MAINTENANCE: 'maintenance',
    // Research agents and findings (swarm_contract.md 6f).
    SWARM_DISABLED: 'swarm_disabled',
    INSUFFICIENT_ALLOWANCE: 'insufficient_allowance',
    VERSION_LIMIT: 'version_limit',
    NO_FINDING: 'no_finding',
})
