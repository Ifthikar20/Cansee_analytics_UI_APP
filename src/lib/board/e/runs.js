// The Prompt runs block's model, as pure functions of the runs block the
// server already sends (GET agent/status/ prompt_runs, else the session's
// limits.prompt_runs; lib/promptRuns.js names its fields). Nothing here
// fetches and nothing invents a value: a figure shows only when the block
// carries it. Free accounts read runs, never dollars; this block has no
// dollar amount for anyone.
import { engineMeta } from '@/lib/engines'
import { normalizeRuns, renewDate, renewSentence, runsLeftText, runsUsedText } from '@/lib/promptRuns'

// The most marks the allowance bar draws; a larger allowance is scaled.
export const MAX_SEGMENTS = 24

export const RUN_NOTE = 'One prompt run is one prompt answered by one AI engine, shared by all your projects.'
export const OUT_NOTE = 'The AI engines are asked again once the runs renew. Google results still work.'

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/**
 * Where the runs block comes from and whether it is current:
 * {phase: 'ready' | 'loading' | 'failed' | 'none', raw, stale}. The agent
 * status' block wins (the store reloads it when a run ends); the session's
 * is the fallback. `failed` is a status request that failed: numbers kept
 * from before it are stale. `asked` says the status was requested at all.
 */
export function runsSource({ status = null, loading = false, failed = false, asked = true, session = null } = {}) {
    const own = isObject(status) && normalizeRuns(status.prompt_runs) ? status.prompt_runs : null
    const raw = own || (normalizeRuns(session) ? session : null)
    if (raw) return { phase: 'ready', raw, stale: Boolean(failed) }
    if (loading) return { phase: 'loading', raw: null, stale: false }
    if (failed) return { phase: 'failed', raw: null, stale: false }
    return { phase: isObject(status) || asked ? 'none' : 'loading', raw: null, stale: false }
}

/**
 * The runs each engine answered this period, most first (ties by name):
 * [{key, label, count, text}]. Engines with nothing counted are left out.
 */
export function runsByEngine(byEngine) {
    if (!isObject(byEngine)) return []
    return Object.entries(byEngine)
        .map(([key, n]) => ({ key, label: engineMeta(key).label, count: Number(n) }))
        .filter((row) => Number.isFinite(row.count) && row.count > 0)
        .map((row) => ({ ...row, count: Math.floor(row.count) }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((row) => ({ ...row, text: row.count.toLocaleString('en-US') }))
}

/**
 * The allowance as marks, spent first: [{state: 'used' | 'out' | 'left',
 * next}]. 'out' are the runs out right now (reserved); `next` is the first
 * run still left, the one the next answer spends. One mark is one run up to
 * MAX_SEGMENTS; a larger allowance is scaled, and then a mark never claims
 * runs that are not there: something left always shows a mark, and
 * anything spent always shows one too. [] without a limit.
 */
export function runSegments(block) {
    if (!block || block.unlimited || !block.limit) return []
    const limit = block.limit
    const left = Math.min(limit, Math.max(0, block.remaining))
    const spent = limit - left
    const out = Math.min(spent, Math.max(0, block.reserved || 0))
    const n = Math.min(limit, MAX_SEGMENTS)
    let leftN = left
    let outN = out
    if (n !== limit) {
        leftN = Math.round((left / limit) * n)
        if (left > 0) leftN = Math.max(1, leftN)
        if (spent > 0) leftN = Math.min(n - 1, leftN)
        outN = out > 0 ? Math.min(n - leftN, Math.max(1, Math.round((out / limit) * n))) : 0
    }
    const usedN = n - leftN - outN
    const marks = []
    for (let i = 0; i < n; i += 1) {
        const state = i < usedN ? 'used' : i < usedN + outN ? 'out' : 'left'
        marks.push({ state, next: state === 'left' && i === usedN + outN })
    }
    return marks
}

/**
 * What the block shows, or null for a missing or unreadable runs block.
 *
 * Free (metered): {mode: 'free', numeral (runs left), unit ('/ 20'), cap, label,
 * segments, perMark, exhausted, low, used, reserved, limit, remaining,
 * usedText, outText, renews ('Renews December 1'), engines, notes,
 * sentence}.
 * Paid (unlimited): {mode: 'unlimited', numeral (runs used this month),
 * unit ('runs'), cap ('No limit'), ...the same keys; segments is [] and
 * renews says when the count starts again}.
 * `sentence` carries the same facts for screen readers.
 */
export function runsModel(raw) {
    const block = normalizeRuns(raw)
    if (!block) return null
    const engines = runsByEngine(raw.by_engine)
    const date = renewDate(block.resetsAt)
    const outText = block.reserved > 0 ? `${block.reserved.toLocaleString('en-US')} running now` : ''
    const byEngine = engines.length ? `By engine: ${engines.map((e) => `${e.label} ${e.text}`).join(', ')}.` : ''
    const shared = { used: block.used, reserved: block.reserved, engines, outText }

    if (block.unlimited) {
        const used = plural(block.used, 'prompt run', 'prompt runs')
        return {
            ...shared,
            mode: 'unlimited',
            numeral: block.used.toLocaleString('en-US'),
            unit: block.used === 1 ? 'run' : 'runs',
            cap: 'No limit',
            label: 'Used this month',
            limit: null,
            remaining: null,
            segments: [],
            perMark: 0,
            exhausted: false,
            low: false,
            usedText: '',
            renews: date ? `Resets ${date}` : '',
            notes: [RUN_NOTE],
            sentence: [
                `${used} used this month.`,
                'This account has no monthly limit.',
                outText ? `${outText}.` : '',
                byEngine,
                date ? `The count restarts on ${date}.` : '',
            ]
                .filter(Boolean)
                .join(' '),
        }
    }

    const segments = runSegments(block)
    const exhausted = block.remaining <= 0
    // A quarter or less left, as the server's prompt_runs_low issue counts it.
    const low = !exhausted && Boolean(block.limit) && block.remaining <= Math.max(1, Math.floor(block.limit / 4))
    return {
        ...shared,
        mode: 'free',
        numeral: block.remaining.toLocaleString('en-US'),
        unit: block.limit !== null ? `/ ${block.limit.toLocaleString('en-US')}` : '',
        cap: '',
        label: 'Free runs left',
        limit: block.limit,
        remaining: block.remaining,
        segments,
        perMark: segments.length && segments.length !== block.limit ? block.limit / segments.length : 0,
        exhausted,
        low,
        usedText: `${block.used.toLocaleString('en-US')} used`,
        renews: date ? `Renews ${date}` : '',
        notes: exhausted ? [OUT_NOTE, RUN_NOTE] : [RUN_NOTE],
        sentence: [
            `${runsLeftText(block)}.`,
            runsUsedText(block) ? `${runsUsedText(block)}.` : '',
            outText ? `${outText}.` : '',
            byEngine,
            renewSentence(block),
        ]
            .filter(Boolean)
            .join(' '),
    }
}
