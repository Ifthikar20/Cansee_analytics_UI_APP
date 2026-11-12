// The Visibility score block (board key "visibility-score"): the share of
// the last 30 days' AI answers that name the brand, as one number, over a
// line of the same share bucket by bucket. Reads the visibility dashboard
// payload: `headline.visibility_pct` (and `visibility_prev_pct`), and
// `visibility.all.visibility_pct` along `window.buckets`. The number is the
// one the AI visibility card shows; nothing is derived beyond it. Pure.
import { formatDelta, formatValue } from '@/lib/charts/format'
import { periodDays } from '@/lib/analytics/visibilitySpecs'
import { num, text } from './words'

const round1 = (v) => Math.round(v * 10) / 10

/**
 * The big figure: {value, figure, unit, exact} or null when the share was
 * not measured. `figure` is at most three characters wide ("34", "100",
 * "9.5"): whole from 10 up, one decimal below. `exact` is the share as
 * every other card prints it ("34%", "9.5%"). The payload gives a percent,
 * so the unit is "%".
 */
export function scoreFigure(payload) {
    const value = num(payload?.headline?.visibility_pct)
    if (value === null) return null
    const tenth = round1(value)
    const figure = Math.abs(tenth) >= 10 || Number.isInteger(tenth) ? String(Math.round(value)) : tenth.toFixed(1)
    return { value, figure, unit: '%', exact: formatValue(value, { value: 'percent' }) }
}

/** The window in words: "Last 30 days". */
export function scoreWindow(payload) {
    return `Last ${periodDays(payload?.window?.period)} days`
}

/**
 * The change against the window before: {value, direction, text, label}
 * or null when either share is unknown. `text` is "+4.1 pts".
 */
export function scoreChange(payload) {
    const now = num(payload?.headline?.visibility_pct)
    const before = num(payload?.headline?.visibility_prev_pct)
    if (now === null || before === null) return null
    // A fall too small to show is no change (and never a negative zero).
    const value = round1(now - before) || 0
    return {
        value,
        direction: value > 0 ? 'up' : value < 0 ? 'down' : 'flat',
        text: formatDelta(value, 'pts'),
        label: `vs previous ${periodDays(payload?.window?.period)} days`,
    }
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

/** A bucket's date as an axis label: "Oct 06" (UTC); '' when unusable. */
export function bucketLabel(iso) {
    const raw = text(String(iso ?? ''))
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw)
    if (!raw || Number.isNaN(date.getTime())) return ''
    return `${MONTH.format(date)} ${String(date.getUTCDate()).padStart(2, '0')}`
}

const coord = (v) => Math.round(v * 100) / 100

/**
 * The line under the figure, in a 100 by 100 box (x left to right, y 0 at
 * the top, the bottom edge is 0%):
 * {points, lines, singles, end, from, to, low, high, top}.
 * `points` are the measured buckets [{x, y, value, label}]; a bucket with
 * no answers is a gap, never a zero. `lines` are SVG paths, one per run of
 * neighbouring measured buckets; `singles` the measured buckets with no
 * measured neighbour (the last point excepted: it is `end`, the dot the
 * line ends in). `from` and `to` label the window's first and last bucket.
 * Null when no bucket was measured.
 */
export function scoreLine(payload) {
    const buckets = Array.isArray(payload?.window?.buckets) ? payload.window.buckets : []
    const values = payload?.visibility?.all?.visibility_pct
    const series = buckets.map((iso, i) => num(Array.isArray(values) ? values[i] : null))
    const measured = series.filter((v) => v !== null)
    if (!measured.length) return null
    const high = Math.max(...measured)
    const low = Math.min(...measured)
    const top = high > 0 ? high : 1
    const last = buckets.length - 1
    const at = (i) => ({
        x: coord(last > 0 ? (i / last) * 100 : 100),
        y: coord(100 - (Math.max(0, series[i]) / top) * 100),
        value: series[i],
        label: bucketLabel(buckets[i]),
    })
    const runs = []
    let run = []
    series.forEach((value, i) => {
        if (value === null) {
            if (run.length) runs.push(run)
            run = []
        } else run.push(at(i))
    })
    if (run.length) runs.push(run)
    const points = runs.flat()
    const end = points.at(-1)
    return {
        points,
        lines: runs.filter((r) => r.length > 1).map((r) => r.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')),
        singles: runs.filter((r) => r.length === 1 && r[0] !== end).map((r) => r[0]),
        end,
        from: bucketLabel(buckets[0]),
        to: bucketLabel(buckets[last]),
        low,
        high,
        top,
    }
}

const percent = (v) => formatValue(v, { value: 'percent' })

/** The figure, its change and the line as sentences, for screen readers. */
export function scoreSentence(payload) {
    const figure = scoreFigure(payload)
    if (!figure) return ''
    const window = scoreWindow(payload).toLowerCase()
    const change = scoreChange(payload)
    const parts = [`AI named you in ${figure.exact} of answers over the ${window}`]
    if (change) {
        const points = `${formatValue(Math.abs(change.value), { value: 'number' })} ${Math.abs(change.value) === 1 ? 'point' : 'points'}`
        parts[0] += change.direction === 'flat' ? ', the same as the period before' : `, ${change.direction} ${points} on the period before`
    }
    parts[0] += '.'
    const line = scoreLine(payload)
    if (line) {
        const { end, points } = line
        if (points.length === 1) parts.push(`One reading so far: ${percent(end.value)}${end.label ? ` on ${end.label}` : ''}.`)
        else parts.push(`Between ${line.from} and ${line.to} it ranged from ${percent(line.low)} to ${percent(line.high)}; the latest reading is ${percent(end.value)}${end.label ? ` on ${end.label}` : ''}.`)
    }
    return parts.join(' ')
}
