// Small text helpers the group D blocks share. Pure.

/** A finite number, or null: a value that was not measured is never 0. */
export function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** A trimmed string, or '' for anything that is not text. */
export function text(value) {
    return typeof value === 'string' ? value.trim() : ''
}

const integer = new Intl.NumberFormat('en-US')

/** "1 prompt", "1,204 prompts". */
export function plural(n, one, many) {
    return `${integer.format(n)} ${n === 1 ? one : many}`
}

/** "ChatGPT", "ChatGPT and Claude", "ChatGPT, Claude and Gemini". */
export function listWords(items) {
    const list = (Array.isArray(items) ? items : []).map((item) => text(String(item ?? ''))).filter(Boolean)
    if (list.length <= 1) return list[0] || ''
    return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

/** A place in a list as two digits: 1 is "01", 12 is "12", 120 is "120". */
export function pad2(n) {
    return String(n).padStart(2, '0')
}
