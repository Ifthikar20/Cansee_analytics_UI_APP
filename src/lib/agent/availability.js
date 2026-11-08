// Why an agent cannot run, and what is set up for it, from GET agent/status/.
//
// Every answer is built from what the server reports; nothing is assumed.
// A missing status (not loaded yet, or its request failed) blocks nothing:
// the chat then reports any failure itself.
//
// A block is {code, scope, title, action, setting}:
//   - title: the reason, in words a customer can act on ("The research
//     agents are turned off on this workspace.");
//   - action: what to do ("Ask your workspace admin to turn them on.");
//   - setting: the setting to change, only for viewers who may see setting
//     names (staff, a DEBUG server, a local dev build; lib/agent/setup.js),
//     '' for everyone else;
//   - scope: 'workspace' (every agent), 'research' (the research agents) or
//     'agent' (one writing agent).
// The server's own setup issue (status.setup.issues, same code) wins over
// the words here, which match apps/agent/services/setup_status.py.
import { agentFix, settingsVisible } from './setup'
import { writerUnavailable } from './agentsMeta'

// apps/agent/tools/schemas.py MAX_SWARM_PROMPTS: the prompts one research takes.
export const MAX_RESEARCH_PROMPTS = 5

const GOOGLE_SETTINGS = 'SERPAPI_KEY or SCRAPERAPI_KEY'

// The setting behind each code, for viewers who may see setting names when
// the server did not name one (a local dev build against a non-DEBUG server).
const KNOWN_SETTINGS = Object.freeze({
    agent_disabled: 'AGENT_ENABLED',
    agent_not_configured: 'ANTHROPIC_API_KEY',
    research_disabled: 'AGENT_SWARM_ENABLED',
})

function text(code, { free = false } = {}) {
    switch (code) {
        case 'agent_disabled':
            return { title: 'The AI agent is turned off on this workspace.', action: 'Ask your workspace admin to turn it on.' }
        case 'agent_not_configured':
            return {
                title: "The AI agent isn't set up on this workspace.",
                action: 'Ask your workspace admin to add the Anthropic API key.',
            }
        case 'agent_unavailable':
            return {
                title: "The AI agent isn't running right now.",
                action: 'Try again in a minute. If it stays down, contact support.',
            }
        case 'allowance_exceeded':
            return {
                title: free ? "This month's free AI allowance is used up." : "This month's AI allowance is used up.",
                action: 'It renews at the start of your next billing month.',
            }
        case 'research_disabled':
            return {
                title: 'The research agents are turned off on this workspace.',
                action: 'Ask your workspace admin to turn them on.',
            }
        case 'nothing_to_measure':
            return {
                title: 'Neither Google results nor any AI engine is set up on this workspace.',
                action: 'Ask your workspace admin to set up Google results or an AI engine.',
            }
        default:
            return { title: '', action: '' }
    }
}

function issuesOf(status) {
    const list = status?.setup?.issues
    return Array.isArray(list) ? list.filter((i) => i && typeof i === 'object') : []
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Whether the account counts free prompt runs and must never see dollars. */
export function hidesDollars(status) {
    if (!isObject(status)) return false
    if (status.allowance && status.allowance.show_usd === false) return true
    return isObject(status.prompt_runs) && status.prompt_runs.unlimited === false
}

// The settings an engine or Google needs, for viewers who may see them.
function nothingSettings(status, opts) {
    if (!settingsVisible(status, opts)) return ''
    const engines = Array.isArray(status?.engines) ? status.engines : []
    const names = engines.map((e) => (e && typeof e.key_setting === 'string' ? e.key_setting : '')).filter(Boolean)
    const google = Array.isArray(status?.google?.key_settings) && status.google.key_settings.length
        ? status.google.key_settings.join(' or ')
        : GOOGLE_SETTINGS
    return [google, ...names].join(', ')
}

function settingOf(code, status, issue, opts) {
    if (issue && typeof issue.setting === 'string' && issue.setting) return issue.setting
    if (code === 'nothing_to_measure') return nothingSettings(status, opts)
    if (!settingsVisible(status, opts)) return ''
    return KNOWN_SETTINGS[code] || ''
}

function block(code, scope, status, opts, { title = '', action = '' } = {}) {
    const issue = issuesOf(status).find((i) => i.code === code) || null
    const words = text(code, { free: hidesDollars(status) })
    const out = {
        code,
        scope,
        title: (typeof issue?.title === 'string' && issue.title) || title || words.title,
        action: (typeof issue?.action === 'string' && issue.action) || action || words.action,
        setting: settingOf(code, status, issue, opts),
    }
    // The agent process being down has no setting, but staff get a pointer.
    if (code === 'agent_unavailable' && !out.setting) {
        const staff = agentFix(code, status, opts).staff
        if (staff) out.staffNote = staff
    }
    return out
}

/**
 * What stops every agent, or null: the agent switched off, its key missing,
 * the agent process down, or this month's AI allowance used up. Only an
 * explicit false (or true for `exceeded`) counts; a missing field is unknown.
 */
export function workspaceBlock(status, opts = {}) {
    if (!isObject(status)) return null
    if (status.enabled === false) return block('agent_disabled', 'workspace', status, opts)
    if (status.configured === false) return block('agent_not_configured', 'workspace', status, opts)
    if (status.live_available === false) return block('agent_unavailable', 'workspace', status, opts)
    if (status.allowance && status.allowance.exceeded === true) return block('allowance_exceeded', 'workspace', status, opts)
    return null
}

// Whether Google results are set up: the google block, else serp_configured.
function googleConfigured(status) {
    if (isObject(status?.google) && typeof status.google.configured === 'boolean') return status.google.configured
    if (typeof status?.serp_configured === 'boolean') return status.serp_configured
    return null
}

function engineRows(status) {
    return Array.isArray(status?.engines) ? status.engines.filter((e) => e && e.key) : []
}

/**
 * What stops the research agents, or null: a workspace block first (it
 * stops them too), then the server's research block ({available, reason,
 * message}) when it is sent; an older server is read from swarm.enabled
 * and what is set up.
 */
export function researchBlock(status, opts = {}) {
    if (!isObject(status)) return null
    const workspace = workspaceBlock(status, opts)
    if (workspace) return workspace
    const research = isObject(status.research) ? status.research : null
    if (research && research.available === false) {
        const code = typeof research.reason === 'string' && research.reason ? research.reason : 'research_unavailable'
        const message = typeof research.message === 'string' ? research.message : ''
        const scope = ['agent_disabled', 'agent_not_configured', 'agent_unavailable', 'allowance_exceeded'].includes(code)
            ? 'workspace'
            : 'research'
        const fallback = code === 'research_unavailable' ? { title: message || "The research agents can't run right now." } : { title: message }
        return block(code, scope, status, opts, fallback)
    }
    if (research && research.available === true) return null
    if (isObject(status.swarm) && status.swarm.enabled === false) return block('research_disabled', 'research', status, opts)
    const google = googleConfigured(status)
    const engines = engineRows(status)
    if (google === false && engines.length && !engines.some((e) => e.configured === true)) {
        return block('nothing_to_measure', 'research', status, opts)
    }
    return null
}

/**
 * Why `key` cannot run now, or null when it can (or status/ does not say).
 * `research_agents` reads researchBlock(); a writing agent also needs the
 * least its request costs (status.writers).
 */
export function agentBlock(key, status, opts = {}) {
    if (key === 'research_agents') return researchBlock(status, opts)
    const workspace = workspaceBlock(status, opts)
    if (workspace) return workspace
    const writer = writerUnavailable(key, status)
    if (!writer) return null
    return {
        code: 'writer_allowance',
        scope: 'agent',
        title: writer,
        action: 'The allowance renews at the start of your next billing month.',
        setting: '',
    }
}

/** "The reason. What to do." with "Setting: X." for viewers who may see it. */
export function blockHelp(b) {
    if (!b) return ''
    const parts = [b.action]
    if (b.setting) parts.push(`Setting: ${b.setting}.`)
    if (b.staffNote) parts.push(b.staffNote)
    return parts.filter(Boolean).join(' ')
}

function names(list) {
    if (list.length <= 1) return list.join('')
    return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

function count(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
    const n = Number(value)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null
}

function usd(value) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * The prompt runs left this month on an account that counts them
 * (prompt_runs.unlimited === false): `remaining`, else limit - used -
 * reserved; null for an unlimited account or when status/ does not say.
 */
export function promptRunsLeft(status) {
    const runs = isObject(status?.prompt_runs) ? status.prompt_runs : null
    if (!runs || runs.unlimited !== false) return null
    const left = count(runs.remaining)
    if (left !== null) return left
    const limit = count(runs.limit)
    if (limit === null) return null
    return Math.max(0, limit - (count(runs.used) ?? 0) - (count(runs.reserved) ?? 0))
}

/**
 * "13 free prompt runs left this month" for a free account, "$4.08 of AI
 * allowance left this month" for a paid one whose server says dollars may
 * show; '' when status/ does not say (a free account never gets dollars).
 */
export function allowanceLine(status) {
    if (!isObject(status)) return ''
    const runs = isObject(status.prompt_runs) ? status.prompt_runs : null
    if (runs && runs.unlimited === false) {
        const left = promptRunsLeft(status)
        if (left === null) return ''
        if (left === 0) return 'No free prompt runs left this month'
        return `${left} free prompt ${left === 1 ? 'run' : 'runs'} left this month`
    }
    if (hidesDollars(status)) return ''
    const allowance = isObject(status.allowance) ? status.allowance : null
    if (!allowance || allowance.show_usd !== true) return ''
    const cap = Number(allowance.cap_usd)
    const spent = Number(allowance.spent_usd)
    // Cap 0 is an unlimited allowance: there is no amount left to state.
    if (!(cap > 0) || !Number.isFinite(spent)) return ''
    return `${usd(Math.max(0, cap - spent))} of AI allowance left this month`
}

/**
 * What the research agents can use, for the Agents page:
 * {google: {configured, note, setting} | null, engines: {ready: [label],
 * missing: [{key, label, setting}]}, allowance: string}. `configured` is
 * null when status/ does not say.
 */
export function setupSummary(status, opts = {}) {
    if (!isObject(status)) return null
    const reveal = settingsVisible(status, opts)
    const google = googleConfigured(status)
    const googleSetting = () => {
        if (!reveal) return ''
        const listed = status.google?.key_settings
        return Array.isArray(listed) && listed.length ? listed.join(' or ') : GOOGLE_SETTINGS
    }
    const engines = engineRows(status)
    return {
        google:
            google === null
                ? null
                : {
                      configured: google,
                      note: google && status.google?.reliable_pages === 1 ? 'page one only' : '',
                      setting: google ? '' : googleSetting(),
                  },
        engines: {
            ready: engines.filter((e) => e.configured === true).map((e) => e.label || e.key),
            missing: engines
                .filter((e) => e.configured !== true)
                .map((e) => ({ key: e.key, label: e.label || e.key, setting: typeof e.key_setting === 'string' ? e.key_setting : '' })),
        },
        allowance: allowanceLine(status),
    }
}

/** "ChatGPT, Claude and Gemini" (labels in the order given). */
export function listNames(list) {
    return names(Array.isArray(list) ? list.filter(Boolean) : [])
}

/** The research agents' ceiling (status.swarm.max_agents), or null. */
export function researchCeiling(status) {
    const n = count(status?.swarm?.max_agents)
    return n && n > 0 ? n : null
}

/**
 * What one research can cover with what is set up here, or null when
 * status/ does not state a ceiling or nothing can be measured:
 * {prompts, engines, enginesKnown, perPrompt, runsLeft, limitedBy, short}.
 *
 * The plan is the server's default (apps/agent/runtime/swarm/plan.py
 * max_prompts_for): one Google page and `competitorPages` competitor pages
 * a prompt when Google is set up, every engine set up here asked, content
 * gaps and citations on. `prompts` fits the ceiling, at most
 * MAX_RESEARCH_PROMPTS and at least 1.
 *
 * On an account that counts prompt runs, each engine answer is one run
 * (tools/swarm.py _check_prompt_runs refuses a plan that needs more than
 * are left), so `prompts` is also at most floor(runsLeft / engines). When
 * not even one prompt fits, `prompts` is null and `short` says why:
 * 'no_runs' (none left) or 'few_runs' (fewer left than engines set up);
 * '' otherwise. `limitedBy` is 'runs' when the runs left allow fewer
 * prompts than the ceiling, else 'ceiling'. Unknown engines count as all
 * five.
 */
export function researchFit(status, { competitorPages = 1 } = {}) {
    const ceiling = researchCeiling(status)
    if (!ceiling) return null
    const rows = engineRows(status)
    const enginesKnown = rows.length > 0
    const engines = enginesKnown ? rows.filter((e) => e.configured === true).length : 5
    const google = googleConfigured(status) !== false
    // Nothing to measure: the research is refused.
    if (!google && engines === 0) return null
    const pages = Math.max(0, Math.floor(Number(competitorPages) || 0))
    const perPrompt = (google ? 1 + pages : 0) + engines + 2 + (engines > 0 ? 1 : 0)
    let prompts = Math.max(1, Math.min(MAX_RESEARCH_PROMPTS, Math.floor(ceiling / perPrompt)))
    const runsLeft = promptRunsLeft(status)
    let short = ''
    let limitedBy = 'ceiling'
    if (runsLeft !== null && engines > 0) {
        const affordable = Math.floor(runsLeft / engines)
        if (affordable < prompts) limitedBy = 'runs'
        if (affordable < 1) {
            prompts = null
            short = runsLeft === 0 ? 'no_runs' : 'few_runs'
        } else {
            prompts = Math.min(prompts, affordable)
        }
    }
    return { prompts, engines, enginesKnown, perPrompt, runsLeft, limitedBy, short }
}

function runsText(n) {
    return `${n} free prompt ${n === 1 ? 'run' : 'runs'}`
}

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`
}

/**
 * What the prompt runs left allow one research, for an account that counts
 * them, or '' when the ceiling is what limits it (or status/ does not say):
 *   - "With 13 free prompt runs left and 5 AI engines set up, one research
 *     covers up to 2 prompts."
 *   - "No free prompt runs are left this month, so a research cannot ask
 *     the AI engines until they renew."
 *   - "3 free prompt runs left: one prompt asks all 5 AI engines set up
 *     here, so ask for fewer engines."
 */
export function researchRunsLine(fit) {
    if (!fit || fit.runsLeft === null || fit.runsLeft === undefined) return ''
    const engines = plural(fit.engines, 'AI engine', 'AI engines')
    if (fit.short === 'no_runs') return 'No free prompt runs are left this month, so a research cannot ask the AI engines until they renew.'
    if (fit.short === 'few_runs') {
        return `${runsText(fit.runsLeft)} left: one prompt asks all ${engines} set up here, so ask for fewer engines.`
    }
    if (fit.limitedBy !== 'runs' || !fit.prompts) return ''
    return `With ${runsText(fit.runsLeft)} left and ${engines} set up, one research covers up to ${plural(fit.prompts, 'prompt', 'prompts')}.`
}

/**
 * The free prompt runs a research takes: "Up to 2 prompts × 5 AI engines =
 * 10 free prompt runs; 13 left this month." for `prompts` prompts, or ''
 * when the runs or the engines set up are not known, or no engine is set up
 * (Google results use no prompt runs).
 */
export function researchRunsCost(fit, prompts) {
    if (!fit || fit.runsLeft === null || fit.runsLeft === undefined || !fit.enginesKnown || !(fit.engines > 0)) return ''
    if (!(prompts > 0)) return ''
    const total = prompts * fit.engines
    return `Up to ${plural(prompts, 'prompt', 'prompts')} × ${plural(fit.engines, 'AI engine', 'AI engines')} = ${runsText(total)}; ${fit.runsLeft} left this month.`
}

/**
 * How many prompts one research covers (researchFit().prompts), or null
 * when status/ does not say or not even one prompt fits the prompt runs
 * left. `opts.competitorPages`: the competitor pages a prompt reads (1).
 */
export function researchPromptLimit(status, opts = {}) {
    return researchFit(status, opts)?.prompts ?? null
}
