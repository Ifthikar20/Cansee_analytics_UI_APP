// A saved report's structured header (reports-be contract: version
// data.header) as display text, for ReportHeader.vue, the HTML export and
// the Markdown export. Reports saved before the header existed have no
// data.header: headerModel returns null and nothing is shown, so old
// reports stay unlabelled.
//
// Which optional lines a header shows follows the template's
// header_fields: prompts for the deep dive, competitors for the
// comparison, compared for the change log. The server fills those keys
// for every report, so showing them elsewhere would name competitors a
// report never compared.
import { engineMeta } from '@/lib/engines'
import { findTemplate, isReportTemplateKey } from '@/lib/agent/reportTemplates'
import { hostOf } from '@/lib/agent/url'
import { regionName } from '@/components/agent/browser/format'

const DAY_MS = 24 * 60 * 60 * 1000

export const ENGINE_STATUS_TEXT = Object.freeze({
    asked: 'Asked',
    failed: 'Failed',
    not_selected: 'Not selected',
    not_configured: 'Not set up',
    not_asked: 'Not asked',
})

const text = (value) => (typeof value === 'string' ? value.trim() : '')
const list = (value) => (Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : [])

function toDate(iso) {
    if (typeof iso !== 'string' || !iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
}

/** "Nov 8, 2026"; '' for a missing or bad date. */
export function dayText(iso) {
    const date = iso instanceof Date ? iso : toDate(iso)
    if (!date) return ''
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Jul 11, 2026 to Nov 8, 2026 (last 120 days)", from the capture date back. */
export function windowText(capturedAt, days) {
    const n = Number(days)
    if (!Number.isFinite(n) || n <= 0) return ''
    const end = toDate(capturedAt)
    if (!end) return `Last ${n} days`
    const start = new Date(end.getTime() - n * DAY_MS)
    return `${dayText(start)} to ${dayText(end)} (last ${n} days)`
}

function comparedText(compared) {
    if (!compared || typeof compared !== 'object') return ''
    if (compared.kind === 'research_versions') {
        const now = Number(compared.version)
        const before = Number(compared.previous_version)
        if (!Number.isFinite(now) || !Number.isFinite(before)) return ''
        const nowDay = dayText(compared.captured_at)
        const beforeDay = dayText(compared.previous_captured_at)
        const a = nowDay ? `Research v${now} (${nowDay})` : `Research v${now}`
        const b = beforeDay ? `v${before} (${beforeDay})` : `v${before}`
        return `${a} compared with ${b}`
    }
    if (compared.kind === 'engine_checks') {
        const latest = dayText(compared.latest_check_at)
        const previous = dayText(compared.previous_check_at)
        const days = Number(compared.window_days)
        const window = Number.isFinite(days) && days > 0 ? ` (last ${days} days)` : ''
        if (latest && previous) return `Latest engine checks (${latest}) compared with the previous ones (${previous})${window}`
        if (latest) return `Latest engine checks (${latest}); no earlier check to compare${window}`
        return ''
    }
    return ''
}

function extraFields(templateId) {
    if (!isReportTemplateKey(templateId)) return new Set()
    return new Set(findTemplate(templateId).header_fields)
}

/**
 * {template, project, captured, data, engines, locations, prompts,
 * competitors, compared} as display text, or null for a report without a
 * header. `templateId` is data.template (it wins over header.template.id).
 */
export function headerModel(header, templateId = null) {
    if (!header || typeof header !== 'object' || Array.isArray(header)) return null
    const project = header.project && typeof header.project === 'object' ? header.project : {}
    const tplRaw = header.template && typeof header.template === 'object' ? header.template : null
    const id = isReportTemplateKey(templateId) ? templateId : isReportTemplateKey(tplRaw?.id) ? tplRaw.id : null
    const template = id ? { id, name: text(tplRaw?.id === id ? tplRaw?.name : '') || findTemplate(id).name } : null
    const capturedAt = typeof header.captured_at === 'string' ? header.captured_at : null
    const fields = extraFields(id)

    const data = list(header.data)
        .filter((d) => text(d.label))
        .map((d) => {
            const window = windowText(capturedAt, d.window_days)
            return { key: text(d.key), label: text(d.label), text: window ? `${text(d.label)}, ${window}` : text(d.label) }
        })

    const engines = list(header.engines)
        .filter((e) => text(e.key))
        .map((e) => ({
            key: text(e.key),
            label: text(e.label) || engineMeta(e.key).label,
            status: ENGINE_STATUS_TEXT[e.status] ? e.status : 'not_asked',
            statusText: ENGINE_STATUS_TEXT[e.status] || ENGINE_STATUS_TEXT.not_asked,
        }))

    const locations = (Array.isArray(header.locations) ? header.locations : [])
        .map((l) => regionName(String(l || '')))
        .filter(Boolean)

    const prompts = fields.has('prompts')
        ? list(header.prompts)
              .filter((p) => text(p.text))
              .map((p) => ({ text: text(p.text), location: regionName(text(p.location)) }))
        : []
    const competitors = fields.has('competitors')
        ? list(header.competitors)
              .filter((c) => text(c.name) || text(c.domain))
              .map((c) => ({ name: text(c.name) || text(c.domain), domain: text(c.domain) }))
        : []

    const url = text(project.url)
    return {
        template,
        project: { name: text(project.name), url, host: url ? hostOf(url) : '' },
        capturedAt,
        captured: dayText(capturedAt),
        data,
        engines,
        locations,
        prompts,
        competitors,
        compared: fields.has('compared') ? comparedText(header.compared) : '',
    }
}

// Markdown-significant characters in text that came from data.
function md(value) {
    return String(value ?? '').replace(/([\\`*_{}[\]()<>#+!|~])/g, '\\$1')
}

/**
 * The header as Markdown, ahead of the report's own text in the .md
 * export: a bold template line (when there is one), then one bullet per
 * field and a rule. '' for a report without a header.
 */
export function headerMarkdown(header, templateId = null) {
    const m = headerModel(header, templateId)
    if (!m) return ''
    const lines = []
    if (m.template) lines.push(`**Template: ${md(m.template.name)}**`, '')
    if (m.project.name || m.project.url) {
        const name = md(m.project.name || m.project.host)
        lines.push(`- Project: ${m.project.url && m.project.name ? `${name} (${md(m.project.url)})` : name}`)
    }
    if (m.captured) lines.push(`- Captured: ${m.captured}`)
    if (m.data.length) lines.push(`- Data: ${m.data.map((d) => md(d.text)).join('; ')}`)
    if (m.engines.length) lines.push(`- Engines: ${m.engines.map((e) => `${md(e.label)} ${e.statusText.toLowerCase()}`).join(', ')}`)
    if (m.locations.length) lines.push(`- Locations: ${m.locations.map(md).join(', ')}`)
    if (m.prompts.length) lines.push(`- Prompts: ${m.prompts.map((p) => `"${md(p.text)}"`).join(', ')}`)
    if (m.competitors.length) {
        lines.push(
            `- Competitors: ${m.competitors.map((c) => (c.domain && c.domain !== c.name ? `${md(c.name)} (${md(c.domain)})` : md(c.name))).join(', ')}`,
        )
    }
    if (m.compared) lines.push(`- Compared: ${md(m.compared)}`)
    return `${lines.join('\n')}\n\n---\n\n`
}
