// Pure helpers for the keywords tab (KeywordsView): sorting, the change badge
// per keyword, the engine cells and the terms a keyword highlights. Classes,
// scores and positions come from the API (the search-gap overview and
// highlight-changes); nothing is re-derived here (spec section 6.4).
import { hostOf } from '@/lib/agent/url'

// The change window the tab asks for (highlight-changes accepts 1 to 90).
export const KEYWORDS_WINDOW_DAYS = 90

export const SORT_OPTIONS = Object.freeze([
  { key: 'gap', label: 'Biggest gap' },
  { key: 'google', label: 'Google rank' },
  { key: 'ai', label: 'AI score' },
  { key: 'changed', label: 'Recently changed' },
])

export function sortLabel(key) {
  return (SORT_OPTIONS.find((o) => o.key === key) || SORT_OPTIONS[0]).label
}

// Changes that move a keyword, in the order the server lists them.
const MOVES = ['named_now', 'rank_up', 'dropped', 'rank_down']
const CHANGE_LABELS = {
  named_now: 'Named now',
  rank_up: 'Up',
  dropped: 'Dropped',
  rank_down: 'Down',
  first_check: 'First check',
  unchanged: 'No change',
}

function list(value) {
  return Array.isArray(value) ? value.filter((v) => v !== null && typeof v === 'object') : []
}

/** The change rows (one per engine) of each tracked prompt, by prompt_id. */
export function changesByPrompt(changes) {
  const map = new Map()
  for (const row of list(changes)) {
    const id = row.prompt_id === undefined || row.prompt_id === null ? '' : String(row.prompt_id)
    if (!id) continue
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(row)
  }
  return map
}

/** One engine answer as a reader says it: "#3", "named", "not named". */
export function answerText(answer) {
  if (!answer || typeof answer !== 'object') return 'no earlier answer'
  if (!answer.named) return 'not named'
  return answer.rank ? `#${answer.rank}` : 'named'
}

/**
 * The keyword's change badge from its engine rows: the first move (named
 * now, up, dropped, down), else "First check" when every engine was checked
 * once (never "Dropped"), else "No change"; null when no engine answered in
 * the window. `details` says each engine's move ("ChatGPT: not named to #3").
 */
export function changeSummary(rows) {
  const engines = list(rows)
  if (!engines.length) return null
  let kind = MOVES.find((k) => engines.some((r) => r.change === k))
  if (!kind) kind = engines.every((r) => r.change === 'first_check') ? 'first_check' : 'unchanged'
  return {
    kind,
    label: CHANGE_LABELS[kind],
    moved: MOVES.includes(kind),
    details: engines.map(
      (r) => `${r.label || r.engine}: ${answerText(r.previous)} to ${answerText(r.latest)}`
    ),
  }
}

/** An engine's cell: "Named #2", "Not named", "No answers"; '' when not set up. */
export function engineText(engine) {
  if (!engine || typeof engine !== 'object' || !engine.configured) return ''
  if (!engine.answers) return 'No answers'
  if (engine.mentioned) return engine.rank ? `Named #${engine.rank}` : 'Named'
  return 'Not named'
}

/** The AI score (0-100) as text, "Not checked" when no engine answered. */
export function aiScoreText(row) {
  const score = row && row.gap ? row.gap.ai_score : null
  return Number.isFinite(score) ? String(score) : 'Not checked'
}

function googlePosition(row) {
  const google = row && row.google
  const n = google && google.status === 'ok' ? google.position : null
  return Number.isInteger(n) && n > 0 ? n : null
}

function aiScore(row) {
  const score = row && row.gap ? row.gap.ai_score : null
  return Number.isFinite(score) ? score : null
}

const ascending = (x, y) => (x === y ? 0 : x === null ? 1 : y === null ? -1 : x - y)
const descending = (x, y) => (x === y ? 0 : x === null ? 1 : y === null ? -1 : y - x)

/** The keyword moved in the change window. */
export function isMoved(row, changes) {
  const summary = changeSummary(changes && changes.get(String(row && row.prompt_id)))
  return Boolean(summary && summary.moved)
}

/**
 * The overview's prompts[] in `sort` order. 'gap' (the default) keeps the
 * server's order, already biggest gap first. 'google' and 'ai' put nulls last
 * and break ties on AI score, Google position, then the keyword (spec 6.8).
 * 'changed' lists moved keywords first, in move order, and keeps the server
 * order after them.
 */
export function sortKeywordRows(prompts, sort, changes = new Map()) {
  const rows = list(prompts)
  if (!sort || sort === 'gap') return rows
  const indexed = rows.map((row, i) => ({ row, i }))
  const tie = (a, b) =>
    descending(aiScore(a.row), aiScore(b.row)) ||
    ascending(googlePosition(a.row), googlePosition(b.row)) ||
    String(a.row.text || '').localeCompare(String(b.row.text || ''), 'en', {
      sensitivity: 'base',
    }) ||
    a.i - b.i
  const moveRank = (row) => {
    const summary = changeSummary(changes.get(String(row.prompt_id)))
    return summary && summary.moved ? MOVES.indexOf(summary.kind) : null
  }
  let compare
  if (sort === 'google')
    compare = (a, b) => ascending(googlePosition(a.row), googlePosition(b.row)) || tie(a, b)
  else if (sort === 'ai')
    compare = (a, b) => descending(aiScore(a.row), aiScore(b.row)) || tie(a, b)
  else if (sort === 'changed')
    compare = (a, b) => ascending(moveRank(a.row), moveRank(b.row)) || a.i - b.i
  else return rows
  return indexed.sort(compare).map((entry) => entry.row)
}

/**
 * What a keyword row highlights in the pane: the keyword, your brand (the
 * project's name and domain) and the brands the AI answers rank (the
 * overview's leaderboard, without you).
 */
export function keywordTerms(overview, row) {
  const website = (overview && overview.website) || {}
  const host = hostOf(website.url || '').replace(/^www\./, '')
  return {
    keyword: String((row && row.text) || ''),
    brand: [website.name, host],
    competitors: list(overview && overview.leaderboard)
      .filter((b) => !b.is_you && b.name)
      .map((b) => b.name),
  }
}
