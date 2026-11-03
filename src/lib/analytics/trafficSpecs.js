// Chart specs (contract 8a), stat tiles and empty states for website
// traffic and AI traffic (contract 4c-4e). Pure functions.
//
// Country codes here are uppercase. A field the source cannot measure is
// null and reads "Not measured by {source}", never 0; a measured zero
// (no AI visits, no crawler requests) is 0.
import { ASSISTANT_SLOT, OPERATOR_SLOT } from '@/lib/charts/palette'
import { periodDays } from './visibilitySpecs'

const integer = new Intl.NumberFormat('en-US')
const CONNECTIONS = { name: 'settings-connections' }

function fit(values, length) {
    const out = []
    for (let i = 0; i < length; i++) {
        const v = values?.[i]
        out.push(typeof v === 'number' && Number.isFinite(v) ? v : null)
    }
    return out
}

// Days before the source started recording are "Not measured", not gaps
// of zero.
function sinceStates(labels, since) {
    return labels.map((day) => (since && String(day) < String(since) ? 'not_measured' : null))
}

function pctDelta(value, label) {
    return typeof value === 'number' ? { value, unit: 'pct', label, goodWhen: 'up' } : null
}

// ── Website traffic ──

/**
 * What the Traffic page (and the Countries page's visitors section) shows
 * instead of numbers: {kind, title, body, action} for an `empty_reason`,
 * or null when there is data.
 */
export function trafficEmpty(payload) {
    const reason = payload?.empty_reason
    if (!reason) return null
    const label = payload?.source_label || 'This source'
    switch (reason) {
        case 'no_source':
            return {
                kind: 'not_connected',
                title: 'No traffic source is connected.',
                body: 'Connect the Cansee pixel, Google Analytics 4 or Cloudflare to see who visits your site and from where.',
                action: { label: 'Connect a source', to: CONNECTIONS },
            }
        case 'not_connected':
            return {
                kind: 'not_connected',
                title: `${label} isn't connected.`,
                body: 'Connect it in Settings, or choose another source above.',
                action: { label: 'Open Connections', to: CONNECTIONS },
            }
        case 'no_data':
            if (payload?.source === 'pixel') {
                return {
                    kind: 'empty',
                    title: "The Cansee pixel hasn't recorded a visit yet.",
                    body: 'Check that the snippet is on every page. Visits appear within a minute.',
                    action: { label: 'Open Connections', to: CONNECTIONS },
                }
            }
            return { kind: 'empty', title: `${label} has no data for this period.`, body: '', action: null }
        case 'source_error':
            return {
                kind: 'error',
                title: `We couldn't reach ${label} just now.`,
                body: 'Try again in a minute.',
                action: { label: 'Try again' },
            }
        default:
            return { kind: 'empty', title: `${label} has no data for this period.`, body: '', action: null }
    }
}

/** The three headline tiles: visitors (users, requests), page views, sessions. */
export function trafficTiles(payload, { period = payload?.period || '30d' } = {}) {
    const o = payload?.overview || {}
    const vs = `vs previous ${periodDays(period)} days`
    const stateText = `Not measured by ${payload?.source_label || 'this source'}`
    const tile = (key, label, value, change) => ({
        key,
        label,
        value: typeof value === 'number' ? value : null,
        kind: 'count',
        stateText,
        delta: typeof value === 'number' ? pctDelta(change, vs) : null,
    })
    return [
        tile('visitors', payload?.metric_label || 'Visitors', o.visitors, o.visitors_change_pct),
        tile('pageviews', 'Page views', o.pageviews, o.pageviews_change_pct),
        tile('sessions', 'Sessions', o.sessions, o.sessions_change_pct),
    ]
}

const PIXEL_SINCE = 'The Cansee pixel started recording on'

/** Visitors (users, requests), page views and sessions per day; one at a time. */
export function trafficSeries(payload) {
    const series = payload?.series || {}
    const labels = [...(series.labels || [])]
    const states = sinceStates(labels, payload?.source === 'pixel' ? payload?.measured_since : null)
    const dataset = (key, label) => ({ key, label, value: 'count', data: fit(series[key], labels.length), states })
    const note = (payload?.notes || []).find((n) => typeof n === 'string' && n.startsWith(PIXEL_SINCE))
    return {
        id: 'traffic.series',
        title: 'Traffic over time',
        subtitle: payload?.source_label ? `Per day, from ${payload.source_label}.` : 'Per day.',
        x: 'time',
        time_unit: 'day',
        value: 'count',
        labels,
        datasets: [
            dataset('visitors', payload?.metric_label || 'Visitors'),
            dataset('pageviews', 'Page views'),
            dataset('sessions', 'Sessions'),
        ],
        pick_one: true,
        type: 'line',
        ...(note ? { footnote: note } : {}),
    }
}

/**
 * Visitors (users, requests) by country. Also the Countries page's
 * "Visitors by country" (its own id, subtitle and footnote).
 */
export function countriesMap(
    payload,
    { id = 'traffic.countries', title = 'Visitors by country', subtitle = '', footnote = null } = {},
) {
    const rows = payload?.countries || []
    const unknown = payload?.countries_unknown
    const unknownNote = typeof unknown === 'number' && unknown > 0 ? `${integer.format(unknown)} without a known country.` : ''
    const foot = footnote === null ? unknownNote : footnote
    return {
        id,
        title,
        ...(subtitle ? { subtitle } : {}),
        x: 'country',
        value: 'count',
        labels: rows.map((r) => String(r.code || '').toUpperCase()),
        datasets: [
            {
                key: 'value',
                label: payload?.metric_label || 'Visitors',
                value: 'count',
                data: rows.map((r) => (typeof r.value === 'number' ? r.value : null)),
            },
        ],
        type: 'map',
        ...(foot ? { footnote: foot } : {}),
    }
}

function referrerName(r) {
    const name = [r.source, r.medium].filter(Boolean).join(' · ') || 'Unknown'
    return r.is_ai ? `${name} (AI)` : name
}

/** Top referrers by sessions; AI assistants marked "(AI)". */
export function referrersSpec(payload) {
    const rows = payload?.referrers || []
    const labels = rows.map((r, i) => `r${i + 1}`)
    return {
        id: 'traffic.referrers',
        title: 'Top referrers',
        subtitle: 'Where sessions came from.',
        x: 'category',
        value: 'count',
        labels,
        label_names: Object.fromEntries(rows.map((r, i) => [labels[i], referrerName(r)])),
        label_header: 'Referrer',
        datasets: [{ key: 'sessions', label: 'Sessions', value: 'count', data: rows.map((r) => r.sessions ?? null) }],
        type: 'hbar',
        representations: ['hbar'],
    }
}

/** Top pages by views (Cloudflare: by requests). */
export function pagesSpec(payload) {
    const rows = payload?.pages || []
    const cloudflare = payload?.source === 'cloudflare'
    return {
        id: 'traffic.pages',
        title: 'Top pages',
        subtitle: cloudflare ? 'The paths with the most requests.' : 'The pages with the most views.',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => r.path),
        label_header: 'Page',
        datasets: [
            {
                key: 'views',
                label: cloudflare ? 'Requests' : 'Page views',
                value: 'count',
                data: rows.map((r) => r.views ?? null),
            },
        ],
        type: 'hbar',
        representations: ['hbar'],
    }
}

/** Devices as parts of the whole. */
export function devicesSpec(payload) {
    const rows = payload?.devices || []
    return {
        id: 'traffic.devices',
        title: 'Devices',
        subtitle: `${payload?.metric_label || 'Visitors'} by device.`,
        x: 'category',
        value: 'count',
        labels: rows.map((r) => r.name),
        label_header: 'Device',
        datasets: [
            {
                key: 'value',
                label: payload?.metric_label || 'Visitors',
                value: 'count',
                data: rows.map((r) => r.value ?? null),
            },
        ],
        stacked: true,
        type: 'bar',
    }
}

// ── AI traffic: visits from AI assistants ──

export const ASSISTANT_LABELS = Object.freeze({
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    copilot: 'Copilot',
    'meta-ai': 'Meta AI',
    poe: 'Poe',
    you: 'You.com',
})

function assistantLabel(referrals, key) {
    return (referrals?.assistants || []).find((a) => a.key === key)?.label || ASSISTANT_LABELS[key] || key
}

// Assistants without a colour of their own share "Other" when there are
// two or more of them, so two grey series never stand side by side.
function assistantGroups(referrals) {
    const keys = [
        ...(referrals?.assistants || []).map((a) => a.key),
        ...Object.keys(referrals?.series?.by_assistant || {}),
    ].filter((k, i, all) => k && all.indexOf(k) === i)
    const own = keys.filter((k) => ASSISTANT_SLOT[k])
    const rest = keys.filter((k) => !ASSISTANT_SLOT[k])
    const groups = own.map((k) => ({ key: k, label: assistantLabel(referrals, k), members: [k] }))
    if (rest.length === 1) groups.push({ key: rest[0], label: assistantLabel(referrals, rest[0]), members: rest })
    else if (rest.length > 1) groups.push({ key: 'other', label: 'Other assistants', members: rest })
    return groups
}

/**
 * What the AI visits section shows instead of numbers, or null. A measured
 * zero (`ai_sessions: 0`) has its own copy; the tiles still show the zero.
 */
export function referralsEmpty(referrals) {
    if (!referrals) return null
    if (referrals.available === false) {
        switch (referrals.reason) {
            case 'no_data':
                return { kind: 'empty', title: 'No visits recorded in this period.', body: '', action: null }
            case 'source_error':
                return {
                    kind: 'error',
                    title: `We couldn't reach ${referrals.source_label || 'this source'} just now.`,
                    body: '',
                    action: { label: 'Try again' },
                }
            default:
                return {
                    kind: 'not_connected',
                    title: 'No traffic source can show AI visits yet.',
                    body: 'AI visits are counted by the Cansee pixel or Google Analytics 4. Connect one of them.',
                    action: { label: 'Connect a source', to: CONNECTIONS },
                }
        }
    }
    if (referrals.ai_sessions === 0) {
        return {
            kind: 'empty',
            title: 'No visits from AI assistants in this period.',
            body: 'A visit counts as AI-referred when it arrives from ChatGPT, Claude, Gemini, Perplexity, Copilot, Meta AI, Poe or You.com.',
            action: null,
        }
    }
    return null
}

/** AI-referred sessions, their share of all sessions, and the top assistant. */
export function referralTiles(referrals) {
    const r = referrals || {}
    const top = [...(r.assistants || [])].sort((a, b) => (b.sessions || 0) - (a.sessions || 0))[0]
    return [
        {
            key: 'ai_sessions',
            label: 'AI-referred sessions',
            value: typeof r.ai_sessions === 'number' ? r.ai_sessions : null,
            kind: 'count',
            stateText: 'Not measured',
            hint: typeof r.total_sessions === 'number' ? `of ${integer.format(r.total_sessions)} sessions` : '',
        },
        {
            key: 'ai_share',
            label: 'Share of all sessions',
            value: typeof r.ai_share_pct === 'number' ? r.ai_share_pct : null,
            kind: 'percent',
            stateText: 'No sessions',
            hint: '',
        },
        {
            key: 'top_assistant',
            label: 'Top assistant',
            value: top && top.sessions > 0 ? top.label || assistantLabel(r, top.key) : null,
            kind: 'number',
            stateText: 'None yet',
            hint: top && top.sessions > 0 ? `${integer.format(top.sessions)} ${top.sessions === 1 ? 'session' : 'sessions'}` : '',
        },
    ]
}

/** AI-referred sessions per day, stacked by assistant. */
export function aiVisitsSeries(referrals) {
    const series = referrals?.series || {}
    const labels = [...(series.labels || [])]
    const byAssistant = series.by_assistant || {}
    const states = sinceStates(labels, referrals?.source === 'pixel' ? referrals?.measured_since : null)
    return {
        id: 'ai.series',
        title: 'AI visits over time',
        subtitle: 'Sessions that arrived from an AI assistant, per day.',
        x: 'time',
        time_unit: 'day',
        value: 'count',
        labels,
        datasets: assistantGroups(referrals).map((g) => ({
            key: g.key,
            label: g.label,
            entity: g.key === 'other' ? 'other' : `assistant:${g.key}`,
            value: 'count',
            data: labels.map((_, i) => {
                const parts = g.members.map((k) => byAssistant[k]?.[i]).filter((v) => typeof v === 'number')
                return parts.length ? parts.reduce((a, b) => a + b, 0) : null
            }),
            states,
        })),
        stacked: true,
        type: 'stacked_bar',
        representations: ['stacked_bar', 'line', 'area'],
    }
}

/** Sessions by assistant over the period. */
export function byAssistant(referrals) {
    const rows = referrals?.assistants || []
    const groups = assistantGroups({ ...referrals, series: { by_assistant: {} } })
    const sessions = (g) => g.members.reduce((sum, k) => sum + (rows.find((r) => r.key === k)?.sessions || 0), 0)
    const ordered = groups.map((g) => ({ ...g, sessions: sessions(g) })).sort((a, b) => b.sessions - a.sessions)
    return {
        id: 'ai.assistants',
        title: 'By assistant',
        subtitle: 'AI-referred sessions per assistant.',
        x: 'category',
        value: 'count',
        labels: ordered.map((g) => g.key),
        label_names: Object.fromEntries(ordered.map((g) => [g.key, g.label])),
        label_entities: Object.fromEntries(ordered.map((g) => [g.key, g.key === 'other' ? 'other' : `assistant:${g.key}`])),
        label_header: 'Assistant',
        datasets: [{ key: 'sessions', label: 'Sessions', value: 'count', data: ordered.map((g) => g.sessions) }],
        stacked: true,
        type: 'hbar',
    }
}

/** Countries of AI-referred visitors. */
export function aiCountries(referrals) {
    const rows = referrals?.countries || []
    return {
        id: 'ai.countries',
        title: 'Countries of AI visitors',
        subtitle: 'Where AI-referred sessions came from.',
        x: 'country',
        value: 'count',
        labels: rows.map((r) => String(r.code || '').toUpperCase()),
        datasets: [
            { key: 'sessions', label: 'AI-referred sessions', value: 'count', data: rows.map((r) => r.sessions ?? null) },
        ],
        type: 'map',
    }
}

/** The pages AI visitors land on: all sessions, or one assistant's. */
export function landingPages(referrals) {
    const rows = referrals?.landing_pages || []
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r.by_assistant || {})))]
    keys.sort((a, b) => (ASSISTANT_SLOT[a] || 99) - (ASSISTANT_SLOT[b] || 99))
    return {
        id: 'ai.landing',
        title: 'Landing pages from AI',
        subtitle: 'The pages AI-referred sessions start on.',
        x: 'category',
        value: 'count',
        labels: rows.map((r) => r.path),
        label_header: 'Page',
        datasets: [
            { key: 'sessions', label: 'All assistants', value: 'count', data: rows.map((r) => r.sessions ?? null) },
            ...keys.map((k) => ({
                key: k,
                label: assistantLabel(referrals, k),
                entity: `assistant:${k}`,
                value: 'count',
                data: rows.map((r) => r.by_assistant?.[k] ?? 0),
            })),
        ],
        pick_one: true,
        type: 'hbar',
        representations: ['hbar'],
    }
}

// ── AI traffic: crawlers (Cloudflare) ──

export const PURPOSE_LABELS = Object.freeze({
    training: 'Model training',
    search: 'AI search index',
    user: "Fetches for a user's question",
    other: 'Other',
})

/** What the crawlers section shows instead of numbers, or null. */
export function crawlersEmpty(crawlers) {
    if (!crawlers) return null
    if (crawlers.available === false) {
        switch (crawlers.reason) {
            case 'no_cloudflare':
                return {
                    kind: 'not_connected',
                    title: 'Not available: connect Cloudflare.',
                    body: "AI crawlers don't run JavaScript, so the Cansee pixel and Google Analytics never see them. Cloudflare sees every request to your site; connect it to count crawler visits.",
                    action: { label: 'Connect Cloudflare', to: CONNECTIONS },
                }
            case 'plan_unsupported':
                return {
                    kind: 'not_available',
                    title: 'Not available on this Cloudflare plan.',
                    body: "Cloudflare refused the user-agent query for this zone, so crawler requests can't be counted.",
                    action: null,
                }
            case 'source_error':
                return { kind: 'error', title: "We couldn't reach Cloudflare just now.", body: '', action: { label: 'Try again' } }
            case 'disabled':
                return { kind: 'disabled', title: "Cloudflare traffic isn't available on this server.", body: '', action: null }
            default:
                return { kind: 'not_available', title: 'Not available: connect Cloudflare.', body: '', action: null }
        }
    }
    if (crawlers.total_requests === 0) {
        return {
            kind: 'empty',
            title: 'No AI crawler requests in the last 7 days.',
            body: "Counted from Cloudflare's requests for this zone.",
            action: null,
        }
    }
    return null
}

/** The crawler section's source line. */
export function crawlerSourceLine(crawlers) {
    const parts = ['From Cloudflare', `last ${crawlers?.window_days || 7} days`]
    if (crawlers?.sampled) parts.push('sampled')
    parts.push('counted by user agent')
    return parts.join(' · ')
}

/** Crawler requests, crawlers seen, and the top crawler. */
export function crawlerTiles(crawlers) {
    const c = crawlers || {}
    const bots = c.bots || []
    const top = [...bots].sort((a, b) => (b.requests || 0) - (a.requests || 0))[0]
    const days = c.window_days || 7
    return [
        {
            key: 'requests',
            label: 'Crawler requests',
            value: typeof c.total_requests === 'number' ? c.total_requests : null,
            kind: 'count',
            stateText: 'Not measured',
            hint: `last ${days} days`,
        },
        {
            key: 'crawlers',
            label: 'Crawlers seen',
            value: typeof c.total_requests === 'number' ? bots.filter((b) => (b.requests || 0) > 0).length : null,
            kind: 'count',
            stateText: 'Not measured',
            hint: '',
        },
        {
            key: 'top_crawler',
            label: 'Top crawler',
            value: top && top.requests > 0 ? top.name : null,
            kind: 'number',
            stateText: 'None yet',
            hint: top && top.requests > 0 ? top.operator || '' : '',
        },
    ]
}

/** Requests per crawler. The Details view adds operator and purpose. */
export function crawlerBots(crawlers) {
    const bots = [...(crawlers?.bots || [])].sort((a, b) => (b.requests || 0) - (a.requests || 0))
    return {
        id: 'crawlers.bots',
        title: 'Requests by crawler',
        subtitle: 'AI crawler requests to your site in the last 7 days.',
        x: 'category',
        value: 'count',
        labels: bots.map((b) => b.key),
        label_names: Object.fromEntries(bots.map((b) => [b.key, b.operator ? `${b.name} (${b.operator})` : b.name])),
        label_header: 'Crawler',
        datasets: [{ key: 'requests', label: 'Requests', value: 'count', data: bots.map((b) => b.requests ?? null) }],
        type: 'hbar',
        representations: ['hbar', 'custom'],
        custom_label: 'Details',
    }
}

/** Rows of the crawler Details view: name, operator, purpose, requests, share. */
export function crawlerRows(crawlers) {
    return [...(crawlers?.bots || [])]
        .sort((a, b) => (b.requests || 0) - (a.requests || 0))
        .map((b) => ({
            key: b.key,
            name: b.name,
            operator: b.operator || '',
            purpose: PURPOSE_LABELS[b.purpose] || PURPOSE_LABELS.other,
            requests: b.requests ?? null,
            share: typeof b.share_pct === 'number' ? b.share_pct : null,
        }))
}

function operatorKey(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Crawler requests per day, stacked by operator. Operators without a
 * colour of their own are summed as "Other operators".
 */
export function crawlerSeries(crawlers) {
    const series = crawlers?.series || {}
    const labels = [...(series.labels || [])]
    const byBot = series.by_bot || {}
    const botOperator = Object.fromEntries((crawlers?.bots || []).map((b) => [b.key, b.operator || '']))
    const groups = new Map()
    for (const [bot, values] of Object.entries(byBot)) {
        const name = botOperator[bot] || ''
        const key = OPERATOR_SLOT[operatorKey(name)] ? operatorKey(name) : 'other'
        if (!groups.has(key)) groups.set(key, { key, label: key === 'other' ? 'Other operators' : name, rows: [] })
        groups.get(key).rows.push(values)
    }
    const datasets = [...groups.values()]
        .map((g) => {
            const data = labels.map((_, i) => {
                const parts = g.rows.map((r) => r?.[i]).filter((v) => typeof v === 'number')
                return parts.length ? parts.reduce((a, b) => a + b, 0) : null
            })
            const total = data.reduce((a, b) => a + (b || 0), 0)
            return { key: g.key, label: g.label, entity: `operator:${g.key}`, value: 'count', data, total }
        })
        .sort((a, b) => (a.key === 'other') - (b.key === 'other') || b.total - a.total)
        .map(({ total: _total, ...d }) => d)
    return {
        id: 'crawlers.series',
        title: 'Crawler requests per day',
        subtitle: 'By the company that runs the crawler.',
        x: 'time',
        time_unit: 'day',
        value: 'count',
        labels,
        datasets,
        stacked: true,
        type: 'stacked_bar',
        representations: ['stacked_bar', 'line'],
    }
}

/** Why the crawlers came: training, search, user fetches, other. */
export function purposesSpec(crawlers) {
    const rows = crawlers?.purposes || []
    return {
        id: 'crawlers.purposes',
        title: 'Why they crawl',
        subtitle: 'Crawler requests by what the crawler is for.',
        x: 'category',
        value: 'count',
        labels: rows.map((p) => p.key),
        label_names: Object.fromEntries(rows.map((p) => [p.key, p.label || PURPOSE_LABELS[p.key] || p.key])),
        label_header: 'Purpose',
        datasets: [{ key: 'requests', label: 'Requests', value: 'count', data: rows.map((p) => p.requests ?? null) }],
        stacked: true,
        type: 'bar',
    }
}

/** The line under the crawler section: Cloudflare's notes, then the bot-detection caveat. */
export function crawlerFootnotes(crawlers) {
    return [
        ...(crawlers?.notes || []).filter((n) => typeof n === 'string' && n),
        "Verified-bot detection needs Cloudflare Bot Management, so a request that fakes a crawler's name is counted as that crawler.",
    ]
}
