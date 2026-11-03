// Validation for `chart` parts ({spec:{type, title, labels, datasets, unit}}).
// The backend validates show_chart input with the same rules; this is the
// render-boundary copy, so a malformed spec renders nothing rather than
// a broken canvas. Rules: types bar, line or doughnut (otherwise bar); at
// most 12 labels and 3 datasets; values numeric or null; title at most
// 120 characters, unit at most 8.

export const CHART_TYPES = Object.freeze(['bar', 'line', 'doughnut'])
export const MAX_LABELS = 12
export const MAX_DATASETS = 3
export const MAX_TITLE = 120
export const MAX_UNIT = 8

function toValue(n) {
    if (n === null || n === undefined || n === '' || typeof n === 'boolean') return null
    const v = typeof n === 'number' ? n : Number(n)
    return Number.isFinite(v) ? v : null
}

/** Normalise a spec object. Returns null when nothing plottable remains. */
export function normalizeChartSpec(spec) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null

    const type = CHART_TYPES.includes(spec.type) ? spec.type : 'bar'
    const labels = Array.isArray(spec.labels)
        ? spec.labels.slice(0, MAX_LABELS).map((l) => String(l ?? ''))
        : []
    if (!labels.length) return null

    const datasets = (Array.isArray(spec.datasets) ? spec.datasets : [])
        .slice(0, MAX_DATASETS)
        .map((d) => ({
            label: String(d?.label ?? ''),
            data: labels.map((_, i) => toValue(Array.isArray(d?.data) ? d.data[i] : null)),
        }))
        .filter((d) => d.data.some((n) => n !== null))
    if (!datasets.length) return null

    return {
        type,
        title: typeof spec.title === 'string' ? spec.title.slice(0, MAX_TITLE) : '',
        unit: typeof spec.unit === 'string' ? spec.unit.slice(0, MAX_UNIT) : '',
        labels,
        datasets,
    }
}

/** Accept a spec object or its JSON text. */
export function parseChartSpec(raw) {
    if (typeof raw === 'string') {
        try {
            return normalizeChartSpec(JSON.parse(raw))
        } catch {
            return null
        }
    }
    return normalizeChartSpec(raw)
}

/** Format one value with the spec's unit ("42%", "1,204 visits"). */
export function formatChartValue(value, unit = '') {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'No data'
    const text = Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
    if (!unit) return text
    return unit === '%' ? `${text}%` : `${text} ${unit}`
}
