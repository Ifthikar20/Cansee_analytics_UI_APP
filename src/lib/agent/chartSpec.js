// Validation for `chart` parts ({spec:{type, title, labels, datasets, unit}}).
// The backend validates show_chart input with the same rules; this is the
// render-boundary copy, so a malformed spec renders nothing rather than
// a broken canvas. Rules: types bar, line or doughnut, plus area,
// stacked_bar, heatmap and table for forward compatibility (anything else
// is bar); at most 12 labels and 3 datasets; values numeric or null; title
// at most 120 characters, unit at most 8.
//
// toVizSpec() turns a part into a ChartSpec for the shared VizChart
// (lib/charts/spec.js), so the agent's charts switch representation and
// read as a table like every other chart in the app.

export const CHART_TYPES = Object.freeze(['bar', 'line', 'doughnut', 'area', 'stacked_bar', 'heatmap', 'table'])
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

// The representations each part type offers (contract 8d); `table` is
// always last. A representation that cannot draw the data (a donut with
// more than one series, say) is dropped by the chart and the next one
// becomes the default.
const OFFERED = {
    bar: (n) => (n > 1 ? ['bar', 'heatmap', 'table'] : ['bar', 'table']),
    line: () => ['line', 'area', 'bar', 'table'],
    doughnut: () => ['doughnut', 'bar', 'table'],
    area: () => ['line', 'area', 'bar', 'table'],
    stacked_bar: (n) => (n > 1 ? ['bar', 'stacked_bar', 'heatmap', 'table'] : ['bar', 'table']),
    heatmap: () => ['heatmap', 'bar', 'table'],
    table: () => ['bar', 'table'],
}

// One series with long or many labels reads better as horizontal bars.
function longLabels(chart) {
    return chart.labels.length > 8 || chart.labels.some((l) => l.length > 14)
}

/**
 * A `chart` part as a ChartSpec (lib/charts/spec.js), or null when the
 * part has nothing to plot. Percent when the unit is "%", else a number
 * with the unit; datasets keyed s1..s3.
 */
export function toVizSpec(spec) {
    const chart = normalizeChartSpec(spec)
    if (!chart) return null
    const n = chart.datasets.length
    const horizontal = n === 1 && longLabels(chart)
    const swap = (rep) => (horizontal && rep === 'bar' ? 'hbar' : rep)
    const percent = chart.unit === '%'
    return {
        title: chart.title,
        x: 'category',
        value: percent ? 'percent' : 'number',
        unit: percent ? '' : chart.unit,
        labels: chart.labels,
        datasets: chart.datasets.map((d, i) => ({
            key: `s${i + 1}`,
            label: d.label || `Series ${i + 1}`,
            data: d.data,
        })),
        type: swap(chart.type),
        representations: OFFERED[chart.type](n).map(swap),
        stacked: chart.type === 'stacked_bar' || chart.type === 'doughnut',
    }
}
