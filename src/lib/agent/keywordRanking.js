// The keywords searched in this chat, ranked by where your brand places on
// Google (highlight view, spec section 6, the in-chat tier). Built only from
// the chat's Google results captures. A capture counts once the research
// agents stamped it with its tracked prompt (prompt_id); ad-hoc searches carry
// no prompt_id and stay out of the ranking, though they still serve as
// highlight sources. Keywords group by prompt_id, never by query text or by
// prompt_key (which only means something within one research). The wording
// matches the research results table's Google and AI Overview cells.
import { captureTerms, uniqueNames } from './highlight'

// Google results per page (the backend's research PAGE_SIZE).
const PAGE_SIZE = 10

function hasPromptId(capture) {
  return typeof capture.prompt_id === 'string' && capture.prompt_id !== ''
}

function timeOf(capture) {
  const t = Date.parse(capture && capture.captured_at)
  return Number.isFinite(t) ? t : -Infinity
}

function locationOf(capture) {
  return typeof capture.location === 'string' ? capture.location.toLowerCase() : ''
}

function newestOf(captures) {
  return captures.reduce((a, b) => (timeOf(b) >= timeOf(a) ? b : a))
}

// The capture of the latest search: last in the input (the chat's order). A
// page a research shows again keeps its captured_at, so time cannot tell.
function latestOf(captures) {
  return captures[captures.length - 1]
}

function pageOf(capture) {
  const n = Number(capture.page)
  return Number.isInteger(n) && n > 0 ? n : 1
}

// Your positions on one page; an empty list means "not on this page".
function positionsOf(capture) {
  const raw = Array.isArray(capture.brand_positions)
    ? capture.brand_positions
    : capture.results.filter((r) => r && r.is_yours).map((r) => r && r.position)
  return raw.filter((p) => Number.isInteger(p) && p > 0)
}

function andList(items) {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function overviewOf(capture) {
  const o = capture && capture.ai_overview
  if (!o || typeof o !== 'object') return null
  return {
    shown: Boolean(o.shown),
    // A deferred overview was shown but never read; older captures lack the key.
    contentCaptured: o.content_captured !== false,
    mentionsYou: typeof o.mentions_you === 'boolean' ? o.mentions_you : null,
    citesYou: typeof o.cites_you === 'boolean' ? o.cites_you : null,
  }
}

/**
 * The Google results captures of `messages` (the chat's visible branch) and
 * of the open Google tabs, one per capture_id, in the chat's order. A reused
 * capture keeps its id, so the same id can appear unstamped (an earlier ad-hoc
 * search) and stamped (the research that reused it): the stamped copy wins,
 * else the later one, which also takes the later place in the order.
 */
export function collectSerpCaptures(messages, tabs) {
  const byId = new Map()
  const order = []
  const add = (capture) => {
    if (!capture || typeof capture !== 'object') return
    const id =
      capture.capture_id === undefined || capture.capture_id === null
        ? ''
        : String(capture.capture_id)
    if (!id) {
      order.push(capture)
      return
    }
    const known = byId.get(id)
    if (known && hasPromptId(known) && !hasPromptId(capture)) return
    if (known) order.splice(order.indexOf(id), 1)
    order.push(id)
    byId.set(id, capture)
  }
  for (const m of Array.isArray(messages) ? messages : []) {
    const serps = m && m.research && m.research.serp
    if (serps && typeof serps === 'object') for (const capture of Object.values(serps)) add(capture)
  }
  for (const tab of Array.isArray(tabs) ? tabs : []) if (tab && tab.kind === 'serp') add(tab.data)
  return order.map((entry) => (typeof entry === 'string' ? byId.get(entry) : entry))
}

/** The ranked row's Google cell: "#4", "Not in top 20" or "Not on page 2". */
export function googleText(row) {
  if (row.position) return `#${row.position}`
  const pages = row.pages || []
  if (!pages.length) return ''
  if (row.fromPageOne) return `Not in top ${PAGE_SIZE * pages.length}`
  return pages.length === 1 ? `Not on page ${pages[0]}` : `Not on pages ${andList(pages)}`
}

/** The ranked row's AI Overview cell; '' when page 1 was not read. */
export function aiText(row) {
  const o = row.aiOverview
  if (!o) return ''
  if (!o.shown) return 'Not shown'
  if (!o.contentCaptured) return 'Shown, not read'
  if (o.mentionsYou === true && o.citesYou === true) return 'Names you · cites you'
  if (o.mentionsYou === true) return 'Names you'
  if (o.citesYou === true) return 'Cites you'
  return 'Shown, not named'
}

function compareRows(a, b) {
  const pa = a.position === null ? Infinity : a.position
  const pb = b.position === null ? Infinity : b.position
  return (
    (pa === pb ? 0 : pa - pb) ||
    b.aiTier - a.aiTier ||
    a.keyword.localeCompare(b.keyword, 'en', { sensitivity: 'base' }) ||
    (a.promptId < b.promptId ? -1 : a.promptId > b.promptId ? 1 : 0)
  )
}

/**
 * `{rows, byPromptId}`: one row per tracked prompt searched in the chat,
 * ranked by your best Google position (null last). Equal positions break on
 * the AI Overview naming you, then citing you (never blended into the
 * position), then the keyword, then the prompt id. Per prompt, only the
 * searches from the country of its latest search (the last in `captures`, the
 * chat's order) count, as a prompt re-tracked for another country is another
 * search; of those, the newest capture of each page. An errored capture or
 * one without results never counts, so it cannot hide a good earlier page.
 * Brand and competitor names come from every capture of the prompt.
 */
export function rankChatKeywords(captures) {
  const groups = new Map()
  for (const capture of Array.isArray(captures) ? captures : []) {
    if (!capture || typeof capture !== 'object' || !hasPromptId(capture)) continue
    if (capture.error || !Array.isArray(capture.results)) continue
    if (!groups.has(capture.prompt_id)) groups.set(capture.prompt_id, [])
    groups.get(capture.prompt_id).push(capture)
  }
  const rows = []
  for (const [promptId, all] of groups) {
    const where = locationOf(latestOf(all))
    const list = all.filter((capture) => locationOf(capture) === where)
    const perPage = new Map()
    for (const capture of list) {
      const page = pageOf(capture)
      const known = perPage.get(page)
      if (!known || timeOf(capture) >= timeOf(known)) perPage.set(page, capture)
    }
    const pages = [...perPage.keys()].sort((a, b) => a - b)
    const chosen = pages.map((page) => perPage.get(page))
    const positions = chosen.flatMap(positionsOf)
    const newest = newestOf(chosen)
    const keyword = captureTerms(newest).keyword
    if (!keyword) continue
    const aiOverview = perPage.has(1) ? overviewOf(perPage.get(1)) : null
    const terms = all.map(captureTerms)
    const row = {
      promptId,
      brandPromptId:
        typeof newest.brand_prompt_id === 'string' && newest.brand_prompt_id
          ? newest.brand_prompt_id
          : null,
      promptKey:
        typeof newest.prompt_key === 'string' && newest.prompt_key ? newest.prompt_key : null,
      keyword,
      location: typeof newest.location === 'string' ? newest.location : '',
      position: positions.length ? Math.min(...positions) : null,
      pages,
      fromPageOne: pages.every((page, i) => page === i + 1),
      aiOverview,
      aiTier: aiOverview
        ? (aiOverview.mentionsYou === true ? 2 : 0) + (aiOverview.citesYou === true ? 1 : 0)
        : 0,
      captures: chosen.map((capture) => ({
        page: pageOf(capture),
        captureId: String(capture.capture_id || ''),
        tabId: capture.capture_id ? `serp:${capture.capture_id}` : null,
        capturedAt: capture.captured_at || null,
      })),
      capturedAt: newest.captured_at || null,
      brand: uniqueNames(terms.flatMap((t) => t.brand)),
      competitors: uniqueNames(terms.flatMap((t) => t.competitors)),
    }
    row.googleText = googleText(row)
    row.aiText = aiText(row)
    rows.push(row)
  }
  rows.sort(compareRows)
  return { rows, byPromptId: Object.fromEntries(rows.map((row) => [row.promptId, row])) }
}
