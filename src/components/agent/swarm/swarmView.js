// Pure helpers for the research agents block (a `swarm` part): counts, the
// header and summary lines, each task's live line and time, the one-line
// summary of a collapsed category and the texts of a task's detail. Copy
// follows swarm_contract.md section 9; nothing here invents a value that a
// task does not carry.
import { formatDuration } from '@/composables/agent/useElapsed'
import { errorInfo } from '@/components/agent/message/parts'
import { engineMeta } from '@/lib/engines'
import { regionName } from '@/components/agent/browser/format'
import { taskError } from '@/lib/agent/normalize'
import {
  LIVE_SWARM_STATUSES,
  SWARM_CATEGORY_LABELS,
  SWARM_CATEGORY_LIST,
  TERMINAL_TASK_STATUSES,
} from '@/lib/agent/types'

const STATUS_KEYS = ['queued', 'running', 'done', 'failed', 'skipped', 'stopped']
const TONES = new Set(['good', 'warn', 'bad', 'muted'])
const OPEN_STATUSES = new Set(['queued', 'running'])

const STATUS_WORDS = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
  stopped: 'Stopped',
}

// What a queued task waits for, by the category of its open dependency.
const WAIT_TARGETS = {
  google: 'Google results',
  engines: 'the AI engines',
  competitors: 'the pages',
  site: 'the pages',
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Injection key of the tree context SwarmBlock provides to its rows and
 * details (a reactive object, so its computed fields read as plain values):
 * {swarmLive, rerun: {visible, disabled, reason}, findTask(id),
 *  openCapture(tabId, el), openUrl(url, el), rerunTask(taskId), noteToggle()}.
 */
export const SWARM_TREE = 'agSwarmTree'

/** The context a row or detail sees outside a SwarmBlock: nothing to act on. */
export function defaultTree() {
  return {
    swarmLive: false,
    rerun: { visible: false, disabled: true, reason: '' },
    findTask: () => null,
    openCapture: () => {},
    openUrl: () => {},
    rerunTask: async () => {},
    noteToggle: () => {},
  }
}

function toMs(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function lookup(tasksById, id) {
  if (!tasksById || id === undefined || id === null) return null
  if (tasksById instanceof Map) return tasksById.get(id) || null
  if (typeof tasksById === 'function') return tasksById(id) || null
  return tasksById[id] || null
}

function list(value) {
  return Array.isArray(value) ? value.filter((v) => v !== null && v !== undefined) : []
}

function categoryOf(task) {
  if (task && typeof task.category === 'string' && task.category) return task.category
  const id = task && typeof task.id === 'string' ? task.id : ''
  return id.split('.')[0] || ''
}

/** {total, queued, running, done, failed, skipped, stopped, settled}. */
export function swarmCounts(tasks) {
  const counts = { total: 0, queued: 0, running: 0, done: 0, failed: 0, skipped: 0, stopped: 0, settled: 0 }
  for (const task of list(tasks)) {
    counts.total += 1
    if (STATUS_KEYS.includes(task.status)) counts[task.status] += 1
    if (TERMINAL_TASK_STATUSES.has(task.status)) counts.settled += 1
  }
  return counts
}

/** The swarm is working: its message is live and the part is planning or running. */
export function isSwarmLive(part, live) {
  return Boolean(live) && Boolean(part) && LIVE_SWARM_STATUSES.has(part.status)
}

/** A task's status as shown: an open task of a swarm that stopped is stopped. */
export function displayStatus(task, swarmLive) {
  const status = (task && task.status) || 'queued'
  if (!swarmLive && OPEN_STATUSES.has(status)) return 'stopped'
  return status
}

export function statusWord(status) {
  return STATUS_WORDS[status] || ''
}

/** `Waiting for Google results` while a dependency is open; '' when none is. */
export function waitingText(task, tasksById) {
  for (const id of list(task && task.depends_on)) {
    const dep = lookup(tasksById, id)
    // A dependency outside this execution runs on its earlier result.
    if (!dep || TERMINAL_TASK_STATUSES.has(dep.status)) continue
    const what = WAIT_TARGETS[categoryOf(dep)]
    if (what) return `Waiting for ${what}`
  }
  return ''
}

/**
 * The row's line: {text, tone, shimmer}. `waiting` (a precomputed
 * waitingText) saves looking the dependencies up again.
 */
export function taskLine(task, { swarmLive = true, tasksById = null, waiting } = {}) {
  const status = (task && task.status) || 'queued'
  if (!swarmLive && OPEN_STATUSES.has(status)) return { text: 'Not finished', tone: 'muted', shimmer: false }
  const error = taskError(task && task.error)
  switch (status) {
    case 'queued': {
      const wait = typeof waiting === 'string' ? waiting : waitingText(task, tasksById)
      return { text: wait || 'Queued', tone: 'muted', shimmer: false }
    }
    case 'running':
      return { text: task.step || 'Working', tone: null, shimmer: true }
    case 'done':
      return { text: task.result || 'Done', tone: TONES.has(task.tone) ? task.tone : null, shimmer: false }
    case 'failed': {
      const reason = (error && error.message) || task.result || ''
      return { text: reason ? `Failed: ${reason}` : 'Failed', tone: 'bad', shimmer: false }
    }
    case 'skipped':
      return { text: error && error.message ? `Skipped: ${error.message}` : 'Skipped', tone: 'muted', shimmer: false }
    case 'stopped':
      return { text: (error && error.message) || 'Stopped', tone: 'muted', shimmer: false }
    default:
      return { text: (task && task.result) || '', tone: null, shimmer: false }
  }
}

/** `{label}, {status word}, {line}`: the row's accessible name. */
export function taskName(task, line, status) {
  return [task && task.label, statusWord(status), line && line.text].filter(Boolean).join(', ')
}

/**
 * The row's time: the running time while it runs, its duration once it
 * ends. A task that never started shows none.
 */
export function taskTime(task, now, { swarmLive = true } = {}) {
  if (!task) return ''
  if (task.status === 'running') {
    if (!swarmLive) return ''
    const start = toMs(task.started_at)
    const at = finiteNumber(now)
    return start === null || at === null ? '' : formatDuration(Math.max(0, at - start))
  }
  if (TERMINAL_TASK_STATUSES.has(task.status) && task.started_at) {
    const duration = finiteNumber(task.duration_ms)
    if (duration !== null) return formatDuration(duration)
  }
  return ''
}

function agents(n) {
  return plural(n, 'agent', 'agents')
}

function partDuration(part) {
  const duration = finiteNumber(part && part.duration_ms)
  if (duration !== null) return duration
  const start = toMs(part && part.started_at)
  const end = toMs(part && part.ended_at)
  return start !== null && end !== null ? Math.max(0, end - start) : null
}

/** The header line for every swarm status (contract section 9). */
export function headerText(part, counts, { live = true } = {}) {
  const status = (part && part.status) || 'planning'
  const n = counts ? counts.total : 0
  // Agents that finished their work before the end. Stopped agents did not,
  // so they are not counted (the backend's stop summary counts the same).
  const finished = counts ? counts.done + counts.failed + counts.skipped : 0
  // A reply that is no longer live cannot still be planning or running.
  if (LIVE_SWARM_STATUSES.has(status) && !live) {
    return n ? `Interrupted after ${finished} of ${agents(n)}` : 'Interrupted before the agents started'
  }
  switch (status) {
    case 'planning':
      return 'Planning research agents'
    case 'running': {
      const version = Number(part.version)
      if (Number.isFinite(version) && version > 1) {
        const scope = part.scope_label ? ` · ${part.scope_label}` : ''
        return `Re-running ${agents(n)}${scope}`
      }
      return `Running ${agents(n)}`
    }
    case 'done':
    case 'partial': {
      const duration = partDuration(part)
      return duration === null ? `Ran ${agents(n)}` : `Ran ${agents(n)} in ${formatDuration(duration)}`
    }
    case 'cancelled':
      return n ? `Stopped after ${finished} of ${agents(n)}` : 'Stopped before the agents started'
    case 'interrupted':
      return n ? `Interrupted after ${finished} of ${agents(n)}` : 'Interrupted before the agents started'
    case 'error':
      // A part closed as failed after its agents started (the run failed):
      // what ran stays on screen, so it reads like an interruption.
      return n ? `Interrupted after ${finished} of ${agents(n)}` : 'Could not start the research agents'
    default:
      return `Ran ${agents(n)}`
  }
}

/** `18 done · 1 failed · 2 skipped`; zero counts are left out except done. */
export function summaryText(counts) {
  const c = counts || {}
  const parts = [`${c.done || 0} done`]
  for (const key of ['failed', 'skipped', 'stopped']) {
    if (c[key]) parts.push(`${c[key]} ${key}`)
  }
  return parts.join(' · ')
}

function brandPositions(detail) {
  return list(detail && detail.brand_positions)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
}

/** One line for a collapsed category, from what its finished tasks found. */
export function categorySummary(category, tasks) {
  const key = typeof category === 'string' ? category : category && category.key
  const all = list(tasks)
  const done = all.filter((t) => t.status === 'done')
  const failed = all.filter((t) => t.status === 'failed').length
  let base = ''
  if (done.length) {
    switch (key) {
      case 'google': {
        const positions = done.flatMap((t) => brandPositions(t.detail))
        base = positions.length ? `best #${Math.min(...positions)}` : 'not in the pages searched'
        break
      }
      case 'engines': {
        const named = done.filter((t) => t.detail && t.detail.mentioned === true).length
        base = `named by ${named} of ${done.length}`
        break
      }
      case 'competitors':
        base = `${plural(done.length, 'page', 'pages')} read`
        break
      case 'site': {
        const analyses = done.filter((t) => t.worker === 'content_gap')
        if (analyses.length) {
          const gaps = analyses.reduce((sum, t) => sum + list(t.detail && t.detail.gaps).length, 0)
          base = `${plural(gaps, 'gap', 'gaps')} found`
        }
        break
      }
      case 'sources': {
        const engines = new Set()
        let cited = false
        for (const t of done) {
          if (t.detail && t.detail.you_cited === true) cited = true
          for (const source of list(t.detail && t.detail.sources)) {
            if (!source.is_yours) continue
            cited = true
            for (const engine of list(source.engines)) engines.add(engine)
          }
        }
        if (!cited) base = "you're not cited"
        else base = engines.size ? `cited by ${plural(engines.size, 'engine', 'engines')}` : "you're cited"
        break
      }
      default:
        base = `${done.length} done`
    }
  }
  const parts = base ? [base] : []
  if (failed) parts.push(`${failed} failed`)
  if (!done.length) {
    // Nothing was measured: say why instead of leaving the line blank.
    for (const status of ['skipped', 'stopped']) {
      const n = all.filter((t) => t.status === status).length
      if (n) parts.push(`${n} ${status}`)
    }
  }
  return parts.join(' · ')
}

/** settled / total, 0 when there is no task. */
export function progressRatio(counts) {
  if (!counts || !(counts.total > 0)) return 0
  return Math.min(1, Math.max(0, counts.settled / counts.total))
}

/**
 * The part's tasks grouped for the tree, in category order:
 * [{key, label, notes, subcategories: [{key, label, tasks}], tasks}].
 * A category that has only notes keeps its row (it explains what was not
 * asked); tasks a category does not list still show, never silently drop.
 */
export function groupTasks(part) {
  const tasks = list(part && part.tasks).filter((t) => typeof t === 'object' && t.id)
  const declared = list(part && part.categories).filter((c) => typeof c === 'object' && c.key)
  const known = new Set(declared.map((c) => c.key))
  const extra = []
  for (const task of tasks) {
    const key = categoryOf(task)
    if (key && !known.has(key)) {
      known.add(key)
      extra.push({ key, label: SWARM_CATEGORY_LABELS[key] || key, notes: [], subcategories: [] })
    }
  }
  extra.sort((a, b) => SWARM_CATEGORY_LIST.indexOf(a.key) - SWARM_CATEGORY_LIST.indexOf(b.key))
  const seen = new Set()
  const groups = []
  for (const category of [...declared, ...extra]) {
    if (seen.has(category.key)) continue
    seen.add(category.key)
    const own = tasks.filter((t) => categoryOf(t) === category.key)
    const subcategories = []
    const listed = new Set()
    for (const sub of list(category.subcategories)) {
      if (!sub.key || listed.has(sub.key)) continue
      listed.add(sub.key)
      const subTasks = own.filter((t) => t.subcategory === sub.key)
      if (subTasks.length) subcategories.push({ key: sub.key, label: sub.label || '', tasks: subTasks })
    }
    for (const task of own) {
      const sub = task.subcategory || ''
      if (listed.has(sub)) continue
      listed.add(sub)
      subcategories.push({ key: sub, label: '', tasks: own.filter((t) => (t.subcategory || '') === sub) })
    }
    groups.push({
      key: category.key,
      label: category.label || SWARM_CATEGORY_LABELS[category.key] || category.key,
      notes: list(category.notes).filter((n) => typeof n === 'object' && typeof n.text === 'string' && n.text),
      subcategories,
      tasks: own,
    })
  }
  return groups
}

/** The message a failed re-run shows (the store's AgentError carries the code copy). */
export function rerunErrorText(error) {
  return errorInfo(error).message || 'The research could not be re-run. Try again.'
}

/* ── Task detail texts ── */

function clock(value, withSeconds) {
  const ms = toMs(value)
  if (ms === null) return ''
  const date = new Date(ms)
  const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  if (withSeconds) options.second = '2-digit'
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  } catch {
    return date.toISOString().slice(11, withSeconds ? 19 : 16)
  }
}

/** Local time `10:15:04`. */
export function clockTime(value) {
  return clock(value, true)
}

/** The detail's Status row: `Done in 14s`, `Failed after 1m 2s · attempt 2`, `Skipped: {message}`. */
export function detailStatusText(task, { swarmLive = true, waiting = '' } = {}) {
  const status = (task && task.status) || 'queued'
  if (!swarmLive && OPEN_STATUSES.has(status)) return 'Not finished'
  const error = taskError(task && task.error)
  const duration = task && task.started_at ? finiteNumber(task.duration_ms) : null
  const attempt = Number(task && task.attempt)
  const retried = Number.isFinite(attempt) && attempt > 1 ? ` · attempt ${attempt}` : ''
  switch (status) {
    case 'queued':
      return waiting || 'Queued'
    case 'running':
      return `Running${retried}`
    case 'done':
      return `${duration === null ? 'Done' : `Done in ${formatDuration(duration)}`}${retried}`
    case 'failed':
      return `${duration === null ? 'Failed' : `Failed after ${formatDuration(duration)}`}${retried}`
    case 'skipped':
      return error && error.message ? `Skipped: ${error.message}` : 'Skipped'
    case 'stopped':
      return (error && error.message) || 'Stopped'
    default:
      return statusWord(status) || status
  }
}

/** `United States`, or `Global` without a country. */
export function locationText(location) {
  return regionName(location) || 'Global'
}

/** `#4`, `#4, #12`, or `Not on this page`. */
export function positionsText(positions) {
  const found = list(positions)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
  return found.length ? found.map((n) => `#${n}`).join(', ') : 'Not on this page'
}

/** The AI Overview on a Google results page, in words. */
export function overviewText(overview) {
  if (!overview || overview.shown !== true) return 'Not shown'
  if (overview.content_captured === false) return 'Shown, content not read'
  if (overview.mentions_you === true) return overview.cites_you === true ? 'Names you · cites you' : 'Names you'
  if (overview.cites_you === true) return 'Cites you'
  return 'Shown, not named'
}

// A cited source's `engines` lists the engines that cited it, and the
// backend's key for Google's AI Overview when that cited it too.
const CITER_LABELS = { ai_overview: 'Google AI Overview' }

/** Who cited a source, by key: `ChatGPT`, ..., `Google AI Overview`. */
export function citerLabel(key) {
  return CITER_LABELS[key] || engineMeta(key).label
}

/** The service that fetched a Google results page. */
export function providerLabel(provider) {
  if (provider === 'scraperapi') return 'ScraperAPI'
  if (!provider || provider === 'serpapi') return 'SerpAPI'
  return String(provider)
}

// How long before `at` a reused page was captured, in whole minutes once it
// is a minute or more.
function ageText(capturedAt, at) {
  const from = toMs(capturedAt)
  const to = toMs(at)
  if (from === null || to === null) return ''
  const ms = Math.max(0, to - from)
  return formatDuration(ms >= 60_000 ? Math.floor(ms / 60_000) * 60_000 : ms)
}

/** `10:15 via ScraperAPI`, plus ` · reused from 12m ago` for a page shown again. */
export function capturedText(detail, startedAt = null) {
  const d = detail || {}
  const parts = []
  const time = clock(d.captured_at, false)
  parts.push(time ? `${time} via ${providerLabel(d.provider)}` : `Via ${providerLabel(d.provider)}`)
  if (d.reused) {
    const age = ageText(d.captured_at, startedAt)
    parts.push(age ? `reused from ${age} ago` : 'reused')
  }
  return parts.join(' · ')
}

/** `Yes, #3` / `Yes` / `No`. */
export function namedText(detail) {
  if (!detail || detail.mentioned !== true) return 'No'
  const rank = Number(detail.rank)
  return Number.isFinite(rank) && rank > 0 ? `Yes, #${rank}` : 'Yes'
}

/** `{text} (34 characters)`, or `Missing`. */
export function lengthText(text, length) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) return 'Missing'
  const n = finiteNumber(length)
  return n === null ? value : `${value} (${plural(n, 'character', 'characters')})`
}

/** `Analysis not available: {message}` for a detail's analysis_error. */
export function analysisErrorText(error) {
  const info = taskError(error)
  if (!info) return ''
  return info.message ? `Analysis not available: ${info.message}` : 'Analysis not available.'
}
