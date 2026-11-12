// The Rank in AI answers block (board key "answer-rank"): the brands the
// engines name in each prompt's latest answers, in order, with the user's
// own place. Reads the search-gap overview's `leaderboard`, the data the
// Who AI recommends card shows: [{name, is_you, visibility_pct}], the share
// of those answers that name each brand. The overview carries no earlier
// ranking, so the block shows no movement. Pure.
import { formatValue } from '@/lib/charts/format'
import { num, pad2, text } from './words'

// The overview lists this many brands and then adds the user's own row
// when it is not among them (LEADERBOARD_SIZE in the search-gap service).
// A row added that way is "at least" its place: brands between are not sent.
export const BOARD_SIZE = 8

/**
 * Every brand of the leaderboard in rank order:
 * [{key, name, you, value, rank, atLeast, index, text, width}].
 * `rank` is the brand's place by share (brands with the same share share a
 * place); a brand that was never named, or whose share is unknown, has no
 * place (null). `atLeast` marks a place that may really be lower. `index`
 * is the place as printed ("01", "09+", "" for none), `text` the share
 * ("62%", "Not named", "Not measured") and `width` the bar in percent of
 * the largest share.
 */
export function rankedBrands(leaderboard) {
    const list = (Array.isArray(leaderboard) ? leaderboard : []).filter((b) => b && text(String(b.name ?? '')))
    const beyond = list.length > BOARD_SIZE && Boolean(list.at(-1).is_you)
    const brands = list.map((b, order) => ({ order, name: text(String(b.name)), you: Boolean(b.is_you), value: num(b.visibility_pct) }))
    // Largest share first; the API's order settles ties and unmeasured rows.
    brands.sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.order - b.order)
    const top = Math.max(0, ...brands.map((b) => b.value ?? 0))
    return brands.map((b) => {
        const placed = b.value !== null && b.value > 0
        const rank = placed ? 1 + brands.filter((other) => (other.value ?? -1) > b.value).length : null
        const atLeast = placed && b.you && beyond
        return {
            key: `${b.order}:${b.name}`,
            name: b.name,
            you: b.you,
            value: b.value,
            rank,
            atLeast,
            index: rank === null ? '' : `${pad2(rank)}${atLeast ? '+' : ''}`,
            text: b.value === null ? 'Not measured' : b.value > 0 ? formatValue(b.value, { value: 'percent' }) : 'Not named',
            width: placed && top > 0 ? Math.min(100, (b.value / top) * 100) : 0,
        }
    })
}

/**
 * The rows a card shows: the first `limit` brands, with the user's own row
 * in place of the last one when it ranks lower.
 */
export function rankRows(leaderboard, { limit = 6 } = {}) {
    const brands = rankedBrands(leaderboard)
    const size = Math.max(1, Math.floor(num(limit) ?? 6))
    const rows = brands.slice(0, size)
    const you = brands.find((b) => b.you)
    if (you && !rows.includes(you)) rows.splice(-1, 1, you)
    return rows
}

/** A row as a sentence, for screen readers. */
export function rowSentence(row) {
    if (!row) return ''
    const who = row.you ? `${row.name} (you)` : row.name
    if (row.value === null) return `${who}: not measured.`
    if (row.rank === null) return `${who}: not named in these answers.`
    return `Number ${row.rank}${row.atLeast ? ' or lower' : ''}: ${who}, named in ${row.text} of answers.`
}

/**
 * The user's place in a line: "You are number 4 of the brands AI names.",
 * or what stands in its way. '' when the leaderboard has no row for them.
 */
export function yourPlace(leaderboard) {
    const you = rankedBrands(leaderboard).find((b) => b.you)
    if (!you) return ''
    if (you.value === null) return 'Your share of these answers is not measured yet.'
    if (you.rank === null) return 'These answers did not name you.'
    return `You are number ${you.rank}${you.atLeast ? ' or lower' : ''} of the brands AI names.`
}
