// What whoever can fix the agent needs to know when it cannot answer.
//
// Customers see plain words ("Ask your workspace admin to add the Anthropic
// API key"). Staff, and everyone on a DEBUG server or a local dev build, also
// see the exact setting (ANTHROPIC_API_KEY). The server decides who may see
// setting names: GET agent/status/ fills `setup.issues[].setting`,
// `engines[].key_setting` and `google.key_settings` only for them, so any of
// those being present means the viewer may. A server without those fields
// reveals nothing; a local dev build (import.meta.env.DEV) always does.

const AGENT_KEY_SETTING = 'ANTHROPIC_API_KEY'

function issuesOf(status) {
    const list = status?.setup?.issues
    return Array.isArray(list) ? list.filter((i) => i && typeof i === 'object') : []
}

/** Whether this viewer may see setting names. */
export function settingsVisible(status, { dev = Boolean(import.meta.env?.DEV) } = {}) {
    if (dev) return true
    if (!status || typeof status !== 'object') return false
    if (issuesOf(status).some((i) => typeof i.setting === 'string' && i.setting)) return true
    if (Array.isArray(status.engines) && status.engines.some((e) => e && typeof e.key_setting === 'string' && e.key_setting)) {
        return true
    }
    return Array.isArray(status.google?.key_settings) && status.google.key_settings.length > 0
}

/** The setting behind `code`, for viewers who may see it; '' otherwise. */
export function settingFor(code, status, opts = {}) {
    const issue = issuesOf(status).find((i) => i.code === code && typeof i.setting === 'string' && i.setting)
    if (issue) return issue.setting
    if (code === 'agent_not_configured' && settingsVisible(status, opts)) return AGENT_KEY_SETTING
    return ''
}

/**
 * What to do when the agent cannot answer, as {customer, staff}: `customer`
 * is for everyone; `staff` is the extra line with setting names, '' when the
 * viewer may not see them or there is nothing more to say.
 */
export function agentFix(code, status, opts = {}) {
    const visible = settingsVisible(status, opts)
    switch (code) {
        case 'agent_not_configured': {
            const setting = settingFor(code, status, opts)
            return {
                customer: 'Ask your workspace admin to add the Anthropic API key.',
                staff: setting ? `Set ${setting} on the server, then restart the backend and the agent process.` : '',
            }
        }
        case 'agent_unavailable':
            return {
                customer: 'Try again in a minute. If it stays down, contact support.',
                staff: visible ? `Check that the agent process is running. It also needs ${AGENT_KEY_SETTING} to answer.` : '',
            }
        default:
            return { customer: '', staff: '' }
    }
}
