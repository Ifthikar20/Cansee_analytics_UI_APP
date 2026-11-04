// The Analytics board's widget catalog (board_contract.md 3), in catalog
// order. The keys and default sizes are shared with the backend
// (apps/boards/layout.py WIDGETS); both sides test them against the
// contract table. `size` is the default, `sizes` the sizes a user may pick.
// Pure: no Vue, no requests.

export const SIZES = Object.freeze(['third', 'half', 'full'])

// The menu's words for each size, and the same words inside a sentence.
export const SIZE_LABELS = Object.freeze({ third: 'One third', half: 'Half', full: 'Full width' })
export const SIZE_WORDS = Object.freeze({ third: 'one third', half: 'half', full: 'full width' })

const W = (key, title, description, size, sizes) =>
    Object.freeze({ key, title, description, size, sizes: Object.freeze(sizes) })

export const WIDGETS = Object.freeze([
    W('summary', 'Summary', 'Google and the AI engines at a glance.', 'full', ['half', 'full']),
    W('prompts', 'Prompts', 'Where Google ranks you next to what AI says, per question.', 'full', ['half', 'full']),
    W(
        'countries',
        'Countries',
        'Where you rank and where your traffic comes from, country by country.',
        'half',
        ['half', 'full']
    ),
    W('traffic', 'Traffic', 'Real traffic from the source you connect.', 'half', ['third', 'half', 'full']),
    W('visibility', 'AI visibility over time', 'How often the AI engines name you.', 'half', ['third', 'half', 'full']),
    W('by-engine', 'AI visibility by engine', "Each engine's share of answers that name you.", 'third', ['third', 'half']),
    W('who-recommends', 'Who AI recommends', 'Brands the engines name in their latest answers.', 'third', ['third', 'half']),
    W('share-of-voice', 'Share of voice', 'Your share of all brand mentions in AI answers.', 'third', ['third', 'half']),
    W('sentiment', 'Sentiment', 'How the engines describe you when they name you.', 'third', ['third', 'half']),
    W('fact-check', 'Fact check', 'What AI states about you, checked against your facts.', 'third', ['third', 'half']),
    W('citations', 'Citations', "The sources AI answers cite, and how often it's you.", 'half', ['third', 'half', 'full']),
    W('ai-traffic', 'AI traffic', 'Visits that arrive from AI assistants.', 'third', ['third', 'half']),
    W('ai-crawlers', 'AI crawlers', 'AI bots reading your site, counted by Cloudflare.', 'third', ['third', 'half']),
    W('crawler-access', 'Crawler access', 'Whether AI crawlers may read your site.', 'third', ['third', 'half']),
    W('pages', 'Pages', 'Your pages that Google, AI answers and crawlers use.', 'half', ['half', 'full']),
    W('fan-outs', 'Query fan-outs', 'The web searches the engines ran while answering.', 'half', ['half', 'full']),
    W('prompt-research', 'Prompt research', 'New questions worth tracking, and where they came from.', 'half', ['half', 'full']),
    W('competitors', 'Competitors', 'You next to the competitors you track.', 'half', ['half', 'full']),
    W('products', 'Products', 'Your products in Google Shopping and AI answers.', 'half', ['half', 'full']),
])

// The board a project starts with, and the one the server sends while
// nothing is saved: Summary, Prompts, then Countries and Traffic side by side.
export const DEFAULT_LAYOUT = Object.freeze(
    [
        { key: 'summary', size: 'full' },
        { key: 'prompts', size: 'full' },
        { key: 'countries', size: 'half' },
        { key: 'traffic', size: 'half' },
    ].map((w) => Object.freeze(w))
)

const BY_KEY = new Map(WIDGETS.map((w) => [w.key, w]))

/** A widget's catalog entry ({key, title, description, size, sizes}), or null. */
export function widgetMeta(key) {
    return BY_KEY.get(key) || null
}

/** The side panel's title: the widget's, or `Prompt` for one prompt's detail. */
export function panelTitle(key, query = {}) {
    if (key === 'prompts' && query?.prompt) return 'Prompt'
    return widgetMeta(key)?.title || ''
}
