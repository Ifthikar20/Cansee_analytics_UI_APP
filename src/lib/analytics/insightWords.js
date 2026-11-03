// Words of the insights pages (p2_contract.md sections 1e, 3, 5, 6 and 7),
// one place for every screen. Each map is keyed by the API's value, in
// display order; a value the map does not know falls back to the helpers'
// neutral words, never to a guess.
import { markRaw } from 'vue'
import {
    CircleCheck as CircleCheckIcon,
    CircleDashed as CircleDashedIcon,
    CircleHelp as CircleHelpIcon,
    CircleX as CircleXIcon,
} from '@lucide/vue'

// Run kinds (contract 1e, 11c): "{label} started.", "{label} running".
export const RUN_KIND_LABELS = Object.freeze({
    answer_analysis: 'Answer analysis',
    site_audit: 'Crawler audit',
    prompt_research: 'Prompt research',
    fanout_google: 'Fan-out Google check',
    shopping_check: 'Shopping check',
    context_build: 'Context build',
})

// Claim verdicts (contract 3a). The icon carries the meaning with the
// word, never a colour alone.
export const VERDICTS = Object.freeze({
    contradicted: { word: 'Contradicted', help: 'Your evidence says something different.', icon: markRaw(CircleXIcon) },
    not_verifiable: { word: 'Not verifiable', help: "Your evidence doesn't cover this.", icon: markRaw(CircleHelpIcon) },
    unchecked: { word: 'Not checked', help: "The check didn't finish for this claim.", icon: markRaw(CircleDashedIcon) },
    supported: { word: 'Supported', help: 'Your evidence says the same thing.', icon: markRaw(CircleCheckIcon) },
})

export const TOPICS = Object.freeze({
    pricing: 'Pricing',
    features: 'Features',
    integrations: 'Integrations',
    company: 'Company',
    availability: 'Availability',
    support: 'Support',
    security: 'Security',
    performance: 'Performance',
    other: 'Other',
})

export const TONES = Object.freeze({ positive: 'Positive', neutral: 'Neutral', negative: 'Negative' })

// Prompt research sources (contract 7).
export const IDEA_SOURCES = Object.freeze({
    paa: 'People also ask',
    related_search: 'Related search',
    fanout: 'Engine search',
    ai_suggestion: 'AI suggestion',
    sub_query: 'Predicted sub-query',
})

// Crawler audit checks per page (contract 5b), in the order the audit lists them.
export const CHECKS = Object.freeze({
    status_ok: 'Loads',
    indexable: 'Indexable',
    title: 'Has a title',
    meta_description: 'Has a meta description',
    h1: 'Has an H1',
    text_without_js: 'Text without JavaScript',
    structured_data: 'Structured data',
    canonical: 'Canonical link',
    ai_search_allowed: 'Open to AI search bots',
})

// Whether a bot follows robots.txt (contract 5a).
export const BOT_ROBOTS_WORDS = Object.freeze({
    yes: 'Follows robots.txt',
    may_not: 'robots.txt may not apply to fetches a user asks for',
    no: 'Generally ignores robots.txt for fetches a user asks for',
    token_only: 'A control token, not a crawler: it decides whether crawled pages may be used for AI',
    unknown: "Not confirmed from the operator's documentation",
})

// The same in a word, for a table cell; the sentence above is its tooltip.
export const BOT_ROBOTS_SHORT = Object.freeze({
    yes: 'Yes',
    may_not: 'Not always',
    no: 'No',
    token_only: 'Control token',
    unknown: 'Not confirmed',
})

// Item error codes of a run (contract 1e rule 6), in public words.
export const ITEM_ERRORS = Object.freeze({
    invalid_output: 'The analysis came back unreadable.',
    refused: 'The model declined this input.',
    rate_limited: 'The model was busy or rate limited.',
    upstream_error: 'The model returned an error.',
    allowance_exceeded: 'The monthly AI allowance is used up.',
    fetch_failed: 'The page could not be loaded.',
    blocked_url: 'Only public web pages can be read.',
    timeout: 'The page took too long to load.',
    serp_failed: 'Google search failed.',
    daily_limit: 'This project used its Google pages for today.',
    engine_error: 'The engine returned an error.',
    cancelled: 'Stopped before it ran.',
    interrupted: 'The run stopped before this finished.',
})

export const ROBOTS_STATES = Object.freeze({
    found: 'Found',
    missing: 'Missing',
    unreachable: 'Not responding',
    failed: "Couldn't fetch",
})

export const LLMS_STATES = Object.freeze({
    found: 'Found',
    invalid: 'No title line',
    missing: 'Missing',
    failed: "Couldn't fetch",
})

// A bot's access to the home page. A control token (Google-Extended,
// Applebot-Extended) is not a crawler, so blocking it reads "Opted out".
export const BOT_HOME = Object.freeze({
    allowed: 'Allowed',
    blocked: 'Blocked',
    blocked_unreachable: 'Blocked while robots.txt is down',
    unknown: 'Unknown',
})

// Source states of the Pages and Prompt research tabs, wave 1 traffic
// reasons included.
export const SOURCE_STATE_WORDS = Object.freeze({
    ok: 'On',
    no_checks: 'No checks yet',
    not_configured: 'Not configured',
    no_data: 'None recorded',
    not_run: 'Not run',
    no_source: 'Not connected',
    not_connected: 'Not connected',
    no_cloudflare: 'Not connected',
    plan_unsupported: 'Not on this plan',
    source_error: "Couldn't reach it",
    disabled: 'Turned off',
})

/** The home-page access word of a bot; `robots` is its contract 5a follows value. */
export function botHomeWord(state, robots = '') {
    if (state === 'blocked' && robots === 'token_only') return 'Opted out'
    return BOT_HOME[state] || BOT_HOME.unknown
}

/** A source state in words ('On', 'Not connected'...); 'Unknown' for a value the contract does not list. */
export function sourceStateWord(state) {
    return SOURCE_STATE_WORDS[state] || 'Unknown'
}

/** An item error ({code, message} or a code) in public words; `fallback` for a code the contract does not list. */
export function itemErrorText(error, fallback = '') {
    if (!error) return ''
    if (typeof error === 'string') return ITEM_ERRORS[error] || fallback
    return error.message || ITEM_ERRORS[error.code] || fallback
}

/** A check's label, from the payload's catalog when given, else the contract's. */
export function checkLabel(key, catalog = null) {
    const fromPayload = Array.isArray(catalog) ? catalog.find((c) => c && c.key === key)?.label : ''
    return fromPayload || CHECKS[key] || String(key || '')
}
