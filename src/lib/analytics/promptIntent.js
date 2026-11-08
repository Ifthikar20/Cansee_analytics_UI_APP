// Whether a line typed into Add prompts is a buyer question, which Cansee
// tracks, or a request about the user's own data, which belongs to the
// agent (board_contract.md 8). Checked on Add, never while typing. A line
// is lowercased, its spaces collapsed and its trailing ?.! removed; every
// phrase matches whole words only, so "is the apple watch worth it",
// "my siteground plan" and "how is mysql different from postgres" stay
// questions. Buyer phrasing ("show me the best laptops", "can you
// recommend...") is never a request.

const CONTAINS = Object.freeze([
    'the app',
    'this app',
    'cansee',
    'my site',
    'our site',
    'my website',
    'our website',
    'my dashboard',
    'the dashboard',
    'my traffic',
    'our traffic',
    'my prompts',
    'my ranking',
    'our ranking',
    'my visibility',
    'our visibility',
    'this project',
    'my project',
    'my account',
    'my report',
    'our report',
])

const STARTS = Object.freeze([
    'how is my',
    'how is our',
    'how are my',
    'how are our',
    'how am i',
    'how are we',
    "how's my",
    "how's our",
    'show me my',
    'show me our',
    'show me how',
    'tell me how',
    'what is my',
    'what is our',
    "what's my",
    "what's our",
    'why is my',
    'why is our',
    'why are my',
    'why are our',
    'analyze my',
    'analyse my',
    'analyze our',
    'analyse our',
    'summarize my',
    'summarise my',
    'compare my',
    'compare our',
    'check my',
    'check our',
])

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const CONTAINS_RE = new RegExp(`\\b(?:${CONTAINS.map(escape).join('|')})\\b`)
const STARTS_RE = new RegExp(`^(?:${STARTS.map(escape).join('|')})\\b`)

/** A line as it is matched: lowercase, one space between words, no trailing ?.! */
export function normalizeLine(line) {
    return String(line ?? '')
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[?.!]+$/, '')
        .trim()
}

/** True when the line asks about the user's own data rather than what a buyer would ask. */
export function isAgentRequest(line) {
    const text = normalizeLine(line)
    if (!text) return false
    return STARTS_RE.test(text) || CONTAINS_RE.test(text)
}

/** The lines split into {requests, questions}, each in the order typed. */
export function splitPromptLines(lines) {
    const requests = []
    const questions = []
    for (const line of Array.isArray(lines) ? lines : []) {
        if (isAgentRequest(line)) requests.push(line)
        else questions.push(line)
    }
    return { requests, questions }
}
