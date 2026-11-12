// The Asked and answered block (board key "asked-answered"): the newest
// tracked prompt that has answers, and whether each engine's latest answer
// to it named the brand. Reads the search-gap overview: its `prompts` are
// in the order they were tracked (oldest first), and each prompt's
// `engines[key]` holds {configured, answers, mentioned, rank}, where
// `mentioned` and `rank` describe that engine's latest answer. Pure.
import { listWords, num, text } from './words'

// What one engine did with the question.
//   named    its latest answer names the brand (`rank` among the brands
//            it listed, when the engine gave an order)
//   absent   it answered and did not name the brand
//   waiting  it is set up and has not answered yet
export const ANSWER_STATES = Object.freeze(['named', 'absent', 'waiting'])

function engineRows(prompt, engines) {
    const cells = prompt?.engines && typeof prompt.engines === 'object' ? prompt.engines : {}
    const listed = (Array.isArray(engines) ? engines : []).filter((e) => e && text(e.key))
    const known = listed.length ? listed : Object.keys(cells).map((key) => ({ key, label: key, configured: Boolean(cells[key]?.configured) }))
    const rows = []
    for (const engine of known) {
        const key = text(engine.key)
        const cell = cells[key] || {}
        const answers = num(cell.answers) ?? 0
        const configured = Boolean(engine.configured ?? cell.configured)
        // An engine that is not set up and never answered has nothing to say.
        if (answers <= 0 && !configured) continue
        const rank = num(cell.rank)
        const state = answers <= 0 ? 'waiting' : cell.mentioned ? 'named' : 'absent'
        rows.push({
            key,
            label: text(engine.label) || key,
            state,
            rank: state === 'named' && rank !== null && rank >= 1 ? Math.round(rank) : null,
        })
    }
    return rows
}

const answered = (rows) => rows.filter((row) => row.state !== 'waiting').length

/**
 * The block's content: {id, text, location, rows, answered, named, newest}
 * or null when no prompt is tracked. The prompt is the newest one an
 * engine has answered; when none has answers yet it is the newest prompt,
 * with every engine waiting. `newest` says whether it is the newest
 * tracked prompt.
 */
export function askedAnswered(overview) {
    const prompts = (Array.isArray(overview?.prompts) ? overview.prompts : []).filter((p) => p && text(p.text))
    if (!prompts.length) return null
    const newest = prompts.at(-1)
    let picked = null
    let rows = []
    for (let i = prompts.length - 1; i >= 0; i -= 1) {
        const candidate = engineRows(prompts[i], overview.engines)
        if (answered(candidate) > 0) {
            picked = prompts[i]
            rows = candidate
            break
        }
    }
    if (!picked) {
        picked = newest
        rows = engineRows(newest, overview.engines)
    }
    return {
        id: text(String(picked.prompt_id ?? '')),
        text: text(picked.text),
        location: text(picked.location).toUpperCase(),
        rows,
        answered: answered(rows),
        named: rows.filter((row) => row.state === 'named').length,
        newest: picked === newest,
    }
}

/**
 * Why there are no bars to draw, or null when an engine has answered:
 * {kind, title}. No engine at all needs setup; otherwise the answers are
 * still to come.
 */
export function answerGap(block) {
    if (!block || block.answered > 0) return null
    if (!block.rows.length) return { kind: 'not_connected', title: 'No AI engine is set up to answer yet.' }
    return { kind: 'empty', title: 'No engine has answered this yet. Answers arrive with the next run.' }
}

/** "You in 2 of 3", the count beside "Answered"; '' before any answer. */
export function namedSummary(block) {
    if (!block || !block.answered) return ''
    return `You in ${block.named} of ${block.answered}`
}

/** A row's short value: "#2", "Named", "Not named" or "No answer yet". */
export function rowValue(row) {
    if (row?.state === 'named') return row.rank ? `#${row.rank}` : 'Named'
    if (row?.state === 'absent') return 'Not named'
    return 'No answer yet'
}

/** A row as a sentence, for screen readers. */
export function rowSentence(row) {
    const label = row?.label || 'This engine'
    if (row?.state === 'named') return row.rank ? `${label} named you, at number ${row.rank} of the brands in its answer.` : `${label} named you.`
    if (row?.state === 'absent') return `${label} did not name you.`
    return `${label} has not answered yet.`
}

/** The whole answer in a sentence: who named you and who did not. */
export function answerSentence(block) {
    if (!block || !block.answered) return ''
    const named = block.rows.filter((row) => row.state === 'named').map((row) => row.label)
    const absent = block.rows.filter((row) => row.state === 'absent').map((row) => row.label)
    const parts = []
    if (named.length) parts.push(`${listWords(named)} named you.`)
    if (absent.length) parts.push(`${listWords(absent)} did not.`)
    return parts.join(' ')
}

// Where the "you" segment sits on an engine's bar, in percent of the bar:
// further left the earlier the answer names you. Without an order it sits
// in the middle.
const SEGMENT = 22
const STEP = 12
const LAST = 6

/** {left, width} in percent for a named row, or null for any other row. */
export function youSegment(row) {
    if (row?.state !== 'named') return null
    const left = row.rank ? Math.min(row.rank - 1, LAST) * STEP : (100 - SEGMENT) / 2
    return { left, width: SEGMENT }
}
