// Crawler access (p2_contract.md 5) and Pages (contract 6): stat tiles,
// notices, table rows and chart specs (wave 1 contract 8a). Pure functions.
//
// A value that was not measured is null with its state word (Not audited,
// Unknown, the source's state), never 0; a measured zero is 0.
import { timeAgo } from '@/utils/timeAgo'
import {
    BOT_ROBOTS_SHORT,
    BOT_ROBOTS_WORDS,
    CHECKS,
    ITEM_ERRORS,
    LLMS_STATES,
    ROBOTS_STATES,
    botHomeWord,
    checkLabel,
    itemErrorText,
    sourceStateWord,
} from './insightWords'

const integer = new Intl.NumberFormat('en-US')
const count = (n) => integer.format(Number(n) || 0)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// The three AI search bots of the `ai_search_allowed` check (contract 5a).
export const AI_SEARCH_BOTS = Object.freeze(['oai-searchbot', 'claude-searchbot', 'perplexitybot'])
// The bots compared across home pages, in column order, with their robots.txt tokens.
export const BENCHMARK_BOTS = Object.freeze([
    { key: 'gptbot', token: 'GPTBot' },
    { key: 'oai-searchbot', token: 'OAI-SearchBot' },
    { key: 'claudebot', token: 'ClaudeBot' },
    { key: 'claude-searchbot', token: 'Claude-SearchBot' },
    { key: 'perplexitybot', token: 'PerplexityBot' },
    { key: 'google-extended', token: 'Google-Extended' },
])

function plural(n, one, many) {
    return `${count(n)} ${Number(n) === 1 ? one : many}`
}

/** "/pricing" for a page URL ("/" for the home page); the URL itself when it does not parse. */
export function pathOf(url) {
    try {
        return new URL(url).pathname || '/'
    } catch {
        return String(url || '')
    }
}

function apex(domain) {
    return String(domain || '')
        .toLowerCase()
        .replace(/^www\./, '')
}

// ── Crawler access ──

/**
 * The home page of an audit: the page at "/" (pages come in fetch order,
 * which a parallel audit does not keep), else the first one.
 */
export function homePage(audit) {
    const pages = audit?.pages || []
    return pages.find((p) => pathOf(p.url) === '/') || pages[0] || null
}

/**
 * How many of the three AI search bots may fetch the home page; null when
 * that is unknown (robots.txt could not be fetched) or not audited.
 */
export function searchBotsAllowed(audit) {
    if (!audit) return null
    const bots = audit.bots || []
    const rows = AI_SEARCH_BOTS.map((key) => bots.find((b) => b.key === key))
    if (rows.some((b) => !b || b.home === 'unknown')) return null
    return rows.filter((b) => b.home === 'allowed').length
}

/** The four tiles of Crawler access; before the first audit each reads "Not audited". */
export function crawlerTiles(payload) {
    const you = payload?.you || null
    const summary = you?.summary || {}
    const allowed = searchBotsAllowed(you)
    const unknown = you ? 'Unknown' : 'Not audited'
    return [
        {
            key: 'checks',
            label: 'Checks passed',
            value: you && isNum(summary.passed) && isNum(summary.total) ? `${count(summary.passed)} of ${count(summary.total)}` : null,
            stateText: unknown,
        },
        {
            key: 'search_bots',
            label: 'AI search bots allowed',
            value: allowed === null ? null : `${allowed} of 3`,
            stateText: unknown,
        },
        { key: 'robots', label: 'robots.txt', value: you ? ROBOTS_STATES[you.robots?.state] || null : null, stateText: unknown },
        { key: 'llms', label: 'llms.txt', value: you ? LLMS_STATES[you.llms_txt?.state] || null : null, stateText: unknown },
    ]
}

/** The notices under the tiles (contract 5d): robots.txt and llms.txt states that need a word. */
export function crawlerNotices(you) {
    if (!you) return []
    const out = []
    const robots = you.robots?.state
    const llms = you.llms_txt?.state
    if (robots === 'missing') out.push({ key: 'robots_missing', tone: 'info', text: 'No robots.txt. Crawlers may read every page.' })
    if (robots === 'unreachable') {
        out.push({
            key: 'robots_unreachable',
            tone: 'warning',
            text: "robots.txt didn't respond. Crawlers that follow the standard treat your whole site as blocked until it does.",
        })
    }
    if (llms === 'missing') {
        out.push({ key: 'llms_missing', tone: 'info', text: 'No llms.txt. It is an optional file that points AI tools to your most useful pages.' })
    }
    if (llms === 'invalid') {
        out.push({ key: 'llms_invalid', tone: 'warning', text: 'llms.txt has no title line (# Name), the one required part.' })
    }
    return out
}

/** The llms.txt panel line when the file was found, else ''. */
export function llmsLine(llms) {
    if (llms?.state !== 'found') return ''
    const full = LLMS_STATES[llms.full] || LLMS_STATES.failed
    return `llms.txt: "${llms.title || ''}", ${plural(llms.sections, 'section', 'sections')}, ${plural(llms.links, 'link', 'links')}. llms-full.txt: ${full}.`
}

/**
 * The bots table: catalog bots grouped by operator, each with what the
 * project's robots.txt says about it.
 * -> [{ operator, rows: [{ key, token, purpose, rule, home, blocked, follows, followsNote }] }]
 */
export function botGroups(payload) {
    const you = payload?.you || null
    const access = you?.bots || []
    const pages = isNum(you?.summary?.pages) ? you.summary.pages : (you?.pages || []).length
    const noRobots = you?.robots?.state === 'missing'
    const groups = []
    for (const bot of payload?.bots || []) {
        const seen = access.find((b) => b.key === bot.key) || null
        let rule = 'Not audited'
        if (you) {
            if (noRobots) rule = 'No robots.txt'
            else if (seen?.rule) rule = seen.group ? `${seen.rule} from group ${seen.group}` : seen.rule
            else rule = 'No rule'
        }
        const row = {
            key: bot.key,
            token: bot.token,
            purpose: bot.purpose_label || '',
            rule,
            home: you ? botHomeWord(seen?.home, bot.robots) : 'Not audited',
            homeState: seen?.home || null,
            blocked: !you ? 'Not audited' : isNum(seen?.pages_blocked) ? `${count(seen.pages_blocked)} of ${count(pages)}` : 'Unknown',
            follows: BOT_ROBOTS_SHORT[bot.robots] || BOT_ROBOTS_SHORT.unknown,
            followsNote: BOT_ROBOTS_WORDS[bot.robots] || BOT_ROBOTS_WORDS.unknown,
        }
        let group = groups.find((g) => g.operator === bot.operator)
        if (!group) {
            group = { operator: bot.operator || '', rows: [] }
            groups.push(group)
        }
        group.rows.push(row)
    }
    return groups
}

/** `crawler.checks`: pages passing and failing each check over the audited pages. */
export function checksSpec(you, catalog = null) {
    const keys = Array.isArray(catalog) && catalog.length ? catalog.map((c) => c.key) : Object.keys(CHECKS)
    const byCheck = you?.summary?.by_check || {}
    const value = (key, part) => (isNum(byCheck[key]?.[part]) ? byCheck[key][part] : null)
    const states = keys.map((key) => (byCheck[key] ? null : 'not_checked'))
    return {
        id: 'crawler.checks',
        title: 'Pages passing each check',
        x: 'category',
        value: 'count',
        labels: keys,
        label_names: Object.fromEntries(keys.map((key) => [key, checkLabel(key, catalog)])),
        label_header: 'Check',
        datasets: [
            { key: 'passed', label: 'Passed', entity: 'status:good', value: 'count', data: keys.map((k) => value(k, 'passed')), states },
            { key: 'failed', label: 'Failed', entity: 'status:critical', value: 'count', data: keys.map((k) => value(k, 'failed')), states },
        ],
        stacked: true,
        type: 'stacked_bar',
        footnote: "Pages that didn't load are left out of the other checks.",
    }
}

/**
 * The audited pages, fewest checks passed first.
 * -> [{ url, path, status, words, needsJs, checks, failing: [{key, label}], failedLabels, blockedFor, error }]
 */
export function pageAuditRows(you, { checks = null, bots = [] } = {}) {
    const names = Object.fromEntries((bots || []).map((b) => [b.key, b.token]))
    return (you?.pages || [])
        .map((p) => {
            const failing = Object.entries(p.checks || {})
                .filter(([, ok]) => ok === false)
                .map(([key]) => ({ key, label: checkLabel(key, checks) }))
            const error = p.error ? itemErrorText(p.error, ITEM_ERRORS.fetch_failed) : ''
            return {
                url: p.url,
                path: pathOf(p.url),
                status: isNum(p.status_code) ? String(p.status_code) : error || 'Not checked',
                words: isNum(p.words) ? count(p.words) : 'Not checked',
                wordsText: isNum(p.words) ? `${count(p.words)} words readable without JavaScript` : '',
                needsJs: p.checks?.text_without_js === false,
                checks: isNum(p.passed) && isNum(p.total) ? `${p.passed} of ${p.total}` : 'Not checked',
                passed: isNum(p.passed) ? p.passed : -1,
                failing,
                failedLabels: failing.map((f) => f.label),
                blockedFor: (p.blocked_bots || []).map((key) => names[key] || key),
                error,
            }
        })
        .sort((a, b) => a.passed - b.passed)
}

/**
 * The brands of the benchmark: you, then the competitors the project
 * tracks (`tracked`, from the audit's run options, in stored order), each
 * with its latest home-page audit found by apex domain (null when never
 * audited). Without the tracked list, the audited competitors.
 */
export function benchmarkBrands(payload, tracked = []) {
    const you = payload?.you || null
    const audits = payload?.competitors || []
    const brands = [{ key: 'you', name: you?.name || '', domain: you?.domain || '', audit: you }]
    const list = tracked?.length ? tracked : audits.map((a) => ({ key: a.brand_key, name: a.name, domain: a.domain }))
    for (const c of list) {
        const audit = audits.find((a) => apex(a.domain) === apex(c.domain)) || null
        brands.push({ key: c.key, name: c.name || c.domain, domain: c.domain, audit })
    }
    return brands
}

/** `crawler.benchmark`: home-page checks passed and AI search bots allowed, by brand. */
export function benchmarkSpec(brands) {
    const list = brands || []
    const checks = list.map((b) => homePage(b.audit)?.passed)
    const bots = list.map((b) => searchBotsAllowed(b.audit))
    return {
        id: 'crawler.benchmark',
        title: 'Home pages compared',
        x: 'category',
        value: 'count',
        labels: list.map((b) => b.key),
        label_names: Object.fromEntries(list.map((b) => [b.key, b.name || b.domain || b.key])),
        label_header: 'Brand',
        datasets: [
            {
                key: 'checks',
                label: 'Checks passed',
                value: 'count',
                data: checks.map((v) => (isNum(v) ? v : null)),
                states: list.map((b, i) => (!b.audit ? 'not_checked' : isNum(checks[i]) ? null : 'not_measured')),
            },
            {
                key: 'search_bots',
                label: 'AI search bots allowed',
                value: 'count',
                data: bots.map((v) => (isNum(v) ? v : null)),
                states: list.map((b, i) => (!b.audit ? 'not_checked' : isNum(bots[i]) ? null : 'not_measured')),
            },
        ],
        pick_one: true,
        type: 'bar',
        state_labels: { not_checked: 'Not audited' },
    }
}

/** Rows of the benchmark table: robots.txt, llms.txt, each compared bot and the home page checks. */
export function benchmarkRows(brands, catalog = []) {
    const follows = Object.fromEntries((catalog || []).map((b) => [b.key, b.robots]))
    return (brands || []).map((b) => {
        const audit = b.audit
        const home = homePage(audit)
        const bots = Object.fromEntries(
            BENCHMARK_BOTS.map(({ key }) => {
                if (!audit) return [key, 'Not audited']
                const seen = (audit.bots || []).find((x) => x.key === key)
                return [key, botHomeWord(seen?.home, follows[key])]
            }),
        )
        return {
            key: b.key,
            name: b.name || b.domain,
            robots: audit ? ROBOTS_STATES[audit.robots?.state] || 'Unknown' : 'Not audited',
            llms: audit ? LLMS_STATES[audit.llms_txt?.state] || 'Unknown' : 'Not audited',
            bots,
            checks: !audit ? 'Not audited' : isNum(home?.passed) && isNum(home?.total) ? `${home.passed} of ${home.total}` : 'Unknown',
        }
    })
}

// ── Pages ──

export const PAGE_FILTERS = Object.freeze([
    { value: 'all', label: 'All pages' },
    { value: 'cited', label: 'Cited by AI' },
    { value: 'retrieved_not_cited', label: 'Retrieved but never cited' },
    { value: 'ranking', label: 'Ranking on Google' },
    { value: 'ai_visits', label: 'Visited from AI' },
    { value: 'crawled', label: 'Crawled by AI bots' },
    { value: 'failing_checks', label: 'Failing checks' },
])

export const PAGES_FOOTNOTE =
    "Crawler requests are Cloudflare's sampled counts for the most crawled paths it reports each day (top 50 over the last 7 days). Retrieved but never cited: an engine fetched the page while answering, but its answer text didn't point to it."

const on = (source) => source?.state === 'ok'

/** The source chips of the Pages tab. */
export function pagesSourceStates(payload) {
    const s = payload?.sources || {}
    const word = (source) => sourceStateWord(source?.state)
    return [
        { key: 'google', label: 'Google rankings', word: word(s.google), ok: on(s.google) },
        { key: 'citations', label: 'AI citations', word: word(s.citations), ok: on(s.citations) },
        {
            key: 'ai_visits',
            label: 'AI visits',
            word: on(s.ai_visits) ? s.ai_visits.source_label || word(s.ai_visits) : word(s.ai_visits),
            ok: on(s.ai_visits),
        },
        { key: 'crawlers', label: 'AI crawlers', word: word(s.crawlers), ok: on(s.crawlers) },
        {
            key: 'audit',
            label: 'Audit',
            word: on(s.audit) ? timeAgo(s.audit.audited_at) || word(s.audit) : word(s.audit),
            ok: on(s.audit),
        },
    ]
}

/** The five tiles of Pages; a total whose source is not on reads that source's state. */
export function pagesTiles(payload) {
    const t = payload?.totals || {}
    const s = payload?.sources || {}
    const tile = (key, label, source) => ({
        key,
        label,
        value: isNum(t[key]) ? t[key] : null,
        kind: 'count',
        stateText: source ? sourceStateWord(source.state) : 'Not measured',
    })
    return [
        tile('pages', 'Pages seen', null),
        tile('ranking', 'Ranking on Google', s.google),
        tile('cited', 'Cited by AI', s.citations),
        tile('ai_visits', 'Visited from AI', s.ai_visits),
        tile('crawled', 'Crawled by AI bots', s.crawlers),
    ]
}

// A signal whose source is not on: the chart state of that source.
function offState(source) {
    switch (source?.state) {
        case 'not_configured':
            return 'not_configured'
        case 'no_checks':
            return 'not_checked'
        case 'no_source':
        case 'not_connected':
        case 'no_cloudflare':
            return 'not_connected'
        default:
            return 'not_measured'
    }
}

/** `pages.top`: the first 15 pages, one signal at a time. */
export function pagesTopSpec(payload) {
    const rows = (payload?.pages || []).slice(0, 15)
    const s = payload?.sources || {}
    const series = (key, label, value, source, read) => ({
        key,
        label,
        value,
        data: rows.map((r) => read(r).value),
        states: rows.map((r) => (on(source) ? read(r).state : offState(source))),
    })
    return {
        id: 'pages.top',
        title: 'Pages by signal',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => r.url),
        label_names: Object.fromEntries(rows.map((r) => [r.url, r.path || pathOf(r.url)])),
        label_header: 'Page',
        datasets: [
            series('citations', 'AI citations', 'count', s.citations, (r) => ({ value: r.citations ? r.citations.citations ?? null : null, state: null })),
            series('ai_visits', 'AI visits', 'count', s.ai_visits, (r) => ({ value: r.ai_visits ? r.ai_visits.sessions ?? null : null, state: null })),
            series('crawler_requests', 'Crawler requests', 'count', s.crawlers, (r) => {
                const requests = r.crawler_requests?.requests
                // Only the top 50 crawled paths are known.
                return isNum(requests) ? { value: requests, state: null } : { value: null, state: 'not_measured' }
            }),
            series('google', 'Best Google position', 'rank', s.google, (r) => {
                const best = r.google?.best_position
                return isNum(best) ? { value: best, state: null } : { value: null, state: 'not_found' }
            }),
        ].map((d) => ({ ...d, states: d.states.map((st, i) => (isNum(d.data[i]) ? null : st || 'not_measured')) })),
        pick_one: true,
        type: 'hbar',
        state_labels: { not_found: 'Not ranking' },
    }
}

/** Rows of the pages table, each cell in words. */
export function sitePageRows(payload) {
    const s = payload?.sources || {}
    return (payload?.pages || []).map((r) => {
        const google = !on(s.google)
            ? { text: sourceStateWord(s.google?.state) }
            : isNum(r.google?.best_position)
              ? { text: `#${count(r.google.best_position)}`, sub: plural((r.google.prompts || []).length, 'prompt', 'prompts') }
              : { text: 'Not ranking' }
        const c = r.citations
        const citations = !on(s.citations)
            ? { text: sourceStateWord(s.citations?.state) }
            : {
                  text: count(c?.citations),
                  sub: `${count(c?.cited_in_text)} in answer text`,
                  retrievedOnly: (c?.citations || 0) > 0 && c?.cited_in_text === 0,
              }
        const visits = !on(s.ai_visits) ? sourceStateWord(s.ai_visits?.state) : count(r.ai_visits?.sessions)
        const requests = r.crawler_requests?.requests
        const crawler = !on(s.crawlers) ? sourceStateWord(s.crawlers?.state) : isNum(requests) ? count(requests) : 'Not in the top 50'
        const a = r.audit
        const audit = !on(s.audit)
            ? { text: 'Not run', failing: [] }
            : isNum(a?.passed) && isNum(a?.total)
              ? { text: `${a.passed} of ${a.total}`, failing: (a.failed || []).map((key) => checkLabel(key)) }
              : { text: 'Not audited', failing: [] }
        return { url: r.url, path: r.path || pathOf(r.url), signals: r.signals ?? 0, google, citations, visits, crawler, audit }
    })
}

/** The page's empty state for this payload and filter, or null when there are pages. */
export function pagesEmpty(payload, filter = 'all') {
    if ((payload?.pages || []).length) return null
    if (filter && filter !== 'all') return { kind: 'empty', title: 'No pages match this filter.', action: { label: 'Show all pages' }, reset: true }
    return {
        kind: 'empty',
        title: 'No pages seen yet.',
        body: 'Pages appear when Google ranks them for your prompts, an engine cites them, an AI assistant sends a visit, a crawler fetches them, or an audit reads them.',
        action: { label: 'Run audit' },
        audit: true,
    }
}
