// The analytics setup panel's model, as pure functions of what the stores
// already hold: GET agent/status/ (agent store `status`), the first
// research chat's run and reply (agent store `runs` and `messages`) and the
// panel's own record (lib/setup/storage.js). Nothing here fetches, and
// nothing invents a value: a count, an engine or a reason shows only when
// the server sent it.
//
// Copy rules (owner decisions): customers read plain words ("ChatGPT isn't
// set up on this workspace."), which the server writes in setup.issues[];
// a setting name such as OPENAI_API_KEY shows only when the server sent it,
// which it does for staff and on DEBUG servers. Free plans read "N free
// prompt runs left", never dollars.
import { swarmCounts } from '@/components/agent/swarm/swarmView'
import { settingFor } from '@/lib/agent/setup'
import {
    LIVE_SWARM_STATUSES,
    MESSAGE_STATUS,
    PART_TYPES,
    RUN_PHASE,
    isTerminalPhase,
    phaseFromMessageStatus,
} from '@/lib/agent/types'
import { isFirstLanding } from './storage'

// The research steps the panel draws as dots, in order.
export const STAGES = Object.freeze([
    { key: 'start', label: 'Start' },
    { key: 'plan', label: 'Plan' },
    { key: 'research', label: 'Ask Google and the AI engines' },
    { key: 'write', label: 'Write up' },
])

// The asks shown while the research agents work.
export const MAX_ASKING = 3

const SEVERITY_ORDER = { blocking: 0, limited: 1, info: 2 }
// Issues about what is configured; prompt runs and the allowance are limits
// of the plan, shown on their own line.
const CONFIG_SUBJECTS = new Set(['agent', 'engine', 'google'])
const ASK_CATEGORIES = new Set(['engines', 'google'])

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const str = (v) => (typeof v === 'string' ? v.trim() : '')
const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

/* ── What is not set up ── */

function settingOf(issue, status) {
    const own = str(issue.setting)
    if (own) return own
    if (issue.subject === 'engine' && issue.engine) {
        const engine = list(status?.engines).find((e) => e.key === issue.engine)
        const key = str(engine?.key_setting)
        if (key) return key
    }
    if (issue.code === 'google_not_configured') {
        const keys = Array.isArray(status?.google?.key_settings) ? status.google.key_settings.filter((k) => str(k)) : []
        if (keys.length) return keys.join(' or ')
    }
    return settingFor(issue.code, status)
}

/**
 * The server's setup issues about configuration (agent, engines, Google),
 * blocking first: [{key, code, severity, subject, engine, title, action,
 * setting}]. `setting` is '' unless the viewer may see setting names. A
 * server without a setup block gives [].
 */
export function setupIssues(status) {
    const issues = list(status?.setup?.issues)
        .filter((i) => CONFIG_SUBJECTS.has(i.subject) && str(i.title))
        .map((i, index) => ({
            key: `${i.code || 'issue'}:${i.engine || ''}:${index}`,
            code: str(i.code),
            severity: SEVERITY_ORDER[i.severity] === undefined ? 'info' : i.severity,
            subject: i.subject,
            engine: i.engine || null,
            title: str(i.title),
            action: str(i.action),
            setting: settingOf(i, status),
        }))
    return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

/** Some configuration is missing: a blocking or limited issue about the agent, an engine or Google. */
export function configIncomplete(issues) {
    return list(issues).some((i) => i.severity === 'blocking' || i.severity === 'limited')
}

/** Why the research agents cannot run now ('' when they can, or nobody said). */
export function researchBlocker(status, issues) {
    const blocking = list(issues).find((i) => i.severity === 'blocking')
    if (blocking) return blocking.title
    const research = status?.research
    if (research && research.available === false) return str(research.message)
    return ''
}

/* ── Prompt runs ── */

function monthDay(iso) {
    const t = Date.parse(iso)
    if (!Number.isFinite(t)) return ''
    try {
        return new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    } catch {
        return ''
    }
}

/**
 * The free plan's prompt runs as {text, renews, exhausted}, or null for a
 * paid plan, an unknown plan or a server without the runs block.
 */
export function promptRunsLine(status) {
    const runs = status?.prompt_runs
    if (!runs || typeof runs !== 'object' || runs.unlimited !== false) return null
    const remaining = typeof runs.remaining === 'number' ? runs.remaining : NaN
    if (!Number.isFinite(remaining)) return null
    const left = Math.max(0, Math.floor(remaining))
    const date = monthDay(runs.resets_at)
    const renews = date ? `They renew on ${date}.` : ''
    if (left === 0) return { text: 'No free prompt runs left this month.', renews, exhausted: true }
    return { text: `${plural(left, 'free prompt run', 'free prompt runs')} left`, renews, exhausted: false }
}

/* ── The first research ── */

/** The swarm part of a message, or null. */
export function swarmPartOf(message) {
    return list(message?.parts).find((p) => p.type === PART_TYPES.SWARM) || null
}

/**
 * The message that holds the first research: the active run's reply, else
 * the newest reply on the chat's path with a research agents block, else
 * the newest reply on it.
 */
export function researchMessage({ run = null, messages = {}, path = [] } = {}) {
    if (run && run.messageId && messages[run.messageId]) return messages[run.messageId]
    const replies = list(path).filter((m) => m.role === 'assistant')
    for (let i = replies.length - 1; i >= 0; i -= 1) if (swarmPartOf(replies[i])) return replies[i]
    return replies.length ? replies[replies.length - 1] : null
}

function asking(part) {
    const out = []
    for (const task of list(part?.tasks)) {
        if (task.status !== 'running' || !ASK_CATEGORIES.has(task.category)) continue
        const who = str(task.label)
        const prompt = str(task.target)
        if (!who) continue
        out.push({ id: String(task.id || `${who}:${prompt}`), who, prompt })
        if (out.length >= MAX_ASKING) break
    }
    return out
}

function queueTitle(queue) {
    if (queue && queue.ahead > 0) return `Waiting for a free slot (${queue.ahead} ahead)`
    return 'Waiting for a free slot'
}

function queueLine(queue) {
    if (queue && queue.ahead === 0) return 'Your research is next.'
    return 'Your research starts as soon as one is free.'
}

function base(state, extra = {}) {
    return {
        state,
        stage: null,
        title: '',
        line: '',
        counts: null,
        progress: null,
        asking: [],
        queue: null,
        live: false,
        error: '',
        ...extra,
    }
}

function countsOf(part) {
    if (!part) return null
    const counts = swarmCounts(part.tasks)
    return counts.total > 0 ? counts : null
}

function agentsLine(counts) {
    if (!counts) return ''
    return `${counts.settled} of ${plural(counts.total, 'agent', 'agents')} finished`
}

/**
 * Where the first research is: {state, stage, title, line, counts,
 * progress (0..1 or null for indeterminate), asking, queue, live, error}.
 *
 * state: 'none' (no first research known), 'loading', 'missing' (the chat
 * was deleted), 'unknown' (it could not be loaded), 'queued', 'running',
 * 'done', 'failed' or 'stopped'.
 */
export function researchProgress({ chatId = null, chat = null, run = null, message = null } = {}) {
    if (!chatId) return base('none')
    if (chat?.error && !chat.loaded) {
        if (chat.error.status === 404) {
            return base('missing', { title: 'The first research chat was deleted.' })
        }
        return base('unknown', { title: "We couldn't load your first research.", line: 'Open it in the Agent to see where it is.' })
    }

    const part = swarmPartOf(message)
    const counts = countsOf(part)

    if (run && !isTerminalPhase(run.phase)) {
        if (run.phase === RUN_PHASE.QUEUED) {
            return base('queued', {
                stage: 'start',
                title: queueTitle(run.queue),
                line: queueLine(run.queue),
                queue: run.queue || null,
                live: true,
            })
        }
        if (run.phase === RUN_PHASE.CANCELLING) {
            return base('running', { stage: null, title: 'Stopping the research', counts, live: true })
        }
        if (!part || part.status === 'planning') {
            return base('running', { stage: 'plan', title: 'Planning the research', line: 'Choosing what to ask Google and each AI engine.', live: true })
        }
        if (LIVE_SWARM_STATUSES.has(part.status)) {
            return base('running', {
                stage: 'research',
                title: 'Asking Google and the AI engines',
                line: agentsLine(counts),
                counts,
                progress: counts ? counts.settled / counts.total : null,
                asking: asking(part),
                live: true,
            })
        }
        return base('running', {
            stage: 'write',
            title: 'Writing up the findings',
            line: agentsLine(counts),
            counts,
            progress: counts ? 1 : null,
            live: true,
        })
    }

    // Over, or never seen running by this tab: the run's end, else the reply's status.
    let phase = run && isTerminalPhase(run.phase) ? run.phase : null
    if (!phase && message) {
        if (message.status === MESSAGE_STATUS.STREAMING) {
            // A reply still streaming with no active run to follow: the store settles it.
            return base('loading', { title: 'Checking your first research' })
        }
        phase = phaseFromMessageStatus(message.status)
    }
    if (!phase) {
        if (!chat || !chat.loaded) return base('loading', { title: 'Checking your first research' })
        return base('failed', { title: "The research didn't start.", line: 'Open the Agent to start it again.' })
    }
    const error = str(run?.error?.message) || str(message?.error_message)
    if (phase === RUN_PHASE.DONE) {
        return base('done', { stage: 'write', title: 'Your first research is ready.', line: agentsLine(counts), counts, progress: counts ? 1 : null })
    }
    if (phase === RUN_PHASE.CANCELLED) {
        return base('stopped', { title: 'The research was stopped.', line: 'Open it in the Agent to run it again.', counts })
    }
    return base('failed', {
        title: "The research didn't finish.",
        line: error || 'Open it in the Agent to try again.',
        counts,
        error,
    })
}

export const IN_FLIGHT = new Set(['loading', 'queued', 'running'])

/* ── The panel as a whole ── */

/**
 * {visible, dismissible, complete, pointer}. The panel shows on a first
 * landing after onboarding (until dismissed) and whenever configuration is
 * missing. It can be dismissed once everything is set up and the first
 * research is no longer in flight. `pointer` is the line an empty board
 * widget shows to send the user to the panel ('' when hidden).
 */
export function panelState({ record = null, statusKnown = false, issues = [], research = base('none'), now = Date.now() } = {}) {
    const first = isFirstLanding(record, now)
    const incomplete = configIncomplete(issues)
    const inFlight = IN_FLIGHT.has(research.state)
    const visible = first || incomplete
    const complete = statusKnown && !incomplete
    const dismissible = visible && complete && !inFlight
    let pointer = ''
    if (visible) {
        if (inFlight && research.state !== 'loading') pointer = 'Your first research is still running. Its progress is in Setup at the top of this page.'
        else if (incomplete) pointer = 'Some of your setup is missing, so this may stay empty. See Setup at the top of this page.'
        else pointer = 'See Setup at the top of this page for what to do next.'
    }
    return { visible, dismissible, complete, incomplete, first, pointer }
}

/**
 * What to do next once the first research is no longer in flight:
 * [{key, label, body, to | action, disabled, reason}]. `to` is a route
 * location; an `action` is run by the panel ('add-prompts').
 */
export function nextSteps({ websiteId, chatId = null, research, autopilotOn = null, blocker = '' } = {}) {
    const wid = String(websiteId || '')
    if (!wid || !research || IN_FLIGHT.has(research.state)) return []
    const steps = []
    if (chatId && research.state !== 'missing') {
        steps.push({
            key: 'results',
            label: research.state === 'done' ? 'View the research' : 'Open the research',
            body: research.state === 'done' ? 'What Google and the AI engines say about you, with the gaps to close.' : 'See what happened and run it again from the Agent.',
            to: { name: 'agent-chat', params: { websiteId: wid, chatId: String(chatId) } },
        })
    } else {
        steps.push({
            key: 'research',
            label: 'Run a research',
            body: 'The research agents ask Google and the AI engines your prompts and report the gaps.',
            to: { name: 'agent-home', params: { websiteId: wid }, query: { agent: 'gap_analyst' } },
            disabled: Boolean(blocker),
            reason: blocker,
        })
    }
    if (autopilotOn !== true) {
        steps.push({
            key: 'autopilot',
            label: 'Turn on Autopilot',
            body: 'Autopilot asks your tracked prompts every day, so you see when an answer changes.',
            to: { name: 'settings-autopilot' },
        })
    }
    steps.push({
        key: 'prompts',
        label: 'Add prompts',
        body: 'Track more of the questions your buyers ask.',
        action: 'add-prompts',
    })
    return steps
}
