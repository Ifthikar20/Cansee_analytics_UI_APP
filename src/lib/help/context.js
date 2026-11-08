// The help drawer's "On this page" list: the questions that fit the screen
// in view, read from the route alone (its name, then ?widget= on the board
// and ?section= on Settings, then its section). Pure: no Vue, no requests.
import { sectionOf } from '@/lib/shell/nav'
import { FAQ_GROUPS, faqById } from './faq'

// Board panels (?widget=<key> on 'analytics').
const BY_WIDGET = Object.freeze({
    'prompt-box': ['pr-askai', 'eng-vary'],
    ranking: ['pr-ranked', 'pr-add', 'pr-limit'],
    summary: ['gap-score', 'gap-labels'],
    prompts: ['pr-add', 'gap-notchecked', 'gap-labels'],
    countries: ['pr-country'],
    traffic: ['gs-traffic'],
    'ai-traffic': ['gs-traffic'],
    'ai-crawlers': ['gs-traffic'],
    citations: ['gap-citations'],
    'fact-check': ['gap-change'],
    'who-recommends': ['pr-competitors'],
    competitors: ['pr-competitors'],
})

// Settings sections (?section=<key> on 'settings').
const BY_SECTION = Object.freeze({
    subscription: ['plan-paid', 'plan-free', 'plan-out'],
    usage: ['plan-free', 'plan-out'],
    team: ['acct-roles'],
    domains: ['acct-sso'],
    account: ['acct-delete'],
    contact: ['ts-contact'],
})

// Route names.
const BY_ROUTE = Object.freeze({
    dashboard: ['gs-setup', 'gs-board', 'plan-free'],
    analytics: ['gs-board', 'pr-add', 'gap-score'],
    settings: ['gs-projects', 'ts-contact'],
    'settings-project': ['pr-competitors', 'gs-edit-setup'],
    'settings-autopilot': ['pr-often', 'ts-autopilot'],
    'settings-connections': ['rep-channels', 'gs-traffic'],
    'settings-brand-facts': ['gap-change'],
    'settings-command-center': ['plan-free', 'plan-out'],
    billing: ['plan-free', 'plan-paid', 'ts-paid'],
    agent: ['ag-what', 'ag-research'],
    'agent-projects': ['ag-what', 'gs-projects'],
    'agent-home': ['ag-what', 'ag-research', 'ag-notready'],
    'agent-chat': ['ag-what', 'ag-research', 'ag-notready'],
    'agent-agents': ['ag-what', 'ag-notready'],
    'agent-findings': ['ag-findings'],
    'agent-reviews': ['ag-reviews'],
    'agent-context': ['ag-context'],
    'agent-reports': ['rep-where', 'rep-templates', 'rep-export'],
    'agent-documents': ['rep-where', 'rep-export'],
    'agent-sheets': ['rep-where', 'rep-export'],
    'agent-artifact': ['rep-export', 'ag-reviews'],
})

// Pages with no list of their own: the full help center shows instead.
const NONE = new Set(['support', 'docs'])

const BY_APP_SECTION = Object.freeze({
    analytics: BY_ROUTE.analytics,
    agent: BY_ROUTE['agent-home'],
    settings: BY_ROUTE.settings,
})

const MAX = 4

const fallback = () => FAQ_GROUPS[0].items.slice(0, 3).map((it) => it.id)

const first = (value) => (Array.isArray(value) ? value[0] : value)

/** The FAQ ids for the route in view (at most 4, all existing); [] on Support and Docs. */
export function helpContextFor(route) {
    const name = String(route?.name || '')
    if (NONE.has(name)) return []
    const query = route?.query || {}
    let ids = null
    if (name === 'analytics') ids = BY_WIDGET[first(query.widget)] || null
    if (name === 'settings') ids = BY_SECTION[first(query.section)] || null
    if (!ids) ids = BY_ROUTE[name] || BY_APP_SECTION[sectionOf(route)] || fallback()
    return ids.filter((id) => faqById(id)).slice(0, MAX)
}

// For the tests: every id the maps name.
export const CONTEXT_MAPS = Object.freeze({ BY_WIDGET, BY_SECTION, BY_ROUTE })
