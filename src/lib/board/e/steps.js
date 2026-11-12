// The Next steps block's model: what is not set up for this project and
// what to do next, as pure functions of payloads the app already has. The
// setup issues are the server's own words (GET agent/status/ setup.issues,
// read through lib/setup/status.js, the Setup panel's logic); prompts and
// Autopilot come from the ranking payload the board already loads. Nothing
// is guessed: a step shows only when a payload says so, and "All set" only
// when every payload was read and none asks for anything.
import { researchBlocker, setupIssues } from '@/lib/setup/status'

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const list = (v) => (Array.isArray(v) ? v.filter(isObject) : [])
const str = (v) => (typeof v === 'string' ? v.trim() : '')
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export const RESEARCH_DOWN = "The research agents can't run right now."

export const COPY = Object.freeze({
    prompts: {
        title: 'Track your first prompts',
        body: 'Add the questions your buyers ask. Each AI engine is asked them, and the answers fill this board.',
        link: 'Add prompts',
    },
    autopilot: {
        title: 'Turn on Autopilot',
        body: 'Autopilot asks your tracked prompts every day, so you see when an answer changes.',
        link: 'Open Autopilot',
    },
})

function trackedCount(ranking) {
    const n = isObject(ranking?.tracked) ? Number(ranking.tracked.count) : NaN
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

function autopilotOn(ranking) {
    const enabled = isObject(ranking?.autopilot) ? ranking.autopilot.enabled : null
    return typeof enabled === 'boolean' ? enabled : null
}

/**
 * What is in place, for the "All set" state: [{key, label, value}]. Each
 * fact is read from a payload; one the payloads do not state is left out.
 */
export function setupFacts(status, ranking) {
    const facts = []
    const engines = list(status?.engines).filter((e) => str(e.key))
    if (engines.length) {
        const ready = engines.filter((e) => e.configured === true).length
        facts.push({ key: 'engines', label: 'AI engines', value: `${ready} of ${engines.length}` })
    }
    if (status?.google?.configured === true) facts.push({ key: 'google', label: 'Google results', value: 'On' })
    if (status?.research?.available === true) facts.push({ key: 'research', label: 'Research agents', value: 'Ready' })
    const tracked = trackedCount(ranking)
    if (tracked !== null) facts.push({ key: 'prompts', label: 'Prompts tracked', value: tracked.toLocaleString('en-US') })
    if (autopilotOn(ranking) === true) facts.push({ key: 'autopilot', label: 'Autopilot', value: 'On' })
    return facts
}

/**
 * {known, rows, issues, actions, unknown, allSet, summary, sentence}.
 *
 * rows: [{key, index ('01'), kind: 'issue' | 'action', severity, title,
 * body, setting, to | action, link}], what is not set up first (blocking
 * before limited), then what to do. An issue is the workspace's to fix, so
 * it has no link of its own (the block offers Check again); an action has
 * `to` (a route location) or `action` ('add-prompts').
 * known: the agent status was read. unknown: what could not be checked
 * ('prompts', 'autopilot') because the ranking payload is missing.
 * allSet: everything was read and nothing asks for anything.
 */
export function stepsModel({ status = null, ranking = null } = {}) {
    const known = isObject(status)
    const rows = []
    if (known) {
        const issues = setupIssues(status).filter((i) => i.severity !== 'info')
        for (const issue of issues) {
            rows.push({
                key: issue.key,
                kind: 'issue',
                severity: issue.severity,
                title: issue.title,
                body: issue.action,
                setting: issue.setting,
            })
        }
        // The research agents are down for a reason no issue above names.
        if (status.research?.available === false && !issues.some((i) => i.severity === 'blocking')) {
            const reason = researchBlocker(status, issues)
            rows.push({
                key: 'research',
                kind: 'issue',
                severity: 'limited',
                title: RESEARCH_DOWN,
                body: reason && reason !== RESEARCH_DOWN ? reason : '',
                setting: '',
            })
        }
    }
    const haveRanking = isObject(ranking)
    const tracked = haveRanking ? trackedCount(ranking) : null
    const autopilot = haveRanking ? autopilotOn(ranking) : null
    if (tracked === 0) {
        rows.push({ key: 'prompts', kind: 'action', severity: 'todo', ...COPY.prompts, setting: '', action: 'add-prompts' })
    }
    if (autopilot === false) {
        rows.push({ key: 'autopilot', kind: 'action', severity: 'todo', ...COPY.autopilot, setting: '', to: { name: 'settings-autopilot' } })
    }
    const unknown = []
    if (tracked === null) unknown.push('prompts')
    if (autopilot === null) unknown.push('autopilot')

    const numbered = rows.map((row, i) => ({ ...row, index: String(i + 1).padStart(2, '0') }))
    const issues = numbered.filter((r) => r.kind === 'issue').length
    const actions = numbered.length - issues
    const summary = [issues ? `${issues} not set up` : '', actions ? `${actions} to do` : ''].filter(Boolean).join(', ')
    const allSet = known && numbered.length === 0 && unknown.length === 0
    let sentence = ''
    if (numbered.length) {
        sentence = `${plural(numbered.length, 'step', 'steps')} for this project: ${numbered.map((r) => r.title.replace(/[.!?]+$/, '')).join('; ')}.`
    } else if (allSet) {
        sentence = 'Everything is set up for this project.'
    }
    return { known, rows: numbered, issues, actions, unknown, allSet, summary, sentence }
}

/** "We couldn't check your prompts and Autopilot." for what stepsModel left unknown, or ''. */
export function unknownText(unknown) {
    const names = { prompts: 'your prompts', autopilot: 'Autopilot' }
    const parts = (Array.isArray(unknown) ? unknown : []).map((key) => names[key]).filter(Boolean)
    if (!parts.length) return ''
    return `We couldn't check ${parts.join(' and ')}.`
}

/**
 * The rows a card of this size shows and how many it leaves for the
 * expanded view: {shown, more}. `limit` of 0 or less shows every row.
 */
export function visibleSteps(rows, limit = 0) {
    const all = Array.isArray(rows) ? rows : []
    if (!(limit > 0) || all.length <= limit) return { shown: all, more: 0 }
    return { shown: all.slice(0, limit), more: all.length - limit }
}
