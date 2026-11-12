// The Latest report block's model: the project's newest saved report as a
// cover, as pure functions of the artifact list the Reports page reads
// (GET agent/websites/<id>/artifacts/?kind=report, newest first) and, when
// it loaded, that report's detail (its structured header: template and
// engines). A line shows only when the payload carries it: a report saved
// before headers existed has no template and no engines, and says neither.
import { dayText, headerModel } from '@/lib/agent/reportHeader'

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const str = (v) => (typeof v === 'string' ? v.trim() : '')

export const UNTITLED = 'Untitled report'

function timeOf(iso) {
    const t = typeof iso === 'string' ? Date.parse(iso) : NaN
    return Number.isFinite(t) ? t : null
}

/**
 * The saved reports of a payload, newest first: [{id, title, when (ISO or
 * ''), date ('Nov 8, 2026' or ''), version (Number or null), author}].
 * Rows without an id and artifacts of another kind are dropped. The
 * server's order is kept for rows with equal or missing dates.
 */
export function reportsList(payload) {
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : []
    return rows
        .filter((r) => isObject(r) && r.id !== undefined && r.id !== null && r.id !== '' && (!r.kind || r.kind === 'report'))
        .map((r, order) => {
            const when = timeOf(r.updated_at) !== null ? r.updated_at : timeOf(r.created_at) !== null ? r.created_at : ''
            const version = Number(r.latest_version)
            return {
                id: String(r.id),
                title: str(r.title) || UNTITLED,
                when,
                date: dayText(when),
                version: Number.isInteger(version) && version > 0 ? version : null,
                author: str(r.created_by_name),
                order,
            }
        })
        .sort((a, b) => {
            const ta = timeOf(a.when)
            const tb = timeOf(b.when)
            if (ta !== null && tb !== null && ta !== tb) return tb - ta
            if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1
            return a.order - b.order
        })
        .map(({ order: _order, ...row }) => row)
}

/** How large the cover sets a title, by its length: 'lg' | 'md' | 'sm'. */
export function titleScale(title) {
    const n = str(title).length
    if (n <= 40) return 'lg'
    if (n <= 80) return 'md'
    return 'sm'
}

/** Where a report opens: the Agent's artifact page. Null without a project or a report. */
export function reportLocation(websiteId, id) {
    if (!websiteId || !id) return null
    return { name: 'agent-artifact', params: { websiteId: String(websiteId), artifactId: String(id) } }
}

/** The Reports page, where the report templates are. Null without a project. */
export function reportsLocation(websiteId) {
    return websiteId ? { name: 'agent-reports', params: { websiteId: String(websiteId) } } : null
}

/**
 * The cover of `report` (a reportsList row): {id, title, scale, template,
 * date, version ('v3'), author, engines: [{key, label, status,
 * statusText}], asked: [label], enginesText, captured, to}.
 * `detail` is the report's ArtifactDetail, used only when it is this
 * report's: its header names the template and the engines. Null without
 * a report.
 */
export function coverModel(report, detail = null, websiteId = '') {
    if (!isObject(report) || !report.id) return null
    const own = isObject(detail) && String(detail.id) === report.id ? detail : null
    const data = isObject(own?.data) ? own.data : null
    const header = data ? headerModel(data.header, data.template) : null
    const engines = header ? header.engines : []
    const asked = engines.filter((e) => e.status === 'asked').map((e) => e.label)
    let enginesText = ''
    if (asked.length) enginesText = asked.join(', ')
    else if (engines.length) enginesText = 'No AI engine asked'
    const template = header?.template?.name || ''
    const version = report.version ? `v${report.version}` : ''
    return {
        id: report.id,
        title: report.title,
        scale: titleScale(report.title),
        template,
        date: report.date,
        version,
        author: report.author,
        engines,
        asked,
        enginesText,
        captured: header?.captured || '',
        to: reportLocation(websiteId, report.id),
    }
}

/** The reports after the newest, for the expanded view: at most `limit`, each with its `to`. */
export function earlierReports(reports, websiteId = '', limit = 5) {
    const rows = Array.isArray(reports) ? reports.slice(1, 1 + Math.max(0, limit)) : []
    return rows.map((row, i) => ({ ...row, index: String(i + 2).padStart(2, '0'), to: reportLocation(websiteId, row.id) }))
}
