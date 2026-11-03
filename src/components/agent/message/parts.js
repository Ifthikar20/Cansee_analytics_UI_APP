// Pure helpers that turn a message's parts into what the chat shows: the
// step list, the background engine checks, the reply body and the agent
// deliverables. Labels follow the contract's part fields only; nothing here
// invents a value that a part does not carry.
import { engineMeta } from '@/lib/engines'
import { displayUrl, hostOf } from '@/lib/agent/url'

export const STEP_TYPES = new Set(['thinking', 'tool', 'web_search', 'web_fetch', 'serp', 'page_inspect'])
export const BODY_TYPES = new Set(['text', 'chart', 'browser_open', 'notice'])

const LIVE_STATUSES = new Set(['preparing', 'queued', 'running', 'planning', 'drafting', 'validating', 'loading'])

export function isLiveStatus(status) {
  return LIVE_STATUSES.has(status)
}

/** {steps, checks, body, calls} in arrival order. */
export function splitParts(parts) {
  const out = { steps: [], checks: [], body: [], calls: [] }
  for (const part of Array.isArray(parts) ? parts : []) {
    if (!part || !part.type) continue
    if (STEP_TYPES.has(part.type)) out.steps.push(part)
    else if (part.type === 'engine_check') out.checks.push(part)
    else if (part.type === 'agent_call') out.calls.push(part)
    else if (BODY_TYPES.has(part.type)) out.body.push(part)
  }
  return out
}

/** The reply's Markdown, as the user would copy or save it. */
export function messageText(message) {
  const parts = Array.isArray(message?.parts) ? message.parts : []
  return parts
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Unique citations across text parts, first occurrence wins. */
export function messageCitations(message) {
  const seen = new Set()
  const out = []
  for (const part of Array.isArray(message?.parts) ? message.parts : []) {
    if (!part || part.type !== 'text' || !Array.isArray(part.citations)) continue
    for (const c of part.citations) {
      const url = c && typeof c.url === 'string' ? c.url : ''
      if (!url || seen.has(url) || !hostOf(url)) continue
      seen.add(url)
      out.push({ url, title: (c.title || '').trim(), host: hostOf(url) })
    }
  }
  return out
}

function quote(text) {
  return `“${String(text || '').trim()}”`
}

function ordinal(positions) {
  const list = Array.isArray(positions) ? positions.filter((n) => Number.isFinite(Number(n))) : []
  return list.length ? Number(list[0]) : null
}

/**
 * A step line: {text, detail, tone, tabId, url}.
 * tone: 'live' | 'done' | 'error'. tabId opens a pane tab; url opens a page.
 */
export function stepLine(part) {
  const status = part?.status
  const live = isLiveStatus(status)
  const failed = status === 'error'
  const tone = failed ? 'error' : live ? 'live' : 'done'

  switch (part?.type) {
    case 'tool': {
      const label = part.label || part.name || 'Tool'
      const detail = failed ? part.error || 'This step failed.' : part.summary || ''
      return { text: label, detail, tone }
    }
    case 'web_search': {
      const q = quote(part.query)
      if (failed) {
        return { text: `Web search for ${q} failed`, detail: part.error_code ? `Reason: ${part.error_code}` : '', tone }
      }
      if (live) return { text: `Searching the web for ${q}`, detail: '', tone }
      const count = Array.isArray(part.results) ? part.results.length : 0
      const suffix = count ? ` · ${count} ${count === 1 ? 'result' : 'results'}` : ''
      return { text: `Searched the web for ${q}${suffix}`, detail: '', tone }
    }
    case 'web_fetch': {
      const name = part.title || hostOf(part.url) || displayUrl(part.url) || 'a page'
      if (failed) return { text: `Could not read ${name}`, detail: part.error_code ? `Reason: ${part.error_code}` : '', tone, url: part.url }
      return { text: live ? `Reading ${name}` : `Read ${name}`, detail: '', tone, url: part.url }
    }
    case 'serp': {
      const q = quote(part.query)
      const page = Number(part.page) > 1 ? ` · page ${Number(part.page)}` : Number(part.page) === 1 ? ' · page 1' : ''
      if (failed) {
        const code = part.error?.code
        const detail = code === 'serp_not_configured'
          ? "Google search isn't available yet."
          : part.error?.message || 'The Google search failed.'
        return { text: `Google search for ${q}${page}`, detail, tone, tabId: code === 'serp_not_configured' ? null : part.tab_id }
      }
      if (live) return { text: `Searching Google for ${q}${page}`, detail: '', tone, tabId: part.tab_id }
      const pos = ordinal(part.brand_positions)
      const rank = pos !== null ? ` · you're #${pos}` : ' · you are not on this page'
      const overview = part.ai_overview_shown ? ' · AI Overview shown' : ''
      return { text: `Searched Google for ${q}${page}${rank}${overview}`, detail: '', tone, tabId: part.tab_id }
    }
    case 'page_inspect': {
      const name = part.title || hostOf(part.url) || displayUrl(part.url) || 'a page'
      if (failed) {
        return { text: `Could not inspect ${name}`, detail: part.error?.message || part.error || '', tone, tabId: part.tab_id }
      }
      return { text: live ? `Inspecting ${name}` : `Inspected ${name}`, detail: live ? '' : part.summary || '', tone, tabId: part.tab_id }
    }
    case 'thinking': {
      // Thinking parts carry no status; an open one has no end time yet.
      const open = status ? live : !part.ended_at && (part.duration_ms === null || part.duration_ms === undefined)
      return { text: open ? 'Thinking' : 'Thought', detail: '', tone: open ? 'live' : 'done' }
    }
    default:
      return { text: part?.type || 'Step', detail: '', tone }
  }
}

/** "Claude · named #3", "Perplexity · not named", "Grok · not available". */
export function engineCheckLine(part) {
  const label = part?.engine_label || engineMeta(part?.engine).label
  const color = engineMeta(part?.engine).color
  let status
  let tone = 'done'
  switch (part?.status) {
    case 'queued':
      status = 'queued'
      tone = 'live'
      break
    case 'running':
      status = 'asking'
      tone = 'live'
      break
    case 'unavailable':
      status = 'not available'
      tone = 'muted'
      break
    case 'error':
      status = 'failed'
      tone = 'error'
      break
    case 'done':
      if (part.mentioned) {
        const rank = Number(part.rank)
        status = Number.isFinite(rank) && rank > 0 ? `named #${rank}` : 'named'
        tone = 'good'
      } else {
        status = 'not named'
      }
      break
    default:
      status = part?.status || ''
  }
  const reason = part?.status === 'unavailable' || part?.status === 'error'
    ? typeof part.error === 'string'
      ? part.error
      : part.error?.message || ''
    : ''
  return { label, status, tone, color, reason }
}

/** Engine checks grouped by prompt, in first-seen order. */
export function groupChecks(checks) {
  const groups = new Map()
  for (const part of checks || []) {
    const key = part.prompt_id ?? part.prompt_text ?? ''
    if (!groups.has(key)) groups.set(key, { key: String(key), prompt: part.prompt_text || '', checks: [] })
    groups.get(key).checks.push(part)
  }
  return [...groups.values()]
}

export function checkProgress(checks) {
  const list = checks || []
  const settled = list.filter((p) => !isLiveStatus(p.status)).length
  return { settled, total: list.length, live: settled < list.length }
}

const ERROR_COPY = {
  allowance_exceeded: {
    title: "You've used your AI allowance for this period.",
    body: 'Upgrade your plan or wait for the allowance to reset.',
    retry: false,
    billing: true,
  },
  agent_busy: { title: 'Another reply is still running.', body: 'Wait for it to finish, then try again.', retry: true },
  run_in_progress: { title: 'This chat is already working on a reply.', body: '', retry: false },
  agent_disabled: { title: 'The agent is switched off on this server.', body: '', retry: false },
  agent_unavailable: { title: "The agent service isn't reachable right now.", body: 'Try again in a minute.', retry: true },
  agent_not_configured: {
    title: "The agent isn't set up on this server yet.",
    body: 'No model API key is configured.',
    retry: false,
  },
  interrupted: { title: 'The reply was interrupted before it finished.', body: '', retry: true },
  overloaded: { title: 'The model is overloaded right now.', body: 'Try again in a moment.', retry: true },
  rate_limited: { title: 'Too many requests right now.', body: 'Try again in a moment.', retry: true },
  timeout: { title: 'The reply took too long and was stopped.', body: '', retry: true },
  deadline_exceeded: { title: 'The reply took too long and was stopped.', body: '', retry: true },
  cost_limit: { title: 'This reply reached its spending limit and was stopped.', body: '', retry: true },
  max_requests: { title: 'This reply reached its step limit and was stopped.', body: '', retry: true },
  network: { title: 'The connection to the agent was lost.', body: '', retry: true },
}

/** Copy for a failed or interrupted reply. */
export function errorCopy(code, message, status) {
  const key = code || (status === 'interrupted' ? 'interrupted' : '')
  const known = ERROR_COPY[key]
  if (known) return { ...known, code: key, body: known.body || '' }
  return {
    code: key,
    title: status === 'interrupted' ? 'The reply was interrupted before it finished.' : 'The agent ran into a problem.',
    body: typeof message === 'string' && message.trim() ? message.trim() : '',
    retry: true,
  }
}

/**
 * {status, code, message, details} from an axios error, an error envelope or
 * a store error object. Axios's own codes (ERR_BAD_REQUEST) are not API codes.
 */
export function errorInfo(error) {
  if (!error || typeof error !== 'object') {
    return { status: null, code: '', message: typeof error === 'string' ? error : '', details: null }
  }
  const axios = Boolean(error.isAxiosError)
  const body = error.response?.data
  let inner = null
  if (body && typeof body === 'object' && body.error && typeof body.error === 'object') inner = body.error
  else if (error.error && typeof error.error === 'object') inner = error.error
  let code = inner?.code || ''
  if (!code && body && typeof body.error === 'string') code = body.error
  if (!code && !axios && typeof error.code === 'string') code = error.code
  if (!code && axios && !error.response) code = 'network'
  const message =
    inner?.message || (!axios && typeof error.message === 'string' ? error.message : '') || error.displayMessage || ''
  return {
    status: error.response?.status ?? (typeof error.status === 'number' ? error.status : null),
    code: typeof code === 'string' ? code : '',
    message,
    details: inner?.details || (!axios ? error.details : null) || null,
  }
}
