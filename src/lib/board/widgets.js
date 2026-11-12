// The Analytics board's catalog of blocks: the four that open a new board,
// board_contract.md 3's widgets (Ask AI and Prompt ranking first,
// autopilot_contract.md 6), then the account and project blocks, in catalog
// order. The keys and default sizes are shared with the backend
// (apps/boards/layout.py WIDGETS); both sides test them against the
// contract table. `size` is the default, `sizes` the sizes a user may pick.
// Pure: no Vue, no requests.

export const SIZES = Object.freeze(['third', 'half', 'full'])

// The menu's words for each size, and the same words inside a sentence.
export const SIZE_LABELS = Object.freeze({ third: 'One third', half: 'Half', full: 'Full width' })
export const SIZE_WORDS = Object.freeze({ third: 'one third', half: 'half', full: 'full width' })

// How a block looks on the board and in the catalog, next to what it is:
// - `caption`: the short line under the card, shown in capitals;
// - `tone`: the card's surface, 'ink' (near-black in the light theme) or
//   'light'. It belongs to the block, not to its place, so a card keeps its
//   surface when it moves; the catalog spreads the ink blocks out;
// - `preview`: the drawing its catalog tile shows (BlockPreview.vue).
export const TONES = Object.freeze(['ink', 'light'])

const W = (key, title, description, size, sizes, caption, tone, preview) =>
    Object.freeze({ key, title, description, size, sizes: Object.freeze(sizes), caption, tone, preview })

const THIRD = ['third', 'half']
const HALF = ['half', 'full']
const ANY = ['third', 'half', 'full']

// Catalog order numbers the blocks (CNS_01 to CNS_28, blockCode), so a new
// block goes last.
export const WIDGETS = Object.freeze([
    W('watch', 'Watch', 'An eye on your tracking: the prompts and AI engines it follows.', 'third', THIRD, 'It looks back', 'ink', 'eye'),
    W(
        'asked-answered',
        'Asked and answered',
        'Your latest tracked question, and whether each engine named you in its answer.',
        'third',
        THIRD,
        'Asked. Were you in it?',
        'light',
        'question'
    ),
    W(
        'answer-rank',
        'Rank in AI answers',
        'The brands AI names in recent answers, in order, with your place among them.',
        'third',
        THIRD,
        'Who AI names, in order',
        'light',
        'rank'
    ),
    W(
        'visibility-score',
        'Visibility score',
        'How often AI names you, as one number, with the last weeks behind it.',
        'third',
        THIRD,
        'One number to watch',
        'ink',
        'numeral'
    ),
    W(
        'prompt-box',
        'Ask AI',
        "Ask a buyer's question several times and see how often each engine names you.",
        'full',
        HALF,
        'Ask every engine at once',
        'light',
        'ask'
    ),
    W(
        'ranking',
        'Prompt ranking',
        'Your tracked prompts, ranked by how often AI names you.',
        'full',
        HALF,
        'Your prompts, best first',
        'light',
        'bars'
    ),
    W('summary', 'Summary', 'Google and the AI engines at a glance.', 'full', HALF, 'Google next to AI', 'light', 'tiles'),
    W(
        'prompts',
        'Prompts',
        'Where Google ranks you next to what AI says, per question.',
        'full',
        HALF,
        'Each question, two answers',
        'light',
        'table'
    ),
    W(
        'countries',
        'Countries',
        'Where you rank and where your traffic comes from, country by country.',
        'half',
        HALF,
        'Rank, country by country',
        'light',
        'grid'
    ),
    W('traffic', 'Traffic', 'Real traffic from the source you connect.', 'half', ANY, 'Visits, from your source', 'ink', 'line'),
    W(
        'visibility',
        'AI visibility over time',
        'How often the AI engines name you.',
        'half',
        ANY,
        'How often AI names you',
        'light',
        'line'
    ),
    W(
        'by-engine',
        'AI visibility by engine',
        "Each engine's share of answers that name you.",
        'third',
        THIRD,
        'Engine by engine',
        'light',
        'bars'
    ),
    W(
        'who-recommends',
        'Who AI recommends',
        'Brands the engines name in their latest answers.',
        'third',
        THIRD,
        'Brands AI reaches for',
        'light',
        'rank'
    ),
    W(
        'share-of-voice',
        'Share of voice',
        'Your share of all brand mentions in AI answers.',
        'third',
        THIRD,
        'Your slice of mentions',
        'ink',
        'share'
    ),
    W(
        'sentiment',
        'Sentiment',
        'How the engines describe you when they name you.',
        'third',
        THIRD,
        'The tone when named',
        'light',
        'split'
    ),
    W(
        'fact-check',
        'Fact check',
        'What AI states about you, checked against your facts.',
        'third',
        THIRD,
        'What AI claims, checked',
        'light',
        'checks'
    ),
    W(
        'citations',
        'Citations',
        "The sources AI answers cite, and how often it's you.",
        'half',
        ANY,
        'Sources AI leans on',
        'light',
        'rank'
    ),
    W('ai-traffic', 'AI traffic', 'Visits that arrive from AI assistants.', 'third', THIRD, 'Visits sent by assistants', 'ink', 'columns'),
    W(
        'ai-crawlers',
        'AI crawlers',
        'AI bots reading your site, counted by Cloudflare.',
        'third',
        THIRD,
        'Bots reading your site',
        'light',
        'columns'
    ),
    W(
        'crawler-access',
        'Crawler access',
        'Whether AI crawlers may read your site.',
        'third',
        THIRD,
        'Who may read your site',
        'light',
        'checks'
    ),
    W(
        'pages',
        'Pages',
        'Your pages that Google, AI answers and crawlers use.',
        'half',
        HALF,
        'The pages that get used',
        'light',
        'table'
    ),
    W(
        'fan-outs',
        'Query fan-outs',
        'The web searches the engines ran while answering.',
        'half',
        HALF,
        'Searches behind answers',
        'ink',
        'fan'
    ),
    W(
        'prompt-research',
        'Prompt research',
        'New questions worth tracking, and where they came from.',
        'half',
        HALF,
        'Questions worth tracking',
        'light',
        'lines'
    ),
    W('competitors', 'Competitors', 'You next to the competitors you track.', 'half', HALF, 'You, next to them', 'light', 'bars'),
    W(
        'products',
        'Products',
        'Your products in Google Shopping and AI answers.',
        'half',
        HALF,
        'Your products in answers',
        'light',
        'table'
    ),
    W(
        'prompt-runs',
        'Prompt runs',
        'The prompt runs of this month: what is left on Free, what was used on a paid plan.',
        'third',
        THIRD,
        'Runs, this month',
        'ink',
        'meter'
    ),
    W(
        'next-steps',
        'Next steps',
        'What is not set up for this project yet, and what to do next.',
        'third',
        THIRD,
        'What to set up next',
        'light',
        'steps'
    ),
    W(
        'latest-report',
        'Latest report',
        'The most recent report you saved for this project.',
        'half',
        HALF,
        'The newest saved report',
        'ink',
        'cover'
    ),
])

// The board a project starts with, and the one the server sends while
// nothing is saved: a row of four small blocks (the watch, the latest
// question, who AI names, the visibility score), then Ask AI and Prompt
// ranking (autopilot_contract.md 6).
export const DEFAULT_LAYOUT = Object.freeze(
    [
        { key: 'watch', size: 'third' },
        { key: 'asked-answered', size: 'third' },
        { key: 'answer-rank', size: 'third' },
        { key: 'visibility-score', size: 'third' },
        { key: 'prompt-box', size: 'full' },
        { key: 'ranking', size: 'full' },
    ].map((w) => Object.freeze(w))
)

const BY_KEY = new Map(WIDGETS.map((w) => [w.key, w]))

/** A block's catalog entry ({key, title, description, size, sizes, caption, tone, preview}), or null. */
export function widgetMeta(key) {
    return BY_KEY.get(key) || null
}

const CODES = new Map(WIDGETS.map((w, i) => [w.key, `CNS_${String(i + 1).padStart(2, '0')}`]))

/** A block's code by catalog order, 'CNS_01' to 'CNS_28', or '' for an unknown key. */
export function blockCode(key) {
    return CODES.get(key) || ''
}

/** The side panel's title: the widget's, or `Prompt` for one prompt's detail. */
export function panelTitle(key, query = {}) {
    if (key === 'prompts' && query?.prompt) return 'Prompt'
    return widgetMeta(key)?.title || ''
}
