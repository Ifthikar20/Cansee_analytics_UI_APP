// Report templates (reports-be contract): the fixed set of seven the
// backend serves at GET agent/report-templates/, merged here with what
// only the UI needs: the preview view of each section and the drafted
// message that "Use template" puts in a new chat's composer.
//
// The catalog is the source of truth for names, purposes, sections,
// requirements and availability. FALLBACK repeats its display text
// (apps/agent/report_templates.py) so the gallery still lists the
// templates when the catalog call fails; availability is then unknown,
// and the server says so on send if a template cannot run.
import { fillTemplate } from '@/lib/agent/taskTemplates'

export const REPORT_TEMPLATE_KEYS = Object.freeze([
    'executive_summary',
    'google_ai_gap',
    'competitor_comparison',
    'prompt_deep_dive',
    'sources_citations',
    'brand_accuracy',
    'change_log',
])

const KEY_SET = new Set(REPORT_TEMPLATE_KEYS)

/** True for one of the seven catalog keys. */
export function isReportTemplateKey(key) {
    return typeof key === 'string' && KEY_SET.has(key)
}

// Requirement values of the catalog (requirements.google / .engines).
export const REQUIRED = 'required'
export const OPTIONAL = 'optional'
export const SAVED = 'saved'
export const NOT_USED = 'not_used'
const USES = new Set([REQUIRED, OPTIONAL, SAVED, NOT_USED])

const BASE_HEADER = ['template', 'project', 'captured_at', 'data', 'engines', 'locations']
const METHOD = {
    title: 'Method',
    shows: 'When the data was captured, the data window, the location, the engines asked and the engines that are not configured.',
    repeat: null,
}

const s = (title, shows, repeat = null) => ({ title, shows, repeat })

const FALLBACK = Object.freeze({
    executive_summary: {
        name: 'Executive summary',
        purpose:
            'A one-page status for leadership: the headline numbers, the biggest gaps and the top fixes, from data already measured.',
        header_fields: BASE_HEADER,
        sections: [
            s('Key numbers', "Tracked prompts, AI visibility, average Google position and prompts not in Google's results."),
            s('Gap mix', 'How many prompts are AI ahead, Google ahead, strong in both, invisible in both, even or not checked.'),
            s('Who AI recommends', 'The brands the AI engines name most often.'),
            s('Biggest gaps', 'The three prompts with the largest gap between Google and the AI engines.'),
            s('Top fixes', 'Up to five fixes, each naming the page to change or create.'),
            METHOD,
        ],
        requirements: {
            google: SAVED,
            engines: SAVED,
            research_agents: false,
            runs_checks: false,
            note: 'Uses data already measured. Runs no new Google searches or AI engine questions.',
        },
    },
    google_ai_gap: {
        name: 'Google vs AI gap',
        purpose:
            'Prompt by prompt, where Google ranks you compared with what the AI engines say, and the fixes for each gap.',
        header_fields: BASE_HEADER,
        sections: [
            s('Summary', 'Three sentences on where the brand stands.'),
            s('Results', "One row per prompt: the Google position, each engine's result and the gap."),
            s(
                'Prompt',
                "What Google shows, what each engine says and which brands it lists above the brand, what competitor pages do that the brand's page does not, the cited sources, the gap and 2 to 4 fixes.",
                'prompt',
            ),
            s('Content gaps', "What the brand's page lacks compared with the competitor pages."),
            METHOD,
        ],
        requirements: {
            google: OPTIONAL,
            engines: OPTIONAL,
            research_agents: true,
            runs_checks: true,
            note: 'Runs new Google searches and AI engine questions for 2 to 4 prompts. Engines that are not set up are reported as not configured.',
        },
    },
    competitor_comparison: {
        name: 'Competitor comparison',
        purpose: 'You against one to three tracked competitors, prompt by prompt.',
        header_fields: [...BASE_HEADER, 'competitors'],
        sections: [
            s('Share of voice', 'How often the AI engines name the brand and each competitor.'),
            s('Where competitors are ahead', 'Per prompt and engine, the competitors listed above the brand, and their Google positions.'),
            s('What their pages do', "What the competitor pages do that the brand's page does not."),
            s('Sources that favour competitors', 'Competitor-owned pages the engines cite.'),
            s('Fixes', '2 to 5 fixes, each naming the page to change or create.'),
            METHOD,
        ],
        requirements: {
            google: OPTIONAL,
            engines: OPTIONAL,
            research_agents: true,
            runs_checks: true,
            note: 'Uses your tracked competitors. Runs new Google searches and AI engine questions for 2 to 3 prompts.',
        },
    },
    prompt_deep_dive: {
        name: 'Prompt deep dive',
        purpose: 'One tracked prompt, end to end: Google, every engine, the sources and the fixes.',
        header_fields: [...BASE_HEADER, 'prompts'],
        sections: [
            s('Verdict and gap', 'The gap between Google and the AI engines, and its label.'),
            s(
                'Google results and AI Overview',
                "The top results, the brand's position and whether the AI Overview names or cites the brand.",
            ),
            s('What each engine said', 'Whether each engine names the brand, at what rank, with a short quote.'),
            s('Sources cited', 'The domains the engines cite for this prompt.'),
            s('On-page check', "The brand's best-ranking page compared with the strongest competitor page."),
            s('Fixes', '2 to 4 fixes, each naming the page to change or create.'),
            METHOD,
        ],
        requirements: {
            google: REQUIRED,
            engines: SAVED,
            research_agents: false,
            runs_checks: true,
            note: 'Searches Google for one prompt (2 results pages) and reads the latest saved engine answers.',
        },
    },
    sources_citations: {
        name: 'Sources and citations',
        purpose: 'Which domains the AI engines cite, and where the brand should get mentioned.',
        header_fields: BASE_HEADER,
        sections: [
            s('Totals', "Citations in the window and how many point to the brand's own site."),
            s(
                'Top sources',
                "Each source's domain, citations, the engines citing it, and whether it is the brand's or a competitor's.",
            ),
            s('Sources to target', 'Third-party and competitor-owned sources the engines cite where the brand is absent.'),
            s('Outreach list', 'Example pages to pitch, per target source.'),
            METHOD,
        ],
        requirements: {
            google: SAVED,
            engines: SAVED,
            research_agents: false,
            runs_checks: false,
            note: 'Uses citations already measured. Runs no new Google searches or AI engine questions.',
        },
    },
    brand_accuracy: {
        name: 'Brand accuracy',
        purpose:
            "How the AI engines describe the brand, and which of their claims the brand's own evidence contradicts.",
        header_fields: BASE_HEADER,
        sections: [
            s('Coverage', 'Answers that name the brand out of the answers analyzed.'),
            s('How the engines describe the brand', 'Each theme with its tone, how many answers, the engines and one quote.'),
            s('Contradicted claims', 'Each claim the evidence contradicts, with the evidence.'),
            s('Corrections to request', 'The correction to ask for, per contradicted claim.'),
            METHOD,
        ],
        requirements: {
            google: SAVED,
            engines: SAVED,
            research_agents: false,
            runs_checks: false,
            note: 'Uses the Sentiment and Fact check analysis of saved engine answers. Runs no new checks.',
        },
    },
    change_log: {
        name: 'Change log since the last run',
        purpose: 'What moved since the previous check of each prompt, and what to do next.',
        header_fields: [...BASE_HEADER, 'compared'],
        sections: [
            s('What changed', 'Prompts and engines whose result moved since the previous check: gains first, then losses.'),
            s('Unchanged', 'How many prompt and engine results did not change.'),
            s('Visibility trend', 'Weekly AI visibility, overall and per engine.'),
            s('Next actions', '2 to 4 actions, each naming the page to change or create.'),
            METHOD,
        ],
        requirements: {
            google: SAVED,
            engines: SAVED,
            research_agents: false,
            runs_checks: false,
            note: "Compares each prompt's latest engine answer with the one before it. Runs no new checks.",
        },
    },
})

/**
 * The preview view of each section, by template and section title. A
 * section that repeats per prompt is always 'prompt_detail'; a title the
 * map does not know previews as plain text ('text').
 */
export const SECTION_VIEWS = Object.freeze({
    executive_summary: {
        'Key numbers': 'kpis',
        'Gap mix': 'gap_mix',
        'Who AI recommends': 'leaderboard',
        'Biggest gaps': 'gap_rows',
        'Top fixes': 'actions',
    },
    google_ai_gap: {
        Summary: 'summary',
        Results: 'results_table',
        'Content gaps': 'content_gaps',
    },
    competitor_comparison: {
        'Share of voice': 'leaderboard',
        'Where competitors are ahead': 'competitor_ranks',
        'What their pages do': 'page_compare',
        'Sources that favour competitors': 'sources_table',
        Fixes: 'actions',
    },
    prompt_deep_dive: {
        'Verdict and gap': 'verdict',
        'Google results and AI Overview': 'google_results',
        'What each engine said': 'engine_cards',
        'Sources cited': 'sources_table',
        'On-page check': 'page_compare',
        Fixes: 'actions',
    },
    sources_citations: {
        Totals: 'citation_totals',
        'Top sources': 'sources_table',
        'Sources to target': 'target_sources',
        'Outreach list': 'outreach',
    },
    brand_accuracy: {
        Coverage: 'coverage',
        'How the engines describe the brand': 'themes',
        'Contradicted claims': 'claims',
        'Corrections to request': 'corrections',
    },
    change_log: {
        'What changed': 'changes',
        Unchanged: 'unchanged',
        'Visibility trend': 'trend',
        'Next actions': 'actions',
    },
})

/** The preview view key of a section of template `id`. */
export function sectionView(id, section) {
    if (!section) return 'text'
    if (section.repeat === 'prompt') return 'prompt_detail'
    if (section.title === 'Method') return 'method'
    return SECTION_VIEWS[id]?.[section.title] || 'text'
}

/**
 * Which tracked prompts the template's dialog offers: {min, max}. min 1
 * means the report needs one picked; max 0 means no picker.
 */
export const PROMPT_PICKS = Object.freeze({
    executive_summary: { min: 0, max: 0 },
    google_ai_gap: { min: 0, max: 4 },
    competitor_comparison: { min: 0, max: 3 },
    prompt_deep_dive: { min: 1, max: 1 },
    sources_citations: { min: 0, max: 3 },
    brand_accuracy: { min: 0, max: 0 },
    change_log: { min: 0, max: 0 },
})

// The drafted message per template: `text` is filled with fillTemplate
// (a line whose value is empty is left out), and {prompt_list} is
// `intro` followed by the picked prompts, one numbered line each.
const DRAFTS = Object.freeze({
    executive_summary: { text: 'Write an executive summary report for {brand}.' },
    google_ai_gap: { text: 'Write a Google vs AI gap report for {brand}.\n{prompt_list}', intro: 'Research these prompts:' },
    competitor_comparison: {
        text: 'Write a competitor comparison report for {brand}.\nCompare with {competitors}.\n{prompt_list}',
        intro: 'Research these prompts:',
    },
    prompt_deep_dive: { text: 'Write a prompt deep dive report for {brand}.\n{prompt_list}', intro: 'The tracked prompt:' },
    sources_citations: {
        text: 'Write a sources and citations report for {brand}.\n{prompt_list}',
        intro: 'Also look at the sources cited for these prompts:',
    },
    brand_accuracy: { text: 'Write a brand accuracy report for {brand}.' },
    change_log: { text: 'Write a change log report for {brand}: what changed since the last check of each prompt.' },
})

const text = (value) => (typeof value === 'string' ? value.trim() : '')

function note(raw) {
    if (!raw || typeof raw !== 'object') return null
    const message = text(raw.message)
    if (!message) return null
    const out = { code: text(raw.code), message }
    const setting = text(raw.setting)
    if (setting) out.setting = setting
    return out
}

function requirementsOf(raw, base) {
    const r = raw && typeof raw === 'object' ? raw : {}
    const pick = (value, fallback) => (USES.has(value) ? value : fallback)
    return {
        google: pick(r.google, base.google),
        engines: pick(r.engines, base.engines),
        research_agents: typeof r.research_agents === 'boolean' ? r.research_agents : base.research_agents,
        runs_checks: typeof r.runs_checks === 'boolean' ? r.runs_checks : base.runs_checks,
        note: text(r.note) || base.note,
    }
}

function sectionsOf(raw, base) {
    const list = Array.isArray(raw)
        ? raw
              .filter((item) => item && typeof item === 'object' && text(item.title))
              .map((item) => ({
                  title: text(item.title),
                  shows: text(item.shows),
                  repeat: item.repeat === 'prompt' ? 'prompt' : null,
              }))
        : []
    return list.length ? list : base.sections.map((item) => ({ ...item }))
}

/** One template as the UI uses it, from a catalog item (or the fallback). */
export function normalizeTemplate(raw, { fallback = false } = {}) {
    const id = raw && typeof raw === 'object' ? raw.id : null
    if (!isReportTemplateKey(id)) return null
    const base = FALLBACK[id]
    const fields = Array.isArray(raw.header_fields) ? raw.header_fields.filter((f) => typeof f === 'string') : []
    const name = text(raw.name) || base.name
    // In the fallback availability is unknown: the server decides on send.
    // A reason without available: false still counts as unavailable.
    let unavailable = null
    if (!fallback && (raw.available === false || note(raw.unavailable))) {
        unavailable = note(raw.unavailable) || { code: '', message: `${name} isn't available on this workspace.` }
    }
    return {
        id,
        name,
        purpose: text(raw.purpose) || base.purpose,
        header_fields: fields.length ? fields : [...base.header_fields],
        sections: sectionsOf(raw.sections, base),
        requirements: requirementsOf(raw.requirements, base.requirements),
        available: !unavailable,
        unavailable,
        limitations: fallback ? [] : (Array.isArray(raw.limitations) ? raw.limitations : []).map(note).filter(Boolean),
        prompts: PROMPT_PICKS[id],
        checked: !fallback,
    }
}

/** The seven templates from the local copy, availability unknown. */
export function fallbackTemplates() {
    return REPORT_TEMPLATE_KEYS.map((id) => normalizeTemplate({ id, ...FALLBACK[id] }, { fallback: true }))
}

/**
 * The catalog's items as UI templates, in the catalog's order. Items with
 * a key the UI does not know are left out, and so is a second item with
 * the same key. Resolves to [] when nothing usable came back; the caller
 * then uses fallbackTemplates().
 */
export function templatesFromCatalog(items) {
    const list = Array.isArray(items) ? items : Array.isArray(items?.results) ? items.results : []
    const seen = new Set()
    const out = []
    for (const raw of list) {
        const t = normalizeTemplate(raw)
        if (!t || seen.has(t.id)) continue
        seen.add(t.id)
        out.push(t)
    }
    return out
}

/** A template by key from a list, else from the fallback; null for an unknown key. */
export function findTemplate(key, list = null) {
    if (!isReportTemplateKey(key)) return null
    const found = Array.isArray(list) ? list.find((t) => t && t.id === key) : null
    return found || fallbackTemplates().find((t) => t.id === key)
}

/**
 * Short labels for a card: what the template needs and whether it runs
 * new checks. Each is {key, label}.
 */
export function requirementBadges(template) {
    const r = template?.requirements
    if (!r) return []
    const out = []
    if (r.google === REQUIRED) out.push({ key: 'google', label: 'Needs Google results' })
    else if (r.google === OPTIONAL) out.push({ key: 'google', label: 'Google results if set up' })
    if (r.engines === REQUIRED || r.engines === OPTIONAL) out.push({ key: 'engines', label: 'Asks the AI engines' })
    else if (r.engines === SAVED) out.push({ key: 'engines', label: 'Saved engine answers' })
    if (r.research_agents) out.push({ key: 'research_agents', label: 'Research agents' })
    if (!r.runs_checks) out.push({ key: 'no_checks', label: 'No new checks' })
    return out
}

/** True when the template may ask the AI engines again (each answer is a prompt run). */
export function asksEngines(template) {
    const r = template?.requirements
    return Boolean(r && r.runs_checks && (r.engines === REQUIRED || r.engines === OPTIONAL))
}

/**
 * The free plan's line for a template that asks the engines:
 * "Each AI engine answer uses a free prompt run. 12 free prompt runs left."
 * '' for paid plans (unlimited), an unknown balance or a template that
 * asks no engine. `runs` is the status' prompt_runs block.
 */
export function promptRunsLine(template, runs) {
    if (!asksEngines(template) || !runs || runs.unlimited !== false) return ''
    const left = Number(runs.remaining)
    if (runs.remaining === null || runs.remaining === undefined || !Number.isFinite(left)) return ''
    const n = Math.max(0, Math.floor(left))
    if (n === 0) return "Each AI engine answer uses a free prompt run, and this month's are used up."
    return `Each AI engine answer uses a free prompt run. ${n} free prompt ${n === 1 ? 'run' : 'runs'} left.`
}

function listText(items) {
    const names = items.filter(Boolean)
    if (names.length <= 1) return names.join('')
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The message "Use template" drafts. values: brand (the project's name or
 * domain), prompts ([{text, location?}] or strings, cut to the template's
 * maximum), competitors ([{name, domain}]).
 */
export function draftText(key, values = {}) {
    if (!isReportTemplateKey(key)) return ''
    const v = values || {}
    const max = PROMPT_PICKS[key].max
    const prompts = (Array.isArray(v.prompts) ? v.prompts : [])
        .map((p) => (typeof p === 'string' ? p : p?.text))
        .map((p) => text(p))
        .filter(Boolean)
        .slice(0, max)
    const competitors = (Array.isArray(v.competitors) ? v.competitors : [])
        .map((c) => {
            const name = text(c?.name)
            const domain = text(c?.domain)
            if (name && domain && name.toLowerCase() !== domain.toLowerCase()) return `${name} (${domain})`
            return name || domain
        })
        .filter(Boolean)
        .slice(0, 3)
    const draft = DRAFTS[key]
    const list = prompts.map((p, i) => `${i + 1}. "${p}"`).join('\n')
    return fillTemplate(draft.text, {
        brand: text(v.brand) || 'this project',
        competitors: listText(competitors),
        prompt_list: list ? `${draft.intro}\n${list}` : '',
    })
}
