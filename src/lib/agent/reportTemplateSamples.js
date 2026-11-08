// Sample props for the report template previews on the Reports page. The
// previews render the real report components (ReportHeader, VizStatTile,
// GapBadge, Leaderboard, VizTable, EngineCard, ActionList) with these
// fixed values, never with the project's data: every brand, domain and
// number here is made up, and every preview is labelled "Sample". Domains
// use example.com, example.org and example.net, which are reserved for
// examples. Nothing here is fetched.
import { REPORT_TEMPLATE_KEYS, findTemplate, isReportTemplateKey } from '@/lib/agent/reportTemplates'

export const SAMPLE_BRAND = 'Sample brand'
const RIVAL_A = 'Rival A'
const RIVAL_B = 'Rival B'
export const SAMPLE_PROMPTS = Object.freeze([
    'best project tool for small teams',
    'project tool with time tracking',
    'free alternative to big project suites',
])
// A fixed capture date, so the sample header reads the same for everyone.
export const SAMPLE_CAPTURED_AT = '2026-11-02T12:00:00Z'

const DATA_BY_TEMPLATE = {
    executive_summary: [{ key: 'tracked_data', label: 'Tracked prompt data', window_days: 120 }],
    google_ai_gap: [
        { key: 'research_agents', label: 'Research agents run for this reply', window_days: null },
        { key: 'google', label: 'Google results captured for this reply', window_days: null },
    ],
    competitor_comparison: [
        { key: 'tracked_data', label: 'Tracked prompt data', window_days: 120 },
        { key: 'citations', label: 'Cited sources', window_days: 120 },
    ],
    prompt_deep_dive: [
        { key: 'tracked_data', label: 'Tracked prompt data', window_days: 120 },
        { key: 'google', label: 'Google results captured for this reply', window_days: null },
    ],
    sources_citations: [{ key: 'citations', label: 'Cited sources', window_days: 120 }],
    brand_accuracy: [{ key: 'perception', label: 'Sentiment and Fact check', window_days: 90 }],
    change_log: [{ key: 'visibility_history', label: 'Visibility history', window_days: 90 }],
}

const ENGINE_LABELS = [
    ['chatgpt', 'ChatGPT'],
    ['claude', 'Claude'],
    ['gemini', 'Gemini'],
    ['grok', 'Grok'],
    ['perplexity', 'Perplexity'],
]

/**
 * A header shaped like the server's data.header (reports-be contract),
 * with sample values only. Templates that read saved data show every
 * engine as asked; the others show one engine as not set up, as a real
 * workspace often does.
 */
export function sampleHeader(templateId) {
    const id = isReportTemplateKey(templateId) ? templateId : REPORT_TEMPLATE_KEYS[0]
    const template = findTemplate(id)
    const live = template.requirements.runs_checks
    return {
        template: { id, name: template.name },
        project: { name: SAMPLE_BRAND, url: 'https://www.example.com' },
        captured_at: SAMPLE_CAPTURED_AT,
        data: DATA_BY_TEMPLATE[id].map((d) => ({ ...d })),
        engines: ENGINE_LABELS.map(([key, label]) => ({
            key,
            label,
            status: live && key === 'grok' ? 'not_configured' : 'asked',
            configured: !(live && key === 'grok'),
        })),
        locations: ['US'],
        prompts: id === 'prompt_deep_dive' ? [{ prompt_id: null, text: SAMPLE_PROMPTS[0], location: 'US' }] : [],
        competitors:
            id === 'competitor_comparison'
                ? [
                      { name: RIVAL_A, domain: 'example.org' },
                      { name: RIVAL_B, domain: 'example.net' },
                  ]
                : [],
        compared:
            id === 'change_log'
                ? {
                      kind: 'engine_checks',
                      window_days: 90,
                      latest_check_at: SAMPLE_CAPTURED_AT,
                      previous_check_at: '2026-10-26T12:00:00Z',
                  }
                : null,
    }
}

const table = (labelHeader, labels, datasets) => ({ label_header: labelHeader, labels, datasets })

/** Sample props per preview view (lib/agent/reportTemplates SECTION_VIEWS). */
export const SAMPLES = Object.freeze({
    kpis: [
        { label: 'Tracked prompts', value: 12, kind: 'count' },
        { label: 'AI visibility', value: 38, kind: 'percent' },
        { label: 'Avg. Google position', value: 6.4, kind: 'rank' },
        { label: 'Not in Google', value: 3, kind: 'count' },
    ],
    gap_mix: [
        { cls: 'ai_ahead', count: 3 },
        { cls: 'google_ahead', count: 4 },
        { cls: 'strong_both', count: 2 },
        { cls: 'invisible_both', count: 2 },
        { cls: 'even', count: 1 },
    ],
    leaderboard: [
        { name: RIVAL_A, visibility_pct: 52 },
        { name: SAMPLE_BRAND, visibility_pct: 38, is_you: true },
        { name: RIVAL_B, visibility_pct: 21 },
    ],
    gap_rows: table('Prompt', SAMPLE_PROMPTS, [
        { key: 'google', label: 'Google', value: 'rank', data: [2, 9, null], states: [null, null, 'not_found'] },
        { key: 'ai', label: 'AI visibility', value: 'percent', data: [10, 60, 40] },
    ]),
    actions: [
        {
            kind: 'sample_compare',
            title: 'Add a comparison table to the pricing page',
            detail: 'The engines quote competitors that compare plans side by side.',
            targets: [],
            engines: ['chatgpt', 'gemini'],
        },
        {
            kind: 'sample_cited',
            title: 'Get listed on the review page the engines cite',
            detail: 'Two engines cite the same third-party list, which leaves the brand out.',
            targets: [],
            engines: ['perplexity'],
        },
    ],
    summary: [
        'Sample: the brand ranks on Google for two of three prompts but the AI engines name it in fewer than half of their answers.',
    ],
    results_table: table('Prompt', SAMPLE_PROMPTS, [
        { key: 'google', label: 'Google', value: 'rank', data: [2, 9, null], states: [null, null, 'not_found'] },
        { key: 'chatgpt', label: 'ChatGPT', texts: ['Named #3', 'Not named', 'Named #1'] },
        { key: 'claude', label: 'Claude', texts: ['Named #2', 'Not named', 'Not named'] },
    ]),
    prompt_detail: {
        prompt: SAMPLE_PROMPTS[0],
        gap: { class: 'google_ahead', value: -35 },
        engines: [
            {
                key: 'chatgpt',
                label: 'ChatGPT',
                configured: true,
                answers: 5,
                mentioned: true,
                rank: 3,
                sentiment: 'positive',
                visibility_pct: 60,
                class: 'even',
                brands_above: [{ name: RIVAL_A, position: 1 }],
                citations: [],
            },
            {
                key: 'gemini',
                label: 'Gemini',
                configured: true,
                answers: 5,
                mentioned: false,
                rank: null,
                sentiment: null,
                visibility_pct: 20,
                class: 'google_ahead',
                brands_above: [
                    { name: RIVAL_A, position: 1 },
                    { name: RIVAL_B, position: 2 },
                ],
                citations: [],
            },
        ],
    },
    content_gaps: [
        'Sample: no pricing table on the product page.',
        'Sample: no answer to "does it track time" on the features page.',
    ],
    competitor_ranks: table('Prompt', SAMPLE_PROMPTS.slice(0, 2), [
        { key: 'google_a', label: `${RIVAL_A} on Google`, value: 'rank', data: [1, 3] },
        { key: 'above', label: 'Engines naming them first', texts: ['ChatGPT, Gemini', 'Claude'] },
    ]),
    page_compare: table('Page', ['example.com/product', 'example.org/product'], [
        { key: 'words', label: 'Words', value: 'count', data: [640, 1850] },
        { key: 'schema', label: 'Structured data', texts: ['None', 'Product, FAQPage'] },
    ]),
    sources_table: table('Source', ['example.org', 'example.net', 'example.com'], [
        { key: 'citations', label: 'Citations', value: 'count', data: [24, 15, 6] },
        { key: 'owner', label: 'Owner', texts: [RIVAL_A, 'Third party', 'You'] },
    ]),
    verdict: {
        gap: { class: 'google_ahead', value: -35 },
        line: 'Sample: Google ranks the brand #2, but only one engine in three names it.',
    },
    google_results: table('Result', ['example.org', 'example.com', 'example.net'], [
        { key: 'position', label: 'Position', value: 'rank', data: [1, 2, 3] },
        { key: 'flag', label: 'Flag', texts: ['Competitor', 'You', ''] },
    ]),
    engine_cards: 'prompt_detail',
    citation_totals: [
        { label: 'Citations', value: 214, kind: 'count' },
        { label: 'To your site', value: 9, kind: 'percent' },
    ],
    target_sources: ['Sample: example.org/best-tools (cited 11 times, names Rival A)', 'Sample: example.net/reviews (cited 7 times)'],
    outreach: ['Sample: pitch a product review to example.net/reviews.'],
    coverage: [
        { label: 'Answers naming you', value: 42, kind: 'count' },
        { label: 'Answers analyzed', value: 120, kind: 'count' },
    ],
    themes: table('Theme', ['Easy to start', 'Pricing unclear'], [
        { key: 'answers', label: 'Answers', value: 'count', data: [18, 7] },
        { key: 'tone', label: 'Tone', texts: ['Positive', 'Negative'] },
    ]),
    claims: ['Sample claim: "has no mobile app". Evidence: the brand facts list an iOS and an Android app.'],
    corrections: ['Sample: ask the publishers repeating the claim to correct it.'],
    changes: table('Prompt', SAMPLE_PROMPTS.slice(0, 2), [
        { key: 'engine', label: 'Engine', texts: ['ChatGPT', 'Gemini'] },
        { key: 'change', label: 'Change', texts: ['Now named, #2', 'Dropped'] },
    ]),
    unchanged: [{ label: 'Unchanged results', value: 23, kind: 'count' }],
    trend: [{ label: 'AI visibility, weekly', value: 38, kind: 'percent', spark: [22, 25, 24, 30, 33, 38] }],
    method: [
        'Sample: data captured Nov 2, 2026 from the United States.',
        'Engines that are not set up are listed as not configured.',
    ],
})

/** The sample props of a view; 'engine_cards' shares the prompt detail's engines. */
export function sampleFor(view) {
    const value = SAMPLES[view]
    return typeof value === 'string' ? SAMPLES[value] : value ?? null
}
