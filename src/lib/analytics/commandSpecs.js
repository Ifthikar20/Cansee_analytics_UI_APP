// Stat tiles and chart specs (contract 8a) for the usage dashboard
// (p2_contract.md 14b, the Command Center design). Pure functions over the
// GET /agent/command-center/ payload: counts come from recorded agent runs
// and AI spend from the usage ledger, so a measured zero is 0 and nothing
// here is estimated.
import { formatValue, toNumber } from '@/lib/charts/format'
import { periodDays } from './visibilitySpecs'

export const RUN_OUTCOMES = Object.freeze([
    { key: 'completed', label: 'Completed', entity: 'status:good' },
    { key: 'failed', label: 'Failed', entity: 'status:critical' },
    { key: 'cancelled', label: 'Stopped', entity: 'muted' },
    { key: 'interrupted', label: 'Interrupted', entity: 'status:warning' },
])

export const SPEND_CATEGORIES = Object.freeze([
    { key: 'agent_replies', label: 'Agent replies' },
    { key: 'writers', label: 'Writing agents' },
    { key: 'research', label: 'Research agents' },
    { key: 'context', label: 'Context builds' },
    { key: 'engines', label: 'AI engine answers' },
    { key: 'insights', label: 'Insights runs' },
    { key: 'other', label: 'Other' },
])

export const RUNS_FOOTNOTE =
    'A run is one reply of the agent, re-runs included; a run that used two writing agents counts for both.'
export const SPEND_FOOTNOTE =
    'AI spend is priced from the tokens each request recorded, the figure your allowance uses. Spend by agent counts each agent\'s own requests; the replies around them are under Agent replies.'

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
const integer = new Intl.NumberFormat('en-US')

function buckets(payload) {
    return Array.isArray(payload?.window?.buckets) ? payload.window.buckets.map(String) : []
}

function timeUnit(payload) {
    return payload?.window?.interval === 'week' ? 'week' : 'day'
}

// Pad or cut a series to the bucket count; money strings become numbers and
// anything that is not a number is null (a gap, never a zero).
function fit(values, length) {
    const out = []
    for (let i = 0; i < length; i++) out.push(toNumber(values?.[i]))
    return out
}

function pctChange(now, before) {
    const a = toNumber(now)
    const b = toNumber(before)
    if (a === null || b === null || b <= 0) return null
    return Math.round(((a - b) / b) * 1000) / 10
}

/** Days in the payload's window (30 when unknown). */
export function windowDays(payload, fallback = '30d') {
    return periodDays(payload?.window?.period || fallback)
}

/** The five headline tiles (VizStatTile props plus a key). */
export function commandTiles(payload, { period = payload?.window?.period || '30d' } = {}) {
    const t = payload?.totals || {}
    const vs = `vs previous ${periodDays(period)} days`
    const delta = (value, goodWhen) => (value === null ? null : { value, unit: 'pct', label: vs, goodWhen })
    const runs = toNumber(t.runs)
    const failed = toNumber(t.failed)
    return [
        {
            key: 'runs',
            label: 'Agent runs',
            value: runs,
            kind: 'count',
            delta: delta(pctChange(t.runs, t.runs_prev), 'up'),
        },
        {
            key: 'active_users',
            label: 'Active users',
            value: toNumber(t.active_users),
            kind: 'count',
            delta: delta(pctChange(t.active_users, t.active_users_prev), 'up'),
        },
        { key: 'drafts_saved', label: 'Drafts saved', value: toNumber(t.drafts_saved), kind: 'count', delta: null },
        {
            key: 'ai_usd',
            label: 'AI spend',
            value: toNumber(t.ai_usd),
            kind: 'usd',
            delta: delta(pctChange(t.ai_usd, t.ai_usd_prev), 'down'),
        },
        {
            key: 'failed',
            label: 'Failed runs',
            value: runs !== null && failed !== null ? `${integer.format(failed)} of ${integer.format(runs)}` : null,
            kind: 'number',
            delta: null,
        },
    ]
}

/** Agent runs per bucket by how they ended (stacked). */
export function runsOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.runs_series || {}
    return {
        id: 'command.runs',
        title: 'Agent runs',
        subtitle: 'Replies the agent finished, by how they ended.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'count',
        labels,
        datasets: RUN_OUTCOMES.map((o) => ({
            key: o.key,
            label: o.label,
            entity: o.entity,
            data: fit(series[o.key], labels.length),
        })),
        stacked: true,
        type: 'stacked_bar',
    }
}

/** People who started at least one run, per bucket. */
export function activeUsersOverTime(payload) {
    const labels = buckets(payload)
    return {
        id: 'command.users',
        title: 'Active users',
        subtitle: 'People who started at least one agent run.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'count',
        labels,
        datasets: [{ key: 'active_users', label: 'Active users', data: fit(payload?.active_users_series, labels.length) }],
        type: 'line',
    }
}

function categoryLabel(payload, key, fallback) {
    const row = (payload?.spend_by_category || []).find((c) => c && c.key === key)
    return row?.label || fallback
}

/** AI spend per bucket by category (stacked, US dollars). */
export function spendOverTime(payload) {
    const labels = buckets(payload)
    const series = payload?.spend_series || {}
    return {
        id: 'command.spend',
        title: 'AI spend',
        subtitle: 'Priced from the tokens each request recorded.',
        x: 'time',
        time_unit: timeUnit(payload),
        value: 'usd',
        labels,
        datasets: SPEND_CATEGORIES.map((c) => ({
            key: c.key,
            label: categoryLabel(payload, c.key, c.label),
            data: fit(series[c.key], labels.length),
        })),
        stacked: true,
        type: 'stacked_bar',
        footnote: SPEND_FOOTNOTE,
    }
}

/** Runs, drafts saved and AI spend by agent; one measure at a time. */
export function runsByAgent(payload) {
    const rows = (payload?.by_agent || []).filter((r) => r && r.key)
    const column = (field) => rows.map((r) => toNumber(r[field]))
    return {
        id: 'command.agents',
        title: 'Runs by agent',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => String(r.key)),
        label_names: Object.fromEntries(rows.map((r) => [String(r.key), r.label || String(r.key)])),
        label_header: 'Agent',
        datasets: [
            { key: 'runs', label: 'Runs', value: 'count', data: column('runs') },
            { key: 'drafts_saved', label: 'Drafts saved', value: 'count', data: column('drafts_saved') },
            { key: 'ai_usd', label: 'AI spend', value: 'usd', data: column('ai_usd') },
        ],
        pick_one: true,
        type: 'hbar',
        footnote: RUNS_FOOTNOTE,
    }
}

/** Runs by the primary team of the agents each run used. */
export function runsByTeam(payload) {
    const rows = (payload?.by_team || []).filter((r) => r && r.key)
    return {
        id: 'command.teams',
        title: 'Runs by team',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => String(r.key)),
        label_names: Object.fromEntries(rows.map((r) => [String(r.key), r.label || String(r.key)])),
        label_header: 'Team',
        datasets: [{ key: 'runs', label: 'Runs', data: rows.map((r) => toNumber(r.runs)) }],
        type: 'bar',
    }
}

/** Top users of the organization scope as table rows (null in `me`). */
export function topUserRows(payload) {
    if (!Array.isArray(payload?.top_users)) return null
    return payload.top_users
        .filter((u) => u && (u.user_id || u.name))
        .map((u, i) => ({
            key: String(u.user_id || i),
            name: u.name || '',
            email: u.email || '',
            role: ROLE_LABELS[u.role] || '',
            runs: formatValue(u.runs, { value: 'count' }) ?? '',
            active_days: formatValue(u.active_days, { value: 'count' }) ?? '',
            ai_usd: formatValue(u.ai_usd, { value: 'usd' }) ?? '',
            last_active_at: u.last_active_at || '',
        }))
}

/** The page's empty state for `empty_reason`, or null when there is activity. */
export function commandEmpty(payload, period) {
    if (payload?.empty_reason !== 'no_activity') return null
    return {
        kind: 'empty',
        title: `No agent runs or AI use in the last ${windowDays(payload, period)} days.`,
        body: 'Runs and AI spend show up here when someone uses the agent or checks prompts.',
        action: { label: 'Open the agent', to: { name: 'agent' } },
    }
}
